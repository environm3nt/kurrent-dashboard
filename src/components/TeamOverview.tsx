'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RecruiterConfig, Client, UserClient } from '@/types/database'
import { Briefcase, MapPin, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { palette } from '@/lib/theme'

interface LeadAssignment {
  id: string
  company_name: string
  role_title: string
  assigned_to_user_id: string | null
  status: string
  projected_fee: number | null
  updated_at: string
}

interface TeamMember {
  userClient: UserClient
  config: RecruiterConfig | null
  leadCount: number
  pipelineValue: number
  revenueWon: number
}

interface TeamOverviewProps {
  clientId: string
  client: Client
}

const TIER_LIMITS: Record<string, { roles: number; locations: number }> = {
  starter: { roles: 6, locations: 1 },
  growth: { roles: 12, locations: 3 },
  scale: { roles: 25, locations: 5 },
  founding_partner: { roles: 20, locations: 10 },
  enterprise: { roles: 999, locations: 999 },
}

const DAYS_SHORT: Record<string, string> = {
  mon: 'M', tue: 'T', wed: 'W', thu: 'Th', fri: 'F',
}

const cardStyle = {
  backgroundColor: palette.parchment,
  border: `1px solid ${palette.line}`,
  borderRadius: '14px',
  marginBottom: '16px',
}

const sectionTitleStyle = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '17px',
  fontWeight: 700 as const,
  color: palette.ink,
}

export default function TeamOverview({ clientId, client }: TeamOverviewProps) {
  const supabase = createClient()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [allLeads, setAllLeads] = useState<LeadAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)

  const limits = TIER_LIMITS[client.tier] || TIER_LIMITS.starter

  useEffect(() => {
    async function fetchTeam() {
      // Fetch team members
      const { data: userClients } = await supabase
        .from('user_clients')
        .select('*')
        .eq('client_id', clientId)

      // Fetch all recruiter configs
      const { data: configs } = await supabase
        .from('recruiter_configs')
        .select('*')
        .eq('client_id', clientId)

      // Fetch leads for stats and assignments table
      const { data: leads } = await supabase
        .from('leads')
        .select('id, company_name, role_title, assigned_to_user_id, projected_fee, status, updated_at')
        .eq('client_id', clientId)
        .not('status', 'in', '("Archived")')
        .order('updated_at', { ascending: false })

      const allLeads = (leads || []) as unknown as LeadAssignment[]

      const memberList: TeamMember[] = (userClients || []).map(uc => {
        const config = (configs || []).find(c => c.user_id === uc.user_id) as RecruiterConfig | undefined
        const memberLeads = allLeads.filter(l => l.assigned_to_user_id === uc.user_id)
        const pipelineValue = memberLeads
          .filter(l => l.status !== 'Won' && l.status !== 'Lost')
          .reduce((sum, l) => sum + (Number(l.projected_fee) || 0), 0)
        const revenueWon = memberLeads
          .filter(l => l.status === 'Won')
          .reduce((sum, l) => sum + (Number(l.projected_fee) || 0), 0)

        return {
          userClient: uc as UserClient,
          config: config || null,
          leadCount: memberLeads.length,
          pipelineValue,
          revenueWon,
        }
      })

      setMembers(memberList)
      setAllLeads(allLeads)
      setLoading(false)
    }
    fetchTeam()
  }, [clientId])

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: palette.muted }}>
        Loading team...
      </div>
    )
  }

  // Count UNIQUE roles across all recruiters (not duplicates)
  const uniqueRoles = new Set<string>()
  members.forEach(m => {
    (m.config?.target_roles || []).forEach(role => uniqueRoles.add(role.title.toLowerCase().trim()))
  })
  const totalRolesUsed = uniqueRoles.size
  const totalPipeline = members.reduce((sum, m) => sum + m.pipelineValue, 0)
  const totalRevenueWon = members.reduce((sum, m) => sum + m.revenueWon, 0)

  // Build display name map for assignments table
  const nameMap: Record<string, string> = {}
  members.forEach(m => {
    const name = m.config?.display_name || m.userClient.contact_name || m.userClient.contact_email || 'Unknown'
    nameMap[m.userClient.user_id] = name
  })

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* ========== TEAM STATS (4 cards per mockup) ========== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ ...cardStyle, padding: '20px', marginBottom: 0 }}>
          <div style={{ fontSize: '32px', fontWeight: 400, color: palette.ink, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1, marginBottom: '4px' }}>
            {members.length}
          </div>
          <div style={{ fontSize: '12.5px', color: palette.secondary }}>Active recruiters</div>
          <div style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>Unlimited seats</div>
        </div>
        <div style={{ ...cardStyle, padding: '20px', marginBottom: 0 }}>
          <div style={{ fontSize: '32px', fontWeight: 400, color: palette.ink, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1, marginBottom: '4px' }}>
            {totalRolesUsed} / {limits.roles}
          </div>
          <div style={{ fontSize: '12.5px', color: palette.secondary }}>Roles allocated</div>
          <div style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>{client.tier.replace('_', ' ')} tier</div>
        </div>
        <div style={{ ...cardStyle, padding: '20px', marginBottom: 0 }}>
          <div style={{ fontSize: '32px', fontWeight: 400, color: palette.ink, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1, marginBottom: '4px' }}>
            ${totalPipeline.toLocaleString()}
          </div>
          <div style={{ fontSize: '12.5px', color: palette.secondary }}>Team pipeline</div>
          <div style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>Across all stages</div>
        </div>
        <div style={{ ...cardStyle, padding: '20px', marginBottom: 0 }}>
          <div style={{ fontSize: '32px', fontWeight: 400, color: palette.ink, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1, marginBottom: '4px' }}>
            ${totalRevenueWon.toLocaleString()}
          </div>
          <div style={{ fontSize: '12.5px', color: palette.secondary }}>Revenue won</div>
          <div style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>This month</div>
        </div>
      </div>

      {/* ========== ROLE ALLOCATION BAR ========== */}
      <div style={{ ...cardStyle, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: palette.ink }}>
            Role Allocation
          </span>
          <span style={{ fontSize: '12px', color: palette.muted }}>
            {totalRolesUsed} of {limits.roles} roles · {client.tier.replace('_', ' ')} tier · unlimited seats
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: palette.line,
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min((totalRolesUsed / limits.roles) * 100, 100)}%`,
            height: '100%',
            backgroundColor: palette.ink,
            borderRadius: '4px',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* ========== RECRUITER CARDS ========== */}
      <div style={{ marginBottom: '8px' }}>
        <div style={sectionTitleStyle}>Team Members</div>
      </div>

      {members.map(member => {
        const expanded = expandedMember === member.userClient.user_id
        const roleCount = member.config?.target_roles?.length || 0
        const roleName = member.userClient.role === 'admin' || member.userClient.role === 'owner' ? 'Admin' : 'Recruiter'

        return (
          <div key={member.userClient.id} style={cardStyle}>
            {/* Header */}
            <button
              onClick={() => setExpandedMember(expanded ? null : member.userClient.user_id)}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: palette.ink,
                color: palette.cream,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
                flexShrink: 0,
              }}>
                {(member.config?.display_name || member.userClient.contact_name || member.userClient.contact_email || '?')
                  .split(' ')
                  .map(w => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
                }
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: palette.ink }}>
                  {member.config?.display_name || member.userClient.contact_name || member.userClient.contact_email || 'Team Member'}
                </div>
                <div style={{ fontSize: '12px', color: palette.muted, display: 'flex', gap: '12px', marginTop: '2px' }}>
                  <span>{roleName}</span>
                  <span>{roleCount} roles</span>
                  <span>{member.leadCount} leads</span>
                  {member.pipelineValue > 0 && (
                    <span>${member.pipelineValue.toLocaleString()} pipeline</span>
                  )}
                </div>
              </div>

              {/* Role badge */}
              <span style={{
                padding: '3px 10px',
                backgroundColor: member.userClient.role === 'admin' || member.userClient.role === 'owner' ? palette.ink : palette.line,
                color: member.userClient.role === 'admin' || member.userClient.role === 'owner' ? palette.cream : palette.ink,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
              }}>
                {roleName}
              </span>

              {expanded ? <ChevronUp size={18} style={{ color: palette.muted }} /> : <ChevronDown size={18} style={{ color: palette.muted }} />}
            </button>

            {/* Expanded details */}
            {expanded && member.config && (
              <div style={{
                padding: '0 20px 20px',
                borderTop: `1px solid ${palette.line}`,
                marginTop: 0,
              }}>
                {/* Roles with schedule */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: palette.ink, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Briefcase size={14} /> Roles & Schedule
                  </div>
                  {(member.config.target_roles || []).length === 0 ? (
                    <div style={{ fontSize: '13px', color: palette.muted, fontStyle: 'italic' }}>No roles configured</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {member.config.target_roles.map((role, idx) => {
                        const days = member.config!.schedule?.[role.title] || []
                        return (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            border: `1px solid ${palette.line}`,
                          }}>
                            <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: palette.ink }}>
                              {role.title}
                            </span>
                            <div style={{ display: 'flex', gap: '3px' }}>
                              {days.length > 0 ? days.sort().map(d => (
                                <span key={d} style={{
                                  width: '24px', height: '24px', borderRadius: '6px',
                                  backgroundColor: palette.ink, color: palette.cream,
                                  fontSize: '10px', fontWeight: 700,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {DAYS_SHORT[d] || d}
                                </span>
                              )) : (
                                <span style={{ fontSize: '11px', color: palette.muted }}>No days</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Locations */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: palette.ink, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} /> Locations
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(member.config.target_locations || []).map((loc, idx) => (
                      <span key={idx} style={{
                        padding: '4px 10px',
                        backgroundColor: '#fff',
                        border: `1px solid ${palette.line}`,
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: palette.ink,
                      }}>
                        {loc}
                      </span>
                    ))}
                    {(member.config.target_locations || []).length === 0 && (
                      <span style={{ fontSize: '12px', color: palette.muted, fontStyle: 'italic' }}>No locations configured</span>
                    )}
                  </div>
                </div>

                {/* Digest status */}
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={14} style={{ color: palette.secondary }} />
                  <span style={{ fontSize: '12px', color: palette.secondary }}>
                    Digest: {member.config.digest_enabled ? `Enabled (${(member.config.digest_days || []).map(d => DAYS_SHORT[d]).join(', ')})` : 'Paused'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {members.length === 0 && (
        <div style={{
          ...cardStyle,
          padding: '40px',
          textAlign: 'center',
          color: palette.muted,
          fontSize: '14px',
        }}>
          No team members yet. Invite recruiters from the Settings page.
        </div>
      )}

      {/* ========== ALL LEAD ASSIGNMENTS TABLE ========== */}
      {allLeads.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <div style={{ ...sectionTitleStyle, marginBottom: '16px' }}>All Lead Assignments</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Lead', 'Role', 'Assigned To', 'Stage', 'Est. Fee', 'Last Activity'].map(h => (
                  <th key={h} style={{
                    textAlign: h === 'Est. Fee' ? 'right' : 'left',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    color: palette.muted,
                    padding: '10px 12px',
                    borderBottom: `1px solid ${palette.line}`,
                    fontWeight: 600,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allLeads.slice(0, 20).map(lead => {
                const assignedName = lead.assigned_to_user_id ? nameMap[lead.assigned_to_user_id] : null
                const isUnassigned = !lead.assigned_to_user_id
                const stageLabel = lead.status === 'Viewed' ? 'Meeting' : lead.status
                const stageIsDark = ['Contacted', 'Viewed', 'Meeting', 'Won', 'Proposal'].includes(lead.status)
                const feeDisplay = lead.projected_fee
                  ? `$${Number(lead.projected_fee).toLocaleString()}`
                  : '—'
                const lastActivity = new Date(lead.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                return (
                  <tr
                    key={lead.id}
                    style={{
                      backgroundColor: isUnassigned ? 'rgba(241, 234, 221, 0.3)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '14px 12px', fontSize: '13.5px', borderBottom: `1px solid ${palette.line}`, fontWeight: 600, color: palette.ink }}>
                      {lead.company_name}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13.5px', borderBottom: `1px solid ${palette.line}`, color: palette.secondary }}>
                      {lead.role_title}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13.5px', borderBottom: `1px solid ${palette.line}` }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 500,
                        backgroundColor: isUnassigned ? 'transparent' : palette.parchment,
                        border: isUnassigned ? `1px dashed ${palette.line}` : `1px solid ${palette.line}`,
                        color: isUnassigned ? palette.muted : palette.ink,
                      }}>
                        {assignedName || 'Unassigned'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13.5px', borderBottom: `1px solid ${palette.line}` }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        backgroundColor: stageIsDark ? palette.ink : palette.line,
                        color: stageIsDark ? palette.cream : palette.ink,
                      }}>
                        {stageLabel}
                      </span>
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13.5px', borderBottom: `1px solid ${palette.line}`, textAlign: 'right', fontWeight: 500 }}>
                      {feeDisplay}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13.5px', borderBottom: `1px solid ${palette.line}`, color: palette.muted }}>
                      {lastActivity}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
