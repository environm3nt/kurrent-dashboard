import { palette } from '@/lib/theme'
export default function TeamLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-7 rounded" style={{ width: '180px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '280px', backgroundColor: palette.line }} />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="h-3 rounded mb-2" style={{ width: '60%', backgroundColor: palette.line }} />
            <div className="h-7 rounded" style={{ width: '30%', backgroundColor: palette.line }} />
          </div>
        ))}
      </div>

      {/* Team member rows skeleton */}
      <div className="rounded-xl" style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4"
            style={{ borderBottom: i < 3 ? `1px solid ${palette.line}` : 'none' }}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full" style={{ backgroundColor: palette.line }} />
              <div>
                <div className="h-4 rounded mb-1" style={{ width: '140px', backgroundColor: palette.line }} />
                <div className="h-3 rounded" style={{ width: '180px', backgroundColor: palette.line }} />
              </div>
            </div>
            <div className="h-6 w-16 rounded-md" style={{ backgroundColor: palette.line }} />
          </div>
        ))}
      </div>
    </div>
  )
}
