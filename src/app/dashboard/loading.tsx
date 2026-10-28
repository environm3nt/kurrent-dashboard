import { palette } from '@/lib/theme'
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Greeting skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="h-8 rounded" style={{ width: '280px', backgroundColor: palette.line }} />
          <div className="h-4 rounded mt-2" style={{ width: '180px', backgroundColor: palette.line }} />
        </div>
        <div className="h-24 rounded-xl" style={{ width: '260px', backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }} />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="h-3 rounded mb-3" style={{ width: '60%', backgroundColor: palette.line }} />
            <div className="h-7 rounded" style={{ width: '40%', backgroundColor: palette.line }} />
          </div>
        ))}
      </div>

      {/* Lead cards skeleton */}
      <div className="mt-6 sm:mt-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="h-5 rounded mb-2" style={{ width: '200px', backgroundColor: palette.line }} />
                <div className="h-4 rounded" style={{ width: '140px', backgroundColor: palette.line }} />
              </div>
              <div className="h-6 w-12 rounded-md" style={{ backgroundColor: palette.line }} />
            </div>
            <div className="h-4 rounded mt-4" style={{ width: '90%', backgroundColor: palette.line }} />
            <div className="h-4 rounded mt-2" style={{ width: '70%', backgroundColor: palette.line }} />
          </div>
        ))}
      </div>
    </div>
  )
}
