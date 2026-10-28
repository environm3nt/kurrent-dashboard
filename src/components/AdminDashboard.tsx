'use client'

import { useState } from 'react'
import { Client } from '@/types/database'
import {
  Users,
  DollarSign,
  FileText,
  Activity,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Shield,
  UserCheck,
  Mail,
  Building2,
} from 'lucide-react'
import { palette } from '@/lib/theme'

interface PipelineRun {
  id: string
  client_id: string
  status: string
  started_at: string
  completed_at?: string
  jobs_discovered: number
  leads_created: number
  cost_usd: number
  error_log?: string
  clients?: { agency_name: string }
}

interface ApiUsageRow {
  id: string
  client_id: string
  service: string
  credits_used: number
  cost_usd: number
  recorded_at: string
}

interface LeadSummary {
  id: string
  client_id: string
  status: string
  role_title: string
  company_name: string
  projected_fee: number | null
  contact_quality: string | null
  created_at: string
  assigned_to_user_id: string | null
}

interface UserSummary {
  id: string
  user_id: string
  client_id: string
  role: string
  contact_name: string | null
  contact_email: string | null
  created_at: string
  clients?: { agency_name: string }
}

interface ConfigSummary {
  id: string
  client_id: string
  user_id: string
  display_name: string | null
  target_roles: Array<{ title: string }>
  target_locations: string[]
  digest_enabled: boolean
  digest_days: string[]
}

interface InvitationSummary {
  id: string
  client_id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
  clients?: { agency_name: string }
}

interface AdminDashboardProps {
  clients: Client[]
  recentRuns: PipelineRun[]
  recentUsage: ApiUsageRow[]
  leadsByClient: Record<string, number>
  allLeads: LeadSummary[]
  allUsers: UserSummary[]
  allConfigs: ConfigSummary[]
  pendingInvitations: InvitationSummary[]
}

const TIER_PRICING: Record<string, number> = {
  starter: 499,
  growth: 799,
  scale: 1299,
  founding_partner: 0,
  enterprise: 0,
}

const cardStyle = {
  backgroundColor: palette.parchment,
  border: `1px solid ${palette.line}`,
  borderRadius: '14px',
  padding: '24px',
  marginBottom: '16px',
}

const statCardStyle = {
  backgroundColor: palette.parchment,
  border: `1px solid ${palette.line}`,
  borderRadius: '14px',
  padding: '20px',
}

const tierStyles: Record<string, { bg: string; color: string }> = {
  starter: { bg: palette.line, color: palette.ink },
  growth: { bg: palette.parchment, color: palette.ink },
  scale: { bg: palette.parchment, color: palette.ink },
  founding_partner: { bg: palette.parchment, color: palette.ink },
  enterprise: { bg: palette.parchment, color: palette.ink },
}

const roleStyles: Record<string, { bg: string; color: string }> = {
  owner: { bg: palette.ink, color: palette.cream },
  admin: { bg: palette.ink, color: palette.cream },
  member: { bg: palette.line, color: palette.ink },
}

function OverviewTab({
  clients,
  recentRuns,
  allLeads,
  allUsers,
  pendingInvitations,
}: {
  clients: Client[]
  recentRuns: PipelineRun[]
  allLeads: LeadSummary[]
  allUsers: UserSummary[]
  pendingInvitations: InvitationSummary[]
}) {
  const totalMRR = clients.reduce((sum, c) => sum + (TIER_PRICING[c.tier] || 0), 0)
  const customClients = clients.filter(c => !TIER_PRICING[c.tier] || TIER_PRICING[c.tier] === 0).length
  const successRate =
    recentRuns.length > 0
      ? Math.round((recentRuns.filter((r) => r.status === 'success').length / recentRuns.length) * 100)
      : 0

  // Recent activity from pipeline runs
  const recentActivity = recentRuns.slice(0, 5)

  // Alerts
  const failedRuns = recentRuns.filter(
    (r) =>
      r.status === 'failed' &&
      new Date(r.started_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
  )
  const zeroLeadRuns = recentRuns.filter((r) => r.leads_created === 0).slice(0, 3)
  const expiringInvitations = pendingInvitations.filter(
    (i) => new Date(i.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && i.status === 'pending'
  )
  const clientsNoConfigs = clients.filter((c) => !allUsers.some((u) => u.client_id === c.id))

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <DollarSign size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Projected MRR</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>${totalMRR.toLocaleString()}</p>
          <p style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>
            {totalMRR === 0 ? 'No paying clients yet' : `${customClients > 0 ? `+${customClients} custom · ` : ''}Pre-Stripe`}
          </p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <Building2 size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Active Clients</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{clients.length}</p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <FileText size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Total Leads</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{allLeads.length.toLocaleString()}</p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <TrendingUp size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Pipeline Health</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{successRate}%</p>
        </div>
      </div>

      {/* Revenue breakdown */}
      <div style={cardStyle}>
        <h2 className="font-serif font-bold text-lg mb-1" style={{ color: palette.ink }}>Revenue Breakdown</h2>
        <p style={{ fontSize: '12px', color: palette.muted, marginBottom: '16px' }}>Based on tier pricing — Stripe not yet connected</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(TIER_PRICING).map(([tier, price]) => {
            const count = clients.filter((c) => c.tier === tier).length
            const revenue = count * price
            return (
              <div key={tier} style={{ backgroundColor: palette.cream, border: `1px solid ${palette.line}`, borderRadius: '10px', padding: '14px' }}>
                <p style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600, textTransform: 'uppercase' }}>
                  {tier.replace(/_/g, ' ')}
                </p>
                <p className="font-serif font-bold text-lg" style={{ color: palette.ink, marginTop: '4px' }}>
                  {count > 0 ? `${count}` : '—'}
                </p>
                <p style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>
                  ${revenue.toLocaleString()}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div style={cardStyle}>
        <h2 className="font-serif font-bold text-lg mb-4" style={{ color: palette.ink }}>Recent Activity</h2>
        {recentActivity.length > 0 ? (
          <div className="space-y-0">
            {recentActivity.map((run) => {
              const agency = (run.clients as unknown as { agency_name: string })?.agency_name || 'Unknown'
              const date = new Date(run.started_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              const statusBg =
                run.status === 'success'
                  ? palette.parchment
                  : run.status === 'failed'
                    ? palette.parchment
                    : palette.parchment
              const statusColor = palette.ink

              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: `1px solid ${palette.line}` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          run.status === 'success' ? palette.ink : run.status === 'failed' ? palette.secondary : palette.muted,
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium" style={{ color: palette.ink }}>
                        {agency}
                      </p>
                      <p className="text-xs" style={{ color: palette.secondary }}>
                        {date} · {run.jobs_discovered} jobs · {run.leads_created} leads
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: '12px', color: palette.secondary }}>${Number(run.cost_usd).toFixed(2)}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: statusBg,
                        color: statusColor,
                        borderRadius: '6px',
                        padding: '4px 8px',
                        textTransform: 'capitalize',
                        border: `1px solid ${run.status === 'success' ? palette.line : palette.line}`,
                      }}
                    >
                      {run.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ color: palette.muted, fontSize: '14px' }}>No recent activity.</p>
        )}
      </div>

      {/* Alerts */}
      {(failedRuns.length > 0 || zeroLeadRuns.length > 0 || expiringInvitations.length > 0 || clientsNoConfigs.length > 0) && (
        <div style={cardStyle}>
          <h2 className="font-serif font-bold text-lg mb-4" style={{ color: palette.ink }}>Alerts</h2>
          <div className="space-y-3">
            {failedRuns.length > 0 && (
              <div className="flex items-start gap-3" style={{ padding: '12px', backgroundColor: palette.cream, borderRadius: '10px' }}>
                <AlertTriangle size={16} style={{ color: palette.secondary, marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: palette.ink }}>
                    {failedRuns.length} failed run{failedRuns.length > 1 ? 's' : ''} in last 24h
                  </p>
                  <p style={{ fontSize: '12px', color: palette.secondary, marginTop: '2px' }}>
                    {failedRuns.map((r) => (r.clients as unknown as { agency_name: string })?.agency_name || '?').join(', ')}
                  </p>
                </div>
              </div>
            )}

            {zeroLeadRuns.length > 0 && (
              <div className="flex items-start gap-3" style={{ padding: '12px', backgroundColor: palette.cream, borderRadius: '10px' }}>
                <AlertTriangle size={16} style={{ color: palette.secondary, marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: palette.ink }}>
                    {zeroLeadRuns.length} run{zeroLeadRuns.length > 1 ? 's' : ''} with 0 leads
                  </p>
                  <p style={{ fontSize: '12px', color: palette.secondary, marginTop: '2px' }}>Recent pipelines found no opportunities</p>
                </div>
              </div>
            )}

            {expiringInvitations.length > 0 && (
              <div className="flex items-start gap-3" style={{ padding: '12px', backgroundColor: palette.cream, borderRadius: '10px' }}>
                <AlertTriangle size={16} style={{ color: palette.secondary, marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: palette.ink }}>
                    {expiringInvitations.length} invitation{expiringInvitations.length > 1 ? 's' : ''} expiring soon
                  </p>
                  <p style={{ fontSize: '12px', color: palette.secondary, marginTop: '2px' }}>
                    {expiringInvitations.map((i) => i.email).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {clientsNoConfigs.length > 0 && (
              <div className="flex items-start gap-3" style={{ padding: '12px', backgroundColor: palette.cream, borderRadius: '10px' }}>
                <AlertTriangle size={16} style={{ color: palette.secondary, marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: palette.ink }}>
                    {clientsNoConfigs.length} client{clientsNoConfigs.length > 1 ? 's' : ''} with no users
                  </p>
                  <p style={{ fontSize: '12px', color: palette.secondary, marginTop: '2px' }}>Add team members to activate pipeline</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ClientsTab({
  clients,
  allLeads,
  allUsers,
}: {
  clients: Client[]
  allLeads: LeadSummary[]
  allUsers: UserSummary[]
}) {
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)

  return (
    <div>
      {clients.length > 0 ? (
        <div>
          {clients.map((client) => {
            const isExpanded = expandedClientId === client.id
            const clientLeads = allLeads.filter((l) => l.client_id === client.id)
            const clientUsers = allUsers.filter((u) => u.client_id === client.id)

            return (
              <div key={client.id} style={cardStyle}>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-serif font-bold"
                      style={{ backgroundColor: palette.line, color: palette.ink }}
                    >
                      {client.agency_initials || client.agency_name?.substring(0, 2) || '?'}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: palette.ink }}>
                        {client.agency_name || 'Unnamed'}
                      </p>
                      <p style={{ fontSize: '13px', color: palette.secondary }}>
                        {clientLeads.length} leads · {clientUsers.length} user{clientUsers.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        backgroundColor: tierStyles[client.tier].bg,
                        color: tierStyles[client.tier].color,
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        padding: '4px 10px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {client.tier.replace(/_/g, ' ')}
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={18} style={{ color: palette.muted }} />
                    ) : (
                      <ChevronDown size={18} style={{ color: palette.muted }} />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${palette.line}` }}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <p style={{ fontSize: '12px', color: palette.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                          Contact
                        </p>
                        <p style={{ fontSize: '14px', color: palette.ink, marginTop: '4px' }}>
                          {client.contact_name || '—'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: palette.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                          Timezone
                        </p>
                        <p style={{ fontSize: '14px', color: palette.ink, marginTop: '4px' }}>
                          {client.timezone || '—'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: palette.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                          Target Roles
                        </p>
                        <p style={{ fontSize: '14px', color: palette.ink, marginTop: '4px' }}>
                          {(client.target_roles || []).length} configured
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: palette.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                          Locations
                        </p>
                        <p style={{ fontSize: '14px', color: palette.ink, marginTop: '4px' }}>
                          {(client.target_locations || []).length > 0 ? (client.target_locations || []).join(', ') : '—'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: palette.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                          Sales Rep
                        </p>
                        <p style={{ fontSize: '14px', color: palette.ink, marginTop: '4px' }}>
                          {client.sales_rep_name || '—'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: palette.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                          PDFs
                        </p>
                        <p style={{ fontSize: '14px', color: palette.ink, marginTop: '4px' }}>
                          {client.generate_pdfs ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                    </div>

                    {clientUsers.length > 0 && (
                      <div>
                        <p style={{ fontSize: '13px', color: palette.secondary, fontWeight: 600, marginBottom: '12px' }}>Team Members</p>
                        <div className="space-y-2">
                          {clientUsers.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between"
                              style={{
                                padding: '10px',
                                backgroundColor: palette.cream,
                                borderRadius: '8px',
                                fontSize: '13px',
                              }}
                            >
                              <div>
                                <p style={{ color: palette.ink, fontWeight: 500 }}>
                                  {user.contact_name || 'No name'}
                                </p>
                                <p style={{ color: palette.secondary, fontSize: '12px' }}>
                                  {user.contact_email || '—'}
                                </p>
                              </div>
                              <span
                                style={{
                                  backgroundColor: roleStyles[user.role]?.bg || palette.line,
                                  color: roleStyles[user.role]?.color || palette.ink,
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {user.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={cardStyle}>
          <p style={{ color: palette.muted, fontSize: '14px', textAlign: 'center', padding: '20px' }}>
            No clients yet.
          </p>
        </div>
      )}
    </div>
  )
}

function PipelineTab({ recentRuns }: { recentRuns: PipelineRun[] }) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  const totalRuns = recentRuns.length
  const successCount = recentRuns.filter((r) => r.status === 'success').length
  const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0
  const avgLeadsPerRun = totalRuns > 0 ? Math.round(recentRuns.reduce((sum, r) => sum + r.leads_created, 0) / totalRuns) : 0
  const avgDuration = totalRuns > 0
    ? Math.round(
        recentRuns
          .filter((r) => r.completed_at)
          .reduce((sum, r) => sum + (new Date(r.completed_at!).getTime() - new Date(r.started_at).getTime()), 0) /
          (recentRuns.filter((r) => r.completed_at).length * 60000)
      )
    : 0

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <Activity size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Total Runs</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{totalRuns}</p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <TrendingUp size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Success Rate</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{successRate}%</p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <FileText size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Avg Leads/Run</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{avgLeadsPerRun}</p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <Clock size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Avg Duration</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{avgDuration}m</p>
        </div>
      </div>

      {/* Run history table */}
      <div style={cardStyle}>
        <h2 className="font-serif font-bold text-lg mb-4" style={{ color: palette.ink }}>Run History</h2>
        {recentRuns.length > 0 ? (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${palette.line}` }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Client
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Jobs
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Leads
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Duration
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Cost
                  </th>
                </tr>
              </thead>
              {recentRuns.map((run) => {
                  const isExpanded = expandedRunId === run.id
                  const agency = (run.clients as unknown as { agency_name: string })?.agency_name || 'Unknown'
                  const date = new Date(run.started_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const duration = run.completed_at
                    ? Math.round(
                        (new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 60000
                      )
                    : '—'

                  return (
                    <tbody key={run.id}>
                      <tr
                        style={{ borderBottom: `1px solid ${palette.line}`, cursor: 'pointer' }}
                        onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                      >
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                          {date}
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                          {agency}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor:
                                run.status === 'success'
                                  ? palette.parchment
                                  : run.status === 'failed'
                                    ? palette.parchment
                                    : palette.parchment,
                              color: palette.ink,
                              borderRadius: '6px',
                              padding: '4px 8px',
                              textTransform: 'capitalize',
                              border: `1px solid ${palette.line}`,
                            }}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                          {run.jobs_discovered}
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                          {run.leads_created}
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                          {duration}m
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                          ${Number(run.cost_usd).toFixed(2)}
                        </td>
                      </tr>
                      {isExpanded && run.error_log && (
                        <tr style={{ backgroundColor: palette.cream, borderBottom: `1px solid ${palette.line}` }}>
                          <td colSpan={7} style={{ padding: '16px' }}>
                            <p style={{ fontSize: '11px', color: palette.secondary, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {run.error_log}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  )
                })}
            </table>
          </div>
        ) : (
          <p style={{ color: palette.muted, fontSize: '14px' }}>No pipeline runs yet.</p>
        )}
      </div>
    </div>
  )
}

function CostsTab({ recentUsage }: { recentUsage: ApiUsageRow[] }) {
  const totalCost = recentUsage.reduce((sum, u) => sum + Number(u.cost_usd), 0)

  // Aggregate by service
  const byService: Record<string, { cost: number; credits: number }> = {}
  recentUsage.forEach((u) => {
    if (!byService[u.service]) {
      byService[u.service] = { cost: 0, credits: 0 }
    }
    byService[u.service].cost += Number(u.cost_usd)
    byService[u.service].credits += u.credits_used
  })

  const sortedServices = Object.entries(byService).sort((a, b) => b[1].cost - a[1].cost)

  return (
    <div>
      {/* Total spend card */}
      <div style={cardStyle}>
        <h2 className="font-serif font-bold text-lg mb-2" style={{ color: palette.ink }}>Total Spend</h2>
        <p className="font-serif font-bold text-4xl" style={{ color: palette.ink }}>
          ${totalCost.toFixed(2)}
        </p>
        <p style={{ fontSize: '12px', color: palette.secondary, marginTop: '8px' }}>
          Across {Object.keys(byService).length} service{Object.keys(byService).length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Cost breakdown */}
      <div style={cardStyle}>
        <h2 className="font-serif font-bold text-lg mb-4" style={{ color: palette.ink }}>Cost Breakdown by Service</h2>
        {sortedServices.length > 0 ? (
          <div className="space-y-4">
            {sortedServices.map(([service, data]) => {
              const percentage = totalCost > 0 ? ((data.cost / totalCost) * 100).toFixed(1) : '0'
              const barWidth = totalCost > 0 ? (data.cost / totalCost) * 100 : 0

              return (
                <div key={service}>
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ fontSize: '13px', fontWeight: 600, color: palette.ink, textTransform: 'capitalize' }}>
                      {service}
                    </p>
                    <div className="flex items-center gap-2">
                      <p style={{ fontSize: '13px', color: palette.ink, fontWeight: 600 }}>
                        ${data.cost.toFixed(2)}
                      </p>
                      <p style={{ fontSize: '12px', color: palette.secondary }}>
                        {percentage}%
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      backgroundColor: palette.line,
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: palette.ink,
                        width: `${barWidth}%`,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: palette.muted, marginTop: '2px' }}>
                    {data.credits} credits used
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ color: palette.muted, fontSize: '14px' }}>No API usage recorded yet.</p>
        )}
      </div>

      {/* Recent usage table */}
      <div style={cardStyle}>
        <h2 className="font-serif font-bold text-lg mb-4" style={{ color: palette.ink }}>Recent API Usage</h2>
        {recentUsage.length > 0 ? (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${palette.line}` }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Service
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Credits
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentUsage.slice(0, 50).map((usage) => {
                  const date = new Date(usage.recorded_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr key={usage.id} style={{ borderBottom: `1px solid ${palette.line}` }}>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                        {date}
                      </td>
                      <td
                        style={{
                          padding: '12px 8px',
                          fontSize: '13px',
                          color: palette.ink,
                          textTransform: 'capitalize',
                        }}
                      >
                        {usage.service}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                        {usage.credits_used}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                        ${Number(usage.cost_usd).toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: palette.muted, fontSize: '14px' }}>No API usage recorded yet.</p>
        )}
      </div>
    </div>
  )
}

function UsersTab({
  allUsers,
  pendingInvitations,
}: {
  allUsers: UserSummary[]
  pendingInvitations: InvitationSummary[]
}) {
  const totalUsers = allUsers.length
  const adminCount = allUsers.filter((u) => u.role === 'admin' || u.role === 'owner').length
  const recruiterCount = allUsers.filter((u) => u.role === 'member').length
  const pendingCount = pendingInvitations.filter((i) => i.status === 'pending').length

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <Users size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Total Users</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{totalUsers}</p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <Shield size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Admins</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{adminCount}</p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <UserCheck size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Recruiters</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{recruiterCount}</p>
        </div>

        <div style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: palette.line, borderRadius: '8px', padding: '6px' }}>
              <Mail size={16} style={{ color: palette.secondary }} />
            </div>
            <span style={{ fontSize: '12px', color: palette.secondary, fontWeight: 600 }}>Pending</span>
          </div>
          <p className="font-serif font-bold text-2xl" style={{ color: palette.ink }}>{pendingCount}</p>
        </div>
      </div>

      {/* Users table */}
      <div style={cardStyle}>
        <h2 className="font-serif font-bold text-lg mb-4" style={{ color: palette.ink }}>All Users</h2>
        {allUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${palette.line}` }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Client
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Role
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 8px',
                      fontSize: '11px',
                      color: palette.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => {
                  const clientName = (user.clients as unknown as { agency_name: string })?.agency_name || 'Unknown'
                  const date = new Date(user.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: '2-digit',
                  })

                  return (
                    <tr key={user.id} style={{ borderBottom: `1px solid ${palette.line}` }}>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink, fontWeight: 500 }}>
                        {user.contact_name || 'No name'}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.secondary }}>
                        {user.contact_email || '—'}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.ink }}>
                        {clientName}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: roleStyles[user.role]?.bg || palette.line,
                            color: roleStyles[user.role]?.color || palette.ink,
                            borderRadius: '6px',
                            padding: '4px 8px',
                            textTransform: 'capitalize',
                          }}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: palette.secondary }}>
                        {date}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: palette.muted, fontSize: '14px' }}>No users yet.</p>
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div style={cardStyle}>
          <h2 className="font-serif font-bold text-lg mb-4" style={{ color: palette.ink }}>Pending Invitations</h2>
          <div className="space-y-0">
            {pendingInvitations
              .filter((i) => i.status === 'pending')
              .map((invite) => {
                const clientName = (invite.clients as unknown as { agency_name: string })?.agency_name || 'Unknown'
                const expiresAt = new Date(invite.expires_at)
                const now = new Date()
                const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                const isExpiring = daysUntilExpiry <= 7
                const expiryText =
                  daysUntilExpiry <= 0
                    ? 'Expired'
                    : daysUntilExpiry === 1
                      ? 'Expires tomorrow'
                      : `Expires in ${daysUntilExpiry}d`

                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: `1px solid ${palette.line}` }}
                  >
                    <div>
                      <p style={{ fontSize: '13px', color: palette.ink, fontWeight: 500 }}>
                        {invite.email}
                      </p>
                      <p style={{ fontSize: '12px', color: palette.secondary }}>
                        {clientName} · {invite.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          fontSize: '12px',
                          color: isExpiring ? palette.secondary : palette.secondary,
                          fontWeight: 500,
                        }}
                      >
                        {expiryText}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: palette.line,
                          color: palette.ink,
                          borderRadius: '6px',
                          padding: '4px 8px',
                        }}
                      >
                        Pending
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard({
  clients,
  recentRuns,
  recentUsage,
  leadsByClient: _leadsByClient,
  allLeads,
  allUsers,
  allConfigs: _allConfigs,
  pendingInvitations,
}: AdminDashboardProps) {
  void _leadsByClient
  void _allConfigs
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'pipeline' | 'costs' | 'users'>('overview')

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'clients', label: 'Clients' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'costs', label: 'Costs' },
    { id: 'users', label: 'Users' },
  ] as const

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2" style={{ borderBottom: `1px solid ${palette.line}` }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              backgroundColor: activeTab === tab.id ? palette.ink : palette.line,
              color: activeTab === tab.id ? palette.cream : palette.ink,
              border: 'none',
              borderRadius: '9px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          clients={clients}
          recentRuns={recentRuns}
          allLeads={allLeads}
          allUsers={allUsers}
          pendingInvitations={pendingInvitations}
        />
      )}

      {activeTab === 'clients' && (
        <ClientsTab clients={clients} allLeads={allLeads} allUsers={allUsers} />
      )}

      {activeTab === 'pipeline' && <PipelineTab recentRuns={recentRuns} />}

      {activeTab === 'costs' && <CostsTab recentUsage={recentUsage} />}

      {activeTab === 'users' && (
        <UsersTab allUsers={allUsers} pendingInvitations={pendingInvitations} />
      )}
    </div>
  )
}
