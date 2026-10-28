'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Mail, Shield, User, X, Clock, RefreshCw } from 'lucide-react'
import { palette } from '@/lib/theme'

interface TeamMember {
  id: string
  user_id: string
  role: string
  contact_name?: string | null
  contact_email?: string | null
  created_at: string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

interface TeamManagementProps {
  clientName: string
}

// Shared styles matching SettingsForm
const cardStyle = {
  backgroundColor: palette.parchment,
  border: `1px solid ${palette.line}`,
  borderRadius: '14px',
  padding: '24px',
  marginBottom: '16px',
}

const sectionTitleStyle = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: '17px',
  fontWeight: 700 as const,
  color: palette.ink,
  marginBottom: '4px',
}

const sectionDescStyle = {
  fontSize: '13px',
  color: palette.secondary,
  marginBottom: '16px',
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: `1.5px solid ${palette.line}`,
  borderRadius: '10px',
  fontSize: '14px',
  color: palette.nearBlack,
  backgroundColor: '#fff',
  outline: 'none',
  fontFamily: 'Inter, -apple-system, sans-serif',
  transition: 'border-color 0.2s',
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600 as const,
  color: palette.ink,
  marginBottom: '6px',
}

export default function TeamManagement({ clientName }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchTeam = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invitations')
      if (!res.ok) throw new Error('Failed to load team')
      const data = await res.json()
      setMembers(data.members || [])
      setInvitations(data.invitations || [])
      setCurrentUserId(data.currentUserId || '')
    } catch {
      setError('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeam()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setSending(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send invitation')
        return
      }

      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('member')
      fetchTeam()
    } catch {
      setError('Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  const handleRevoke = async (invitationId: string) => {
    try {
      const res = await fetch('/api/invitations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      })

      if (!res.ok) throw new Error()
      setSuccess('Invitation revoked')
      fetchTeam()
    } catch {
      setError('Failed to revoke invitation')
    }
  }

  const getRoleBadge = (role: string) => {
    const isAdmin = role === 'admin' || role === 'owner'
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 10px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: isAdmin ? palette.line : '#E8F5E9',
          color: isAdmin ? '#8B7355' : '#2E7D32',
        }}
      >
        {isAdmin ? <Shield size={12} /> : <User size={12} />}
        {isAdmin ? 'Owner' : 'Recruiter'}
      </span>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...sectionTitleStyle }}>
          <Users size={18} />
          Team
        </div>
        <p style={{ fontSize: '14px', color: palette.secondary, marginTop: '12px' }}>Loading team...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Current Team Members */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...sectionTitleStyle }}>
              <Users size={18} />
              Team Members
            </div>
            <p style={sectionDescStyle}>
              People with access to {clientName}&apos;s portal
            </p>
          </div>
          <button
            onClick={fetchTeam}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: `1.5px solid ${palette.line}`,
              backgroundColor: '#fff',
              fontSize: '12px',
              color: palette.secondary,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map((member) => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: `1px solid ${palette.line}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: palette.line,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#8B7355',
                  }}
                >
                  {(member.contact_name || member.contact_email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: palette.ink }}>
                    {member.contact_name || 'Team Member'}
                    {member.user_id === currentUserId && (
                      <span style={{ fontSize: '11px', color: palette.secondary, marginLeft: '6px' }}>(you)</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: palette.secondary }}>
                    {member.contact_email || 'No email set'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getRoleBadge(member.role)}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p style={{ fontSize: '14px', color: palette.secondary, textAlign: 'center', padding: '20px' }}>
              No team members yet. Send an invite below.
            </p>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...sectionTitleStyle }}>
            <Clock size={18} />
            Pending Invitations
          </div>
          <p style={sectionDescStyle}>
            Invites waiting to be accepted
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: `1px dashed ${palette.line}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#FFF8E1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Mail size={16} style={{ color: '#F9A825' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: palette.ink }}>
                      {inv.email}
                    </div>
                    <div style={{ fontSize: '12px', color: palette.secondary }}>
                      Invited {formatDate(inv.created_at)} · Expires {formatDate(inv.expires_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getRoleBadge(inv.role)}
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    title="Revoke invitation"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      border: `1px solid ${palette.line}`,
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      color: palette.secondary,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Form */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...sectionTitleStyle }}>
          <UserPlus size={18} />
          Invite Team Member
        </div>
        <p style={sectionDescStyle}>
          Send an invitation to join {clientName}&apos;s portal. They&apos;ll sign in with Google or Microsoft.
        </p>

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: '#FFF5F5',
            border: '1px solid #FED7D7',
            color: '#C53030',
            fontSize: '13px',
            marginBottom: '12px',
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: '#F0FFF4',
            border: '1px solid #C6F6D5',
            color: '#276749',
            fontSize: '13px',
            marginBottom: '12px',
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleInvite}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Email address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setError(''); setSuccess('') }}
                placeholder="jordan@example.com"
                style={inputStyle}
                required
              />
            </div>
            <div style={{ width: '160px' }}>
              <label style={labelStyle}>Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'member')}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  appearance: 'none' as const,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237A7468' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '32px',
                }}
              >
                <option value="member">Recruiter</option>
                <option value="admin">Owner</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={sending || !inviteEmail.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: sending || !inviteEmail.trim() ? '#E8E3D9' : palette.ink,
                color: sending || !inviteEmail.trim() ? palette.secondary : palette.cream,
                fontSize: '14px',
                fontWeight: 600,
                cursor: sending || !inviteEmail.trim() ? 'default' : 'pointer',
                whiteSpace: 'nowrap' as const,
                transition: 'all 0.2s',
              }}
            >
              {sending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
