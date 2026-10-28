import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import WeekPlanner from '@/components/WeekPlanner'
import { palette } from '@/lib/theme'

export default async function SchedulePage() {
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
  const clientId = userClient?.client_id

  if (!clientId || !client) {
    return <div>No client linked</div>
  }

  return (
    <div>
      <h1
        className="text-2xl font-serif font-bold"
        style={{ color: palette.ink }}
      >
        Plan Your Week
      </h1>
      <p className="mt-1 mb-6" style={{ color: palette.secondary, fontSize: '14px' }}>
        Decide which roles to go after each day. Drag roles between days to plan your lead generation.
      </p>

      <WeekPlanner
        userId={user.id}
        clientId={clientId}
      />
    </div>
  )
}
