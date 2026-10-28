'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RecruiterConfig, Client } from '@/types/database'
import { Plus, X, AlertCircle, Check, Calendar, Briefcase, Search, MapPin } from 'lucide-react'
import { palette } from '@/lib/theme'

interface RoleSuggestion {
  title: string
  posting_count: number
  category: string | null
  seniority_default: string | null
}

interface LocationSuggestion {
  description: string
  place_id: string | null
  structured: string
}

interface RoleEntry {
  title: string
  function?: string
  seniority?: string          // legacy single-select (old configs)
  seniorities?: string[]      // multi-select (new format)
  locations?: string[]
}

const SENIORITY_LEVELS = [
  { key: 'IC', label: 'IC' },
  { key: 'Manager', label: 'Manager' },
  { key: 'Director', label: 'Director' },
  { key: 'VP', label: 'VP' },
  { key: 'C-Suite', label: 'C-suite' },
]

function getDemandTag(count: number): { label: string; style: React.CSSProperties } | null {
  if (count >= 50) return {
    label: 'HOT',
    style: { backgroundColor: palette.ink, color: palette.cream, padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }
  }
  if (count >= 10) return {
    label: 'WARM',
    style: { backgroundColor: 'transparent', color: palette.ink, padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', border: `1.5px solid ${palette.ink}` }
  }
  if (count >= 1) return {
    label: 'NICHE',
    style: { backgroundColor: palette.line, color: palette.ink, padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px' }
  }
  return null
}

interface MyRolesConfigProps {
  userId: string
  clientId: string
  client: Client
  userRole: 'admin' | 'member'
  teamRoleCount: number
}

const DAYS = [
  { key: 'mon', label: 'M', full: 'Monday' },
  { key: 'tue', label: 'T', full: 'Tuesday' },
  { key: 'wed', label: 'W', full: 'Wednesday' },
  { key: 'thu', label: 'Th', full: 'Thursday' },
  { key: 'fri', label: 'F', full: 'Friday' },
]

const TIER_LIMITS: Record<string, { roles: number; locations: number }> = {
  starter: { roles: 6, locations: 1 },
  growth: { roles: 12, locations: 3 },
  scale: { roles: 25, locations: 5 },
  founding_partner: { roles: 20, locations: 10 },
  enterprise: { roles: 999, locations: 999 },
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
  marginBottom: '4px',
}

const sectionDescStyle = {
  fontSize: '13px',
  color: palette.secondary,
  marginBottom: '20px',
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

export default function MyRolesConfig({ userId, clientId, client, userRole: _userRole, teamRoleCount }: MyRolesConfigProps) {
  const supabase = createClient()
  const [config, setConfig] = useState<RecruiterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>()

  const [roles, setRoles] = useState<RoleEntry[]>([])
  // Global locations kept for backward compatibility (pipeline reads target_locations)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_locations, setLocations] = useState<string[]>([])
  const [schedule, setSchedule] = useState<Record<string, string[]>>({})
  const [digestEnabled, setDigestEnabled] = useState(true)
  const [digestDays, setDigestDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri'])

  // Role search
  const [roleSearchQuery, setRoleSearchQuery] = useState('')
  const [roleSuggestions, setRoleSuggestions] = useState<RoleSuggestion[]>([])
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [roleSearchLoading, setRoleSearchLoading] = useState(false)
  const roleSearchRef = useRef<HTMLDivElement>(null)
  const roleDebounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Per-role location search — tracks which role card has location input open
  const [activeLocationRole, setActiveLocationRole] = useState<number | null>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const locationSearchRef = useRef<HTMLDivElement>(null)
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout>>()

  const limits = TIER_LIMITS[client.tier] || TIER_LIMITS.starter

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(undefined), 3000)
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (roleSearchRef.current && !roleSearchRef.current.contains(e.target as Node)) {
        setShowRoleDropdown(false)
      }
      if (locationSearchRef.current && !locationSearchRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false)
        setActiveLocationRole(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchRoleSuggestions = useCallback((query: string) => {
    if (roleDebounceRef.current) clearTimeout(roleDebounceRef.current)
    roleDebounceRef.current = setTimeout(async () => {
      setRoleSearchLoading(true)
      try {
        const params = new URLSearchParams({ limit: '8' })
        if (query) params.set('q', query)
        const res = await fetch(`/api/roles/suggestions?${params}`)
        if (res.ok) {
          const data = await res.json()
          setRoleSuggestions(data)
        }
      } catch {
        // Silently fail
      } finally {
        setRoleSearchLoading(false)
      }
    }, 200)
  }, [])

  const fetchLocationSuggestions = useCallback((query: string) => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current)
    locationDebounceRef.current = setTimeout(async () => {
      if (query.length < 2) { setLocationSuggestions([]); return }
      try {
        const res = await fetch(`/api/locations/autocomplete?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setLocationSuggestions(data)
        }
      } catch {
        // Silently fail
      }
    }, 250)
  }, [])

  // Fetch recruiter config
  useEffect(() => {
    async function fetchConfig() {
      const { data, error } = await supabase
        .from('recruiter_configs')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', userId)
        .single()

      if (data) {
        setConfig(data as RecruiterConfig)
        const loadedRoles = (data.target_roles || []) as RoleEntry[]
        // Migration: normalize old seniority string → seniorities array, populate locations from global
        const globalLocs = data.target_locations || []
        const migratedRoles = loadedRoles.map(r => ({
          ...r,
          seniorities: r.seniorities && r.seniorities.length > 0
            ? r.seniorities
            : [r.seniority || 'IC'],
          locations: r.locations && r.locations.length > 0 ? r.locations : [...globalLocs],
        }))
        setRoles(migratedRoles)
        setLocations(data.target_locations || [])
        setSchedule(data.schedule || {})
        setDigestEnabled(data.digest_enabled ?? true)
        setDigestDays(data.digest_days || ['mon', 'tue', 'wed', 'thu', 'fri'])
      } else if (error?.code === 'PGRST116') {
        const clientRoles = (client.target_roles || []) as RoleEntry[]
        const clientLocs = client.target_locations || []
        setRoles(clientRoles.map(r => ({
          ...r,
          seniorities: r.seniorities && r.seniorities.length > 0 ? r.seniorities : [r.seniority || 'IC'],
          locations: r.locations || [...clientLocs],
        })))
        setLocations(clientLocs)
      }
      setLoading(false)
    }
    fetchConfig()
  }, [clientId, userId])

  const handleRoleSearchChange = (value: string) => {
    setRoleSearchQuery(value)
    setShowRoleDropdown(true)
    fetchRoleSuggestions(value)
  }

  const handleSelectRole = (suggestion: RoleSuggestion) => {
    if (totalRolesUsed >= limits.roles) {
      showToast(`Role pool full (${limits.roles} on ${client.tier.replace('_', ' ')} tier)`, 'error')
      return
    }
    if (roles.some(r => r.title.toLowerCase() === suggestion.title.toLowerCase())) {
      showToast('Role already added', 'error')
      return
    }
    const newRole: RoleEntry = {
      title: suggestion.title,
      seniorities: [suggestion.seniority_default || 'IC'],
      locations: [],
    }
    setRoles(prev => [...prev, newRole])
    setRoleSearchQuery('')
    setShowRoleDropdown(false)
    setIsDirty(true)
    // Auto-open location input for the new role
    setActiveLocationRole(roles.length)
  }

  const toggleRoleSeniority = (index: number, level: string) => {
    setRoles(prev => prev.map((r, i) => {
      if (i !== index) return r
      const current = r.seniorities || [r.seniority || 'IC']
      if (current.includes(level)) {
        // Don't allow deselecting the last one
        if (current.length <= 1) return r
        return { ...r, seniorities: current.filter(s => s !== level) }
      }
      return { ...r, seniorities: [...current, level] }
    }))
    setIsDirty(true)
  }

  const addLocationToRole = (roleIndex: number, location: string) => {
    setRoles(prev => prev.map((r, i) => {
      if (i !== roleIndex) return r
      const locs = r.locations || []
      if (locs.some(l => l.toLowerCase() === location.toLowerCase())) return r
      // Check total unique locations across all roles
      const allLocs = new Set<string>()
      prev.forEach((role, idx) => {
        const roleLocs = idx === roleIndex ? [...locs, location] : (role.locations || [])
        roleLocs.forEach(l => allLocs.add(l.toLowerCase()))
      })
      if (allLocs.size > limits.locations) {
        showToast(`Your ${client.tier.replace('_', ' ')} plan allows up to ${limits.locations} unique locations`, 'error')
        return r
      }
      return { ...r, locations: [...locs, location] }
    }))
    setLocationQuery('')
    setShowLocationDropdown(false)
    setIsDirty(true)
  }

  const removeLocationFromRole = (roleIndex: number, locIndex: number) => {
    setRoles(prev => prev.map((r, i) => {
      if (i !== roleIndex) return r
      return { ...r, locations: (r.locations || []).filter((_, li) => li !== locIndex) }
    }))
    setIsDirty(true)
  }

  const removeRole = useCallback((index: number) => {
    const role = roles[index]
    setRoles(prev => prev.filter((_, i) => i !== index))
    if (role) {
      setSchedule(prev => {
        const next = { ...prev }
        delete next[role.title]
        return next
      })
    }
    if (activeLocationRole === index) setActiveLocationRole(null)
    else if (activeLocationRole !== null && activeLocationRole > index) setActiveLocationRole(activeLocationRole - 1)
    setIsDirty(true)
  }, [roles, activeLocationRole])

  const toggleDigestDay = useCallback((day: string) => {
    setDigestDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
    setIsDirty(true)
  }, [])

  // Compute unique locations across all roles (for tier limit display)
  const uniqueLocations = new Set<string>()
  roles.forEach(r => (r.locations || []).forEach(l => uniqueLocations.add(l.toLowerCase())))
  const uniqueLocationCount = uniqueLocations.size

  // Save — also maintain backward-compatible target_locations (union of all per-role locs)
  const handleSave = async () => {
    setSaving(true)
    try {
      const allLocs = new Set<string>()
      roles.forEach(r => (r.locations || []).forEach(l => allLocs.add(l)))

      // Backward compat: write singular `seniority` (first from array) so pipeline can read it
      const rolesForSave = roles.map(r => ({
        ...r,
        seniority: (r.seniorities && r.seniorities[0]) || r.seniority || 'IC',
      }))

      const payload = {
        client_id: clientId,
        user_id: userId,
        target_roles: rolesForSave,
        target_locations: Array.from(allLocs),
        schedule,
        digest_enabled: digestEnabled,
        digest_days: digestDays,
      }

      if (config) {
        const { error } = await supabase
          .from('recruiter_configs')
          .update(payload)
          .eq('id', config.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('recruiter_configs')
          .insert(payload)
        if (error) throw error
      }

      showToast('Roles & schedule saved')
      setIsDirty(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: palette.muted }}>
        Loading your roles...
      </div>
    )
  }

  const savedRoles = config?.target_roles || []
  const savedTitles = new Set(savedRoles.map((r: { title: string }) => r.title.toLowerCase()))
  const currentTitles = new Set(roles.map(r => r.title.toLowerCase()))
  const removedCount = [...savedTitles].filter(t => !currentTitles.has(t)).length
  const addedCount = [...currentTitles].filter(t => !savedTitles.has(t)).length
  const totalRolesUsed = teamRoleCount - removedCount + addedCount

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-16 md:top-4 right-4 left-4 sm:left-auto px-4 py-3 rounded-lg flex items-center gap-2 z-50"
          style={toast.type === 'success' ? {
            backgroundColor: palette.ink, color: palette.cream, border: `1px solid ${palette.ink}`,
          } : {
            backgroundColor: palette.line, color: palette.ink, border: '1px solid #E5E1D8',
          }}
        >
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {/* ========== ROLE POOL BAR ========== */}
      <div style={{
        ...cardStyle,
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={16} style={{ color: palette.secondary }} />
            <span style={{ fontSize: '14px', color: palette.secondary }}>
              Role pool ({client.tier.replace('_', ' ')} plan)
            </span>
          </div>
          <span style={{ fontSize: '14px', color: palette.ink, fontWeight: 600 }}>
            {totalRolesUsed} / {limits.roles} roles &middot; {uniqueLocationCount} / {limits.locations} locations
          </span>
        </div>
        <div style={{
          height: '6px',
          backgroundColor: palette.line,
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (totalRolesUsed / limits.roles) * 100)}%`,
            backgroundColor: totalRolesUsed >= limits.roles ? palette.muted : palette.ink,
            borderRadius: '3px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* ========== MY ROLES ========== */}
      <div style={cardStyle} className="p-4 sm:p-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Briefcase size={18} style={{ color: palette.ink }} />
          <div style={sectionTitleStyle}>My Roles</div>
        </div>
        <div style={sectionDescStyle}>
          Select role families, seniority levels, and locations for each role. One search per role-location combination.
        </div>

        {/* Predictive role search */}
        {totalRolesUsed < limits.roles ? (
          <div ref={roleSearchRef} style={{ position: 'relative', marginBottom: roles.length > 0 ? '20px' : '0' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: palette.muted }} />
              <input
                type="text"
                value={roleSearchQuery}
                onChange={e => handleRoleSearchChange(e.target.value)}
                onFocus={() => { setShowRoleDropdown(true); if (!roleSearchQuery) fetchRoleSuggestions('') }}
                placeholder="Search roles — e.g., Product Manager, Accountant, Civil Engineer..."
                style={{ ...inputStyle, paddingLeft: '36px' }}
              />
              {roleSearchLoading && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: `2px solid ${palette.line}`, borderTopColor: palette.ink, borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              )}
            </div>

            {showRoleDropdown && roleSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                backgroundColor: '#fff', border: `1.5px solid ${palette.line}`, borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(47,44,37,0.08)', zIndex: 30, overflow: 'hidden',
                maxHeight: '320px', overflowY: 'auto',
              }}>
                {(() => {
                  let lastCategory = ''
                  return roleSuggestions.map((s, i) => {
                    const tag = getDemandTag(s.posting_count)
                    const alreadyAdded = roles.some(r => r.title.toLowerCase() === s.title.toLowerCase())
                    const showCategory = s.category && s.category !== lastCategory
                    if (s.category) lastCategory = s.category
                    return (
                      <div key={i}>
                        {showCategory && (
                          <div style={{
                            padding: i === 0 ? '10px 16px 4px' : '12px 16px 4px',
                            fontSize: '11px', fontWeight: 600, color: palette.muted,
                            textTransform: 'uppercase' as const, letterSpacing: '0.5px',
                            borderTop: i === 0 ? 'none' : `1px solid ${palette.line}`,
                          }}>
                            {s.category}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => !alreadyAdded && handleSelectRole(s)}
                          disabled={alreadyAdded}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '10px 16px', border: 'none', backgroundColor: 'transparent',
                            cursor: alreadyAdded ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
                            opacity: alreadyAdded ? 0.45 : 1, transition: 'background-color 0.1s',
                          }}
                          onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.backgroundColor = palette.parchment }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: palette.ink }}>{s.title}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {tag && <span style={tag.style}>{tag.label}</span>}
                            <span style={{ fontSize: '12px', color: palette.muted }}>
                              {s.posting_count > 0 ? `${s.posting_count} postings` : ''}
                            </span>
                            {alreadyAdded ? <Check size={14} style={{ color: palette.muted }} /> : <Plus size={14} style={{ color: palette.muted }} />}
                          </div>
                        </button>
                      </div>
                    )
                  })
                })()}
              </div>
            )}

            {showRoleDropdown && roleSearchQuery.trim() && roleSuggestions.length === 0 && !roleSearchLoading && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                backgroundColor: '#fff', border: `1.5px solid ${palette.line}`, borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(47,44,37,0.08)', zIndex: 30, padding: '16px',
                textAlign: 'center', fontSize: '13px', color: palette.muted,
              }}>
                No matching roles found. Try a different search term.
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: palette.ink, fontWeight: 500, marginBottom: roles.length > 0 ? '20px' : '0' }}>
            Role pool is full ({limits.roles} roles on {client.tier.replace('_', ' ')} tier). Remove a role to add a new one.
          </p>
        )}

        {/* ========== ROLE CARDS ========== */}
        {roles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {roles.map((role, idx) => {
              const roleLocs = role.locations || []
              const isLocationInputActive = activeLocationRole === idx

              return (
                <div
                  key={`${role.title}-${idx}`}
                  style={{
                    backgroundColor: '#fff',
                    border: `1px solid ${palette.line}`,
                    borderRadius: '12px',
                    padding: '16px 20px',
                  }}
                >
                  {/* Role header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: palette.ink }}>
                      {role.title}
                    </span>
                    <button
                      onClick={() => removeRole(idx)}
                      type="button"
                      style={{
                        fontSize: '13px', color: palette.muted, cursor: 'pointer',
                        border: 'none', background: 'none', padding: '4px 8px',
                        borderRadius: '6px', fontFamily: 'Inter, sans-serif',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = palette.parchment; e.currentTarget.style.color = palette.ink }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = palette.muted }}
                    >
                      Remove
                    </button>
                  </div>

                  {/* Seniority (multi-select) */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: palette.muted, minWidth: '56px', fontWeight: 500 }}>Seniority</span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {SENIORITY_LEVELS.map(level => {
                          const activeLevels = role.seniorities || [role.seniority || 'IC']
                          const isActive = activeLevels.includes(level.key)
                          return (
                            <button
                              key={level.key}
                              type="button"
                              onClick={() => toggleRoleSeniority(idx, level.key)}
                              style={{
                                fontSize: '12px', padding: '5px 14px', borderRadius: '20px',
                                border: isActive ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
                                backgroundColor: isActive ? palette.ink : 'transparent',
                                color: isActive ? palette.cream : palette.secondary,
                                cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => {
                                if (!isActive) { e.currentTarget.style.backgroundColor = palette.parchment; e.currentTarget.style.borderColor = '#E5E1D8' }
                              }}
                              onMouseLeave={e => {
                                if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = palette.line }
                              }}
                            >
                              {level.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ marginLeft: '68px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: palette.muted }}>
                        Select multiple — each level is a separate search
                      </span>
                    </div>
                  </div>

                  {/* Locations */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: palette.muted, minWidth: '56px', fontWeight: 500, paddingTop: '6px' }}>Locations</span>
                    <div style={{ flex: 1 }}>
                      {/* Location tags */}
                      {roleLocs.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                          {roleLocs.map((loc, locIdx) => (
                            <span key={locIdx} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px', backgroundColor: palette.line, borderRadius: '6px',
                              fontSize: '12px', color: palette.ink, fontWeight: 500,
                            }}>
                              {loc}
                              <button
                                type="button"
                                onClick={() => removeLocationFromRole(idx, locIdx)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.secondary, padding: 0, display: 'flex', fontSize: '14px', lineHeight: 1 }}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add location button or input */}
                      {isLocationInputActive ? (
                        <div ref={locationSearchRef} style={{ position: 'relative' }}>
                          <div style={{ position: 'relative' }}>
                            <MapPin size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: palette.muted }} />
                            <input
                              type="text"
                              value={locationQuery}
                              onChange={e => {
                                setLocationQuery(e.target.value)
                                setShowLocationDropdown(true)
                                fetchLocationSuggestions(e.target.value)
                              }}
                              onFocus={() => { if (locationQuery.length >= 2) setShowLocationDropdown(true) }}
                              autoFocus
                              placeholder="Search cities..."
                              style={{
                                ...inputStyle,
                                paddingLeft: '30px',
                                padding: '7px 12px 7px 30px',
                                fontSize: '13px',
                                borderRadius: '8px',
                              }}
                            />
                          </div>

                          {showLocationDropdown && locationSuggestions.length > 0 && (
                            <div style={{
                              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                              backgroundColor: '#fff', border: `1.5px solid ${palette.line}`, borderRadius: '10px',
                              boxShadow: '0 8px 24px rgba(47,44,37,0.08)', zIndex: 30, overflow: 'hidden',
                              maxHeight: '200px', overflowY: 'auto',
                            }}>
                              {locationSuggestions.map((s, i) => {
                                const alreadyAdded = roleLocs.some(l => l.toLowerCase() === s.structured.toLowerCase())
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      if (!alreadyAdded) addLocationToRole(idx, s.structured)
                                    }}
                                    disabled={alreadyAdded}
                                    style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                      width: '100%', padding: '9px 14px', border: 'none', backgroundColor: 'transparent',
                                      cursor: alreadyAdded ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
                                      borderBottom: i < locationSuggestions.length - 1 ? `1px solid ${palette.line}` : 'none',
                                      opacity: alreadyAdded ? 0.45 : 1, transition: 'background-color 0.1s',
                                    }}
                                    onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.backgroundColor = palette.parchment }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <MapPin size={13} style={{ color: palette.muted }} />
                                      <span style={{ fontSize: '13px', color: palette.ink }}>{s.description}</span>
                                    </div>
                                    {alreadyAdded ? <Check size={13} style={{ color: palette.muted }} /> : <Plus size={13} style={{ color: palette.muted }} />}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveLocationRole(idx)
                            setLocationQuery('')
                            setLocationSuggestions([])
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '5px 12px', fontSize: '12px', color: palette.secondary,
                            border: '1.5px dashed #E5E1D8', borderRadius: '6px',
                            backgroundColor: 'transparent', cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif', fontWeight: 500,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = palette.ink; e.currentTarget.style.color = palette.ink }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E1D8'; e.currentTarget.style.color = palette.secondary }}
                        >
                          <Plus size={12} />
                          Add location
                        </button>
                      )}

                      {roleLocs.length === 0 && !isLocationInputActive && (
                        <span style={{ fontSize: '11px', color: palette.muted, display: 'block', marginTop: '4px' }}>
                          No locations — this role won&apos;t be searched until you add at least one
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ========== DIGEST PREFERENCES ========== */}
      <div style={cardStyle} className="p-4 sm:p-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Calendar size={18} style={{ color: palette.ink }} />
          <div style={sectionTitleStyle}>Digest Delivery</div>
        </div>
        <div style={sectionDescStyle}>
          Choose which days you receive your personalized lead briefing.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => { setDigestEnabled(!digestEnabled); setIsDirty(true) }}
            style={{
              width: '44px', height: '24px', borderRadius: '12px', border: 'none',
              backgroundColor: digestEnabled ? palette.ink : palette.line,
              cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s',
            }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '9px', backgroundColor: '#fff',
              position: 'absolute', top: '3px', left: digestEnabled ? '23px' : '3px',
              transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: '14px', color: palette.ink, fontWeight: 500 }}>
            {digestEnabled ? 'Digest enabled' : 'Digest paused'}
          </span>
        </div>

        {digestEnabled && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {DAYS.map(day => {
              const active = digestDays.includes(day.key)
              return (
                <button
                  key={day.key}
                  onClick={() => toggleDigestDay(day.key)}
                  title={day.full}
                  style={{
                    width: '44px', height: '38px', borderRadius: '8px',
                    border: active ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
                    backgroundColor: active ? palette.ink : '#fff',
                    color: active ? palette.cream : palette.muted,
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ========== STICKY SAVE BAR ========== */}
      {isDirty && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40"
          style={{
            backgroundColor: palette.cream, borderTop: `1.5px solid ${palette.line}`,
            padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px',
          }}
        >
          <button
            onClick={() => {
              if (config) {
                const loadedRoles = (config.target_roles || []) as RoleEntry[]
                const globalLocs = config.target_locations || []
                setRoles(loadedRoles.map(r => ({
                  ...r,
                  seniorities: r.seniorities && r.seniorities.length > 0 ? r.seniorities : [r.seniority || 'IC'],
                  locations: r.locations && r.locations.length > 0 ? r.locations : [...globalLocs],
                })))
                setLocations(config.target_locations || [])
                setSchedule(config.schedule || {})
                setDigestEnabled(config.digest_enabled ?? true)
                setDigestDays(config.digest_days || ['mon', 'tue', 'wed', 'thu', 'fri'])
              }
              setIsDirty(false)
            }}
            type="button"
            style={{
              padding: '10px 20px', fontSize: '13px', fontWeight: 600,
              backgroundColor: palette.line, color: '#5A5347', borderRadius: '10px',
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            style={{
              padding: '10px 28px', fontSize: '13px', fontWeight: 600,
              backgroundColor: palette.ink, color: palette.cream, borderRadius: '10px',
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
      {isDirty && <div style={{ height: '80px' }} />}

      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  )
}
