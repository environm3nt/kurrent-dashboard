import { palette } from '@/lib/theme'
export default function ScheduleLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-7 rounded" style={{ width: '180px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '380px', backgroundColor: palette.line }} />
      </div>

      {/* 5-day grid skeleton */}
      <div className="grid grid-cols-5 gap-3">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
          <div
            key={day}
            className="rounded-xl p-3"
            style={{
              minHeight: '280px',
              backgroundColor: palette.parchment,
              border: `1px solid ${palette.line}`,
            }}
          >
            <div className="h-5 rounded mb-4" style={{ width: '40px', backgroundColor: palette.line }} />
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg p-3 mb-2"
                style={{ backgroundColor: palette.cream, border: `1px solid ${palette.line}` }}
              >
                <div className="h-4 rounded" style={{ width: '80%', backgroundColor: palette.line }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
