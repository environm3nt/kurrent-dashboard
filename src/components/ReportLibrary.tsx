'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Client, Lead, IndustryBrief } from '@/types/database'
import {
  FileText, ExternalLink, Search, Check, AlertCircle,
  Building2, Loader2, Zap, TrendingUp, DollarSign, Users, Download,
  MapPin, Plus
} from 'lucide-react'
import { palette } from '@/lib/theme'

interface ReportLibraryProps {
  client: Client
  leads: Lead[]
  industryBriefs: IndustryBrief[]
  userRole: 'admin' | 'member'
}

// Character limits for PDF-mapped fields
const FIELD_LIMITS: Record<string, number> = {
  agency_name: 40,
  agency_initials: 3,
}

const INDUSTRY_OPTIONS = [
  'Administrative',
  'Aerospace & Defence',
  'Agriculture',
  'Automotive',
  'Banking',
  'Construction',
  'Consulting',
  'Distribution',
  'Education',
  'Energy & Utilities',
  'Engineering',
  'Environmental',
  'Executive',
  'Finance',
  'Food & Beverage',
  'Government',
  'Healthcare',
  'Hospitality',
  'Human Resources',
  'Insurance',
  'Legal',
  'Life Sciences',
  'Manufacturing',
  'Marketing',
  'Media',
  'Mining & Natural Resources',
  'Nonprofit & Social Services',
  'Pharmaceutical',
  'Property Management',
  'Real Estate',
  'Real Estate Development',
  'Retail',
  'Sales',
  'Supply Chain',
  'Technology',
  'Telecommunications',
  'Trades',
  'Transportation',
]

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

/* ============================================================
   Location Autocomplete Hook (reuses /api/locations/autocomplete)
   ============================================================ */
interface LocationSuggestion {
  description: string
  place_id: string | null
  structured: string
}

function useLocationAutocomplete() {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setSuggestions([]); return }
    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/locations/autocomplete?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          // API returns a flat array of { description, place_id, structured }
          setSuggestions(Array.isArray(data) ? data : [])
        }
      } catch { /* ignore */ }
      setIsLoading(false)
    }, 250)
  }, [])

  const clear = useCallback(() => setSuggestions([]), [])

  return { suggestions, isLoading, search, clear }
}

export default function ReportLibrary({ client, leads, industryBriefs, userRole }: ReportLibraryProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'lead-reports' | 'industry-briefs'>('lead-reports')
  const [searchQuery, setSearchQuery] = useState('')
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)
  const [pdfMessage, setPdfMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null)
  const [localLeads, setLocalLeads] = useState(leads)
  const [localBriefs, setLocalBriefs] = useState(industryBriefs)

  // Industry brief form state
  const [briefIndustry, setBriefIndustry] = useState('')
  const [briefLocation, setBriefLocation] = useState('')
  const [briefCompany, setBriefCompany] = useState('')
  const [briefGenerating, setBriefGenerating] = useState(false)
  const [briefMessage, setBriefMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const locationAutocomplete = useLocationAutocomplete()
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const locationInputRef = useRef<HTMLInputElement>(null)

  // Brand customization state
  const [brandData, setBrandData] = useState({
    agency_name: client.agency_name || '',
    agency_initials: client.agency_initials || '',
    brand_primary_color: client.brand_primary_color || palette.ink,
    brand_accent_color: client.brand_accent_color || palette.cream,
  })
  const [originalBrandData] = useState(brandData)
  const [isBrandDirty, setIsBrandDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>()
  const toastTimeoutRef = useRef<NodeJS.Timeout>()

  const isGrowthPlus = client.tier !== 'starter'

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(undefined), 3000)
  }

  const handleBrandChange = useCallback((field: string, value: string) => {
    if (FIELD_LIMITS[field]) {
      value = value.slice(0, FIELD_LIMITS[field])
    }
    setBrandData(prev => ({ ...prev, [field]: value }))
    setIsBrandDirty(true)
  }, [])

  const handleBrandSave = async () => {
    if (!isBrandDirty) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          agency_name: brandData.agency_name,
          agency_initials: brandData.agency_initials,
          brand_primary_color: brandData.brand_primary_color,
          brand_accent_color: brandData.brand_accent_color,
        })
        .eq('id', client.id)
      if (error) throw error
      showToast('Report branding updated')
      setIsBrandDirty(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Leads with PDFs
  const leadsWithPdfs = localLeads.filter(l => l.pdf_report_link)
  const leadsWithoutPdfs = localLeads.filter(l => !l.pdf_report_link)

  // Filter
  const filterLeads = (list: Lead[]) =>
    searchQuery.trim()
      ? list.filter(l =>
          l.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.role_title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : list

  const filteredWithPdfs = filterLeads(leadsWithPdfs)
  const filteredWithoutPdfs = filterLeads(leadsWithoutPdfs)

  const generatePdf = async (leadId: string) => {
    setGeneratingPdf(leadId)
    setPdfMessage(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/pdf`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.pdf_url) {
        setLocalLeads(prev => prev.map(l =>
          l.id === leadId ? { ...l, pdf_report_link: data.pdf_url } : l
        ))
        setPdfMessage({ id: leadId, type: 'success', text: 'Briefing generated' })
        window.open(data.pdf_url, '_blank')
      } else if (res.status === 422) {
        setPdfMessage({ id: leadId, type: 'error', text: data.detail || 'Not enough data to generate a report for this lead.' })
      } else {
        setPdfMessage({ id: leadId, type: 'error', text: data.error || 'Generation failed' })
      }
    } catch {
      setPdfMessage({ id: leadId, type: 'error', text: 'Network error — try again' })
    } finally {
      setGeneratingPdf(null)
      setTimeout(() => setPdfMessage(null), 6000)
    }
  }

  // Industry Brief generation
  const generateBrief = async () => {
    if (!briefIndustry || !briefLocation || !briefCompany) return
    if (!isGrowthPlus) return

    setBriefGenerating(true)
    setBriefMessage(null)
    try {
      const res = await fetch('/api/industry-briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: briefIndustry,
          location: briefLocation,
          target_company: briefCompany,
        }),
      })
      const data = await res.json()
      if (res.ok && data.brief) {
        setLocalBriefs(prev => [data.brief, ...prev])
        if (data.brief.status === 'failed') {
          const msg = data.brief.error_message?.includes('not configured')
            ? 'PDF template not configured yet — contact your admin.'
            : data.brief.error_message || 'Generation failed'
          setBriefMessage({ type: 'error', text: msg })
        } else if (data.brief.status === 'ready' && data.brief.pdf_url) {
          setBriefMessage({ type: 'success', text: 'Industry brief ready — download below.' })
          setBriefIndustry('')
          setBriefLocation('')
          setBriefCompany('')
        } else {
          setBriefMessage({ type: 'success', text: 'Industry brief is generating — check back shortly.' })
          setBriefIndustry('')
          setBriefLocation('')
          setBriefCompany('')
        }
      } else if (res.status === 429) {
        setBriefMessage({ type: 'error', text: data.error || 'Rate limit reached — 3 briefs per day.' })
      } else {
        setBriefMessage({ type: 'error', text: data.error || 'Generation failed' })
      }
    } catch {
      setBriefMessage({ type: 'error', text: 'Network error — try again' })
    } finally {
      setBriefGenerating(false)
      setTimeout(() => setBriefMessage(null), 6000)
    }
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

      {/* ========== TABS ========== */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1.5px solid ${palette.line}`, marginBottom: '28px' }}>
        <button
          onClick={() => setActiveTab('lead-reports')}
          style={{
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: activeTab === 'lead-reports' ? 600 : 500,
            color: activeTab === 'lead-reports' ? palette.ink : palette.muted,
            cursor: 'pointer',
            borderBottom: `2px solid ${activeTab === 'lead-reports' ? palette.ink : 'transparent'}`,
            marginBottom: '-1.5px',
            transition: 'all 0.15s',
            background: 'none',
            border: 'none',
            borderBottomWidth: '2px',
            borderBottomStyle: 'solid',
            borderBottomColor: activeTab === 'lead-reports' ? palette.ink : 'transparent',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
        >
          Lead Reports
        </button>
        <button
          onClick={() => setActiveTab('industry-briefs')}
          style={{
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: activeTab === 'industry-briefs' ? 600 : 500,
            color: activeTab === 'industry-briefs' ? palette.ink : palette.muted,
            cursor: 'pointer',
            marginBottom: '-1.5px',
            transition: 'all 0.15s',
            background: 'none',
            border: 'none',
            borderBottomWidth: '2px',
            borderBottomStyle: 'solid',
            borderBottomColor: activeTab === 'industry-briefs' ? palette.ink : 'transparent',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
        >
          Industry Briefs
        </button>
      </div>

      {/* ========== LEAD REPORTS TAB ========== */}
      {activeTab === 'lead-reports' && (
        <>
          {/* Report Branding (admin only) */}
          {userRole === 'admin' && (
            <div style={cardStyle} className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={18} style={{ color: palette.ink }} />
                <div style={sectionTitleStyle}>Report Branding</div>
              </div>
              <div style={sectionDescStyle}>Customize how your Market Intelligence Reports look</div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4 mb-4">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={labelStyle}>Agency Name</label>
                    <CharCounter value={brandData.agency_name} max={FIELD_LIMITS.agency_name} />
                  </div>
                  <input
                    type="text"
                    value={brandData.agency_name}
                    onChange={e => handleBrandChange('agency_name', e.target.value)}
                    maxLength={FIELD_LIMITS.agency_name}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                    onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={labelStyle}>Initials</label>
                    <CharCounter value={brandData.agency_initials} max={FIELD_LIMITS.agency_initials} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      maxLength={3}
                      value={brandData.agency_initials}
                      onChange={e => handleBrandChange('agency_initials', e.target.value.toUpperCase())}
                      placeholder="HG"
                      style={{ ...inputStyle, width: '60px', textAlign: 'center' as const, fontWeight: 700 }}
                      onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                      onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
                    />
                    {brandData.agency_initials && (
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '8px',
                        backgroundColor: brandData.brand_primary_color, color: brandData.brand_accent_color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '14px', flexShrink: 0,
                      }}>
                        {brandData.agency_initials}
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>Your logo on PDF reports</p>
                </div>
              </div>

              <div className="mb-4">
                <label style={labelStyle}>Report Colours</label>
                <p style={{ fontSize: '12px', color: palette.muted, marginBottom: '12px' }}>These appear on your Market Intelligence Reports</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label style={{ fontSize: '11px', color: palette.secondary, display: 'block', marginBottom: '6px' }}>Primary</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={brandData.brand_primary_color}
                        onChange={e => handleBrandChange('brand_primary_color', e.target.value)}
                        style={{ height: '38px', width: '50px', borderRadius: '8px', border: `1.5px solid ${palette.line}`, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={brandData.brand_primary_color}
                        onChange={e => handleBrandChange('brand_primary_color', e.target.value)}
                        style={{ ...inputStyle, width: '100px', fontFamily: 'monospace', fontSize: '12px' }}
                        onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                        onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
                      />
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: brandData.brand_primary_color, border: `1.5px solid ${palette.line}`, flexShrink: 0 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: palette.secondary, display: 'block', marginBottom: '6px' }}>Accent</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={brandData.brand_accent_color}
                        onChange={e => handleBrandChange('brand_accent_color', e.target.value)}
                        style={{ height: '38px', width: '50px', borderRadius: '8px', border: `1.5px solid ${palette.line}`, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={brandData.brand_accent_color}
                        onChange={e => handleBrandChange('brand_accent_color', e.target.value)}
                        style={{ ...inputStyle, width: '100px', fontFamily: 'monospace', fontSize: '12px' }}
                        onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                        onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
                      />
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: brandData.brand_accent_color, border: `1.5px solid ${palette.line}`, flexShrink: 0 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview badge */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: palette.secondary, display: 'block', marginBottom: '8px' }}>Preview</label>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '12px',
                  padding: '12px 20px', borderRadius: '10px',
                  backgroundColor: brandData.brand_primary_color,
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    backgroundColor: brandData.brand_accent_color, color: brandData.brand_primary_color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '13px',
                  }}>
                    {brandData.agency_initials || 'AB'}
                  </div>
                  <span style={{ color: brandData.brand_accent_color, fontWeight: 600, fontSize: '14px' }}>
                    {brandData.agency_name || 'Your Agency'}
                  </span>
                </div>
              </div>

              {isBrandDirty && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setBrandData(originalBrandData); setIsBrandDirty(false) }} type="button"
                    style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 600, backgroundColor: palette.line, color: '#5A5347', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    Discard
                  </button>
                  <button onClick={handleBrandSave} disabled={isSaving} type="button"
                    style={{ padding: '10px 28px', fontSize: '13px', fontWeight: 600, backgroundColor: palette.ink, color: palette.cream, borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: isSaving ? 0.6 : 1 }}>
                    {isSaving ? 'Saving...' : 'Save Branding'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Briefing Library */}
          <div style={cardStyle} className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={18} style={{ color: palette.ink }} />
              <div style={sectionTitleStyle}>Intelligence Briefings</div>
            </div>
            <div style={sectionDescStyle}>
              {leadsWithPdfs.length} briefing{leadsWithPdfs.length !== 1 ? 's' : ''} generated
              {leadsWithoutPdfs.length > 0 && ` · ${leadsWithoutPdfs.length} available to generate`}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: palette.muted }} />
              <input
                type="text"
                placeholder="Search by company or role..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg outline-none transition"
                style={{ backgroundColor: '#fff', border: `1.5px solid ${palette.line}`, color: palette.ink, fontFamily: 'Inter, -apple-system, sans-serif' }}
              />
            </div>

            {/* Generated briefings */}
            {filteredWithPdfs.length > 0 && (
              <div className="mb-4">
                <label className="text-xs font-semibold block mb-2" style={{ color: palette.muted }}>
                  Generated Briefings
                </label>
                <div className="space-y-2">
                  {filteredWithPdfs.map(lead => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ backgroundColor: '#fff', border: `1px solid ${palette.line}` }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '8px',
                          backgroundColor: palette.ink, color: palette.cream,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: palette.ink }}>
                            {lead.company_name}
                          </p>
                          <p className="text-xs truncate" style={{ color: palette.secondary }}>
                            {lead.role_title}
                            {lead.date_identified ? ` · ${lead.date_identified}` : ''}
                          </p>
                        </div>
                      </div>
                      <a
                        href={lead.pdf_report_link!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg flex-shrink-0 ml-3"
                        style={{ backgroundColor: palette.ink, color: palette.cream }}
                      >
                        <ExternalLink size={13} /> View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available to generate */}
            {filteredWithoutPdfs.length > 0 && (
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: palette.muted }}>
                  Available to Generate
                </label>
                <div className="space-y-2">
                  {filteredWithoutPdfs.map(lead => {
                    const isGenerating = generatingPdf === lead.id
                    return (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ backgroundColor: '#fff', border: `1px solid ${palette.line}` }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '8px',
                            backgroundColor: palette.line, color: palette.ink,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: palette.ink }}>
                              {lead.company_name}
                            </p>
                            <p className="text-xs truncate" style={{ color: palette.secondary }}>
                              {lead.role_title}
                              {lead.date_identified ? ` · ${lead.date_identified}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {pdfMessage && pdfMessage.id === lead.id && (
                            <span className="text-xs px-2 py-1 rounded-lg"
                              style={pdfMessage.type === 'success'
                                ? { backgroundColor: palette.ink, color: palette.cream }
                                : { backgroundColor: palette.line, color: palette.ink }
                              }>
                              {pdfMessage.text}
                            </span>
                          )}
                          <button
                            onClick={() => generatePdf(lead.id)}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                            style={{ backgroundColor: palette.line, color: palette.ink }}
                          >
                            {isGenerating ? (
                              <><Loader2 size={13} className="animate-spin" /> Generating...</>
                            ) : (
                              <><FileText size={13} /> Generate</>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {filteredWithPdfs.length === 0 && filteredWithoutPdfs.length === 0 && (
              <div className="p-6 text-center rounded-lg" style={{ backgroundColor: '#fff', border: `1px solid ${palette.line}` }}>
                <p style={{ color: palette.muted }}>
                  {searchQuery
                    ? `No briefings matching "${searchQuery}"`
                    : 'No leads found. Briefings will appear here after your pipeline runs.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== INDUSTRY BRIEFS TAB ========== */}
      {activeTab === 'industry-briefs' && (
        <>
          {/* Generator Card */}
          <div style={{
            background: 'white',
            border: `1px solid ${palette.line}`,
            borderRadius: '14px',
            padding: '28px 32px',
            marginBottom: '28px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: palette.ink,
                  marginBottom: '4px',
                }}>
                  Generate Industry Brief
                </div>
                <div style={{ fontSize: '13px', color: palette.secondary, lineHeight: 1.5, maxWidth: '520px' }}>
                  Create a branded market intelligence report for any industry and location. Use it to start conversations with prospective clients — no open roles required.
                </div>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: palette.line,
                color: palette.ink,
                flexShrink: 0,
              }}>
                <Zap size={12} />
                Growth+
              </div>
            </div>

            {!isGrowthPlus ? (
              /* Upgrade prompt for starter tier */
              <div style={{
                padding: '24px',
                backgroundColor: palette.parchment,
                borderRadius: '10px',
                textAlign: 'center' as const,
              }}>
                <p style={{ fontSize: '14px', color: palette.secondary, marginBottom: '8px' }}>
                  Industry Briefs are available on Growth and Scale plans.
                </p>
                <p style={{ fontSize: '13px', color: palette.muted }}>
                  Upgrade to generate branded market intelligence reports for prospecting.
                </p>
              </div>
            ) : (
              <>
                {/* Row 1: Industry + Location */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: palette.ink, marginBottom: '6px', display: 'block' }}>
                      Industry
                    </label>
                    <select
                      value={briefIndustry}
                      onChange={e => setBriefIndustry(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: `1.5px solid ${palette.line}`,
                        borderRadius: '9px',
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                        color: briefIndustry ? palette.ink : palette.muted,
                        backgroundColor: palette.parchment,
                        outline: 'none',
                        appearance: 'none' as const,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%239A9084' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 14px center',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="" disabled>Select industry...</option>
                      {INDUSTRY_OPTIONS.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, position: 'relative' as const }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: palette.ink, marginBottom: '6px', display: 'block' }}>
                      Location
                    </label>
                    <input
                      ref={locationInputRef}
                      type="text"
                      placeholder="Search cities — e.g., Toronto, Ontario..."
                      value={briefLocation}
                      onChange={e => {
                        setBriefLocation(e.target.value)
                        locationAutocomplete.search(e.target.value)
                        setShowLocationDropdown(true)
                      }}
                      onFocus={() => {
                        if (locationAutocomplete.suggestions.length > 0) setShowLocationDropdown(true)
                      }}
                      onBlur={() => {
                        // Delay to allow click on dropdown item
                        setTimeout(() => setShowLocationDropdown(false), 200)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: `1.5px solid ${palette.line}`,
                        borderRadius: '9px',
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                        color: palette.ink,
                        backgroundColor: palette.parchment,
                        outline: 'none',
                      }}
                    />
                    {showLocationDropdown && locationAutocomplete.suggestions.length > 0 && (
                      <div style={{
                        position: 'absolute' as const,
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: '#fff',
                        border: `1.5px solid ${palette.line}`,
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(47,44,37,0.08)',
                        zIndex: 50,
                        overflow: 'hidden',
                        maxHeight: '280px',
                        overflowY: 'auto' as const,
                      }}>
                        {locationAutocomplete.suggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault()
                              setBriefLocation(s.description)
                              locationAutocomplete.clear()
                              setShowLocationDropdown(false)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              padding: '11px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              fontFamily: 'Inter, sans-serif',
                              borderBottom: i < locationAutocomplete.suggestions.length - 1 ? `1px solid ${palette.line}` : 'none',
                              transition: 'background-color 0.1s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = palette.parchment }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <MapPin size={14} style={{ color: palette.muted }} />
                              <span style={{ fontSize: '14px', color: palette.ink }}>{s.description}</span>
                            </div>
                            <Plus size={14} style={{ color: palette.muted }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Target Company */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: palette.ink, marginBottom: '6px', display: 'block' }}>
                    Target Company
                  </label>
                  <span style={{ fontSize: '11px', color: palette.muted, marginBottom: '6px', display: 'block' }}>
                    The prospect you&apos;re sending this to — competitive framing is built around them
                  </span>
                  <input
                    type="text"
                    placeholder="e.g., Hatch, AtkinsRéalis, Vale..."
                    value={briefCompany}
                    onChange={e => setBriefCompany(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: `1.5px solid ${palette.line}`,
                      borderRadius: '9px',
                      fontSize: '14px',
                      fontFamily: 'Inter, sans-serif',
                      color: palette.ink,
                      backgroundColor: palette.parchment,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Generate bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '8px',
                  borderTop: `1px solid ${palette.line}`,
                  marginTop: '4px',
                }}>
                  <div>
                    <span style={{ fontSize: '12px', color: palette.muted }}>
                      Report typically generates in 30-60 seconds
                    </span>
                    {briefMessage && (
                      <span
                        style={{
                          fontSize: '12px',
                          marginLeft: '12px',
                          color: briefMessage.type === 'success' ? palette.ink : palette.secondary,
                          fontWeight: 500,
                        }}
                      >
                        {briefMessage.text}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={generateBrief}
                    disabled={briefGenerating || !briefIndustry || !briefLocation || !briefCompany}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 24px',
                      backgroundColor: (!briefIndustry || !briefLocation || !briefCompany) ? palette.muted : palette.ink,
                      color: palette.cream,
                      border: 'none',
                      borderRadius: '9px',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: 'Inter, sans-serif',
                      cursor: (!briefIndustry || !briefLocation || !briefCompany) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      opacity: briefGenerating ? 0.6 : 1,
                    }}
                  >
                    {briefGenerating ? (
                      <><Loader2 size={16} className="animate-spin" /> Generating...</>
                    ) : (
                      <><FileText size={16} /> Generate Brief</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* What's Included strip */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
            {[
              { icon: Building2, label: 'Competitor Hiring', desc: 'Active postings from competing employers in the sector' },
              { icon: DollarSign, label: 'Salary Benchmarks', desc: 'Market ranges for top roles in the industry' },
              { icon: Users, label: 'Talent Scarcity', desc: 'Pool size and availability signals for key roles' },
              { icon: TrendingUp, label: 'Demand Trends', desc: 'Which roles are hottest and hardest to fill' },
            ].map(item => (
              <div key={item.label} style={{
                flex: 1,
                background: 'white',
                border: `1px solid ${palette.line}`,
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center' as const,
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: palette.parchment,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                }}>
                  <item.icon size={16} style={{ color: palette.ink }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: palette.ink, marginBottom: '2px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '11px', color: palette.muted, lineHeight: 1.4 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Briefs table */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: palette.ink, marginBottom: '14px' }}>
              Recent Industry Briefs
            </div>

            {localBriefs.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr>
                    {['Industry', 'Company', 'Location', 'Generated', 'Status', ''].map(h => (
                      <th key={h} style={{
                        textAlign: 'left' as const,
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.8px',
                        color: palette.muted,
                        padding: '8px 12px',
                        borderBottom: `1.5px solid ${palette.line}`,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {localBriefs.map(brief => (
                    <tr key={brief.id}>
                      <td style={{ padding: '12px', fontSize: '13px', color: palette.ink, fontWeight: 500, borderBottom: `1px solid ${palette.line}` }}>
                        {brief.industry}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: palette.ink, borderBottom: `1px solid ${palette.line}` }}>
                        {brief.target_company}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: palette.secondary, borderBottom: `1px solid ${palette.line}` }}>
                        {brief.location}
                      </td>
                      <td style={{ padding: '12px', fontSize: '12px', color: palette.muted, borderBottom: `1px solid ${palette.line}` }}>
                        {new Date(brief.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px', borderBottom: `1px solid ${palette.line}` }}>
                        <span
                          title={brief.status === 'failed' && brief.error_message ? brief.error_message : undefined}
                          style={{
                            display: 'inline-block',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: '6px',
                            cursor: brief.status === 'failed' ? 'help' : 'default',
                            ...(brief.status === 'ready'
                              ? { backgroundColor: palette.ink, color: palette.cream }
                              : brief.status === 'generating'
                              ? { backgroundColor: palette.line, color: palette.ink }
                              : { backgroundColor: palette.line, color: palette.secondary }),
                          }}>
                          {brief.status === 'ready' ? 'Ready' : brief.status === 'generating' ? 'Generating...' : 'Failed'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', borderBottom: `1px solid ${palette.line}` }}>
                        {brief.status === 'ready' && brief.pdf_url ? (
                          <a
                            href={brief.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              color: palette.ink,
                              textDecoration: 'none',
                              padding: '4px 12px',
                              borderRadius: '6px',
                              border: `1.5px solid ${palette.ink}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Download size={12} /> PDF
                          </a>
                        ) : brief.status === 'failed' && brief.error_message ? (
                          <span style={{ fontSize: '11px', color: palette.muted }}>
                            {brief.error_message.includes('not configured')
                              ? 'PDF template not configured'
                              : brief.error_message}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{
                padding: '32px',
                textAlign: 'center' as const,
                backgroundColor: 'white',
                border: `1px solid ${palette.line}`,
                borderRadius: '10px',
              }}>
                <p style={{ color: palette.muted, fontSize: '13px' }}>
                  No industry briefs generated yet. Use the form above to create your first one.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
