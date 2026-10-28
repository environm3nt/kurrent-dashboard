import { palette } from '@/lib/theme'
export default function LeadsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-7 rounded" style={{ width: '160px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '280px', backgroundColor: palette.line }} />
      </div>

      {/* Search/filter bar skeleton */}
      <div className="flex gap-3 mb-6">
        <div className="h-10 rounded-lg flex-1" style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }} />
        <div className="h-10 w-28 rounded-lg" style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }} />
      </div>

      {/* Lead cards skeleton */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="h-5 rounded mb-2" style={{ width: '220px', backgroundColor: palette.line }} />
                <div className="h-4 rounded" style={{ width: '160px', backgroundColor: palette.line }} />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-14 rounded-md" style={{ backgroundColor: palette.line }} />
                <div className="h-6 w-20 rounded-md" style={{ backgroundColor: palette.line }} />
              </div>
            </div>
            <div className="h-4 rounded mt-4" style={{ width: '95%', backgroundColor: palette.line }} />
            <div className="h-4 rounded mt-2" style={{ width: '75%', backgroundColor: palette.line }} />
          </div>
        ))}
      </div>
    </div>
  )
}
