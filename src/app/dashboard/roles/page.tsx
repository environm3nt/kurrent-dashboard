import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import MyRolesConfig from '@/components/MyRolesConfig'
import { Client } from '@/types/database'
import { palette } from '@/lib/theme'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const serviceClient = createServiceClient() || supabase

  if (!user) {
    return <div>Not authenticated</div>
  }

  // Get user's client association
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

  // Get total roles used across all team members
  const { data: allConfigs } = await serviceClient
    .from('recruiter_configs')
    .select('target_roles')
    .eq('client_id', client.id)

  // Collect unique role titles across the team (role pool is shared, deduped by title)
  const allRoleTitles = new Set<string>()
  for (const cfg of allConfigs || []) {
    const roles = cfg.target_roles as Array<{ title: string }> | null
    if (roles) {
      for (const r of roles) {
        allRoleTitles.add(r.title.toLowerCase())
      }
    }
  }
  const teamRoleCount = allRoleTitles.size

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>
          My Roles
        </h1>
        <p className="mt-1" style={{ color: palette.secondary }}>
          Configure which roles you&apos;re tracking and plan your weekly lead generation schedule
        </p>
      </div>

      <MyRolesConfig
        userId={user.id}
        clientId={client.id}
        client={client}
        userRole={userRole}
        teamRoleCount={teamRoleCount}
      />
    </div>
  )
}
