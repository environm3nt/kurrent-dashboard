import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import SignOutButton from '@/components/SignOutButton'
import { palette } from '@/lib/theme'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Use service role client for data queries — bypasses RLS.
  // Auth is already verified above via getUser(), so this is safe.
  // Falls back to anon client if service role key isn't available.
  const serviceClient = createServiceClient() || supabase

  // Get the client info for this user
  let { data: userClients } = await serviceClient
    .from('user_clients')
    .select('client_id, role, clients(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  let userClient = userClients?.[0] || null

  // Auto-provision: if no user_clients row, find a matching client
  if (!userClient && user.email) {
    // 1. Check contact_email match (primary owner)
    let matchingClient = (await serviceClient
      .from('clients')
      .select('id')
      .eq('contact_email', user.email)
      .single()
    ).data

    // 2. Check allowed_admin_emails array (additional owners configured per client)
    let provisionRole: 'admin' | 'member' = 'admin'
    if (!matchingClient) {
      const { data: adminMatch } = await serviceClient
        .from('clients')
        .select('id')
        .contains('allowed_admin_emails', [user.email])
        .single()

      if (adminMatch) {
        matchingClient = adminMatch
        provisionRole = 'admin'
      }
    }

    // 3. Check pending invitations for this email
    if (!matchingClient) {
      const now = new Date().toISOString()
      const { data: invitation } = await serviceClient
        .from('client_invitations')
        .select('id, client_id, role')
        .eq('email', user.email.toLowerCase())
        .eq('status', 'pending')
        .or(`expires_at.gt.${now},expires_at.is.null`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (invitation) {
        matchingClient = { id: invitation.client_id }
        provisionRole = invitation.role as 'admin' | 'member'

        // Mark invitation as accepted
        await serviceClient
          .from('client_invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', invitation.id)
      }
    }

    if (matchingClient) {
      await serviceClient
        .from('user_clients')
        .insert({
          user_id: user.id,
          client_id: matchingClient.id,
          role: provisionRole,
          contact_email: user.email,
          contact_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        })

      // Re-fetch with the new association
      const { data: newUserClients } = await serviceClient
        .from('user_clients')
        .select('client_id, role, clients(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)

      userClient = newUserClients?.[0] || null
    }
  }

  // If auto-provisioning couldn't find a matching client, show a helpful message
  // instead of an empty dashboard with no data
  if (!userClient) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: palette.cream }}>
        <div style={{
          maxWidth: '460px',
          textAlign: 'center',
          padding: '48px 32px',
          backgroundColor: palette.parchment,
          borderRadius: '14px',
          border: `1px solid ${palette.line}`,
        }}>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '24px',
            color: palette.ink,
            marginBottom: '12px',
          }}>
            Welcome to Kurrent
          </h1>
          <p style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '15px',
            color: palette.secondary,
            lineHeight: '1.6',
            marginBottom: '24px',
          }}>
            Your account ({user.email}) isn&apos;t linked to a client yet. This usually means your admin needs to add your email to the team.
          </p>
          <p style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '13px',
            color: palette.muted,
          }}>
            Contact your account admin or reach out to <a href="mailto:hello@kurrentlabs.com" style={{ color: palette.ink }}>hello@kurrentlabs.com</a> for help.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  const client = userClient?.clients as any
  const rawRole = userClient?.role as string
  const userRole: 'admin' | 'member' = (rawRole === 'admin' || rawRole === 'owner') ? 'admin' : 'member'

  return (
    <div className="flex h-screen" style={{ backgroundColor: palette.cream }}>
      <Sidebar
        userEmail={user.email || ''}
        clientName={client?.agency_name || 'Kurrent'}
        brandColor={client?.brand_primary_color || palette.ink}
        userRole={userRole}
      />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="px-4 py-5 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
