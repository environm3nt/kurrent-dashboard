'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Client } from '@/types/database'
import { X, Plus, Search, Check, AlertCircle, Zap, MapPin, Mail, Clock } from 'lucide-react'
import { palette } from '@/lib/theme'

interface AutomationConfigProps {
  client: Client
  userRole: 'admin' | 'member'
}

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

interface FormData {
  target_roles: Array<{ title: string; seniority: string; seniorities?: string[]; locations?: string[]; [key: string]: unknown }>
  target_locations: string[]
  digest_recipients: string[]
  digest_send_time: string
  timezone: string
}

const TIER_LIMITS: Record<string, { roles: number; locations: number; resultsPerRole: number }> = {
  starter: { roles: 6, locations: 1, resultsPerRole: 3 },
  growth: { roles: 12, locations: 3, resultsPerRole: 3 },
  scale: { roles: 25, locations: 5, resultsPerRole: 3 },
  founding_partner: { roles: 20, locations: 10, resultsPerRole: 5 },
  enterprise: { roles: 999, locations: 999, resultsPerRole: 999 },
}

const SENIORITIES = ['IC', 'Manager', 'Director', 'VP', 'C-Suite']

const TIMEZONES = [
  'America/Toronto', 'America/Vancouver', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Edmonton', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Singapore', 'Asia/Hong_Kong',
  'Australia/Sydney', 'Australia/Melbourne',
]

const DIGEST_WINDOWS = [
  { value: '06:00', label: 'Early Morning (6-8 AM)' },
  { value: '08:00', label: 'Morning (8-10 AM)' },
  { value: '11:00', label: 'Midday (11 AM-1 PM)' },
  { value: '14:00', label: 'Afternoon (2-4 PM)' },
]

// Demand tag thresholds
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

const cardStyle = {
  backgroundColor: palette.parchment,
  border: `1px solid ${palette.line}`,
  borderRadius: '14px',
  marginBottom: '16px',
}

const labelStyle = {
  display: 'block' as const,
  fontSize: '13px',
  fontWeight: 600 as const,
  color: palette.ink,
  marginBottom: '6px',
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
  marginBottom: '20px',
}

export default function AutomationConfig({ client, userRole }: AutomationConfigProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<FormData>({
    target_roles: (client.target_roles || []).map((r: any) => ({
      ...r,
      title: r.title || '',
      seniority: r.seniority || (r.seniorities?.[0]) || 'IC',
    })),
    target_locations: client.target_locations || [],
    digest_recipients: (client.digest_recipients?.to || []).filter(Boolean),
    digest_send_time: client.digest_send_time || '08:00',
    timezone: client.timezone || 'America/Toronto',
  })

  const [originalData] = useState<FormData>(formData)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>()
  const toastTimeoutRef = useRef<NodeJS.Timeout>()

  // Role search state
  const [roleSearchQuery, setRoleSearchQuery] = useState('')
  const [roleSuggestions, setRoleSuggestions] = useState<RoleSuggestion[]>([])
  const [roleSearchLoading, setRoleSearchLoading] = useState(false)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [selectedSeniority, setSelectedSeniority] = useState('IC')
  const roleSearchRef = useRef<HTMLDivElement>(null)
  const roleDebounceRef = useRef<NodeJS.Timeout>()

  // Location search state
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [locationSearchLoading, setLocationSearchLoading] = useState(false)
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const locationSearchRef = useRef<HTMLDivElement>(null)
  const locationDebounceRef = useRef<NodeJS.Timeout>()

  const limits = TIER_LIMITS[client.tier]

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(undefined), 3000)
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (roleSearchRef.current && !roleSearchRef.current.contains(e.target as Node)) {
        setShowRoleDropdown(false)
      }
      if (locationSearchRef.current && !locationSearchRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch role suggestions with debounce
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
        // Silently fail — user can still type custom roles
      } finally {
        setRoleSearchLoading(false)
      }
    }, 200)
  }, [])

  // Fetch location suggestions with debounce
  const fetchLocationSuggestions = useCallback((query: string) => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current)
    locationDebounceRef.current = setTimeout(async () => {
      if (query.length < 2) { setLocationSuggestions([]); return }
      setLocationSearchLoading(true)
      try {
        const res = await fetch(`/api/locations/autocomplete?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setLocationSuggestions(data)
        }
      } catch {
        // Silently fail
      } finally {
        setLocationSearchLoading(false)
      }
    }, 250)
  }, [])

  const handleRoleSearchChange = (value: string) => {
    setRoleSearchQuery(value)
    setShowRoleDropdown(true)
    fetchRoleSuggestions(value)
  }

  const handleSelectRole = (suggestion: RoleSuggestion) => {
    if (formData.target_roles.length >= limits.roles) {
      showToast(`Your ${client.tier.replace('_', ' ')} plan allows up to ${limits.roles} roles`, 'error')
      return
    }
    // Check for duplicate
    if (formData.target_roles.some(r => r.title.toLowerCase() === suggestion.title.toLowerCase())) {
      showToast('This role is already added', 'error')
      return
    }
    setFormData(prev => ({
      ...prev,
      target_roles: [...prev.target_roles, {
        title: suggestion.title,
        seniority: suggestion.seniority_default || selectedSeniority,
      }]
    }))
    setRoleSearchQuery('')
    setShowRoleDropdown(false)
    setIsDirty(true)
  }

  const handleAddCustomRole = () => {
    if (!roleSearchQuery.trim()) return
    if (formData.target_roles.length >= limits.roles) {
      showToast(`Your ${client.tier.replace('_', ' ')} plan allows up to ${limits.roles} roles`, 'error')
      return
    }
    if (formData.target_roles.some(r => r.title.toLowerCase() === roleSearchQuery.trim().toLowerCase())) {
      showToast('This role is already added', 'error')
      return
    }
    setFormData(prev => ({
      ...prev,
      target_roles: [...prev.target_roles, { title: roleSearchQuery.trim(), seniority: selectedSeniority }]
    }))
    setRoleSearchQuery('')
    setShowRoleDropdown(false)
    setIsDirty(true)
  }

  const handleRemoveRole = useCallback((index: number) => {
    setFormData(prev => ({ ...prev, target_roles: prev.target_roles.filter((_, i) => i !== index) }))
    setIsDirty(true)
  }, [])

  const handleLocationSearchChange = (value: string) => {
    setLocationQuery(value)
    setShowLocationDropdown(true)
    fetchLocationSuggestions(value)
  }

  const handleSelectLocation = (suggestion: LocationSuggestion) => {
    if (formData.target_locations.length >= limits.locations) {
      showToast(`Your ${client.tier.replace('_', ' ')} plan allows up to ${limits.locations} locations`, 'error')
      return
    }
    // Use the structured format for pipeline compatibility
    const locationValue = suggestion.structured
    if (formData.target_locations.includes(locationValue)) {
      showToast('This location is already added', 'error')
      return
    }
    setFormData(prev => ({ ...prev, target_locations: [...prev.target_locations, locationValue] }))
    setLocationQuery('')
    setShowLocationDropdown(false)
    setIsDirty(true)
  }

  const handleRemoveLocation = useCallback((index: number) => {
    setFormData(prev => ({ ...prev, target_locations: prev.target_locations.filter((_, i) => i !== index) }))
    setIsDirty(true)
  }, [])

  const handleUpdateSeniority = useCallback((index: number, seniority: string) => {
    setFormData(prev => {
      const updated = [...prev.target_roles]
      updated[index] = { ...updated[index], seniority }
      return { ...prev, target_roles: updated }
    })
    setIsDirty(true)
  }, [])

  const handleDigestRecipientChange = useCallback((index: number, value: string) => {
    setFormData(prev => {
      const newRecipients = [...prev.digest_recipients]
      newRecipients[index] = value
      return { ...prev, digest_recipients: newRecipients }
    })
    setIsDirty(true)
  }, [])

  const handleSave = async () => {
    if (!isDirty) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          target_roles: formData.target_roles,
          target_locations: formData.target_locations,
          digest_recipients: {
            to: formData.digest_recipients.filter(Boolean),
            cc: [],
            from: 'Kurrent <kurrent@kurrentlabs.com>',
            replyTo: 'hello@kurrentlabs.com',
          },
          digest_send_time: formData.digest_send_time,
          timezone: formData.timezone,
        })
        .eq('id', client.id)
      if (error) throw error
      showToast('Automation settings saved — changes take effect on next run')
      setIsDirty(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (userRole === 'member') {
    return (
      <div style={cardStyle} className="p-6 text-center">
        <p className="font-serif font-bold text-lg mb-2" style={{ color: palette.ink }}>Owner Access Required</p>
        <p className="text-sm" style={{ color: palette.secondary }}>
          Only account owners can configure automation settings. Contact your admin to make changes.
        </p>
      </div>
    )
  }

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

      {/* Next run indicator */}
      <div style={{ ...cardStyle, backgroundColor: palette.ink }} className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: palette.line, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} style={{ color: palette.ink }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: palette.cream }}>
              Your automation is active
            </p>
            <p className="text-xs" style={{ color: palette.muted }}>
              Changes you make here take effect on the next scheduled run. Your plan: {limits.roles} roles, {limits.locations} locations.
            </p>
          </div>
        </div>
      </div>

      {/* ========== ROLES — PREDICTIVE SEARCH ========== */}
      <div style={cardStyle} className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Search size={18} style={{ color: palette.ink }} />
          <div style={sectionTitleStyle}>Roles You&apos;re Watching</div>
        </div>
        <div style={sectionDescStyle}>Search for roles — demand signals update daily from live job market data</div>

        {/* Current roles as chips */}
        {formData.target_roles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '16px' }}>
            {formData.target_roles.map((role, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', backgroundColor: palette.line, borderRadius: '10px', border: '1px solid #E5E1D8',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: palette.ink }}>{role.title}</span>
                  <select
                    value={role.seniority}
                    onChange={e => handleUpdateSeniority(i, e.target.value)}
                    style={{
                      fontSize: '11px', color: palette.secondary, backgroundColor: 'transparent', border: 'none',
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif', outline: 'none', padding: '0',
                    }}
                  >
                    {SENIORITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button onClick={() => handleRemoveRole(i)} type="button" style={{ color: palette.muted, cursor: 'pointer', border: 'none', background: 'none', padding: '0', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: palette.muted }}>
            Using {formData.target_roles.length} of {limits.roles} roles
          </span>
        </div>

        {/* Predictive role search */}
        {formData.target_roles.length < limits.roles && (
          <div ref={roleSearchRef} style={{ position: 'relative' as const }}>
            <div style={{ position: 'relative' as const }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: palette.muted }} />
              <input
                type="text"
                value={roleSearchQuery}
                onChange={e => handleRoleSearchChange(e.target.value)}
                onFocus={() => { setShowRoleDropdown(true); if (!roleSearchQuery) fetchRoleSuggestions('') }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomRole() } }}
                placeholder="Search roles — e.g., Senior Accountant, Paralegal, Software Engineer..."
                style={{ ...inputStyle, paddingLeft: '36px' }}
              />
              {roleSearchLoading && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: `2px solid ${palette.line}`, borderTopColor: palette.ink, borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              )}
            </div>

            {/* Suggestions dropdown */}
            {showRoleDropdown && (roleSuggestions.length > 0 || roleSearchQuery.trim()) && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                backgroundColor: '#fff', border: `1.5px solid ${palette.line}`, borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(47,44,37,0.08)', zIndex: 30, overflow: 'hidden',
                maxHeight: '320px', overflowY: 'auto',
              }}>
                {roleSuggestions.map((s, i) => {
                  const tag = getDemandTag(s.posting_count)
                  const alreadyAdded = formData.target_roles.some(r => r.title.toLowerCase() === s.title.toLowerCase())
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => !alreadyAdded && handleSelectRole(s)}
                      disabled={alreadyAdded}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '11px 16px', border: 'none', backgroundColor: 'transparent',
                        cursor: alreadyAdded ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
                        borderBottom: i < roleSuggestions.length - 1 ? `1px solid ${palette.line}` : 'none',
                        opacity: alreadyAdded ? 0.45 : 1,
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.backgroundColor = palette.parchment }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: palette.ink }}>{s.title}</span>
                        {s.category && (
                          <span style={{ fontSize: '11px', color: palette.muted }}>{s.category}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {tag && <span style={tag.style}>{tag.label}</span>}
                        {alreadyAdded && (
                          <Check size={14} style={{ color: palette.muted }} />
                        )}
                        {!alreadyAdded && (
                          <Plus size={14} style={{ color: palette.muted }} />
                        )}
                      </div>
                    </button>
                  )
                })}

                {/* Custom role option */}
                {roleSearchQuery.trim() && !roleSuggestions.some(s => s.title.toLowerCase() === roleSearchQuery.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={handleAddCustomRole}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      width: '100%', padding: '11px 16px', border: 'none',
                      backgroundColor: palette.parchment, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      borderTop: roleSuggestions.length > 0 ? `1.5px solid ${palette.line}` : 'none',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = palette.line }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = palette.parchment }}
                  >
                    <Plus size={14} style={{ color: palette.ink }} />
                    <span style={{ fontSize: '13px', color: palette.ink, fontWeight: 500 }}>
                      Add &ldquo;{roleSearchQuery.trim()}&rdquo; as custom role
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Seniority selector below search */}
            <div style={{ marginTop: '12px' }}>
              <label style={{ ...labelStyle, fontSize: '12px' }}>Default seniority for new roles</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                {SENIORITIES.map(s => (
                  <button key={s} type="button" onClick={() => setSelectedSeniority(s)}
                    style={{
                      padding: '6px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px',
                      border: selectedSeniority === s ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
                      backgroundColor: selectedSeniority === s ? palette.ink : '#fff',
                      color: selectedSeniority === s ? palette.cream : '#5A5347',
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== MARKETS — LOCATION AUTOCOMPLETE ========== */}
      <div style={cardStyle} className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={18} style={{ color: palette.ink }} />
          <div style={sectionTitleStyle}>Markets You&apos;re Covering</div>
        </div>
        <div style={sectionDescStyle}>Geographic markets Kurrent searches — type to search validated locations</div>

        {formData.target_locations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '16px' }}>
            {formData.target_locations.map((loc, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', backgroundColor: palette.line, borderRadius: '10px', border: '1px solid #E5E1D8',
              }}>
                <MapPin size={12} style={{ color: palette.secondary }} />
                <span style={{ fontSize: '13px', color: palette.ink }}>{loc}</span>
                <button onClick={() => handleRemoveLocation(i)} type="button" style={{ color: palette.muted, cursor: 'pointer', border: 'none', background: 'none', padding: '0', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: palette.muted }}>
            Using {formData.target_locations.length} of {limits.locations} locations
          </span>
        </div>

        {/* Location autocomplete */}
        {formData.target_locations.length < limits.locations && (
          <div ref={locationSearchRef} style={{ position: 'relative' as const }}>
            <div style={{ position: 'relative' as const }}>
              <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: palette.muted }} />
              <input
                type="text"
                value={locationQuery}
                onChange={e => handleLocationSearchChange(e.target.value)}
                onFocus={() => { if (locationQuery.length >= 2) setShowLocationDropdown(true) }}
                placeholder="Search cities — e.g., Toronto, Vancouver, New York..."
                disabled={formData.target_locations.length >= limits.locations}
                style={{ ...inputStyle, paddingLeft: '36px', opacity: formData.target_locations.length >= limits.locations ? 0.5 : 1 }}
              />
              {locationSearchLoading && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: `2px solid ${palette.line}`, borderTopColor: palette.ink, borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              )}
            </div>

            {/* Location suggestions dropdown */}
            {showLocationDropdown && locationSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                backgroundColor: '#fff', border: `1.5px solid ${palette.line}`, borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(47,44,37,0.08)', zIndex: 30, overflow: 'hidden',
                maxHeight: '280px', overflowY: 'auto',
              }}>
                {locationSuggestions.map((s, i) => {
                  const alreadyAdded = formData.target_locations.includes(s.structured)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => !alreadyAdded && handleSelectLocation(s)}
                      disabled={alreadyAdded}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '11px 16px', border: 'none', backgroundColor: 'transparent',
                        cursor: alreadyAdded ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
                        borderBottom: i < locationSuggestions.length - 1 ? `1px solid ${palette.line}` : 'none',
                        opacity: alreadyAdded ? 0.45 : 1,
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.backgroundColor = palette.parchment }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={14} style={{ color: palette.muted }} />
                        <span style={{ fontSize: '14px', color: palette.ink }}>{s.description}</span>
                      </div>
                      {alreadyAdded ? (
                        <Check size={14} style={{ color: palette.muted }} />
                      ) : (
                        <Plus size={14} style={{ color: palette.muted }} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== DELIVERY ========== */}
      <div style={cardStyle} className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={18} style={{ color: palette.ink }} />
          <div style={sectionTitleStyle}>Daily Briefing Delivery</div>
        </div>
        <div style={sectionDescStyle}>Who receives your daily intelligence briefing and when</div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Delivery recipients</label>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {[0, 1, 2].map(i => (
              <input key={i} type="email" value={formData.digest_recipients[i] || ''}
                onChange={e => handleDigestRecipientChange(i, e.target.value)}
                placeholder={i === 0 ? 'Primary email (required)' : 'Additional recipient (optional)'}
                required={i === 0} style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock size={14} style={{ color: palette.muted }} />
              <label style={labelStyle}>Delivery Window</label>
            </div>
            <select value={formData.digest_send_time}
              onChange={e => { setFormData(prev => ({ ...prev, digest_send_time: e.target.value })); setIsDirty(true) }}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {DIGEST_WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select value={formData.timezone}
              onChange={e => { setFormData(prev => ({ ...prev, timezone: e.target.value })); setIsDirty(true) }}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ========== STICKY SAVE BAR ========== */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40"
          style={{ backgroundColor: palette.cream, borderTop: `1.5px solid ${palette.line}`, padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={() => { setFormData(originalData); setIsDirty(false) }} type="button"
            style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 600, backgroundColor: palette.line, color: '#5A5347', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Discard
          </button>
          <button onClick={handleSave} disabled={isSaving} type="button"
            style={{ padding: '10px 28px', fontSize: '13px', fontWeight: 600, backgroundColor: palette.ink, color: palette.cream, borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: isSaving ? 0.6 : 1 }}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
      {isDirty && <div style={{ height: '80px' }} />}

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  )
}
