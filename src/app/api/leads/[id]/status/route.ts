import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/leads/[id]/status
 *
 * Update a lead's status field.
 * Valid statuses: 'New', 'Reviewing', 'Contacted', 'Viewed', 'Proposal', 'Won', 'Lost', 'Archived'
 *
 * Request body: { status: string }
 * Returns: { success: true } on success
 */
export async function PATCH(
  request: Request,
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
    .select('id, client_id')
    .eq('id', leadId)
    .eq('client_id', userClient.client_id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // --- Parse request body ---
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status } = body

  // --- Validate status ---
  const validStatuses = ['New', 'Reviewing', 'Contacted', 'Viewed', 'Proposal', 'Won', 'Lost', 'Archived']
  if (!status || typeof status !== 'string' || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  // --- Update the lead's status ---
  const { error: updateError } = await serviceClient
    .from('leads')
    .update({
      status: status as string,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (updateError) {
    console.error('[STATUS-API] Update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
