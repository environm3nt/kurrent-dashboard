import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import StatsCards from '@/components/StatsCards'
import LeadBriefingCards from '@/components/LeadBriefingCards'
import BriefingGreeting from '@/components/BriefingGreeting'
import RoleRecommendations from '@/components/RoleRecommendations'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const serviceClient = createServiceClient() || supabase

  // Get user's client + name + role
  const { data } = await serviceClient
    .from('user_clients')
    .select('client_id, contact_name, role')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = data?.[0] || null
  const clientId = userClient?.client_id
  const userName = userClient?.contact_name || user?.user_metadata?.full_name || user?.user_metadata?.name || null
  const isAdmin = userClient?.role === 'admin' || userClient?.role === 'owner'

  // Today's date in Eastern time (team's timezone) — NOT UTC
  // Vercel runs in UTC, so after 8pm EDT the UTC day flips to tomorrow.
  // en-CA locale gives YYYY-MM-DD format matching date_identified in the DB.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // --- Parallel data fetch ---
  const [
    { data: recruiterConfig },
    { data: myLeadsData },
    { data: latestLeads },
    { data: lastRun },
  ] = await Promise.all([
    // Recruiter config for this user
    serviceClient
      .from('recruiter_configs')
      .select('target_roles, target_locations, schedule, digest_enabled')
      .eq('client_id', clientId || '')
      .eq('user_id', user!.id)
      .single(),
    // My leads with status, contact quality, date, and assignment
    serviceClient
      .from('leads')
      .select('status, contact_quality, date_identified, assigned_to_user_id')
      .eq('client_id', clientId || ''),
    // Latest leads for briefing cards (newest first, limit 5)
    serviceClient
      .from('leads')
      .select('*')
      .eq('client_id', clientId || '')
      .order('date_identified', { ascending: false })
      .limit(5),
    // Last pipeline run date for the greeting context
    serviceClient
      .from('pipeline_runs')
      .select('started_at')
      .eq('client_id', clientId || '')
      .order('started_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  // Scope leads: recruiters see only their assigned leads, admins see all
  const allLeads = myLeadsData || []
  const scopedLeads = isAdmin
    ? allLeads
    : allLeads.filter(l => l.assigned_to_user_id === user!.id)

  // Stat 1: New today — leads from today's pipeline run assigned to me
  const newToday = scopedLeads.filter(l =>
    l.date_identified && l.date_identified >= todayStr
  ).length

  // Stat 2: Ready to contact — my leads with verified contacts still actionable
  const readyToContact = scopedLeads.filter(l =>
    l.contact_quality === 'verified' &&
    l.status !== 'Won' && l.status !== 'Lost' && l.status !== 'Archived'
  ).length

  // Stat 3: To review — my leads still in New status (untouched)
  const toReview = scopedLeads.filter(l => l.status === 'New').length

  // Stat 4: Placements — my leads moved to Won/Placed status
  const placements = scopedLeads.filter(l => l.status === 'Won').length

  // Secondary stats
  const totalScopedLeads = scopedLeads.length
  const contactRate = totalScopedLeads > 0
    ? Math.round((scopedLeads.filter(l => l.contact_quality === 'verified').length / totalScopedLeads) * 100)
    : 0

  // Get today's day key
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const todayKey = dayKeys[new Date().getDay()]

  // Figure out which roles are active today
  const schedule = (recruiterConfig?.schedule || {}) as Record<string, string[]>
  const todayRoles = recruiterConfig?.target_roles
    ? (recruiterConfig.target_roles as Array<{ title: string }>).filter(role => {
        const days = schedule[role.title] || []
        return days.length === 0 || days.includes(todayKey)
      }).map(r => r.title)
    : []

  return (
    <div>
      <BriefingGreeting
        userName={userName}
        newLeadCount={newToday}
        latestRunDate={lastRun?.started_at || null}
        todayRoles={todayRoles}
      />

      <StatsCards
        newToday={newToday}
        readyToContact={readyToContact}
        toReview={toReview}
        placements={placements}
        totalLeads={totalScopedLeads}
        contactRate={contactRate}
      />

      <div className="mt-6 sm:mt-8">
        <LeadBriefingCards leads={latestLeads || []} />
      </div>

      <RoleRecommendations
        currentRoles={todayRoles}
        locations={(recruiterConfig?.target_locations as string[]) || []}
      />
    </div>
  )
}
