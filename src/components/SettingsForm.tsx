'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Client } from '@/types/database'
import { Check, AlertCircle, CreditCard, ExternalLink } from 'lucide-react'
import { palette } from '@/lib/theme'

interface UserProfile {
  id: string
  user_id: string
  client_id: string
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  contact_phone: string | null
}

interface SettingsFormProps {
  client: Client
  userEmail: string
  userRole: 'admin' | 'member'
  userProfile: UserProfile
}

interface FormData {
  agency_name: string
  agency_initials: string
  contact_name: string
  contact_title: string
  contact_email: string
  contact_phone: string
  agency_phone: string
  agency_website: string
}

// Character limits for PDF-mapped fields
const FIELD_LIMITS: Record<string, number> = {
  agency_name: 40,
  agency_initials: 3,
  contact_name: 30,
  contact_title: 40,
  contact_email: 50,
  contact_phone: 20,
  agency_phone: 20,
}

const TIER_LIMITS: Record<string, { roles: number; locations: number; resultsPerRole: number }> = {
  starter: { roles: 6, locations: 1, resultsPerRole: 3 },
  growth: { roles: 12, locations: 3, resultsPerRole: 3 },
  scale: { roles: 25, locations: 5, resultsPerRole: 3 },
  founding_partner: { roles: 20, locations: 10, resultsPerRole: 5 },
  enterprise: { roles: 999, locations: 999, resultsPerRole: 999 },
}

// Shared styles
const cardStyle = {
  backgroundColor: palette.parchment,
  border: `1px solid ${palette.line}`,
  borderRadius: '14px',
  marginBottom: '16px',
}
const cardClassName = 'p-4 sm:p-6'

const labelStyle = {
  display: 'block',
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

function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value.length
  const pct = len / max
  const color = pct >= 1 ? palette.ink : pct >= 0.8 ? palette.secondary : palette.muted
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
      {len}/{max}
    </span>
  )
}

export default function SettingsForm({ client, userEmail, userRole, userProfile }: SettingsFormProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<FormData>({
    agency_name: client.agency_name || '',
    agency_initials: client.agency_initials || '',
    // Personal contact card — loaded from user_clients (per-user), falls back to client-level
    contact_name: userProfile.contact_name || client.sales_rep_name || '',
    contact_title: userProfile.contact_title || client.sales_rep_title || '',
    contact_email: userProfile.contact_email || client.sales_rep_email || '',
    contact_phone: userProfile.contact_phone || client.agency_phone || '',
    agency_phone: client.agency_phone || '',
    agency_website: client.agency_website || '',
  })

  const [originalData] = useState<FormData>(formData)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>()
  const toastTimeoutRef = useRef<NodeJS.Timeout>()

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(undefined), 3000)
  }

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    if (FIELD_LIMITS[field]) {
      value = value.slice(0, FIELD_LIMITS[field])
    }
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }, [])

  const handleSave = async () => {
    if (!isDirty) return

    setIsSaving(true)
    try {
      // Save personal contact card to user_clients (per-user, not shared)
      const { error: contactError } = await supabase
        .from('user_clients')
        .update({
          contact_name: formData.contact_name || null,
          contact_title: formData.contact_title || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
        })
        .eq('id', userProfile.id)

      if (contactError) throw contactError

      // Save agency-level settings to clients (admin only)
      if (userRole === 'admin') {
        const { error: agencyError } = await supabase
          .from('clients')
          .update({
            agency_name: formData.agency_name,
            agency_initials: formData.agency_initials,
            agency_phone: formData.agency_phone || null,
            agency_website: formData.agency_website || null,
          })
          .eq('id', client.id)

        if (agencyError) throw agencyError
      }

      showToast('Settings saved successfully')
      setIsDirty(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const limits = TIER_LIMITS[client.tier]

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-16 md:top-4 right-4 left-4 sm:left-auto px-4 py-3 rounded-lg flex items-center gap-2 z-50"
          style={toast.type === 'success' ? {
            backgroundColor: palette.ink,
            color: palette.cream,
            border: `1px solid ${palette.ink}`,
          } : {
            backgroundColor: palette.line,
            color: palette.ink,
            border: '1px solid #E5E1D8',
          }}
        >
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {/* ========== AGENCY (owner only) ========== */}
      {userRole === 'admin' && (
      <div style={cardStyle} className={cardClassName}>
        <div style={sectionTitleStyle}>Agency</div>
        <div style={sectionDescStyle}>Your agency identity across the portal</div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Agency Name</label>
              <CharCounter value={formData.agency_name} max={FIELD_LIMITS.agency_name} />
            </div>
            <input
              type="text"
              value={formData.agency_name}
              onChange={e => handleChange('agency_name', e.target.value)}
              maxLength={FIELD_LIMITS.agency_name}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
              onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Initials</label>
              <CharCounter value={formData.agency_initials} max={FIELD_LIMITS.agency_initials} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                maxLength={3}
                value={formData.agency_initials}
                onChange={e => handleChange('agency_initials', e.target.value.toUpperCase())}
                placeholder="HG"
                style={{ ...inputStyle, width: '60px', textAlign: 'center' as const, fontWeight: 700 }}
                onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
              />
              {formData.agency_initials && (
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px',
                  backgroundColor: palette.ink, color: palette.cream,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '14px', flexShrink: 0,
                }}>
                  {formData.agency_initials}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Agency Phone</label>
              <CharCounter value={formData.agency_phone} max={FIELD_LIMITS.agency_phone} />
            </div>
            <input
              type="tel"
              value={formData.agency_phone}
              onChange={e => handleChange('agency_phone', e.target.value)}
              maxLength={FIELD_LIMITS.agency_phone}
              placeholder="(416) 555-0100"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
              onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
            />
          </div>
          <div>
            <label style={labelStyle}>Website</label>
            <input
              type="url"
              value={formData.agency_website}
              onChange={e => handleChange('agency_website', e.target.value)}
              placeholder="youragency.com"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
              onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
            />
            <p style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>Not shown on PDF reports — portal only</p>
          </div>
        </div>
      </div>
      )}

      {/* ========== YOUR CONTACT CARD ========== */}
      <div style={cardStyle} className={cardClassName}>
        <div style={sectionTitleStyle}>Your Contact Card</div>
        <div style={sectionDescStyle}>This appears on page 2 of your Market Intelligence Reports</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Your Name</label>
              <CharCounter value={formData.contact_name} max={FIELD_LIMITS.contact_name} />
            </div>
            <input
              type="text"
              value={formData.contact_name}
              onChange={e => handleChange('contact_name', e.target.value)}
              maxLength={FIELD_LIMITS.contact_name}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
              onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Your Title</label>
              <CharCounter value={formData.contact_title} max={FIELD_LIMITS.contact_title} />
            </div>
            <input
              type="text"
              value={formData.contact_title}
              onChange={e => handleChange('contact_title', e.target.value)}
              maxLength={FIELD_LIMITS.contact_title}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
              onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Email</label>
              <CharCounter value={formData.contact_email} max={FIELD_LIMITS.contact_email} />
            </div>
            <input
              type="email"
              value={formData.contact_email}
              onChange={e => handleChange('contact_email', e.target.value)}
              maxLength={FIELD_LIMITS.contact_email}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
              onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={labelStyle}>Phone</label>
              <CharCounter value={formData.contact_phone} max={FIELD_LIMITS.contact_phone} />
            </div>
            <input
              type="tel"
              value={formData.contact_phone}
              onChange={e => handleChange('contact_phone', e.target.value)}
              maxLength={FIELD_LIMITS.contact_phone}
              placeholder="(416) 555-0192"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
              onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
            />
          </div>
        </div>

      </div>

      {/* ========== PLAN & BILLING (owner only) ========== */}
      {userRole === 'admin' && (
      <div style={cardStyle} className={cardClassName}>
        <div style={sectionTitleStyle}>Plan &amp; Billing</div>
        <div style={sectionDescStyle}>Your current subscription and billing management</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{
            padding: '6px 16px', backgroundColor: palette.ink, color: palette.cream,
            borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            textTransform: 'capitalize' as const,
          }}>
            {client.tier.replace('_', ' ')}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: palette.secondary, lineHeight: 1.6, marginBottom: '16px' }}>
          {limits.roles} roles, {limits.locations} locations, {limits.resultsPerRole} results per role
        </p>
        <div className="flex gap-3 flex-wrap">
          <a
            href="mailto:hello@kurrentlabs.com?subject=Kurrent%20Plan%20Change%20Request"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', fontSize: '13px', fontWeight: 600,
              color: palette.ink, border: `1.5px solid ${palette.line}`, borderRadius: '10px',
              textDecoration: 'none',
            }}
          >
            Request Plan Change
          </a>
          <a
            href="https://billing.stripe.com/p/login/test_placeholder"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', fontSize: '13px', fontWeight: 600,
              color: palette.cream, backgroundColor: palette.ink, borderRadius: '10px',
              textDecoration: 'none',
            }}
          >
            <CreditCard size={15} /> Manage Billing <ExternalLink size={13} />
          </a>
        </div>
      </div>
      )}

      {/* ========== ACCOUNT ========== */}
      <div style={cardStyle} className={cardClassName}>
        <div style={sectionTitleStyle}>Account</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label style={{ fontSize: '12px', color: palette.muted, display: 'block', marginBottom: '4px' }}>Email</label>
            <p style={{ fontSize: '14px', fontWeight: 600, color: palette.ink }}>{userEmail}</p>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: palette.muted, display: 'block', marginBottom: '4px' }}>Role</label>
            <p style={{ fontSize: '14px', fontWeight: 600, color: palette.ink }}>{userRole === 'admin' ? 'Owner' : 'Team Member'}</p>
          </div>
        </div>
      </div>

      {/* ========== STICKY SAVE BAR ========== */}
      {isDirty && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40"
          style={{
            backgroundColor: palette.cream,
            borderTop: `1.5px solid ${palette.line}`,
            padding: '14px 24px',
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
          }}
        >
          <button
            onClick={() => {
              setFormData(originalData)
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
            disabled={isSaving}
            type="button"
            style={{
              padding: '10px 28px', fontSize: '13px', fontWeight: 600,
              backgroundColor: palette.ink, color: palette.cream, borderRadius: '10px',
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {isDirty && <div style={{ height: '80px' }} />}
    </div>
  )
}
