import { palette } from '@/lib/theme'
export default function PricingLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="h-7 rounded mx-auto" style={{ width: '100px', backgroundColor: palette.line }} />
        <div className="h-4 rounded mx-auto mt-2" style={{ width: '260px', backgroundColor: palette.line }} />
      </div>

      {/* Pricing cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-6"
            style={{
              backgroundColor: palette.parchment,
              border: i === 1 ? `2px solid ${palette.ink}` : `1px solid ${palette.line}`,
            }}
          >
            <div className="h-5 rounded mb-2" style={{ width: '80px', backgroundColor: palette.line }} />
            <div className="h-9 rounded mb-4" style={{ width: '100px', backgroundColor: palette.line }} />
            <div className="space-y-3">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-3 rounded" style={{ width: `${70 + Math.random() * 30}%`, backgroundColor: palette.line }} />
              ))}
            </div>
            <div className="h-10 rounded-lg mt-6" style={{ backgroundColor: palette.line }} />
          </div>
        ))}
      </div>
    </div>
  )
}
