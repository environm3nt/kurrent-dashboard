import { palette } from '@/lib/theme'
export default function SettingsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-7 rounded" style={{ width: '220px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '300px', backgroundColor: palette.line }} />
      </div>

      {/* Settings form skeleton */}
      <div className="rounded-xl p-6" style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="mb-6">
            <div className="h-4 rounded mb-2" style={{ width: '120px', backgroundColor: palette.line }} />
            <div className="h-10 rounded-lg" style={{ backgroundColor: palette.cream, border: `1px solid ${palette.line}` }} />
          </div>
        ))}
        <div className="h-10 w-32 rounded-lg mt-4" style={{ backgroundColor: palette.line }} />
      </div>
    </div>
  )
}
