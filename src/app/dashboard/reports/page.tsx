import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ReportLibrary from '@/components/ReportLibrary'
import { Client, Lead, IndustryBrief } from '@/types/database'
import { palette } from '@/lib/theme'

export default async function ReportsPage() {
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

  if (!userClient?.clients) {
    return <div>Client not found</div>
  }

  const client = userClient.clients as unknown as Client
  const rawRole = userClient.role as string
  const userRole: 'admin' | 'member' = (rawRole === 'admin' || rawRole === 'owner') ? 'admin' : 'member'

  // --- Parallel data fetch: both queries only depend on client.id ---
  const [
    { data: leads },
    { data: briefs },
  ] = await Promise.all([
    serviceClient
      .from('leads')
      .select('*')
      .eq('client_id', client.id)
      .order('date_identified', { ascending: false }),
    serviceClient
      .from('industry_briefs')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>
          Reports
        </h1>
        <p className="mt-1" style={{ color: palette.secondary }}>
          Your intelligence briefing library and report branding
        </p>
      </div>

      <ReportLibrary
        client={client}
        leads={(leads || []) as Lead[]}
        industryBriefs={(briefs || []) as IndustryBrief[]}
        userRole={userRole}
      />
    </div>
  )
}
