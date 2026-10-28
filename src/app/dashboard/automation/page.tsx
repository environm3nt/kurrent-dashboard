import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import AutomationConfig from '@/components/AutomationConfig'
import { Client } from '@/types/database'
import { palette } from '@/lib/theme'

export default async function AutomationPage() {
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>
          Automation
        </h1>
        <p className="mt-1" style={{ color: palette.secondary }}>
          Configure the roles, markets, and delivery settings for your daily intelligence runs
        </p>
      </div>

      <AutomationConfig
        client={client}
        userRole={userRole}
      />
    </div>
  )
}
