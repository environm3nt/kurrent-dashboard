import { palette } from '@/lib/theme'
export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-7 rounded" style={{ width: '160px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '340px', backgroundColor: palette.line }} />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-4 mb-6" style={{ borderBottom: `1px solid ${palette.line}`, paddingBottom: '12px' }}>
        {['Overview', 'Clients', 'Pipeline', 'Costs', 'Users'].map((tab) => (
          <div key={tab} className="h-5 rounded" style={{ width: '70px', backgroundColor: palette.line }} />
        ))}
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="h-3 rounded mb-3" style={{ width: '50%', backgroundColor: palette.line }} />
            <div className="h-8 rounded" style={{ width: '40%', backgroundColor: palette.line }} />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="rounded-xl p-6" style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${palette.line}` }}>
            <div>
              <div className="h-4 rounded mb-1" style={{ width: '200px', backgroundColor: palette.line }} />
              <div className="h-3 rounded" style={{ width: '140px', backgroundColor: palette.line }} />
            </div>
            <div className="h-6 w-16 rounded-full" style={{ backgroundColor: palette.line }} />
          </div>
        ))}
      </div>
    </div>
  )
}
