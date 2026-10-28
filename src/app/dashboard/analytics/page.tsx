import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '@/lib/platform-admin'
import { palette } from '@/lib/theme'

const runStatusStyles: Record<string, { bg: string; color: string }> = {
  success: { bg: '#EEF5EE', color: '#3D6B3F' },
  failed: { bg: '#FDF2F2', color: '#A0522D' },
  running: { bg: '#FEF7E6', color: '#8B7620' },
  queued: { bg: palette.line, color: palette.secondary },
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Restrict to Kurrent-internal admins only — this is ops data, not client-facing
  if (!user?.email || !isPlatformAdmin(user.email)) {
    redirect('/dashboard')
  }

  const serviceClient = createServiceClient() || supabase

  const { data } = await serviceClient
    .from('user_clients')
    .select('client_id')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = data?.[0] || null

  // --- Parallel data fetch: both queries only depend on clientId ---
  const [
    { data: pipelineRuns },
    { data: apiUsage },
  ] = await Promise.all([
    serviceClient
      .from('pipeline_runs')
      .select('*')
      .eq('client_id', userClient?.client_id || '')
      .order('started_at', { ascending: false })
      .limit(30),
    serviceClient
      .from('api_usage')
      .select('*')
      .eq('client_id', userClient?.client_id || '')
      .order('recorded_at', { ascending: false })
      .limit(50),
  ])

  const totalCost = apiUsage?.reduce((sum, u) => sum + Number(u.cost_usd), 0) || 0
  const totalRuns = pipelineRuns?.length || 0
  const successRuns = pipelineRuns?.filter(r => r.status === 'success').length || 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>Analytics</h1>
        <p className="mt-1" style={{ color: palette.secondary }}>Pipeline performance and usage metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}`, borderRadius: '14px', padding: '24px' }}>
          <p className="text-sm" style={{ color: palette.secondary }}>Total Pipeline Runs</p>
          <p className="text-3xl font-serif font-bold mt-1" style={{ color: palette.ink }}>{totalRuns}</p>
        </div>
        <div style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}`, borderRadius: '14px', padding: '24px' }}>
          <p className="text-sm" style={{ color: palette.secondary }}>Success Rate</p>
          <p className="text-3xl font-serif font-bold mt-1" style={{ color: '#5C8A5E' }}>
            {totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0}%
          </p>
        </div>
        <div style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}`, borderRadius: '14px', padding: '24px' }}>
          <p className="text-sm" style={{ color: palette.secondary }}>Total API Cost</p>
          <p className="text-3xl font-serif font-bold mt-1" style={{ color: palette.ink }}>${totalCost.toFixed(2)}</p>
        </div>
      </div>

      <div style={{ backgroundColor: palette.parchment, border: `1px solid ${palette.line}`, borderRadius: '14px', padding: '24px' }}>
        <h2 className="font-serif font-bold text-lg mb-4" style={{ color: palette.ink }}>Recent Pipeline Runs</h2>
        {pipelineRuns && pipelineRuns.length > 0 ? (
          <div>
            {pipelineRuns.map((run) => {
              const s = runStatusStyles[run.status] || runStatusStyles.queued
              return (
                <div key={run.id} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${palette.line}` }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: palette.ink }}>
                      {new Date(run.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs" style={{ color: palette.secondary }}>
                      {run.leads_created} leads created · {run.jobs_discovered} jobs discovered
                    </p>
                  </div>
                  <span
                    className="px-2.5 py-1 text-xs font-semibold rounded-full"
                    style={{ backgroundColor: s.bg, color: s.color }}
                  >
                    {run.status}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm" style={{ color: palette.muted }}>No pipeline runs yet. Data will appear after the first pipeline execution.</p>
        )}
      </div>
    </div>
  )
}
