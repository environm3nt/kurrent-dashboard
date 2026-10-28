import { palette } from '@/lib/theme'
export default function RolesLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-7 rounded" style={{ width: '120px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '300px', backgroundColor: palette.line }} />
      </div>

      {/* Role pool bar skeleton */}
      <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 rounded" style={{ width: '140px', backgroundColor: palette.line }} />
          <div className="h-4 rounded" style={{ width: '60px', backgroundColor: palette.line }} />
        </div>
        <div className="h-2 rounded-full" style={{ backgroundColor: palette.line }} />
      </div>

      {/* Search bar skeleton */}
      <div className="h-11 rounded-lg mb-6" style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }} />

      {/* Role cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5"
            style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="h-5 rounded" style={{ width: '180px', backgroundColor: palette.line }} />
              <div className="h-6 w-14 rounded-md" style={{ backgroundColor: palette.line }} />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full" style={{ backgroundColor: palette.line }} />
              <div className="h-6 w-24 rounded-full" style={{ backgroundColor: palette.line }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
