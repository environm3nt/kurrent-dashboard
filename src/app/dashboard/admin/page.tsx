import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'

import { isPlatformAdmin } from '@/lib/platform-admin'
import { palette } from '@/lib/theme'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const serviceClient = createServiceClient() || supabase

  if (!user || !isPlatformAdmin(user.email)) {
    redirect('/dashboard')
  }

  // --- Parallel data fetch: all 7 queries are independent ---
  const [
    { data: clients },
    { data: recentRuns },
    { data: recentUsage },
    { data: allLeads },
    { data: allUsers },
    { data: allConfigs },
    { data: pendingInvitations },
  ] = await Promise.all([
    serviceClient
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false }),
    serviceClient
      .from('pipeline_runs')
      .select('*, clients(agency_name)')
      .order('started_at', { ascending: false })
      .limit(50),
    serviceClient
      .from('api_usage')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(100),
    serviceClient
      .from('leads')
      .select('id, client_id, status, role_title, company_name, projected_fee, contact_quality, created_at, assigned_to_user_id')
      .order('created_at', { ascending: false }),
    serviceClient
      .from('user_clients')
      .select('id, user_id, client_id, role, contact_name, contact_email, created_at, clients(agency_name)')
      .order('created_at', { ascending: false }),
    serviceClient
      .from('recruiter_configs')
      .select('id, client_id, user_id, display_name, target_roles, target_locations, digest_enabled, digest_days')
      .order('created_at', { ascending: false }),
    serviceClient
      .from('client_invitations')
      .select('id, client_id, email, role, status, created_at, expires_at, clients(agency_name)')
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false }),
  ])

  // Calculate lead counts by client
  const leadsByClient: Record<string, number> = {}
  if (allLeads) {
    for (const lead of allLeads) {
      leadsByClient[lead.client_id] = (leadsByClient[lead.client_id] || 0) + 1
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>Admin Portal</h1>
        <p className="mt-1" style={{ color: palette.secondary }}>Kurrent internal — client management & pipeline monitoring</p>
      </div>

      <AdminDashboard
        clients={clients || []}
        recentRuns={recentRuns || []}
        recentUsage={recentUsage || []}
        leadsByClient={leadsByClient}
        allLeads={allLeads || []}
        allUsers={(allUsers || []).map((u: any) => ({ ...u, clients: Array.isArray(u.clients) ? u.clients[0] : u.clients }))}
        allConfigs={allConfigs || []}
        pendingInvitations={(pendingInvitations || []).map((i: any) => ({ ...i, clients: Array.isArray(i.clients) ? i.clients[0] : i.clients }))}
      />
    </div>
  )
}
