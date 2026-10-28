import { palette } from '@/lib/theme'
export default function PipelineLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-7 rounded" style={{ width: '180px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mt-2" style={{ width: '320px', backgroundColor: palette.line }} />
      </div>

      {/* Pipeline columns skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {['New', 'Contacted', 'Meeting', 'Proposal', 'Won'].map((stage) => (
          <div
            key={stage}
            className="flex-shrink-0 rounded-xl p-3"
            style={{
              width: '220px',
              minHeight: '400px',
              backgroundColor: palette.parchment,
              border: `1px solid ${palette.line}`,
            }}
          >
            <div className="h-5 rounded mb-3" style={{ width: '80px', backgroundColor: palette.line }} />
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg p-3 mb-2"
                style={{ backgroundColor: palette.cream, border: `1px solid ${palette.line}` }}
              >
                <div className="h-4 rounded mb-2" style={{ width: '85%', backgroundColor: palette.line }} />
                <div className="h-3 rounded" style={{ width: '60%', backgroundColor: palette.line }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
