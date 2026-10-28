import { palette } from '@/lib/theme'
interface StatsCardsProps {
  newToday: number
  readyToContact: number
  toReview: number
  placements: number
  totalLeads: number
  contactRate: number
}

export default function StatsCards({ newToday, readyToContact, toReview, placements, totalLeads, contactRate }: StatsCardsProps) {
  const stats = [
    {
      name: 'New today',
      value: newToday.toString(),
      secondary: totalLeads > 0 ? `${totalLeads} total in your pipeline` : null,
    },
    {
      name: 'Ready to contact',
      value: readyToContact.toString(),
      secondary: contactRate > 0 ? `${contactRate}% contact rate` : null,
    },
    {
      name: 'To review',
      value: toReview.toString(),
      secondary: toReview > 0 ? 'Leads awaiting your review' : 'All caught up',
    },
    {
      name: 'Placements',
      value: placements.toString(),
      secondary: placements > 0 ? `${placements} successful placement${placements !== 1 ? 's' : ''}` : null,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.name}
          style={{
            backgroundColor: palette.parchment,
            border: `1px solid ${palette.line}`,
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <p
            className="text-3xl font-serif font-bold"
            style={{ color: palette.ink, lineHeight: 1, marginBottom: '4px' }}
          >
            {stat.value}
          </p>
          <p className="text-xs mt-1" style={{ color: palette.secondary }}>{stat.name}</p>
          {stat.secondary && (
            <p style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>{stat.secondary}</p>
          )}
        </div>
      ))}
    </div>
  )
}
