import { palette } from '@/lib/theme'
export default function AnalyticsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-7 rounded" style={{ width: '140px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '280px', backgroundColor: palette.line }} />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-6"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="h-3 rounded mb-3" style={{ width: '60%', backgroundColor: palette.line }} />
            <div className="h-9 rounded" style={{ width: '50%', backgroundColor: palette.line }} />
          </div>
        ))}
      </div>

      {/* Pipeline runs table skeleton */}
      <div className="rounded-xl p-6" style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}>
        <div className="h-5 rounded mb-4" style={{ width: '180px', backgroundColor: palette.line }} />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${palette.line}` }}>
            <div>
              <div className="h-4 rounded mb-1" style={{ width: '120px', backgroundColor: palette.line }} />
              <div className="h-3 rounded" style={{ width: '200px', backgroundColor: palette.line }} />
            </div>
            <div className="h-6 w-16 rounded-full" style={{ backgroundColor: palette.line }} />
          </div>
        ))}
      </div>
    </div>
  )
}
