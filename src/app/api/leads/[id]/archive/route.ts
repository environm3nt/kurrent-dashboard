import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/leads/[id]/archive
 *
 * Soft-delete a lead by setting its status to 'Archived'.
 * Requires user confirmation (archive is a destructive operation).
 *
 * Request body: (no body required, status is set to 'Archived')
 * Returns: { success: true }
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params

  // --- Auth check (anon client for auth only) ---
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Service client for data queries (bypasses RLS) ---
  const serviceClient = createServiceClient() || supabase

  // --- Get user's client mapping ---
  const { data: userData, error: ucError } = await serviceClient
    .from('user_clients')
    .select('client_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = userData?.[0] || null

  if (ucError || !userClient) {
    return NextResponse.json({ error: 'No client access' }, { status: 403 })
  }

  // --- Get the lead and verify ownership ---
  const { data: lead, error: leadError } = await serviceClient
    .from('leads')
    .select('id, client_id, company_name, role_title')
    .eq('id', leadId)
    .eq('client_id', userClient.client_id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // --- Archive the lead by setting status to 'Archived' ---
  const { error: updateError } = await serviceClient
    .from('leads')
    .update({
      status: 'Archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (updateError) {
    console.error('[ARCHIVE-API] Archive failed:', updateError)
    return NextResponse.json({ error: 'Failed to archive lead' }, { status: 500 })
  }

  console.log(`[ARCHIVE-API] Lead archived: ${leadId} (${lead.company_name} - ${lead.role_title})`)

  return NextResponse.json({ success: true })
}
