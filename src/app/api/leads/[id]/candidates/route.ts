import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// PDL candidate search + Claude scoring can take time
export const maxDuration = 45

const PDL_BASE_URL = 'https://api.peopledatalabs.com/v5'
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Extract core keywords from a role title for PDL search.
 * Strips seniority prefixes and noise words.
 */
/**
 * Extract the core function title from a role title by stripping leading seniority prefixes.
 * Returns the function phrase (e.g., "product manager", "structural engineer", "business analyst").
 *
 * IMPORTANT: We strip seniority PREFIXES only, not individual words throughout.
 * "Senior Product Manager" → "product manager" (not just "product")
 * "VP of Engineering" → "engineering"
 * "Director of Business Development" → "business development"
 *
 * The full function phrase is used with `match_phrase` so "product manager" matches
 * candidates with that exact phrase in their title — not "product designer" or "product marketing".
 */
function extractFunctionTitle(roleTitle: string): string {
  let title = roleTitle.toLowerCase().replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim()

  // Preserve known compound titles where the prefix IS part of the function
  const preserveTitles = [
    'executive assistant', 'executive director', 'chief of staff',
    'head coach', 'lead generation',
  ]
  for (const pt of preserveTitles) {
    if (title === pt) return title
  }

  // Strip leading seniority prefixes (greedy — removes multiple if stacked)
  const prefixes = [
    'senior', 'junior', 'lead', 'principal', 'staff', 'chief',
    'head', 'director', 'vp', 'vice president', 'vice', 'president',
    'sr', 'jr', 'executive',
  ]
  let changed = true
  while (changed) {
    changed = false
    for (const prefix of prefixes) {
      if (title.startsWith(prefix + ' ')) {
        title = title.slice(prefix.length).trim()
        changed = true
      }
    }
    // Also strip leading "of", "the", "and", "a"
    for (const filler of ['of', 'the', 'and', 'a']) {
      if (title.startsWith(filler + ' ')) {
        title = title.slice(filler.length).trim()
        changed = true
      }
    }
  }

  return title || roleTitle.toLowerCase()
}



/**
 * Calculate availability label based on activity signals.
 */
function calculateMatchLabel(candidate: Record<string, unknown>): string {
  if (candidate.linkedinOpenToWork) return 'WARM'
  if (candidate.linkedinProfileActivity) return 'WARM'

  const jobStartDate = candidate.jobStartDate as string | null
  if (jobStartDate) {
    const months = (Date.now() - new Date(jobStartDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (months <= 6) return 'WARM'
    if (months <= 18) return 'POSSIBLE'
  }

  return 'STRETCH'
}

/**
 * Extract searchable skill keywords from role context using Claude.
 * Returns domain-specific skill terms for PDL Elasticsearch `wildcard` queries.
 *
 * PDL's skills field is mapped as `keyword` (not `text`), so `match` queries don't work.
 * We use `wildcard` with *token* patterns — each extracted skill is split into tokens,
 * and each token becomes a `*token*` wildcard. "loyalty programs" → *loyalty* + *programs*.
 * This matches "loyalty", "loyalty programs", "customer loyalty", etc.
 *
 * Falls back to empty array on any failure — never blocks the search.
 * Cost: ~$0.005-0.01 per call (minimal prompt).
 */
async function extractSkillsFromContext(
  roleTitle: string,
  companyName: string,
  context: string
): Promise<string[]> {
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
  if (!CLAUDE_API_KEY || !context || context.trim().length < 30) return []

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250527',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `I'm searching for candidates on People Data Labs (PDL) using Elasticsearch match queries on their LinkedIn skills. I need 8-12 skill terms that will find the RIGHT candidates for this role.

PDL uses Elasticsearch — "match" queries tokenize, so "loyalty programs" will match candidates with "loyalty", "loyalty programs", or "customer loyalty" in their skills. This means I want SPECIFIC, MEANINGFUL terms, not exhaustive variants.

RULES:
- Focus on the CORE DOMAIN skills that distinguish a good match from a bad one
- Include both the function-specific terms (what makes THIS role unique) and technical skills (tools/methods)
- Prioritize specificity: "quick service restaurants" is better than "food" because it filters precisely
- Skip generic terms everyone has: "leadership", "management", "communication", "strategy", "teamwork"
- All lowercase
- 8-12 terms total

Role: ${roleTitle} at ${companyName}
Context: ${context.slice(0, 1000)}

Return ONLY a JSON array. Example for a QSR Product Manager, Loyalty:
["loyalty programs", "consumer products", "crm", "mobile applications", "digital marketing", "quick service restaurants", "product management", "customer engagement", "retention", "rewards"]`
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return []
    const data = await response.json()
    const text = data?.content?.[0]?.text?.trim()
    if (!text) return []

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return []

    const skills = JSON.parse(match[0])
    if (!Array.isArray(skills)) return []

    return skills
      .filter((s: unknown) => typeof s === 'string' && (s as string).length > 0 && (s as string).length < 50)
      .map((s: string) => s.toLowerCase().trim())
      .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i) // dedupe
      .slice(0, 12)
  } catch {
    return [] // Silent fallback — skill filtering is additive, not required
  }
}

/**
 * Score candidates against role context using Claude.
 * Returns 0-100 match scores based on skills fit, domain relevance, experience.
 * Falls back to keyword-overlap scoring on any failure.
 * Cost: ~$0.01-0.02 per call (short prompt + 3 candidates).
 */
async function scoreCandidatesWithClaude(
  roleTitle: string,
  companyName: string,
  context: string,
  candidates: Record<string, unknown>[]
): Promise<{ scores: Record<string, number>; skills: Record<string, string[]> }> {
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
  if (!CLAUDE_API_KEY || candidates.length === 0) return { scores: {}, skills: {} }

  try {
    const candidateSummaries = candidates.map((c, i) => {
      const parts = [`${i + 1}. ${c.fullName}: ${c.currentTitle} at ${c.currentCompany}`]
      if (c.industry) parts.push(`Industry: ${c.industry}`)
      parts.push(`Skills: ${(c.topSkills as string[])?.join(', ') || 'none listed'}`)
      parts.push(`${Math.floor(c.yearsExperience as number || 0)} yrs experience — ${c.location}`)
      if (c.education) parts.push(`Education: ${c.education}`)
      const prior = c.priorRoles as string[]
      if (prior?.length > 0) parts.push(`Prior: ${prior.join('; ')}`)
      return parts.join('\n   ')
    }).join('\n\n')

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250527',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `You are scoring candidates for a recruiting firm. Score each candidate's fit for this specific role on a 0-100 scale AND identify their 3-5 strongest matching skills/qualifications.

WHAT MATTERS MOST (in order):
1. Role function match — does their current title describe the SAME job function? "Product Manager" ≠ "Product Adoption Manager". "Software Engineer" ≠ "Sales Engineer". Title words overlapping is not enough.
2. Domain/industry relevance — do their skills and experience transfer to this role's domain? A PM from Shopify (e-commerce) is a great fit for loyalty at Tim Hortons (consumer/digital). A PM from a B2B SaaS analytics tool is a weaker fit.
3. Skills alignment — do their listed skills match what this role needs?
4. Seniority — appropriate level of experience for the role?

Scoring rubric:
- 90-100: Same job function + relevant domain + matching skills
- 75-89: Same job function + adjacent domain (skills transfer well)
- 60-74: Similar function but notable domain gaps OR right domain but different function
- Below 60: Different function or completely unrelated domain

Be harsh on function mismatches. "Product Adoption Manager" managing B2B onboarding is NOT the same function as "Product Manager, Loyalty & Offers" managing a consumer loyalty program.

For matched_skills: list 3-5 SHORT skill/qualification labels (2-4 words each) that explain WHY this candidate fits. Draw from their title, industry, skills, education, and prior roles. These appear as pills on the candidate card so keep them concise. Examples: "financial analysis", "capital markets", "cpa designation", "banking industry", "risk management".

Role: ${roleTitle} at ${companyName}
Context: ${context.slice(0, 800)}

Candidates:
${candidateSummaries}

Return ONLY a JSON object with "scores" and "matched_skills":
{"scores": {"1": 85, "2": 72, "3": 58}, "matched_skills": {"1": ["financial analysis", "banking", "cpa"], "2": ["accounting", "audit"], "3": ["data analysis"]}}`
        }],
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return { scores: {}, skills: {} }
    const data = await response.json()
    const text = data?.content?.[0]?.text?.trim()
    if (!text) return { scores: {}, skills: {} }

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return { scores: {}, skills: {} }

    const parsed = JSON.parse(match[0])

    // Handle both new format {"scores": {...}, "matched_skills": {...}} and legacy {"1": 85, "2": 72}
    const rawScores = parsed.scores || parsed
    const rawSkills = parsed.matched_skills || {}

    const scores: Record<string, number> = {}
    for (const [key, val] of Object.entries(rawScores)) {
      if (typeof val === 'number' && val >= 0 && val <= 100) {
        scores[key] = val
      }
    }

    const skills: Record<string, string[]> = {}
    for (const [key, val] of Object.entries(rawSkills)) {
      if (Array.isArray(val)) {
        skills[key] = (val as string[]).filter(s => typeof s === 'string').slice(0, 5)
      }
    }

    return { scores, skills }
  } catch {
    return { scores: {}, skills: {} } // Silent fallback — crude scoring used instead
  }
}

/**
 * POST /api/leads/[id]/candidates
 *
 * On-demand candidate search for a specific lead.
 * Calls PDL Person Search API, scores candidates, writes results to lead record.
 * Uses candidate cache to avoid duplicate PDL charges.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params
  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get('refresh') === 'true'
  const diagnoseMode = url.searchParams.get('diagnose') === 'true'

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 3 per user per 10 minutes
    const rl = rateLimit(`candidates:${user.id}`, { limit: 3, windowSeconds: 600 })
    if (!rl.allowed) {
      return NextResponse.json({
        error: 'Rate limited — 3 candidate searches per 10 minutes',
        remaining: rl.remaining,
        resetAt: new Date(rl.resetAt).toISOString(),
      }, { status: 429 })
    }

    const serviceClient = createServiceClient()
    if (!serviceClient) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
    }

    // Get user's client + tier
    const { data: userClient } = await serviceClient
      .from('user_clients')
      .select('client_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!userClient) {
      return NextResponse.json({ error: 'No client found' }, { status: 404 })
    }

    // Tier gate: check client tier
    const { data: client } = await serviceClient
      .from('clients')
      .select('tier')
      .eq('id', userClient.client_id)
      .single()

    if (!client || client.tier === 'starter') {
      return NextResponse.json({
        error: 'Candidate search requires Growth tier or above',
      }, { status: 403 })
    }

    // Get the lead — include JD + synthesis context for skill extraction + Claude scoring
    const { data: lead } = await serviceClient
      .from('leads')
      .select('id, role_title, location, company_name, client_id, seniority_tier, job_description, sales_talking_points, candidate_pitch_points, market_insight')
      .eq('id', leadId)
      .eq('client_id', userClient.client_id)
      .single()

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Check PDL API key
    const PDL_API_KEY = process.env.PDL_API_KEY
    if (!PDL_API_KEY) {
      return NextResponse.json({ error: 'Candidate search not configured' }, { status: 500 })
    }

    // Extract location parts for PDL query and post-query filter
    const cityName = (lead.location || '').split(/[\s,]+/)[0].toLowerCase()

    // Build metro area name for PDL location_metro filter (more reliable than location_locality)
    // PDL metros use format like "greater toronto area", "san francisco bay area"
    const metroMap: Record<string, string> = {
      toronto: 'greater toronto area',
      vancouver: 'greater vancouver',
      calgary: 'calgary, alberta',
      montreal: 'greater montreal area',
      ottawa: 'ottawa-gatineau',
    }
    const metroName = metroMap[cityName] || cityName

    // Map seniority tier to PDL levels
    const leadSeniority = (lead.seniority_tier || 'mid').toLowerCase()

    // Diagnostic mode — test each filter layer to pinpoint what's failing
    // Costs 0 credits (uses size:0 with total_count). Call with ?diagnose=true
    if (diagnoseMode) {
      const functionTitle = extractFunctionTitle(lead.role_title)
      const seniorityMap: Record<string, string[]> = {
        ic: ['senior', 'manager'], mid: ['senior', 'manager'],
        manager: ['manager', 'director'], senior: ['director', 'vp'],
        executive: ['vp', 'cxo'],
      }
      const seniorityValues = seniorityMap[leadSeniority] || ['senior', 'manager']

      // Test queries from broadest to most specific
      const tests: { name: string; query: Record<string, unknown> }[] = [
        {
          name: 'location_locality only',
          query: { bool: { must: [{ term: { location_locality: cityName } }] } },
        },
        {
          name: 'location_metro only',
          query: { bool: { must: [{ term: { location_metro: metroName } }] } },
        },
        {
          name: 'location_locality + function title (phrase)',
          query: { bool: { must: [
            { term: { location_locality: cityName } },
            { match_phrase: { 'job_title.text': functionTitle } },
          ] } },
        },
        {
          name: 'location_locality + function title (phrase) + seniority',
          query: { bool: { must: [
            { term: { location_locality: cityName } },
            { match_phrase: { 'job_title.text': functionTitle } },
            { terms: { job_title_levels: seniorityValues } },
          ] } },
        },
      ]

      const results: Record<string, unknown>[] = []
      for (const test of tests) {
        try {
          const r = await fetch(`${PDL_BASE_URL}/person/search`, {
            method: 'POST',
            headers: { 'X-Api-Key': PDL_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: test.query, size: 1, pretty: true }),
          })
          if (r.ok) {
            const d = await r.json()
            results.push({ test: test.name, status: r.status, total: d.total, returned: (d.data || []).length })
          } else {
            results.push({ test: test.name, status: r.status, total: 0 })
          }
        } catch (e) {
          results.push({ test: test.name, error: String(e) })
        }
      }

      return NextResponse.json({
        diagnose: true,
        lead: { role: lead.role_title, location: lead.location, seniority: leadSeniority },
        parsed: { city: cityName, metro: metroName, functionTitle },
        results,
      })
    }

    // Check candidate cache first
    const cacheKey = [
      lead.role_title.toLowerCase().trim(),
      cityName,
      leadSeniority,
    ].join('|')

    const { data: cached } = await serviceClient
      .from('candidate_cache')
      .select('candidates, created_at')
      .eq('cache_key', cacheKey)
      .single()

    let candidates: Record<string, unknown>[] = []
    let fromCache = false

    if (cached && cached.candidates && !forceRefresh) {
      // Check TTL (30 days)
      const age = Date.now() - new Date(cached.created_at).getTime()
      const ttlMs = 30 * 24 * 60 * 60 * 1000
      if (age < ttlMs) {
        const cachedCandidates = cached.candidates as Record<string, unknown>[]
        // Invalidate cache entries that lack location data (pre-filter era)
        const hasLocationData = cachedCandidates.length === 0 || cachedCandidates.some(c => c.location && c.location !== 'Unknown')
        if (hasLocationData) {
          candidates = cachedCandidates
          fromCache = true
        }
      }
    }

    if (!fromCache) {
      // Build PDL Elasticsearch query with skills matching.
      //
      // IMPORTANT — location_metro is US-ONLY (PDL canonical list has zero Canadian cities).
      // For Canadian cities (Toronto, Vancouver, Calgary, etc.), we MUST use location_locality.
      // PDL returns all text as lowercase by default, so `term` with lowercase values works.
      // Extract domain-specific skills from job description (gold standard) or synthesis context
      const roleContext = lead.job_description
        || [lead.sales_talking_points, lead.candidate_pitch_points].filter(Boolean).join(' ')
      const extractedSkills = await extractSkillsFromContext(lead.role_title, lead.company_name, roleContext)

      // US metros list (PDL canonical) — only these cities have location_metro data
      const usMetros = new Set([
        'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
        'san antonio', 'san diego', 'dallas', 'san francisco', 'austin', 'seattle',
        'denver', 'boston', 'detroit', 'miami', 'atlanta', 'minneapolis', 'tampa',
        'portland', 'nashville', 'raleigh', 'charlotte', 'pittsburgh', 'cleveland',
        'orlando', 'indianapolis', 'columbus', 'salt lake city', 'san jose',
      ])
      const isUSMetro = usMetros.has(cityName)

      // Location clause — use location_metro for US cities, location_locality for all others
      const locationClause = isUSMetro && metroName !== cityName
        ? { term: { location_metro: metroName } }
        : { term: { location_locality: cityName } }

      // Required filters: title keywords + location + seniority
      // IMPORTANT: job_title is a keyword field — `match` on keyword = exact match only.
      // Must use the `.text` subfield for analyzed/tokenized full-text search.
      //
      // Title strategy: `match_phrase` with the full function title.
      // "product manager" matches candidates whose title contains that exact phrase in order.
      // This prevents "product designer", "product marketing manager" etc. from matching.
      // Much more precise than `match` which uses OR on individual tokens.
      const functionTitle = extractFunctionTitle(lead.role_title)
      const mustClauses: Record<string, unknown>[] = [
        { match_phrase: { 'job_title.text': functionTitle } },
        locationClause,
      ]

      // Seniority — map to PDL values
      const seniorityMap: Record<string, string[]> = {
        ic: ['senior', 'manager'],
        mid: ['senior', 'manager'],
        manager: ['manager', 'director'],
        senior: ['director', 'vp'],
        executive: ['vp', 'cxo'],
      }
      const seniorityValues = seniorityMap[leadSeniority] || ['senior', 'manager']
      mustClauses.push({ terms: { job_title_levels: seniorityValues } })

      // Build query — skills go in `should` for relevance boosting
      const esQuery: Record<string, unknown> = {
        bool: { must: mustClauses }
      }

      // Skills matching — two layers for precision + recall:
      // 1. `term` with full skill phrases (exact match on keyword array — highest signal)
      //    "loyalty programs" matches candidates who have exactly "loyalty programs" in their skills
      // 2. `wildcard` on distinctive domain tokens as fallback (catches partial overlaps)
      //    Skip generic tokens that match everyone: "management", "analysis", "development", etc.
      const hasSkills = extractedSkills.length > 0
      if (hasSkills) {
        const genericTokens = new Set([
          'management', 'analysis', 'development', 'planning', 'operations',
          'services', 'solutions', 'systems', 'support', 'design', 'research',
          'marketing', 'sales', 'training', 'programs', 'projects', 'consulting',
          'implementation', 'administration', 'coordination', 'processing',
        ])
        // Layer 1: exact phrase matches (high precision)
        const termClauses = extractedSkills.map(s => ({ term: { skills: s.toLowerCase() } }))
        // Layer 2: distinctive domain tokens only (skip generic noise)
        const domainTokens = [...new Set(
          extractedSkills
            .flatMap(s => s.toLowerCase().split(/\s+/))
            .filter(t => t.length > 3 && !genericTokens.has(t))
        )].slice(0, 8)
        const wildcardClauses = domainTokens.map(t => ({ wildcard: { skills: `*${t}*` } }))

        // Skills go in `should` WITHOUT minimum_should_match — they RANK, not filter.
        // PDL returns top results by relevance, so candidates with more skill matches
        // naturally rank higher. A hard gate (minimum_should_match) was killing results
        // because PDL's keyword skills array needs exact matches or specific wildcards.
        ;(esQuery.bool as Record<string, unknown>).should = [...termClauses, ...wildcardClauses]
      }

      console.log('[Candidates] PDL query:', JSON.stringify(esQuery))
      console.log('[Candidates] Location strategy:', isUSMetro ? 'metro' : 'locality', '| city:', cityName, '| skills:', extractedSkills.length)

      // Call PDL
      let pdlResponse
      let people: Record<string, unknown>[] = []
      try {
        pdlResponse = await fetch(`${PDL_BASE_URL}/person/search`, {
          method: 'POST',
          headers: {
            'X-Api-Key': PDL_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: esQuery, size: 3, pretty: true }),
        })
      } catch {
        return NextResponse.json({ error: 'PDL API request failed' }, { status: 502 })
      }

      // PDL returns 404 when zero records match — treat as empty, not error
      if (!pdlResponse.ok && pdlResponse.status !== 404) {
        if (pdlResponse.status === 402) {
          return NextResponse.json({
            error: 'credits_exhausted',
            message: 'PDL credits exhausted — resets with your next billing cycle',
          }, { status: 402 })
        }
        const pdlError = await pdlResponse.json().catch(() => ({}))
        console.error('[PDL] Search failed:', pdlResponse.status, JSON.stringify(pdlError))
        return NextResponse.json({
          error: 'PDL search failed',
          status: pdlResponse.status,
          detail: pdlError?.error?.message || pdlError?.message || JSON.stringify(pdlError),
        }, { status: 502 })
      }

      if (pdlResponse.ok) {
        const pdlData = await pdlResponse.json()
        people = pdlData.data || []
        console.log(`[Candidates] PDL returned ${people.length} results`)
      }

      // Transform PDL response
      candidates = people.map((person: Record<string, unknown>) => {
        const experience = (person.experience as Record<string, unknown>[]) || []
        const currentExp = experience.find((e: Record<string, unknown>) => e.is_primary) || experience[0] || null

        // Resolve candidate location — check multiple PDL fields for best coverage
        let candidateLocation = 'Unknown'
        const expCompany = currentExp?.company as Record<string, unknown> | null
        const expLoc = expCompany?.location as Record<string, unknown> | null
        if (expLoc?.name && typeof expLoc.name === 'string') {
          candidateLocation = expLoc.name
        } else if (person.location_metro && typeof person.location_metro === 'string') {
          candidateLocation = person.location_metro as string
        } else {
          const parts = [person.location_locality, person.location_region, person.location_country]
            .filter(v => typeof v === 'string' && (v as string).length > 0)
          if (parts.length > 0) candidateLocation = parts.join(', ')
        }

        // Calculate years of experience from job start date
        const jobStart = (person.job_start_date || currentExp?.start_date || null) as string | null
        let yearsExperience = 0
        if (jobStart) {
          yearsExperience = (Date.now() - new Date(jobStart).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        }

        // Education — pull degree + school for scoring context
        const education = (person.education as Record<string, unknown>[]) || []
        const topDegree = education[0] as Record<string, unknown> | undefined
        const degrees = topDegree?.degrees as string[] | undefined
        const school = topDegree?.school as Record<string, unknown> | undefined
        const degreeStr = topDegree
          ? [degrees?.[0], school?.name].filter(Boolean).join(' from ')
          : ''

        // Industry from current company
        const companyIndustry = person.industry || (expCompany?.industry as string) || ''

        // Prior roles — last 2 positions for career trajectory
        const priorRoles = experience.slice(1, 3).map((e: Record<string, unknown>) => {
          const title = (e.title as Record<string, unknown>)?.name || ''
          const co = (e.company as Record<string, unknown>)?.name || ''
          return title && co ? `${title} at ${co}` : title || co
        }).filter(Boolean)

        return {
          fullName: person.full_name || 'Unknown',
          currentTitle: person.job_title || (currentExp?.title as Record<string, unknown>)?.name || '',
          currentCompany: person.job_company_name || (currentExp?.company as Record<string, unknown>)?.name || '',
          location: candidateLocation,
          linkedinUrl: person.linkedin_url || '',
          topSkills: (person.skills as string[])?.slice(0, 10) || [],
          jobStartDate: jobStart,
          yearsExperience: Math.round(yearsExperience * 10) / 10,
          industry: companyIndustry,
          education: degreeStr,
          priorRoles,
          matchLabel: '',
        }
      })

      // Diagnostic: log PDL skills data per candidate (visible in Vercel function logs)
      candidates.forEach((c, i) => {
        const skills = (c.topSkills as string[]) || []
        console.log(`[Candidates] #${i + 1} ${c.fullName}: ${skills.length} skills from PDL${skills.length > 0 ? ` — ${skills.slice(0, 5).join(', ')}` : ' — EMPTY'}`)
      })

      // Compute matched skills — cross-reference candidate skills against extracted JD skills
      // Uses token overlap so "loyalty programs" matches a candidate with "loyalty" or "programs" in any skill
      candidates = candidates.map(c => {
        const candidateSkills = (c.topSkills as string[]) || []
        const candidateSkillsLower = candidateSkills.map(s => (s as string).toLowerCase())
        const matched = extractedSkills.filter(extracted => {
          const tokens = extracted.toLowerCase().split(/\s+/)
          return tokens.some(token =>
            token.length > 2 && candidateSkillsLower.some(cs => cs.includes(token))
          )
        })
        return { ...c, matchedSkills: [...new Set(matched)].slice(0, 5) }
      })

      // Score with availability labels
      candidates = candidates.map(c => ({
        ...c,
        matchLabel: calculateMatchLabel(c),
      }))

      // Sort: WARM > POSSIBLE > STRETCH
      const priority: Record<string, number> = { WARM: 0, POSSIBLE: 1, STRETCH: 2 }
      candidates.sort((a, b) =>
        (priority[a.matchLabel as string] || 2) - (priority[b.matchLabel as string] || 2)
      )

      // Cache results (only if we got candidates)
      if (candidates.length > 0) {
        await serviceClient
          .from('candidate_cache')
          .upsert({
            cache_key: cacheKey,
            candidates,
            created_at: new Date().toISOString(),
          }, { onConflict: 'cache_key' })
          .then(() => {}) // fire and forget
      }
    }

    // Location filter removed — PDL's query already filters by location_locality
    // or location_metro. A post-query string filter was too aggressive: candidates
    // in suburbs (Mississauga, North York) or with region-only location data
    // (Ontario, Canada) were being stripped even though PDL matched them geo-wise.
    // PDL's Elasticsearch handles the geo filtering; Claude scoring handles quality.

    // Claude-powered match scoring + matched skills — replaces crude keyword overlap
    // Uses job description (gold standard) or synthesis context for domain-aware scoring
    // Claude also returns 3-5 matched skills per candidate (why they fit the role)
    // Falls back to keyword overlap if Claude call fails — never blocks
    let top3 = candidates.slice(0, 3)
    const scoringContext = lead.job_description
      || [lead.sales_talking_points, lead.candidate_pitch_points, lead.market_insight].filter(Boolean).join(' ')
    const { scores: claudeScores, skills: claudeSkills } = await scoreCandidatesWithClaude(lead.role_title, lead.company_name, scoringContext, top3)
    let usedClaudeScoring = Object.keys(claudeScores).length > 0

    // Re-sort by match score so rank 1 = best skills fit (not just most available)
    if (usedClaudeScoring) {
      top3 = top3.map((c, i) => {
        const idx = String(i + 1)
        // Merge Claude's matched skills with PDL-based ones (Claude takes priority — always has data)
        const claudeMatchedSkills = claudeSkills[idx] || []
        const pdlMatchedSkills = (c.matchedSkills as string[]) || []
        // Combine: Claude skills first, then PDL-only skills, deduplicated
        const allSkills = [...claudeMatchedSkills]
        for (const s of pdlMatchedSkills) {
          if (!allSkills.some(cs => cs.toLowerCase() === s.toLowerCase())) {
            allSkills.push(s)
          }
        }
        return {
          ...c,
          _score: claudeScores[idx] ?? 0,
          matchedSkills: allSkills.slice(0, 5),
        }
      })
      top3.sort((a, b) => ((b as Record<string, unknown>)._score as number) - ((a as Record<string, unknown>)._score as number))
    }

    // Write candidate data to the lead record
    const updateData: Record<string, unknown> = {}
    for (let i = 0; i < 3; i++) {
      const c = top3[i]
      const n = i + 1
      if (c) {
        updateData[`candidate_${n}_name`] = c.fullName
        updateData[`candidate_${n}_url`] = c.linkedinUrl || null

        // Build headline matching pipeline format: "Yrs · title · location"
        const parts: string[] = []
        if (c.yearsExperience) {
          const yrs = Math.floor(c.yearsExperience as number)
          if (yrs > 0) parts.push(`${yrs}+ yrs`)
        }
        if (c.currentTitle) parts.push((c.currentTitle as string).toLowerCase())
        if (c.location && c.location !== 'Unknown') {
          const locCity = (c.location as string).split(',')[0].trim().toLowerCase()
          parts.push(locCity)
        }
        updateData[`candidate_${n}_headline`] = parts.length > 0 ? parts.join(' · ') : `${c.currentTitle} at ${c.currentCompany}`

        updateData[`candidate_${n}_signal`] = c.matchLabel
        updateData[`candidate_${n}_matched_skills`] = (c.matchedSkills as string[])?.join(', ') || null

        // Use Claude score if available (carried on _score after re-sort), fall back to keyword overlap
        const claudeScore = (c as Record<string, unknown>)._score as number | undefined
        if (usedClaudeScoring && claudeScore !== undefined && claudeScore > 0) {
          updateData[`candidate_${n}_match_score`] = claudeScore
        } else {
          // Fallback: simple keyword overlap (same as before)
          usedClaudeScoring = false
          const roleWords = new Set(lead.role_title.toLowerCase().split(/\s+/))
          const titleWords = (c.currentTitle as string || '').toLowerCase().split(/\s+/)
          const overlap = titleWords.filter((w: string) => roleWords.has(w)).length
          const score = Math.min(95, Math.round((overlap / Math.max(roleWords.size, 1)) * 80) + 15)
          updateData[`candidate_${n}_match_score`] = score
        }
      } else {
        updateData[`candidate_${n}_name`] = null
        updateData[`candidate_${n}_url`] = null
        updateData[`candidate_${n}_headline`] = null
        updateData[`candidate_${n}_signal`] = null
        updateData[`candidate_${n}_match_score`] = null
        updateData[`candidate_${n}_matched_skills`] = null
      }
    }

    await serviceClient
      .from('leads')
      .update(updateData)
      .eq('id', leadId)

    // Track costs
    const costInserts: Record<string, unknown>[] = []
    if (!fromCache && candidates.length > 0) {
      costInserts.push({
        client_id: userClient.client_id,
        service: 'pdl',
        credits: candidates.length,
        cost_usd: candidates.length * 0.28,
        description: `On-demand candidate search: ${lead.role_title} in ${lead.location}`,
      })
    }
    if (usedClaudeScoring) {
      costInserts.push({
        client_id: userClient.client_id,
        service: 'claude',
        credits: 1,
        cost_usd: 0.02,
        description: `Candidate scoring: ${lead.role_title} (${top3.length} candidates)`,
      })
    }
    if (costInserts.length > 0) {
      await serviceClient
        .from('api_usage')
        .insert(costInserts)
        .then(() => {})
    }

    // Build rich headlines for API response (same format as DB write)
    const responseTop3 = top3.map((c) => {
      const parts: string[] = []
      if (c.yearsExperience) {
        const yrs = Math.floor(c.yearsExperience as number)
        if (yrs > 0) parts.push(`${yrs}+ yrs`)
      }
      if (c.currentTitle) parts.push((c.currentTitle as string).toLowerCase())
      if (c.location && c.location !== 'Unknown') {
        const locCity = (c.location as string).split(',')[0].trim().toLowerCase()
        parts.push(locCity)
      }
      const richHeadline = parts.length > 0 ? parts.join(' · ') : `${c.currentTitle} at ${c.currentCompany}`
      const claudeScore = (c as Record<string, unknown>)._score as number | undefined
      return {
        name: c.fullName,
        url: c.linkedinUrl,
        headline: richHeadline,
        signal: c.matchLabel,
        skills: c.topSkills,
        score: claudeScore ?? null,
        matchedSkills: (c.matchedSkills as string[])?.join(', ') || null,
      }
    })

    return NextResponse.json({
      candidates: responseTop3,
      fromCache,
      creditsUsed: fromCache ? 0 : candidates.length,
      remaining: rl.remaining,
      // Debug info — helps diagnose empty results without Vercel logs
      debug: {
        functionTitle: extractFunctionTitle(lead.role_title),
        location: { city: cityName, metro: metroName },
        seniority: leadSeniority,
        totalBeforeFilter: candidates.length,
      },
    })

  } catch (err) {
    console.error('Candidate search error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
