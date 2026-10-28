import { palette } from '@/lib/theme'
export default function AutomationLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-7 rounded" style={{ width: '200px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '320px', backgroundColor: palette.line }} />
      </div>

      {/* Config sections skeleton */}
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-6"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="h-5 rounded mb-4" style={{ width: '160px', backgroundColor: palette.line }} />
            <div className="space-y-3">
              <div className="h-10 rounded-lg" style={{ backgroundColor: palette.cream, border: `1px solid ${palette.line}` }} />
              <div className="h-10 rounded-lg" style={{ backgroundColor: palette.cream, border: `1px solid ${palette.line}` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
