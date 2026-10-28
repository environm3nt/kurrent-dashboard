import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// Vercel serverless function timeout — Claude synthesis + PDFMonkey polling
export const maxDuration = 120

/**
 * Industry → role mappings used for Claude's qualitative market assessment.
 */
const INDUSTRY_ROLES: Record<string, string[]> = {
  'Healthcare': ['Registered Nurse', 'Pharmacist', 'Physiotherapist', 'Nurse Practitioner', 'Personal Support Worker', 'Occupational Therapist'],
  'Finance': ['Accountant', 'Financial Analyst', 'Controller', 'Bookkeeper', 'Payroll Administrator', 'Senior Accountant'],
  'Legal': ['Paralegal', 'Legal Assistant', 'Compliance Officer', 'Law Clerk', 'Lawyer', 'Legal Counsel'],
  'Technology': ['Software Engineer', 'DevOps Engineer', 'Data Analyst', 'Product Manager', 'Full Stack Developer', 'Cloud Architect'],
  'Engineering': ['Mechanical Engineer', 'Civil Engineer', 'Electrical Engineer', 'Project Engineer', 'Environmental Engineer', 'Structural Engineer'],
  'Construction': ['Project Manager', 'Site Superintendent', 'Safety Officer', 'Construction Estimator', 'Crane Operator', 'Quantity Surveyor'],
  'Sales': ['Account Executive', 'Business Development Manager', 'Sales Manager', 'Inside Sales Representative', 'Customer Success Manager', 'Key Account Manager'],
  'Marketing': ['Marketing Manager', 'Digital Marketing Specialist', 'Content Writer', 'SEO Specialist', 'Brand Manager', 'Social Media Manager'],
  'Human Resources': ['HR Manager', 'Recruiter', 'HR Coordinator', 'Talent Acquisition Specialist', 'Compensation Analyst', 'HRIS Analyst'],
  'Administrative': ['Executive Assistant', 'Office Manager', 'Receptionist', 'Administrative Assistant', 'Data Entry Clerk', 'Operations Coordinator'],
  'Supply Chain': ['Supply Chain Manager', 'Logistics Coordinator', 'Procurement Specialist', 'Warehouse Manager', 'Inventory Analyst', 'Purchasing Agent'],
  'Trades': ['Electrician', 'Plumber', 'HVAC Technician', 'Millwright', 'Welder', 'Industrial Mechanic'],
  'Education': ['Teacher', 'Educational Assistant', 'School Administrator', 'Guidance Counsellor', 'Special Education Teacher', 'Tutor'],
  'Hospitality': ['Chef', 'Hotel Manager', 'Restaurant Manager', 'Event Coordinator', 'Food Service Supervisor', 'Bartender'],
  'Insurance': ['Insurance Underwriter', 'Claims Adjuster', 'Insurance Broker', 'Risk Analyst', 'Actuary', 'Insurance Account Manager'],
  'Executive': ['Chief Financial Officer', 'Chief Operating Officer', 'VP Operations', 'VP Sales', 'Director of Engineering', 'General Manager'],
  'Consulting': ['Management Consultant', 'Strategy Consultant', 'IT Consultant', 'Business Analyst', 'Change Management Consultant', 'ERP Consultant'],
  'Retail': ['Store Manager', 'Retail Sales Associate', 'Visual Merchandiser', 'District Manager', 'Loss Prevention Specialist', 'Buyer'],
  'Transportation': ['Truck Driver', 'Dispatch Coordinator', 'Fleet Manager', 'Freight Broker', 'Logistics Analyst', 'Transportation Planner'],
  'Government': ['Policy Analyst', 'Program Officer', 'Municipal Planner', 'Bylaw Officer', 'Public Health Inspector', 'Economic Development Officer'],
  'Media': ['Graphic Designer', 'Video Editor', 'Journalist', 'UX Designer', 'Production Coordinator', 'Copywriter'],
  'Manufacturing': ['Production Manager', 'Quality Assurance Manager', 'Plant Manager', 'Manufacturing Engineer', 'Process Improvement Specialist', 'Maintenance Manager'],
  'Food & Beverage': ['Food Safety Manager', 'Production Supervisor', 'Quality Control Technician', 'Plant Manager', 'R&D Food Scientist', 'Supply Chain Coordinator'],
  'Distribution': ['Distribution Manager', 'Warehouse Supervisor', 'Logistics Manager', 'Inventory Control Specialist', 'Fleet Coordinator', 'Operations Manager'],
  'Real Estate': ['Property Manager', 'Real Estate Agent', 'Leasing Manager', 'Real Estate Analyst', 'Mortgage Specialist', 'Commercial Real Estate Broker'],
  'Real Estate Development': ['Development Manager', 'Project Director', 'Land Acquisition Analyst', 'Construction Project Manager', 'Planning Coordinator', 'Development Analyst'],
  'Pharmaceutical': ['Regulatory Affairs Specialist', 'Clinical Research Associate', 'Quality Assurance Manager', 'Medical Science Liaison', 'Pharmacovigilance Specialist', 'Drug Safety Associate'],
  'Environmental': ['Environmental Scientist', 'Environmental Compliance Officer', 'Sustainability Manager', 'Environmental Engineer', 'EHS Specialist', 'Remediation Specialist'],
  'Agriculture': ['Farm Manager', 'Agronomist', 'Agricultural Technician', 'Crop Specialist', 'Food Safety Inspector', 'Agricultural Sales Representative'],
  'Mining & Natural Resources': ['Mine Engineer', 'Geologist', 'Health & Safety Coordinator', 'Heavy Equipment Operator', 'Metallurgist', 'Environmental Reclamation Specialist'],
  'Energy & Utilities': ['Power Plant Operator', 'Energy Analyst', 'Electrical Technician', 'Renewable Energy Engineer', 'Pipeline Engineer', 'Utility Project Manager'],
  'Telecommunications': ['Network Engineer', 'Telecom Technician', 'RF Engineer', 'Solutions Architect', 'Field Service Technician', 'Telecom Project Manager'],
  'Nonprofit & Social Services': ['Program Manager', 'Social Worker', 'Community Outreach Coordinator', 'Fundraising Manager', 'Case Manager', 'Grant Writer'],
  'Aerospace & Defence': ['Aerospace Engineer', 'Systems Engineer', 'Avionics Technician', 'Quality Inspector', 'Program Manager', 'Flight Test Engineer'],
  'Automotive': ['Automotive Technician', 'Service Manager', 'Parts Manager', 'Body Shop Manager', 'Automotive Engineer', 'Dealership General Manager'],
  'Banking': ['Branch Manager', 'Commercial Lender', 'Credit Analyst', 'Relationship Manager', 'Compliance Analyst', 'Investment Advisor'],
  'Life Sciences': ['Research Scientist', 'Biotech Engineer', 'Clinical Trials Manager', 'Lab Technician', 'Regulatory Compliance Specialist', 'Medical Device Specialist'],
  'Property Management': ['Property Administrator', 'Building Manager', 'Maintenance Supervisor', 'Tenant Relations Coordinator', 'Facilities Manager', 'Leasing Agent'],
}

const PDFMONKEY_BASE_URL = 'https://api.pdfmonkey.io/api/v1'
const INDUSTRY_BRIEF_TEMPLATE_ID = process.env.INDUSTRY_BRIEF_TEMPLATE_ID


/**
 * Query leads table for real pipeline data matching industry + location.
 * Returns aggregated market intelligence from monitored employer postings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryPipelineData(
  serviceClient: any,
  clientId: string,
  industry: string,
  location: string,
): Promise<{
  hasData: boolean
  leadCount: number
  companies: Array<{ name: string; postings: number; topRole: string; headcount: string | null }>
  roleCounts: Array<{ title: string; count: number; salaryRange: string | null }>
  salaryRanges: string[]
  avgTimeToFill: string | null
  recentPostingDays: number
  dataWarning: string | null
}> {
  if (!serviceClient) {
    return { hasData: false, leadCount: 0, companies: [], roleCounts: [], salaryRanges: [], avgTimeToFill: null, recentPostingDays: 0, dataWarning: 'Service client unavailable' }
  }

  // Query leads from the last 30 days for this client, matching industry + location loosely
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  interface PipelineLead {
    company_name: string
    role_title: string
    salary_range: string | null
    company_headcount: string | null
    time_to_fill_estimate: string | null
    location: string | null
    industry: string | null
    date_identified: string
    competing_postings: string | null
    talent_availability: string | null
  }

  const { data: leads, error } = await serviceClient
    .from('leads')
    .select('company_name, role_title, salary_range, company_headcount, time_to_fill_estimate, location, industry, date_identified, competing_postings, talent_availability')
    .eq('client_id', clientId)
    .gte('date_identified', thirtyDaysAgo)
    .not('status', 'eq', 'Archived') as { data: PipelineLead[] | null; error: any }

  if (error || !leads) {
    console.warn('[Industry-Brief] Pipeline data query failed:', error?.message)
    return { hasData: false, leadCount: 0, companies: [], roleCounts: [], salaryRanges: [], avgTimeToFill: null, recentPostingDays: 0, dataWarning: 'Pipeline data unavailable' }
  }

  // Filter by industry (case-insensitive partial match) and location
  const locationLower = location.toLowerCase()
  const industryLower = industry.toLowerCase()
  const filtered = leads.filter(l => {
    const matchesLocation = l.location && l.location.toLowerCase().includes(locationLower.split(',')[0].split(' ')[0])
    const matchesIndustry = l.industry && l.industry.toLowerCase().includes(industryLower.split(' ')[0])
    // Also match by role titles from the INDUSTRY_ROLES mapping
    const industryRoles = (INDUSTRY_ROLES[industry] || []).map(r => r.toLowerCase())
    const matchesRole = industryRoles.some(r => l.role_title.toLowerCase().includes(r.split(' ')[0]))
    return matchesLocation && (matchesIndustry || matchesRole)
  })

  if (filtered.length === 0) {
    // Try broader match — just location, any industry
    const broadFiltered = leads.filter(l =>
      l.location && l.location.toLowerCase().includes(locationLower.split(',')[0].split(' ')[0])
    )
    if (broadFiltered.length < 5) {
      return { hasData: false, leadCount: 0, companies: [], roleCounts: [], salaryRanges: [], avgTimeToFill: null, recentPostingDays: 0, dataWarning: `Limited pipeline data for ${industry} in ${location} — brief supplemented with market estimates.` }
    }
  }

  const matchedLeads = filtered.length > 0 ? filtered : leads.filter(l =>
    l.location && l.location.toLowerCase().includes(locationLower.split(',')[0].split(' ')[0])
  )

  // Aggregate companies
  const companyMap = new Map<string, { postings: number; roles: Map<string, number>; headcount: string | null }>()
  for (const l of matchedLeads) {
    const existing = companyMap.get(l.company_name) || { postings: 0, roles: new Map(), headcount: null }
    existing.postings++
    existing.roles.set(l.role_title, (existing.roles.get(l.role_title) || 0) + 1)
    if (l.company_headcount) existing.headcount = l.company_headcount
    companyMap.set(l.company_name, existing)
  }

  const companies = Array.from(companyMap.entries())
    .map(([name, data]) => {
      const topRole = Array.from(data.roles.entries()).sort((a, b) => b[1] - a[1])[0]
      return { name, postings: data.postings, topRole: topRole?.[0] || '', headcount: data.headcount }
    })
    .sort((a, b) => b.postings - a.postings)
    .slice(0, 8)

  // Aggregate roles
  const roleMap = new Map<string, { count: number; salaries: string[] }>()
  for (const l of matchedLeads) {
    const existing = roleMap.get(l.role_title) || { count: 0, salaries: [] }
    existing.count++
    if (l.salary_range) existing.salaries.push(l.salary_range)
    roleMap.set(l.role_title, existing)
  }

  const roleCounts = Array.from(roleMap.entries())
    .map(([title, data]) => ({ title, count: data.count, salaryRange: data.salaries[0] || null }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Collect salary ranges and time-to-fill
  const salaryRanges = matchedLeads.map(l => l.salary_range).filter(Boolean) as string[]
  const timeToFills = matchedLeads.map(l => l.time_to_fill_estimate).filter(Boolean) as string[]
  const avgTimeToFill = timeToFills[0] || null

  // How recent is the data
  const dates = matchedLeads.map(l => new Date(l.date_identified).getTime())
  const mostRecent = dates.length > 0 ? Math.max(...dates) : 0
  const recentPostingDays = mostRecent > 0 ? Math.ceil((Date.now() - mostRecent) / (24 * 60 * 60 * 1000)) : 0

  const dataWarning = matchedLeads.length < 5
    ? `Limited pipeline data for ${industry} in ${location} — brief supplemented with market estimates.`
    : null

  console.log(`[Industry-Brief] Pipeline data: ${matchedLeads.length} leads, ${companies.length} companies, ${roleCounts.length} roles${dataWarning ? ' (WARNING: thin data)' : ''}`)

  return {
    hasData: matchedLeads.length >= 5,
    leadCount: matchedLeads.length,
    companies,
    roleCounts,
    salaryRanges,
    avgTimeToFill,
    recentPostingDays,
    dataWarning,
  }
}


/**
 * Enrich the target company via Apollo API — with two cache layers.
 * Layer 1: Check if the company already appears in our leads table (free).
 * Layer 2: Check company_cache table (free, 30-day TTL).
 * Layer 3: Hit Apollo API (1 credit, ~$0.08).
 */
interface CompanyIntel {
  name: string
  domain: string | null
  headcount: string | null
  industry: string | null
  description: string | null
  foundedYear: number | null
  annualRevenue: string | null
  source: 'leads_table' | 'cache' | 'apollo' | 'none'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichTargetCompany(
  serviceClient: any,
  clientId: string,
  companyName: string,
): Promise<CompanyIntel> {
  const empty: CompanyIntel = { name: companyName, domain: null, headcount: null, industry: null, description: null, foundedYear: null, annualRevenue: null, source: 'none' }

  // --- Layer 1: Check leads table (free — already scraped by pipeline) ---
  try {
    const { data: existingLeads } = await serviceClient
      .from('leads')
      .select('company_name, company_headcount, industry, company_domain')
      .eq('client_id', clientId)
      .ilike('company_name', `%${companyName.split(' ')[0]}%`)
      .limit(5)

    if (existingLeads && existingLeads.length > 0) {
      const lead = existingLeads[0]
      console.log(`[Industry-Brief] Company intel from leads table: ${lead.company_name}`)
      return {
        name: lead.company_name,
        domain: lead.company_domain || null,
        headcount: lead.company_headcount || null,
        industry: lead.industry || null,
        description: null,
        foundedYear: null,
        annualRevenue: null,
        source: 'leads_table',
      }
    }
  } catch (e) {
    console.warn('[Industry-Brief] Leads table lookup failed:', e)
  }

  // --- Layer 2: Check company_cache (free, 30-day TTL) ---
  const cacheKey = companyName.toLowerCase().trim()
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: cached } = await serviceClient
      .from('company_cache')
      .select('*')
      .eq('company_name', cacheKey)
      .gte('created_at', thirtyDaysAgo)
      .limit(1)

    if (cached && cached.length > 0) {
      const c = cached[0]
      console.log(`[Industry-Brief] Company intel from cache: ${companyName}`)
      return {
        name: companyName,
        domain: c.domain,
        headcount: c.headcount,
        industry: c.industry,
        description: c.short_description,
        foundedYear: c.founded_year,
        annualRevenue: c.annual_revenue,
        source: 'cache',
      }
    }
  } catch (e) {
    console.warn('[Industry-Brief] Cache lookup failed:', e)
  }

  // --- Layer 3: Apollo API (1 credit) ---
  const apolloKey = process.env.APOLLO_API_KEY
  if (!apolloKey) {
    console.warn('[Industry-Brief] APOLLO_API_KEY not set — skipping company enrichment')
    return empty
  }

  try {
    console.log(`[Industry-Brief] Apollo lookup for: ${companyName}`)
    const res = await fetch('https://api.apollo.io/api/v1/organizations/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apolloKey,
        q_organization_name: companyName,
        page: 1,
        per_page: 1,
      }),
    })

    if (!res.ok) {
      console.error(`[Industry-Brief] Apollo API error: ${res.status}`)
      return empty
    }

    const data = await res.json()
    const org = data.organizations?.[0]
    if (!org) {
      console.log(`[Industry-Brief] Apollo found no match for: ${companyName}`)
      return empty
    }

    const intel: CompanyIntel = {
      name: org.name || companyName,
      domain: org.primary_domain || null,
      headcount: org.estimated_num_employees ? String(org.estimated_num_employees) : null,
      industry: org.industry || null,
      description: org.short_description || null,
      foundedYear: org.founded_year || null,
      annualRevenue: org.annual_revenue_printed || null,
      source: 'apollo',
    }

    // Cache the result
    try {
      await serviceClient
        .from('company_cache')
        .upsert({
          company_name: cacheKey,
          domain: intel.domain,
          headcount: intel.headcount,
          industry: intel.industry,
          founded_year: intel.foundedYear,
          short_description: intel.description,
          annual_revenue: intel.annualRevenue,
          raw_data: org,
          created_at: new Date().toISOString(),
        }, { onConflict: 'company_name' })

      console.log(`[Industry-Brief] Cached Apollo result for: ${companyName}`)
    } catch (cacheErr) {
      console.warn('[Industry-Brief] Failed to cache Apollo result:', cacheErr)
    }

    console.log(`[Industry-Brief] Apollo enriched: ${companyName} — ${intel.headcount || '?'} employees, ${intel.industry || '?'}`)
    return intel
  } catch (e) {
    console.error('[Industry-Brief] Apollo enrichment failed:', e)
    return empty
  }
}


/**
 * Call Claude API to synthesize an industry narrative.
 * When pipeline data is available, Claude synthesizes real facts.
 * When data is thin, Claude supplements with market knowledge.
 */
async function synthesizeIndustryBrief(data: {
  industry: string
  location: string
  targetCompany: string
  roleCounts: Array<{ title: string; postings: number }>
  pipelineData?: Awaited<ReturnType<typeof queryPipelineData>>
  companyIntel?: CompanyIntel
}): Promise<{
  market_overview: string
  competitors: Array<{ name: string; postings: string; top_role: string }>
  top_roles: Array<{ title: string; postings: string; salary_range: string; demand: string }>
  scarcity_signals: Array<{ role: string; pool_size: string; label: string }>
  competing_postings: string
  avg_salary_range: string
  avg_time_to_fill: string
  open_to_new_roles: string
  data_warning?: string
} | null> {
  const claudeKey = process.env.CLAUDE_API_KEY
  if (!claudeKey) {
    console.error('[Industry-Brief] CLAUDE_API_KEY not configured')
    return null
  }

  const roleList = data.roleCounts.map(r => r.title).join(', ')
  const pd = data.pipelineData

  // Build real data context block for the prompt
  let dataContext = ''
  if (pd && pd.hasData) {
    const companyLines = pd.companies.slice(0, 6).map(c =>
      `  - ${c.name}: ${c.postings} postings (top role: ${c.topRole})${c.headcount ? ` [${c.headcount} employees]` : ''}`
    ).join('\n')

    const roleLines = pd.roleCounts.slice(0, 6).map(r =>
      `  - ${r.title}: ${r.count} postings${r.salaryRange ? ` (${r.salaryRange})` : ''}`
    ).join('\n')

    const salaryExamples = pd.salaryRanges.slice(0, 8).join(', ')

    dataContext = `
REAL MARKET DATA (from proprietary employer hiring activity monitoring — last 30 days):
Total active postings tracked: ${pd.leadCount}
Most recent posting: ${pd.recentPostingDays} day(s) ago

Companies actively hiring:
${companyLines}

Roles by posting volume:
${roleLines}

Salary ranges observed: ${salaryExamples || 'Not enough data'}
Avg time to fill (market): ${pd.avgTimeToFill || 'Use your best estimate'}

CRITICAL: Use the REAL company names and posting counts above in your competitors list and market overview. These are verified active postings, not estimates. For the top_roles table, use real counts where available and supplement with market estimates for roles not in our data. Clearly ground your narrative in this data — cite specific companies and numbers. NEVER use the word "scraped" or "scraping" in the output — use "tracked", "monitored", or "identified" instead.`
  } else {
    dataContext = `
NOTE: Limited pipeline data available for this industry/location combination. Use your market knowledge to generate estimates, but be conservative with numbers. Mark stat values as reasonable estimates based on market benchmarks.`
  }

  // Append company-specific intelligence from Apollo if available
  const ci = data.companyIntel
  if (ci && ci.source !== 'none') {
    const ciLines = [
      `\nTARGET COMPANY INTELLIGENCE (source: ${ci.source}):`,
      `  Company: ${ci.name}`,
      ci.headcount ? `  Headcount: ${ci.headcount} employees` : null,
      ci.industry ? `  Industry: ${ci.industry}` : null,
      ci.domain ? `  Domain: ${ci.domain}` : null,
      ci.foundedYear ? `  Founded: ${ci.foundedYear}` : null,
      ci.annualRevenue ? `  Annual Revenue: ${ci.annualRevenue}` : null,
      ci.description ? `  Description: ${ci.description}` : null,
      `\nUse this company data to personalize the brief. Reference their size, industry positioning, or founding year where it adds value. This is real verified data — use it confidently.`,
    ].filter(Boolean).join('\n')
    dataContext += ciLines
  }

  const prompt = `You are a recruitment market intelligence analyst writing a competitive intelligence briefing. This document will be handed directly to ${data.targetCompany} as a prospecting tool by a recruitment agency.

TARGET: ${data.targetCompany} (${data.industry} sector, ${data.location})
ROLES TO ANALYZE: ${roleList}
${dataContext}

TONE RULES:
- This is a sales document shared WITH ${data.targetCompany}. They are the reader.
- Position them as a strong, well-regarded player. Never say they're struggling, falling behind, or losing talent.
- Frame all urgency as market-wide dynamics and opportunities, not company problems.
- Be specific and data-driven, not generic. Every sentence should earn its place.

WRITING RULES — CRITICAL:
- market_overview MUST be 2 SHORT paragraphs. Maximum 150 words total. Tight, punchy, specific.
- Paragraph 1: The key tension in this market right now — what's changed, what's scarce, what's moving fast. Name specific competing employers who are hiring aggressively for the same roles.
- Paragraph 2: What this means specifically for ${data.targetCompany} — what advantage they have, what window of opportunity exists, and one concrete insight (e.g., a competitor's hiring surge, a niche skill becoming scarce, a compensation shift).
- NO filler. No "in recent memory." No "it's worth noting." No "the broader market reflects." Every sentence must contain a fact, a number, or a specific company name.
- Do NOT repeat the company name more than 2-3 times total.

Generate a JSON response with these exact fields:

{
  "market_overview": "<2 SHORT paragraphs, 150 words max total. Specific, data-driven, names competitors. See rules above.>",
  "competitors": [
    {"name": "<real competing employer — use pipeline data names where available>", "postings": "<real count from data, or estimated number>", "top_role": "<their most common open role>"}
  ],
  "top_roles": [
    {"title": "<role title>", "postings": "<real count or estimated number>", "salary_range": "<CAD annual, $XXK-$XXXK — use real ranges from data where available>", "demand": "<HOT if >=50, WARM if >=10, NICHE if <10>"}
  ],
  "scarcity_signals": [
    {"role": "<role title>", "pool_size": "<exactly one of: Scarce / Limited / Moderate / Available>", "label": "<specific insight — mention a tool, cert, regulation, or number. Max 15 words>"}
  ],
  "competing_postings": "<total postings — use real pipeline count if available, else estimate. Plain number only e.g. '47'>",
  "avg_salary_range": "<format: $XXK-$XXXK — derived from real data where possible>",
  "avg_time_to_fill": "<format: XX days>",
  "open_to_new_roles": "<format: XX%>"
}

FORMAT RULES:
- Return ONLY valid JSON, no markdown, no explanation
- competitors: 4-5 entries (prefer real companies from pipeline data, supplement with known employers)
- top_roles: 5-6 entries, sorted by demand descending
- scarcity_signals: exactly 3 entries, pool_size required (Scarce/Limited/Moderate/Available), label max 15 words with specific detail
- All salaries CAD annual
- Stat values must be short (they render in small PDF boxes)
- Never characterize the target company negatively`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': claudeKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '(could not read body)')
      console.error(`[Industry-Brief] Claude API error: HTTP ${res.status} — ${errBody}`)
      return null
    }

    const result = await res.json()
    const text = result.content?.[0]?.text || ''

    if (!text) {
      console.error('[Industry-Brief] Claude returned empty text. Full response:', JSON.stringify(result).slice(0, 500))
      return null
    }

    // Extract JSON robustly — handle markdown fences, leading/trailing prose
    let jsonStr = text
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) {
      jsonStr = fenceMatch[1]
    }
    // If no fences, try to extract the JSON object directly
    if (!fenceMatch) {
      const objMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (objMatch) {
        jsonStr = objMatch[0]
      }
    }
    jsonStr = jsonStr.trim()

    try {
      return JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('[Industry-Brief] JSON parse failed. Parse error:', parseErr)
      console.error('[Industry-Brief] Raw Claude text (first 800 chars):', text.slice(0, 800))
      return null
    }
  } catch (err) {
    console.error('[Industry-Brief] Claude synthesis failed:', err)
    return null
  }
}

/**
 * POST /api/industry-briefs
 *
 * Generate an industry brief: pipeline data + Apollo enrichment → Claude synthesis → PDFMonkey PDF.
 * Tier-gated: Growth+ only. Rate limited: 10/user/day.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient() || supabase

  // Rate limit: 10/user/day
  const { allowed, remaining } = rateLimit(`industry-brief:${user.id}`, { limit: 10, windowSeconds: 86400 })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit reached — you can generate up to 10 industry briefs per day.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    )
  }

  // Get user's client
  const { data: ucData } = await serviceClient
    .from('user_clients')
    .select('client_id, role, contact_name, contact_title, contact_email, contact_phone')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = ucData?.[0] || null
  if (!userClient) {
    return NextResponse.json({ error: 'No client access' }, { status: 403 })
  }

  // Get client for tier + branding
  const { data: client } = await serviceClient
    .from('clients')
    .select('*')
    .eq('id', userClient.client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (client.tier === 'starter') {
    return NextResponse.json(
      { error: 'Industry Briefs are available on Growth, Scale, and Enterprise plans.' },
      { status: 403 }
    )
  }

  // Parse body
  let body: { industry?: string; location?: string; target_company?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { industry, location, target_company } = body
  if (!industry || !location || !target_company) {
    return NextResponse.json(
      { error: 'All three fields are required: industry, location, and target company.' },
      { status: 400 }
    )
  }

  // Insert brief record immediately (status: generating)
  const { data: brief, error: insertError } = await serviceClient
    .from('industry_briefs')
    .insert({
      client_id: userClient.client_id,
      user_id: user.id,
      industry,
      location,
      target_company,
      status: 'generating',
    })
    .select()
    .single()

  if (insertError) {
    console.error('[Industry-Brief] Insert error:', insertError)
    return NextResponse.json({ error: 'Failed to create brief' }, { status: 500 })
  }

  console.log(`[Industry-Brief] Created ${brief.id} — starting generation for ${industry} / ${location} / ${target_company}`)

  // --- STEP 1: Query real pipeline data ---
  const pipelineData = await queryPipelineData(serviceClient, userClient.client_id, industry, location)

  // --- STEP 1b: Enrich target company (cached, max 1 Apollo credit) ---
  const companyIntel = await enrichTargetCompany(serviceClient, userClient.client_id, target_company)

  // --- STEP 2: Build role list for synthesis ---
  const roles = INDUSTRY_ROLES[industry] || INDUSTRY_ROLES['Technology']
  const roleCounts = roles.map(role => {
    // Use real counts from pipeline data where available
    const realCount = pipelineData.roleCounts.find(r =>
      r.title.toLowerCase().includes(role.toLowerCase().split(' ')[0]) ||
      role.toLowerCase().includes(r.title.toLowerCase().split(' ')[0])
    )
    return { title: role, postings: realCount?.count || 0 }
  })
  console.log(`[Industry-Brief] ${roles.length} roles for ${industry} — ${pipelineData.hasData ? `${pipelineData.leadCount} real leads from pipeline` : 'Claude will supplement with market estimates'}`)

  // --- STEP 3: Claude synthesis (now with real data + company intel) ---
  const synthesis = await synthesizeIndustryBrief({
    industry,
    location,
    targetCompany: target_company,
    roleCounts,
    pipelineData,
    companyIntel,
  })

  if (!synthesis) {
    // Update brief to failed — check Vercel function logs for detailed error from synthesizeIndustryBrief()
    const errorMsg = 'Synthesis failed — check Vercel function logs for details (search: [Industry-Brief])'
    await serviceClient
      .from('industry_briefs')
      .update({ status: 'failed', error_message: errorMsg, updated_at: new Date().toISOString() })
      .eq('id', brief.id)

    return NextResponse.json({
      success: true,
      brief: { ...brief, status: 'failed', error_message: errorMsg },
    })
  }

  // --- STEP 3: Generate PDF via PDFMonkey ---
  const pdfMonkeyKey = process.env.PDFMONKEY_API_KEY
  const templateId = INDUSTRY_BRIEF_TEMPLATE_ID

  if (!pdfMonkeyKey || !templateId) {
    // PDFMonkey not configured — fail clearly so the user knows why there's no PDF
    const missingParts = []
    if (!pdfMonkeyKey) missingParts.push('PDFMONKEY_API_KEY')
    if (!templateId) missingParts.push('INDUSTRY_BRIEF_TEMPLATE_ID')
    const errorMsg = `PDF generation not configured — missing: ${missingParts.join(', ')}. Upload the industry brief template to PDFMonkey and set the template ID in environment variables.`
    console.warn(`[Industry-Brief] ${errorMsg}`)

    await serviceClient
      .from('industry_briefs')
      .update({
        status: 'failed',
        error_message: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brief.id)

    return NextResponse.json({
      success: true,
      brief: { ...brief, status: 'failed', error_message: errorMsg },
    })
  }

  // Build PDF payload
  const agencyInitials = client.agency_initials ||
    (client.agency_name || 'AG').split(' ').map((w: string) => w[0]).join('').substring(0, 3).toUpperCase()

  const agentName = userClient.contact_name || client.sales_rep_name || ''
  const agentTitle = userClient.contact_title || client.sales_rep_title || 'Recruitment Director'
  const agentEmail = userClient.contact_email || client.sales_rep_email || ''
  const agentPhone = userClient.contact_phone || client.agency_phone || ''

  const templatePayload = {
    // Agency branding
    agency_name: client.agency_name || 'Your Agency',
    agency_initials: agencyInitials,
    agency_logo_url: client.logo_url || null,
    brand_primary: client.brand_primary_color || '#2F2C25',
    brand_accent: client.brand_accent_color || '#F1EADD',
    white_label: client.white_label || false,

    // Report metadata
    report_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    industry,
    location,
    target_company,

    // Stats — send under BOTH old template names and new names for compatibility
    // Old names (what the current PDFMonkey template expects):
    total_postings: synthesis.competing_postings || '—',
    avg_salary_range: synthesis.avg_salary_range || '—',
    talent_pool_size: synthesis.avg_time_to_fill || '—',
    hottest_role: synthesis.open_to_new_roles || '—',
    // New names (for when we update the template):
    competing_postings: synthesis.competing_postings || '—',
    salary_range: synthesis.avg_salary_range || '—',
    avg_time_to_fill: synthesis.avg_time_to_fill || '—',
    talent_availability: synthesis.open_to_new_roles || '—',

    // Content
    market_overview: synthesis.market_overview || '',
    competitors: synthesis.competitors || [],
    top_roles: synthesis.top_roles || [],
    scarcity_signals: synthesis.scarcity_signals || [],

    // CTA
    agent_name: agentName,
    agent_title: agentTitle,
    agent_email: agentEmail,
    agent_phone: agentPhone,

    methodology_text: 'This brief is compiled from proprietary market monitoring, employer hiring activity data, and intelligence synthesis. Posting counts and salary ranges reflect observed market activity for the specified region. All data is current as of the report date.',
  }

  try {
    // Create PDFMonkey document
    const createRes = await fetch(`${PDFMONKEY_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pdfMonkeyKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          document_template_id: templateId,
          status: 'pending',
          payload: templatePayload,
          filename: `Industry-Brief-${industry.replace(/[^a-zA-Z0-9]/g, '-')}-${target_company.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}`,
        },
      }),
    })

    if (!createRes.ok) {
      const errBody = await createRes.text()
      console.error('[Industry-Brief] PDFMonkey create error:', createRes.status, errBody)
      await serviceClient
        .from('industry_briefs')
        .update({ status: 'failed', error_message: 'PDF generation failed to start', updated_at: new Date().toISOString() })
        .eq('id', brief.id)

      return NextResponse.json({
        success: true,
        brief: { ...brief, status: 'failed' },
      })
    }

    const createData = await createRes.json()
    const documentId = createData.document.id
    console.log(`[Industry-Brief] PDFMonkey document: ${documentId}`)

    // Poll for completion (max 60 seconds)
    let pdfUrl: string | null = null
    for (let attempt = 1; attempt <= 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000))

      const pollRes = await fetch(`${PDFMONKEY_BASE_URL}/documents/${documentId}`, {
        headers: { 'Authorization': `Bearer ${pdfMonkeyKey}` },
      })

      if (!pollRes.ok) continue

      const pollData = await pollRes.json()
      const status = pollData.document.status

      if (status === 'success') {
        pdfUrl = pollData.document.download_url
        console.log(`[Industry-Brief] PDF ready: ${pdfUrl}`)
        break
      }

      if (status === 'error') {
        console.error(`[Industry-Brief] PDFMonkey generation failed: ${pollData.document.error}`)
        break
      }
    }

    // Update brief record
    await serviceClient
      .from('industry_briefs')
      .update({
        status: pdfUrl ? 'ready' : 'failed',
        pdf_url: pdfUrl,
        error_message: pdfUrl ? null : 'PDF generation timed out',
        updated_at: new Date().toISOString(),
      })
      .eq('id', brief.id)

    return NextResponse.json({
      success: true,
      brief: {
        ...brief,
        status: pdfUrl ? 'ready' : 'failed',
        pdf_url: pdfUrl,
      },
    })

  } catch (err) {
    console.error('[Industry-Brief] Unexpected error:', err)
    await serviceClient
      .from('industry_briefs')
      .update({ status: 'failed', error_message: 'Unexpected error', updated_at: new Date().toISOString() })
      .eq('id', brief.id)

    return NextResponse.json({
      success: true,
      brief: { ...brief, status: 'failed' },
    })
  }
}

/**
 * GET /api/industry-briefs
 *
 * List industry briefs for the current user's client.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient() || supabase

  const { data: ucData } = await serviceClient
    .from('user_clients')
    .select('client_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = ucData?.[0] || null
  if (!userClient) {
    return NextResponse.json({ error: 'No client access' }, { status: 403 })
  }

  const { data: briefs } = await serviceClient
    .from('industry_briefs')
    .select('*')
    .eq('client_id', userClient.client_id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ briefs: briefs || [] })
}
