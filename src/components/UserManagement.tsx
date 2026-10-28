'use client'

import { useState, useEffect } from 'react'
import { Users, Shield, UserCheck, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { palette } from '@/lib/theme'

interface UserClientRow {
  id: string
  user_id: string
  client_id: string
  role: string
  contact_name: string | null
  contact_email: string | null
  created_at: string
  clients?: { agency_name: string }
}

const cardStyle = {
  backgroundColor: palette.parchment,
  border: `1px solid ${palette.line}`,
  borderRadius: '14px',
  padding: '24px',
  marginBottom: '16px',
}

const roleDisplayMap: Record<string, { label: string; bg: string; color: string; icon: typeof Shield }> = {
  admin: { label: 'Owner', bg: '#EBE4F7', color: '#5B3F8F', icon: Shield },
  owner: { label: 'Owner', bg: '#EBE4F7', color: '#5B3F8F', icon: Shield },
  member: { label: 'Recruiter', bg: palette.line, color: palette.secondary, icon: UserCheck },
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      setError('Could not load users')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleRoleChange = async (userClientId: string, newRole: 'admin' | 'member', displayName: string) => {
    setUpdating(userClientId)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userClientId, role: newRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update role')
        return
      }

      setSuccess(`${displayName} is now ${newRole === 'admin' ? 'an Owner' : 'a Recruiter'}`)
      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === userClientId ? { ...u, role: newRole } : u
      ))

      // Clear success after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Network error updating role')
      console.error(err)
    } finally {
      setUpdating(null)
    }
  }

  // Group users by client
  const usersByClient: Record<string, { clientName: string; users: UserClientRow[] }> = {}
  for (const u of users) {
    const clientId = u.client_id
    const clientName = (u.clients as unknown as { agency_name: string })?.agency_name || 'Unknown Client'
    if (!usersByClient[clientId]) {
      usersByClient[clientId] = { clientName, users: [] }
    }
    usersByClient[clientId].users.push(u)
  }

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: palette.secondary }} />
          <h2 className="font-serif font-bold text-lg" style={{ color: palette.ink }}>User Management</h2>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ backgroundColor: palette.line, color: palette.secondary }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Role legend */}
      <div className="flex gap-4 mb-4" style={{ fontSize: '12px', color: palette.muted }}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#5B3F8F' }} />
          Owner — full settings, roles, markets, plan
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: palette.secondary }} />
          Recruiter — contact card for PDFs only
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#FDF2F2', color: '#A0522D' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#EEF5EE', color: '#3D6B3F' }}>
          {success}
        </div>
      )}

      {loading ? (
        <p style={{ color: palette.muted, fontSize: '14px' }}>Loading users...</p>
      ) : users.length === 0 ? (
        <p style={{ color: palette.muted, fontSize: '14px' }}>No users provisioned yet.</p>
      ) : (
        <div>
          {Object.entries(usersByClient).map(([clientId, { clientName, users: clientUsers }]) => {
            const isExpanded = expandedClient === clientId || Object.keys(usersByClient).length === 1

            return (
              <div key={clientId}>
                {/* Only show client header if multiple clients */}
                {Object.keys(usersByClient).length > 1 && (
                  <div
                    className="flex items-center justify-between py-2 cursor-pointer"
                    onClick={() => setExpandedClient(isExpanded ? null : clientId)}
                    style={{ borderBottom: `1px solid ${palette.line}` }}
                  >
                    <p className="font-semibold text-sm" style={{ color: palette.ink }}>{clientName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: palette.muted }}>{clientUsers.length} user{clientUsers.length !== 1 ? 's' : ''}</span>
                      {isExpanded ? <ChevronUp size={14} style={{ color: palette.muted }} /> : <ChevronDown size={14} style={{ color: palette.muted }} />}
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="py-2">
                    {clientUsers.map(uc => {
                      const roleInfo = roleDisplayMap[uc.role] || roleDisplayMap.member
                      const displayName = uc.contact_name || uc.contact_email || uc.user_id.substring(0, 8)
                      const isUpdating = updating === uc.id
                      const currentRole = uc.role === 'owner' ? 'admin' : uc.role
                      const newRole = currentRole === 'admin' ? 'member' : 'admin'

                      return (
                        <div
                          key={uc.id}
                          className="flex items-center justify-between py-3"
                          style={{ borderBottom: `1px solid ${palette.line}` }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: roleInfo.bg, color: roleInfo.color }}
                            >
                              {(uc.contact_name || uc.contact_email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium" style={{ color: palette.ink }}>
                                {uc.contact_name || 'No name set'}
                              </p>
                              <p className="text-xs" style={{ color: palette.secondary }}>
                                {uc.contact_email || `User ${uc.user_id.substring(0, 8)}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className="px-2.5 py-1 text-xs font-semibold rounded-full"
                              style={{ backgroundColor: roleInfo.bg, color: roleInfo.color }}
                            >
                              {roleInfo.label}
                            </span>
                            <button
                              onClick={() => handleRoleChange(uc.id, newRole, displayName)}
                              disabled={isUpdating}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                backgroundColor: isUpdating ? palette.line : (newRole === 'admin' ? '#EBE4F7' : palette.parchment),
                                color: isUpdating ? palette.muted : (newRole === 'admin' ? '#5B3F8F' : palette.secondary),
                                border: `1px solid ${newRole === 'admin' ? '#D6CCE8' : palette.line}`,
                                cursor: isUpdating ? 'wait' : 'pointer',
                                opacity: isUpdating ? 0.6 : 1,
                              }}
                            >
                              {isUpdating ? 'Updating...' : `Make ${newRole === 'admin' ? 'Owner' : 'Recruiter'}`}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
