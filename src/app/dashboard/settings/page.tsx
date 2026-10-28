import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import SettingsForm from '@/components/SettingsForm'
import TeamManagement from '@/components/TeamManagement'
import { Client } from '@/types/database'
import { palette } from '@/lib/theme'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const serviceClient = createServiceClient() || supabase

  if (!user) {
    return <div>Not authenticated</div>
  }

  const { data } = await serviceClient
    .from('user_clients')
    .select('id, client_id, user_id, role, contact_name, contact_title, contact_email, contact_phone, clients(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = data?.[0] || null

  if (!userClient?.clients) {
    return <div>Client not found</div>
  }

  const client = userClient.clients as unknown as Client
  // Normalize: 'owner' and 'admin' both get full access (Owner view)
  const rawRole = userClient.role as string
  const userRole: 'admin' | 'member' = (rawRole === 'admin' || rawRole === 'owner') ? 'admin' : 'member'

  // Pass the user's personal contact card from user_clients
  const userProfile = {
    id: userClient.id,
    user_id: userClient.user_id,
    client_id: userClient.client_id,
    contact_name: userClient.contact_name || null,
    contact_title: userClient.contact_title || null,
    contact_email: userClient.contact_email || null,
    contact_phone: userClient.contact_phone || null,
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold" style={{ color: palette.ink }}>
          {userRole === 'admin' ? 'Your Intelligence Profile' : 'Your Contact Card'}
        </h1>
        <p className="mt-1" style={{ color: palette.secondary }}>
          {userRole === 'admin'
            ? 'Manage your agency profile, contact card, and billing'
            : 'Update your contact details for Market Intelligence Reports'
          }
        </p>
      </div>

      <SettingsForm
        client={client}
        userEmail={user.email || ''}
        userRole={userRole}
        userProfile={userProfile}
      />

      {/* Team Management — only visible to admins */}
      {userRole === 'admin' && (
        <div className="mt-8">
          <div className="mb-6">
            <h2 className="text-xl font-serif font-bold" style={{ color: palette.ink }}>
              Team Management
            </h2>
            <p className="mt-1" style={{ color: palette.secondary }}>
              Manage your team and invite new members
            </p>
          </div>
          <TeamManagement clientName={client.agency_name} />
        </div>
      )}
    </div>
  )
}
