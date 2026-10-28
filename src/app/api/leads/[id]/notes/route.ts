import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * GET /api/leads/[id]/notes
 *
 * Returns all notes for a lead, ordered by created_at ascending.
 * Returns: { notes: Array<{ id, lead_id, user_id, user_name, content, created_at }> }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params

  // --- Auth check ---
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Service client for data queries ---
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

  // --- Verify lead belongs to this client ---
  const { data: lead, error: leadError } = await serviceClient
    .from('leads')
    .select('id, client_id')
    .eq('id', leadId)
    .eq('client_id', userClient.client_id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // --- Query notes ordered by created_at ascending ---
  const { data: notes, error: notesError } = await serviceClient
    .from('lead_notes')
    .select('id, lead_id, user_id, user_name, content, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (notesError) {
    console.error('[NOTES-API] Query failed:', notesError)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }

  return NextResponse.json({ notes: notes || [] })
}

/**
 * POST /api/leads/[id]/notes
 *
 * Create a new note on a lead.
 * Request body: { content: string }
 * Returns: { note: { id, lead_id, user_id, user_name, content, created_at } }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params

  // --- Auth check ---
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Service client for data queries ---
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

  // --- Verify lead belongs to this client ---
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

  const { content } = body

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content is required and must be non-empty' }, { status: 400 })
  }

  // --- Get user's display name from user_clients or recruiter_configs ---
  let userName = 'Unknown User'

  const { data: userProfile } = await serviceClient
    .from('user_clients')
    .select('contact_name')
    .eq('user_id', user.id)
    .eq('client_id', userClient.client_id)
    .single()

  if (userProfile?.contact_name) {
    userName = userProfile.contact_name
  } else {
    // Fallback: try recruiter_configs for display_name
    const { data: recruiterConfig } = await serviceClient
      .from('recruiter_configs')
      .select('display_name')
      .eq('user_id', user.id)
      .eq('client_id', userClient.client_id)
      .single()

    if (recruiterConfig?.display_name) {
      userName = recruiterConfig.display_name
    }
  }

  // --- Insert the note ---
  const { data: newNote, error: insertError } = await serviceClient
    .from('lead_notes')
    .insert({
      lead_id: leadId,
      client_id: userClient.client_id,
      user_id: user.id,
      user_name: userName,
      content: content.trim(),
    })
    .select('id, lead_id, user_id, user_name, content, created_at')
    .single()

  if (insertError) {
    console.error('[NOTES-API] Insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }

  return NextResponse.json({ note: newNote }, { status: 201 })
}
