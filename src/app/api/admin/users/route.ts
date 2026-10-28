import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

import { isPlatformAdmin } from '@/lib/platform-admin'

/**
 * GET /api/admin/users
 *
 * List all user-client associations with user email info.
 * Admin-only (email-gated).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all user_clients with their associated auth user emails
  const { data: userClients, error } = await supabase
    .from('user_clients')
    .select('id, user_id, client_id, role, contact_name, contact_email, created_at, clients(agency_name)')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Admin API] Error fetching user_clients:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  // Get auth user emails from auth.users via admin lookup
  // Since we're using anon key, we can't query auth.users directly.
  // Instead, return the contact_email from user_clients and the user_id for reference.
  // The admin page will pass the list of user IDs to resolve emails via a separate lookup.

  return NextResponse.json({ users: userClients || [] })
}

/**
 * PATCH /api/admin/users
 *
 * Change a user's role. Admin-only (email-gated).
 * Body: { userClientId: string, role: 'admin' | 'member' }
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { userClientId, role } = body

  if (!userClientId || !['admin', 'member'].includes(role)) {
    return NextResponse.json(
      { error: 'Invalid request. Provide userClientId and role (admin or member).' },
      { status: 400 }
    )
  }

  // Prevent demoting yourself
  const { data: targetRow } = await supabase
    .from('user_clients')
    .select('user_id')
    .eq('id', userClientId)
    .single()

  if (targetRow?.user_id === user.id && role === 'member') {
    return NextResponse.json(
      { error: 'Cannot demote yourself. Another admin must change your role.' },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase
    .from('user_clients')
    .update({ role })
    .eq('id', userClientId)

  if (updateError) {
    console.error('[Admin API] Error updating role:', updateError)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  return NextResponse.json({ success: true, userClientId, role })
}
