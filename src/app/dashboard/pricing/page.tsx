import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { palette } from '@/lib/theme'

// Prices are not published in this repository. Set NEXT_PUBLIC_TIER_PRICES as
// "starter:499,growth:799,scale:1299" to render amounts; otherwise tiers show "Custom".
const PRICE_OVERRIDES: Record<string, number> = Object.fromEntries(
  (process.env.NEXT_PUBLIC_TIER_PRICES || '')
    .split(',')
    .map((pair) => pair.split(':'))
    .filter(([k, v]) => k && v && !Number.isNaN(Number(v)))
    .map(([k, v]) => [k.trim(), Number(v)])
)

const TIERS = [
  {
    name: 'Starter',
    key: 'starter',
    price: null as number | null,
    roles: 6,
    locations: 1,
    candidates: false,
    features: [
      'Up to 6 roles in your pool',
      '1 target location',
      '~18 leads/day',
      'Daily lead briefings',
      'Verified contacts',
      'PDF reports',
      'Lead Pipeline (CRM)',
      'Unlimited team seats',
    ],
  },
  {
    name: 'Growth',
    key: 'growth',
    price: null as number | null,
    roles: 12,
    locations: 3,
    candidates: true,
    popular: true,
    features: [
      'Up to 12 roles in your pool',
      '3 target locations',
      '~36 leads/day',
      'Everything in Starter',
      'Candidate matching',
      'Per-recruiter digest',
      'Plan Your Week',
      'Market intelligence reports',
      'Unlimited team seats',
    ],
  },
  {
    name: 'Scale',
    key: 'scale',
    price: null as number | null,
    roles: 25,
    locations: 5,
    candidates: true,
    features: [
      'Up to 25 roles in your pool',
      '5 target locations',
      '~75 leads/day',
      'Everything in Growth',
      'Weekly market summary',
      'Priority support',
      'Unlimited team seats',
    ],
  },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const serviceClient = createServiceClient() || supabase

  if (!user) {
    return <div>Not authenticated</div>
  }

  const { data } = await serviceClient
    .from('user_clients')
    .select('client_id, role, clients(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = data?.[0] || null
  const client = userClient?.clients as unknown as Record<string, unknown> | null
  const currentTier = ((client?.tier as string) || 'starter').toLowerCase()
  const rawRole = (userClient?.role as string) || 'member'
  const isAdmin = rawRole === 'admin' || rawRole === 'owner'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>
          Plans &amp; Pricing
        </h1>
        <p className="mt-1" style={{ color: palette.secondary }}>
          Unlimited seats on every plan — your role pool is the only limit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map((tier) => {
          const isCurrent = tier.key === currentTier
          return (
            <div
              key={tier.key}
              className="relative rounded-xl p-6"
              style={{
                backgroundColor: tier.popular ? palette.ink : palette.parchment,
                border: tier.popular ? 'none' : `1px solid ${palette.line}`,
              }}
            >
              {tier.popular && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
                  style={{ backgroundColor: palette.line, color: palette.ink }}
                >
                  Most Popular
                </span>
              )}

              <div className="mb-6">
                <h2
                  className="text-lg font-semibold"
                  style={{ color: tier.popular ? palette.cream : palette.ink }}
                >
                  {tier.name}
                </h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span
                    className="text-4xl font-serif font-bold"
                    style={{ color: tier.popular ? palette.cream : palette.ink }}
                  >
                    {PRICE_OVERRIDES[tier.key] != null ? `$${PRICE_OVERRIDES[tier.key]}` : 'Custom'}
                  </span>
                  {PRICE_OVERRIDES[tier.key] != null && (
                    <span
                      className="text-sm"
                      style={{ color: tier.popular ? palette.muted : palette.secondary }}
                    >
                      /month
                    </span>
                  )}
                </div>
                <p
                  className="mt-2 text-sm"
                  style={{ color: tier.popular ? palette.muted : palette.secondary }}
                >
                  {tier.roles} roles · {tier.locations} location{tier.locations !== 1 ? 's' : ''} · Unlimited seats
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm"
                    style={{ color: tier.popular ? palette.cream : palette.ink }}
                  >
                    <span
                      className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs"
                      style={{
                        backgroundColor: tier.popular ? palette.cream : palette.ink,
                        color: tier.popular ? palette.ink : palette.cream,
                      }}
                    >
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              {isAdmin ? (
                isCurrent ? (
                  <div
                    className="w-full text-center py-3 rounded-lg text-sm font-semibold"
                    style={{
                      backgroundColor: tier.popular ? palette.line : palette.line,
                      color: palette.ink,
                    }}
                  >
                    Current Plan
                  </div>
                ) : (
                  <a
                    href="mailto:hello@kurrentlabs.com?subject=Upgrade%20to%20Kurrent%20"
                    className="block w-full text-center py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: tier.popular ? palette.cream : palette.ink,
                      color: tier.popular ? palette.ink : palette.cream,
                      borderRadius: '9px',
                    }}
                  >
                    {currentTier === 'starter' || TIERS.findIndex(t => t.key === currentTier) < TIERS.findIndex(t => t.key === tier.key)
                      ? 'Upgrade'
                      : 'Switch Plan'}
                  </a>
                )
              ) : (
                <div
                  className="w-full text-center py-3 rounded-lg text-sm"
                  style={{ color: tier.popular ? palette.muted : palette.muted }}
                >
                  {isCurrent ? 'Current Plan' : 'Ask your admin to upgrade'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Role pool explanation */}
      <div
        className="mt-10 rounded-xl p-6"
        style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}` }}
      >
        <h3 className="text-lg font-semibold" style={{ color: palette.ink }}>
          How role pools work
        </h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: palette.secondary }}>
          Your plan includes a pool of roles that your entire team shares. Each recruiter
          picks which roles they want to track and schedules them across the week.
          Kurrent runs intelligence for the scheduled roles each day and delivers
          personalized briefings to each team member. Add as many team members as you
          want — the only limit is how many unique roles your plan supports.
        </p>
        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: palette.muted }}>Seats</p>
            <p className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>Unlimited</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: palette.muted }}>Briefings</p>
            <p className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>Daily</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: palette.muted }}>Per recruiter</p>
            <p className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>Personalized</p>
          </div>
        </div>
      </div>

      {/* Enterprise callout */}
      <div
        className="mt-6 rounded-xl p-6 text-center"
        style={{ backgroundColor: palette.ink }}
      >
        <h3 className="text-lg font-semibold" style={{ color: palette.cream }}>
          Need more than 25 roles?
        </h3>
        <p className="mt-1 text-sm" style={{ color: palette.muted }}>
          Enterprise plans come with unlimited roles, custom integrations, and dedicated support.
        </p>
        <a
          href="mailto:hello@kurrentlabs.com?subject=Kurrent%20Enterprise"
          className="inline-block mt-4 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            backgroundColor: palette.cream,
            color: palette.ink,
            borderRadius: '9px',
          }}
        >
          Talk to us
        </a>
      </div>
    </div>
  )
}
