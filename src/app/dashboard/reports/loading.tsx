import { palette } from '@/lib/theme'
export default function ReportsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-7 rounded" style={{ width: '120px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '320px', backgroundColor: palette.line }} />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-6 mb-6" style={{ borderBottom: `1px solid ${palette.line}`, paddingBottom: '12px' }}>
        <div className="h-5 rounded" style={{ width: '100px', backgroundColor: palette.line }} />
        <div className="h-5 rounded" style={{ width: '120px', backgroundColor: palette.line }} />
      </div>

      {/* Report cards skeleton */}
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl p-4"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="flex-1">
              <div className="h-5 rounded mb-2" style={{ width: '240px', backgroundColor: palette.line }} />
              <div className="h-3 rounded" style={{ width: '160px', backgroundColor: palette.line }} />
            </div>
            <div className="h-9 w-24 rounded-lg" style={{ backgroundColor: palette.line }} />
          </div>
        ))}
      </div>
    </div>
  )
}
