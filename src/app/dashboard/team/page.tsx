import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import TeamOverview from '@/components/TeamOverview'
import { Client } from '@/types/database'
import { palette } from '@/lib/theme'

export default async function TeamPage() {
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

  // Only admins can see Team View
  if (userRole !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>
          Team View
        </h1>
        <p className="mt-1" style={{ color: palette.secondary }}>
          See your team&apos;s role allocations, schedules, and pipeline
        </p>
      </div>

      <TeamOverview
        clientId={client.id}
        client={client}
      />
    </div>
  )
}
