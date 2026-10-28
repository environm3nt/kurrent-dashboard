import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// Vercel serverless function timeout — this route polls PDFMonkey (up to 60s)
export const maxDuration = 90

const PDFMONKEY_BASE_URL = 'https://api.pdfmonkey.io/api/v1'
const PDFMONKEY_TEMPLATE_ID = process.env.PDFMONKEY_TEMPLATE_ID

/**
 * Title-case a string (LinkedIn often stores lowercase).
 * Keeps small words lowercase unless they're the first word.
 */
function titleCase(str: string): string {
  if (!str) return ''
  return str.replace(/\b\w+/g, (word, index) => {
    const small = ['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'by']
    if (small.includes(word.toLowerCase()) && index !== 0) {
      return word.toLowerCase()
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}

/**
 * Minimum data requirements for PDF generation.
 * If a lead is missing these, we tell the user instead of generating a blank report.
 */
function validateLeadData(lead: Record<string, unknown>): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  // Must have basic role info
  if (!lead.role_title) missing.push('role title')
  if (!lead.company_name) missing.push('company name')

  // Must have at least SOME intelligence data — market insight OR landscape OR salary
  const hasMarketInsight = !!lead.market_insight
  const hasLandscape = !!(lead.scarcity_insight || lead.competition_insight || lead.speed_insight)
  const hasSalary = !!lead.salary_range

  if (!hasMarketInsight && !hasLandscape && !hasSalary) {
    missing.push('market intelligence — this lead was created before the pipeline started generating report data. New leads from the next pipeline run will include full market intelligence, competitive landscape, and candidate analysis.')
  }

  return { valid: missing.length === 0, missing }
}

/**
 * Build candidates array for PDFMonkey template from lead data.
 * Uses candidate_pitch_points for tag generation and synthesized data when available.
 */
function buildCandidatesArray(lead: Record<string, unknown>): Array<Record<string, unknown>> {
  const candidates: Array<Record<string, unknown>> = []

  for (let i = 1; i <= 3; i++) {
    const name = lead[`candidate_${i}_name`] as string | null
    const url = lead[`candidate_${i}_url`] as string | null
    const headline = lead[`candidate_${i}_headline`] as string | null
    const signal = lead[`candidate_${i}_signal`] as string | null
    const matchScore = lead[`candidate_${i}_match_score`] as number | null

    if (!name) continue

    const isFirst = candidates.length === 0

    // Map availability signal to tag label
    const signalLabel = signal === 'WARM' ? 'Open to Move' :
                        signal === 'POSSIBLE' ? 'May Be Open' :
                        'Passive'

    // Title-case the headline (PDL returns lowercase)
    const displayHeadline = headline
      ? titleCase(headline)
      : titleCase(lead.role_title as string || '') + ' Candidate — Verified Profile'

    // Build a readable role tag — use full role title, capped at ~25 chars
    const roleTag = titleCase((lead.role_title as string || 'Matched'))
    const roleLabel = roleTag.length > 25 ? roleTag.slice(0, 22) + '...' : roleTag

    candidates.push({
      rank_label: isFirst ? 'Top Pick' : 'Strong',
      headline: displayHeadline,
      meta: `${lead.location || 'Location not specified'}`,
      match_score: matchScore || (isFirst ? 88 : (candidates.length === 1 ? 80 : 73)),
      tags: [
        { label: roleLabel, style: 'primary' },
        { label: signalLabel, style: 'outline' },
        { label: url ? 'Profile Available' : 'Sourced', style: 'accent' },
      ],
    })
  }

  return candidates
}

/**
 * POST /api/leads/[id]/pdf
 *
 * Generate an on-demand PDF report for a specific lead.
 * Requires authenticated user with access to the lead's client.
 * Calls PDFMonkey API, polls for completion, stores URL on lead record.
 *
 * Returns a clear error message if the lead doesn't have enough data
 * for a meaningful report (instead of generating a blank PDF).
 *
 * Rate limited: 5 generations per user per 10 minutes (PDFMonkey costs money).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params

  // --- Auth check (anon client for auth only) ---
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Service client for data queries (bypasses RLS, same pattern as all dashboard pages) ---
  const serviceClient = createServiceClient() || supabase

  // --- Rate limit: 5 PDF generations per user per 10 minutes ---
  const { allowed, remaining } = rateLimit(`pdf:${user.id}`, { limit: 5, windowSeconds: 600 })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. PDF generation is expensive — please wait a few minutes.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    )
  }

  // --- Get user's client mapping ---
  const { data, error: ucError } = await serviceClient
    .from('user_clients')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = data?.[0] || null

  if (ucError || !userClient) {
    return NextResponse.json({ error: 'No client access' }, { status: 403 })
  }

  // --- Get the lead ---
  const { data: lead, error: leadError } = await serviceClient
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('client_id', userClient.client_id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // --- Validate lead has enough data for a meaningful report ---
  const { valid, missing } = validateLeadData(lead)
  if (!valid) {
    console.warn(`[PDF-API] Insufficient data for lead ${leadId}: missing ${missing.join(', ')}`)
    return NextResponse.json({
      error: 'Not enough data to generate a report',
      detail: `This lead is missing: ${missing.join(', ')}. The pipeline needs to complete market intelligence synthesis before a briefing can be generated.`,
      missing,
    }, { status: 422 })
  }

  // --- Get client config for branding ---
  const { data: client, error: clientError } = await serviceClient
    .from('clients')
    .select('*')
    .eq('id', userClient.client_id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client config not found' }, { status: 500 })
  }

  // --- Check PDFMonkey API key ---
  const apiKey = process.env.PDFMONKEY_API_KEY
  if (!PDFMONKEY_TEMPLATE_ID) {
    console.error('[PDF-API] PDFMONKEY_TEMPLATE_ID not configured')
    return NextResponse.json({ error: 'PDF generation not configured' }, { status: 503 })
  }
  if (!apiKey) {
    console.error('[PDF-API] PDFMONKEY_API_KEY not configured')
    return NextResponse.json({ error: 'PDF service not configured' }, { status: 503 })
  }

  // --- Resolve contact info: use user's own contact card if available, else client defaults ---
  // All roles (admin, owner, member) can have personal contact info on PDFs
  let agentName = client.sales_rep_name || ''
  let agentTitle = client.sales_rep_title || 'Recruitment Director'
  let agentEmail = client.sales_rep_email || ''
  let agentPhone = client.agency_phone || ''

  // Look up user's personal contact card (applies to all roles)
  const { data: userProfileData } = await serviceClient
    .from('user_clients')
    .select('contact_name, contact_title, contact_email, contact_phone')
    .eq('user_id', user.id)
    .eq('client_id', userClient.client_id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userProfile = userProfileData?.[0] || null

  if (userProfile) {
    agentName = userProfile.contact_name || agentName
    agentTitle = userProfile.contact_title || agentTitle
    agentEmail = userProfile.contact_email || agentEmail
    agentPhone = userProfile.contact_phone || agentPhone
  }

  // --- Build candidates array from lead data ---
  const candidates = buildCandidatesArray(lead)

  // --- Clean stat values for PDF stat boxes (must be short) ---
  // Pipeline synthesis sometimes returns verbose values. These render in small stat cards.
  function cleanSalaryRange(val: string | null): string {
    if (!val) return '—'
    // Already short format like "$85K-$110K" → keep
    if (/^\$\d+K\s*-\s*\$\d+K$/i.test(val)) return val
    // Convert "$85,000-$110,000 annually" → "$85K-$110K"
    const rangeMatch = val.match(/\$?([\d,]+)\s*[-–to]+\s*\$?([\d,]+)/i)
    if (rangeMatch) {
      const low = Math.round(parseInt(rangeMatch[1].replace(/,/g, ''), 10) / 1000)
      const high = Math.round(parseInt(rangeMatch[2].replace(/,/g, ''), 10) / 1000)
      if (low > 0 && high > 0) return `$${low}K-$${high}K`
    }
    // Hourly rate like "$70 an hour" → convert to annual
    const hourlyMatch = val.match(/\$?([\d.]+)\s*(an?\s*hour|\/hr|hourly)/i)
    if (hourlyMatch) {
      const annual = Math.round(parseFloat(hourlyMatch[1]) * 2080 / 1000)
      return `~$${annual}K`
    }
    // Fallback: truncate to 12 chars
    return val.length > 12 ? val.slice(0, 12) : val
  }

  function cleanTimeToFill(val: string | null): string {
    if (!val) return '—'
    // Extract first number + "days"
    const match = val.match(/(\d+)\s*(?:[-–]\s*\d+\s*)?days?/i)
    if (match) return `${match[1]} days`
    // Just a number
    const numMatch = val.match(/^(\d+)$/)
    if (numMatch) return `${numMatch[1]} days`
    return val.length > 10 ? val.slice(0, 10) : val
  }

  function cleanTalentAvailability(val: string | null): string {
    if (!val) return '—'
    // Extract percentage if present
    const pctMatch = val.match(/(\d+)\s*%/)
    if (pctMatch) return `${pctMatch[1]}%`
    // Single word like "Limited" → keep
    if (val.length <= 10) return val
    return val.slice(0, 10)
  }

  /** Truncate insight text to fit inside the Competitive Landscape PDF cards */
  function truncateInsight(val: string | null | undefined): string {
    if (!val) return ''
    if (val.length <= 130) return val
    // Cut at last space before 130 chars, add ellipsis
    const cut = val.lastIndexOf(' ', 127)
    return val.slice(0, cut > 80 ? cut : 127) + '...'
  }

  function cleanCompetingPostings(val: string | null): string {
    if (!val) return '—'
    // Extract first number
    const match = val.match(/(\d+)/)
    if (match) return match[1]
    return val.length > 6 ? val.slice(0, 6) : val
  }

  // --- Build PDFMonkey payload (matches pdf-generator.js template format) ---
  const agencyInitials = client.agency_initials ||
    (client.agency_name || 'AG').split(' ').map((w: string) => w[0]).join('').substring(0, 3).toUpperCase()

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
    role_title: titleCase(lead.role_title || ''),
    location: lead.location || '',
    industry: lead.industry || 'Professional Services',
    work_arrangement: 'Full-Time',

    // Stat strip (cleaned for stat box sizing)
    competing_postings: cleanCompetingPostings(lead.competing_postings),
    salary_range: cleanSalaryRange(lead.salary_range),
    avg_time_to_fill: cleanTimeToFill(lead.time_to_fill_estimate),
    talent_availability: cleanTalentAvailability(lead.talent_availability),

    // Market intelligence narrative
    market_insight: lead.market_insight || '',
    // Competitive Landscape cards have limited vertical space — cap at 130 chars
    scarcity_insight: truncateInsight(lead.scarcity_insight),
    competition_insight: truncateInsight(lead.competition_insight),
    speed_insight: truncateInsight(lead.speed_insight),

    // Candidates (built from lead data — no longer hardcoded empty)
    candidates,

    // CTA contact info
    agent_name: agentName,
    agent_title: agentTitle,
    agent_phone: agentPhone,
    agent_email: agentEmail,

    // Methodology
    methodology_text: 'This brief is compiled from real-time job market data, proprietary talent pool analytics, and AI-powered candidate matching. Market statistics reflect a 30-day rolling window. Candidate match scores are based on skills alignment, experience relevance, and qualification fit against the role requirements. All candidate identities are anonymized — full profiles are available upon engagement.',
  }

  try {
    // --- Create PDFMonkey document ---
    console.log(`[PDF-API] Generating PDF for lead ${leadId} (${lead.company_name}) with ${candidates.length} candidates`)
    console.log(`[PDF-API] Payload size: ${JSON.stringify(templatePayload).length} bytes`)

    const createRes = await fetch(`${PDFMONKEY_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          document_template_id: PDFMONKEY_TEMPLATE_ID,
          status: 'pending',
          payload: templatePayload,
          filename: `Market-Brief-${(lead.role_title || 'Role').replace(/[^a-zA-Z0-9]/g, '-')}-${(lead.company_name || 'Company').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}`,
        },
      }),
    })

    if (!createRes.ok) {
      const errBody = await createRes.text()
      console.error('[PDF-API] PDFMonkey create error:', createRes.status, errBody)
      return NextResponse.json({
        error: `PDF generation failed — PDFMonkey ${createRes.status}`,
        detail: errBody,
        candidateCount: candidates.length,
      }, { status: 502 })
    }

    const createData = await createRes.json()
    const documentId = createData.document.id
    console.log(`[PDF-API] Document created: ${documentId}`)

    // --- Poll for completion (max 40 seconds — PDFMonkey typically renders in 5-15s) ---
    const maxAttempts = 20
    const pollInterval = 2000

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const pollRes = await fetch(`${PDFMONKEY_BASE_URL}/documents/${documentId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })

      if (!pollRes.ok) continue

      const pollData = await pollRes.json()
      const status = pollData.document.status

      if (status === 'success') {
        const downloadUrl = pollData.document.download_url
        console.log(`[PDF-API] PDF ready: ${downloadUrl}`)

        // Store the URL on the lead record
        const { error: updateError } = await serviceClient
          .from('leads')
          .update({ pdf_report_link: downloadUrl, updated_at: new Date().toISOString() })
          .eq('id', leadId)

        if (updateError) {
          console.error('[PDF-API] Failed to save URL to lead:', updateError)
        }

        return NextResponse.json({
          success: true,
          pdf_url: downloadUrl,
          lead_id: leadId,
        })
      }

      if (status === 'error') {
        const errMsg = pollData.document.error || 'Unknown error'
        console.error(`[PDF-API] PDFMonkey generation failed: ${errMsg}`)
        return NextResponse.json({ error: 'PDF generation failed', detail: errMsg }, { status: 502 })
      }
    }

    // Timeout
    console.error(`[PDF-API] PDF generation timed out for document ${documentId}`)
    return NextResponse.json({ error: 'PDF generation timed out' }, { status: 504 })

  } catch (err) {
    console.error('[PDF-API] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
