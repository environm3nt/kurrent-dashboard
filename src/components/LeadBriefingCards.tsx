'use client'

import { Lead } from '@/types/database'
import { palette } from '@/lib/theme'
interface LeadBriefingCardsProps {
  leads: Lead[]
}

// Determine lead heat tag based on recency and contact quality
function getLeadTag(lead: Lead): { label: string; style: React.CSSProperties } | null {
  // Parse date-only strings with 'T00:00:00' to avoid UTC midnight timezone shift
  const dateStr = lead.date_identified?.split('T')[0]
  const daysSinceIdentified = dateStr
    ? Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
    : 999
  if (daysSinceIdentified <= 1 && lead.contact_quality === 'verified') {
    return { label: 'HOT', style: { backgroundColor: palette.ink, color: palette.cream } }
  }
  if (daysSinceIdentified <= 2) {
    return { label: 'NEW', style: { backgroundColor: palette.line, color: palette.ink } }
  }
  if (lead.contact_quality === 'verified' || lead.contact_quality === 'partial') {
    return { label: 'WARM', style: { backgroundColor: 'transparent', color: palette.ink, border: `1.5px solid ${palette.ink}` } }
  }
  return null
}

// Estimate placement fee as range (15-25% of salary bounds)
function estimateFee(salaryRange?: string | null): string | null {
  if (!salaryRange) return null
  const nums = salaryRange.match(/[\d,]+/g)
  if (!nums || nums.length === 0) return null
  const values = nums.map(n => parseInt(n.replace(/,/g, '')))
  if (values.length >= 2) {
    const low = Math.round(Math.min(...values) * 0.15)
    const high = Math.round(Math.max(...values) * 0.25)
    if (low > 5000) return `$${low.toLocaleString()}-$${high.toLocaleString()}`
  }
  const median = values.reduce((a, b) => a + b, 0) / values.length
  const fee = Math.round(median * 0.2)
  return fee > 5000 ? `$${fee.toLocaleString()}` : null
}

export default function LeadBriefingCards({ leads }: LeadBriefingCardsProps) {
  if (leads.length === 0) {
    return (
      <div
        className="p-6 sm:p-8 text-center"
        style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}`, borderRadius: '14px' }}
      >
        <p className="font-serif text-lg font-bold mb-2" style={{ color: palette.ink }}>
          No opportunities yet
        </p>
        <p className="text-sm" style={{ color: palette.muted }}>
          New leads will appear here after your next intelligence run.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif font-bold text-base sm:text-lg" style={{ color: palette.ink }}>
          Latest Intelligence
        </h2>
        <a
          href="/dashboard/leads"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          style={{ color: palette.ink, backgroundColor: palette.line }}
        >
          View all leads
        </a>
      </div>

      <div className="space-y-4">
        {leads.map((lead) => {
          const tag = getLeadTag(lead)
          const fee = estimateFee(lead.salary_range)
          const status = (lead as unknown as Record<string, unknown>).status as string | undefined

          return (
            <div
              key={lead.id}
              className="p-4 sm:p-5"
              style={{
                backgroundColor: 'white',
                border: `1px solid ${palette.line}`,
                borderRadius: '12px',
              }}
            >
              {/* Header: Company + Tag + Stage */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm sm:text-base" style={{ color: palette.ink }}>
                      {lead.company_name}
                    </h3>
                    {tag && (
                      <span
                        className="text-xs font-semibold uppercase tracking-wide px-2.5 py-0.5"
                        style={{ borderRadius: '6px', letterSpacing: '0.5px', fontSize: '11px', ...tag.style }}
                      >
                        {tag.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm mt-0.5" style={{ color: palette.secondary }}>
                    {lead.role_title}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {status && (
                    <span
                      className="text-xs font-medium px-3 py-1"
                      style={{
                        borderRadius: '6px',
                        backgroundColor: status === 'Won' || status === 'Contacted' || status === 'Viewed' ? palette.ink : palette.line,
                        color: status === 'Won' || status === 'Contacted' || status === 'Viewed' ? palette.cream : palette.ink,
                      }}
                    >
                      {status === 'Viewed' ? 'Meeting' : status}
                    </span>
                  )}
                </div>
              </div>

              {/* Meta line: contact, quality, salary */}
              <p className="text-xs mb-1" style={{ color: palette.muted }}>
                {lead.hiring_contact_name && (
                  <>Hiring contact: {lead.hiring_contact_name}{lead.hiring_contact_title ? `, ${lead.hiring_contact_title}` : ''} · </>
                )}
                {lead.contact_quality === 'verified' ? 'Verified' : lead.contact_quality === 'partial' ? 'Partial' : 'No Contact'}
                {lead.salary_range && <> · {lead.salary_range} range</>}
              </p>

              {/* Estimated placement fee */}
              {fee && (
                <p className="text-xs font-semibold mb-3" style={{ color: palette.ink }}>
                  Est. placement fee: {fee}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {lead.pdf_report_link && (
                  <a
                    href={lead.pdf_report_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition"
                    style={{
                      backgroundColor: 'transparent',
                      color: palette.ink,
                      border: `1.5px solid ${palette.ink}`,
                      borderRadius: '6px',
                    }}
                  >
                    View PDF
                  </a>
                )}
                {status === 'New' && (
                  <button
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition"
                    style={{
                      backgroundColor: palette.line,
                      color: palette.ink,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Mark Contacted
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
