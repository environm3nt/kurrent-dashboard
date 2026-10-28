import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import UnifiedLeads from '@/components/UnifiedLeads'
import { Lead } from '@/types/database'

export default async function LeadsPage() {
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

  const client = userClient.clients as any
  const rawRole = userClient.role as string
  const userRole: 'admin' | 'member' = (rawRole === 'admin' || rawRole === 'owner') ? 'admin' : 'member'

  // --- Parallel data fetch ---
  const [
    { data: leads },
    { data: teamConfigs },
    { data: userClients },
    noteResult,
  ] = await Promise.all([
    // All leads (including archived for search, component filters them)
    serviceClient
      .from('leads')
      .select('*')
      .eq('client_id', client.id)
      .order('date_identified', { ascending: false }),
    // Team configs for assignment dropdown
    serviceClient
      .from('recruiter_configs')
      .select('user_id, display_name')
      .eq('client_id', client.id),
    // User clients for team member names
    serviceClient
      .from('user_clients')
      .select('user_id, contact_name, contact_email')
      .eq('client_id', client.id),
    // All notes for this client's leads — wrapped to handle missing table
    (async () => {
      try {
        return await serviceClient
          .from('lead_notes')
          .select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: true })
      } catch {
        // lead_notes table may not exist yet; return empty
        return { data: null }
      }
    })(),
  ])

  // Build team members list
  const teamMembers = (userClients || []).map(uc => {
    const config = (teamConfigs || []).find((c: any) => c.user_id === uc.user_id)
    return {
      user_id: uc.user_id,
      display_name: config?.display_name || uc.contact_name || uc.contact_email || 'Team Member',
    }
  })

  // Group notes by lead_id
  const notesByLead: Record<string, any[]> = {}
  const notesData = noteResult?.data || []
  for (const note of notesData) {
    if (!notesByLead[note.lead_id]) notesByLead[note.lead_id] = []
    notesByLead[note.lead_id].push(note)
  }

  return (
    <UnifiedLeads
      leads={(leads || []) as Lead[]}
      userId={user.id}
      teamMembers={teamMembers}
      userRole={userRole}
      initialNotes={notesByLead}
    />
  )
}
