'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Lead } from '@/types/database'
// Supabase client available for future real-time features
// import { createClient } from '@/lib/supabase/client'
import {
  ExternalLink, ChevronDown, ChevronUp, FileText, Loader2,
  CheckCircle, AlertCircle, MinusCircle, MapPin,
  DollarSign, Clock, Users, Search, Download, Archive, Link as LinkIcon,
  LayoutList, LayoutGrid, GripHorizontal, Send, Zap, TrendingUp, Users2,
  X, RefreshCw,
} from 'lucide-react'
import { palette } from '@/lib/theme'

interface LeadNote {
  id: string
  lead_id: string
  user_id: string
  user_name: string
  content: string
  created_at: string
}

interface UnifiedLeadsProps {
  leads: Lead[]
  userId: string
  teamMembers: Array<{ user_id: string; display_name: string }>
  userRole: 'admin' | 'member'
  initialNotes: Record<string, LeadNote[]>
}

type ViewMode = 'list' | 'board'
type ScopeMode = 'my' | 'all'
type DateFilter = 'today' | 'week' | 'all'
type SortOption = 'newest' | 'date_posted' | 'company_az' | 'role_az' | 'status' | 'contact_quality'

const contactBadge: Record<string, { label: string; icon: typeof CheckCircle; color: string; bg: string; border?: string }> = {
  verified: { label: 'Verified', icon: CheckCircle, color: palette.cream, bg: palette.ink },
  partial: { label: 'Unverified', icon: AlertCircle, color: palette.ink, bg: palette.line },
  none: { label: 'No Contact', icon: MinusCircle, color: palette.ink, bg: 'transparent', border: `1.5px solid ${palette.ink}` },
}

const STAGES = [
  { key: 'New', label: 'New' },
  { key: 'Reviewing', label: 'Reviewing' },
  { key: 'Contacted', label: 'Contacted' },
  { key: 'Viewed', label: 'Meeting' },
  { key: 'Proposal', label: 'Proposal' },
  { key: 'Won', label: 'Placed' },
  { key: 'Lost', label: 'Closed/Lost' },
]

// Board view uses STAGES directly for labels; Archived is excluded from board columns

function getHeatTag(lead: Lead): 'HOT' | 'NEW' | 'WARM' | null {
  const now = new Date()
  // Parse date-only strings with 'T00:00:00' to avoid UTC midnight timezone shift
  const dateStr = lead.date_identified?.split('T')[0]
  const dateId = dateStr ? new Date(dateStr + 'T00:00:00') : null
  const daysOld = dateId ? Math.floor((now.getTime() - dateId.getTime()) / (1000 * 60 * 60 * 24)) : null

  if (lead.contact_quality === 'verified' && daysOld !== null && daysOld <= 1) return 'HOT'
  if (daysOld !== null && daysOld <= 2) return 'NEW'
  if (lead.contact_quality === 'verified' || lead.contact_quality === 'partial') return 'WARM'
  return null
}

function estimateFee(salaryRange?: string): number | null {
  if (!salaryRange) return null
  const nums = salaryRange.match(/[\d,]+/g)
  if (!nums || nums.length === 0) return null
  const values = nums.map(n => parseInt(n.replace(/,/g, '')))
  const median = values.reduce((a, b) => a + b, 0) / values.length
  return Math.round(median * 0.2)
}

function getInitials(name: string): string {
  return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(isoString: string): string {
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

const HeatTag = ({ tag }: { tag: 'HOT' | 'NEW' | 'WARM' | null }) => {
  if (!tag) return null

  if (tag === 'HOT') {
    return (
      <span
        style={{ backgroundColor: palette.ink, color: palette.cream }}
        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      >
        HOT
      </span>
    )
  }
  if (tag === 'NEW') {
    return (
      <span
        style={{ backgroundColor: palette.line, color: palette.ink }}
        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      >
        NEW
      </span>
    )
  }
  if (tag === 'WARM') {
    return (
      <span
        style={{ backgroundColor: 'transparent', color: palette.ink, border: `1.5px solid ${palette.ink}` }}
        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      >
        WARM
      </span>
    )
  }
  return null
}

// Reusable multi-select filter dropdown chip
function FilterChip({
  label,
  selected,
  options,
  onChange,
  isOpen,
  onToggle,
}: {
  label: string
  selected: Set<string>
  options: { key: string; label: string }[]
  onChange: (newSelected: Set<string>) => void
  isOpen: boolean
  onToggle: () => void
}) {
  const isActive = selected.size > 0
  const toggleOption = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    onChange(next)
    // Don't close dropdown — let user select multiple
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          backgroundColor: isActive ? palette.parchment : palette.white,
          color: isActive ? palette.ink : palette.secondary,
          border: isActive ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
      >
        {label}
        {isActive && (
          <span
            style={{ backgroundColor: palette.line, color: palette.ink }}
            className="px-1.5 py-0 rounded text-[10px] font-bold"
          >
            {selected.size}
          </span>
        )}
        <ChevronDown size={12} style={{ opacity: 0.5 }} />
      </button>
      {isOpen && (
        <div
          style={{
            backgroundColor: palette.white,
            border: `1px solid ${palette.line}`,
            boxShadow: '0 4px 16px rgba(47,44,37,0.1)',
          }}
          className="absolute top-full left-0 mt-1 rounded-lg py-1 z-50 min-w-[160px] max-h-[240px] overflow-y-auto"
        >
          {selected.size > 0 && (
            <button
              onClick={() => { onChange(new Set()); onToggle() }}
              style={{ color: palette.secondary, borderBottom: `1px solid ${palette.line}` }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
            >
              Clear {label.toLowerCase()}
            </button>
          )}
          {options.map(opt => (
            <button
              key={opt.key}
              onClick={() => toggleOption(opt.key)}
              style={{
                backgroundColor: selected.has(opt.key) ? palette.parchment : 'transparent',
                color: selected.has(opt.key) ? palette.ink : palette.secondary,
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '3px',
                  border: selected.has(opt.key) ? `1.5px solid ${palette.ink}` : '1.5px solid #C8C2B8',
                  backgroundColor: selected.has(opt.key) ? palette.ink : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: palette.cream,
                  fontSize: '9px',
                }}
              >
                {selected.has(opt.key) && '✓'}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function UnifiedLeads({
  leads: initialLeads,
  userId,
  teamMembers,
  userRole: _userRole,
  initialNotes = {},
}: UnifiedLeadsProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Title-case role titles (LinkedIn stores them lowercase)
  const titleCase = (str: string) => {
    if (!str) return ''
    const small = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'by'])
    return str.replace(/\b\w+/g, (word, idx) => {
      if (idx !== 0 && small.has(word.toLowerCase())) return word.toLowerCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
  }
  const hasAssignedLeads = initialLeads.some(l => (l as any).assigned_to_user_id === userId)
  const [scopeMode, setScopeMode] = useState<ScopeMode>(hasAssignedLeads ? 'my' : 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [contactQualityFilter, setContactQualityFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set())
  const [locationFilter, setLocationFilter] = useState<Set<string>>(new Set())
  const [heatFilter, setHeatFilter] = useState<Set<string>>(new Set())
  const [seniorityFilter, setSeniorityFilter] = useState<Set<string>>(new Set())
  const [assignedFilter, setAssignedFilter] = useState<Set<string>>(new Set())
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, LeadNote[]>>(initialNotes)
  const [newNoteInput, setNewNoteInput] = useState<Record<string, string>>({})
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)
  const [pdfMessage, setPdfMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null)
  const [draggedLead, setDraggedLead] = useState<string | null>(null)
  const [searchingCandidates, setSearchingCandidates] = useState<string | null>(null)
  const [candidateMessage, setCandidateMessage] = useState<{ id: string; type: 'success' | 'error' | 'exhausted'; text: string } | null>(null)

  // Close dropdown when clicking outside
  const filterBarRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Derive unique values for dropdown filters from active leads
  const uniqueRoles = [...new Set(leads.filter(l => l.status !== 'Archived').map(l => l.role_title))].sort()
  const uniqueLocations = [...new Set(leads.filter(l => l.status !== 'Archived').map(l => l.location).filter(Boolean))].sort() as string[]
  const uniqueSeniorities = [...new Set(leads.filter(l => l.status !== 'Archived' && l.seniority_tier).map(l => l.seniority_tier!))].sort()
  const uniqueAssigned = teamMembers.filter(m => leads.some(l => (l as any).assigned_to_user_id === m.user_id))

  // Filter out archived leads (soft-deleted), then by scope
  const activeLeads = leads.filter(l => l.status !== 'Archived')
  const scopedLeads = scopeMode === 'my'
    ? activeLeads.filter(l => {
        const assignedTo = (l as any).assigned_to_user_id
        return assignedTo === userId || !assignedTo
      })
    : activeLeads

  // Filter by date
  // NOTE: date_identified is stored as "YYYY-MM-DD" (date-only string).
  // new Date("YYYY-MM-DD") parses as UTC midnight, which shifts to the
  // previous day in US timezones. To avoid this, we compare date strings
  // directly instead of using Date objects for the "today" filter.
  const dateFilteredLeads = scopedLeads.filter(l => {
    if (dateFilter === 'all') return true
    if (!l.date_identified) return false
    // Extract just the date portion (handles both "2026-04-30" and "2026-04-30T..." formats)
    const leadDate = l.date_identified.split('T')[0]
    if (dateFilter === 'today') {
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      return leadDate === todayStr
    }
    // 'week' — last 7 days (use Date objects but parse with time to avoid UTC shift)
    const leadDateTime = new Date(leadDate + 'T00:00:00')
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    weekAgo.setHours(0, 0, 0, 0)
    return leadDateTime >= weekAgo
  })

  // Filter by contact quality (null/undefined treated as 'none')
  const contactQualityFilteredLeads = dateFilteredLeads.filter(l => {
    if (contactQualityFilter.size === 0) return true
    const quality = l.contact_quality || 'none'
    return contactQualityFilter.has(quality)
  })

  // Filter by status
  const statusFilteredLeads = contactQualityFilteredLeads.filter(l => {
    if (statusFilter.size === 0) return true
    return statusFilter.has(l.status)
  })

  // Filter by role
  const roleFilteredLeads = statusFilteredLeads.filter(l => {
    if (roleFilter.size === 0) return true
    return roleFilter.has(l.role_title)
  })

  // Filter by location
  const locationFilteredLeads = roleFilteredLeads.filter(l => {
    if (locationFilter.size === 0) return true
    return locationFilter.has(l.location || '')
  })

  // Filter by seniority
  const seniorityFilteredLeads = locationFilteredLeads.filter(l => {
    if (seniorityFilter.size === 0) return true
    return seniorityFilter.has(l.seniority_tier || 'IC')
  })

  // Filter by heat tag
  const heatFilteredLeads = seniorityFilteredLeads.filter(l => {
    if (heatFilter.size === 0) return true
    return heatFilter.has(getHeatTag(l) || '')
  })

  // Filter by assigned recruiter
  const assignedFilteredLeads = heatFilteredLeads.filter(l => {
    if (assignedFilter.size === 0) return true
    if (assignedFilter.has('unassigned')) return !(l as any).assigned_to_user_id
    return assignedFilter.has((l as any).assigned_to_user_id || '')
  })

  // Filter by search
  const filteredLeads = assignedFilteredLeads.filter(l => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const leadNotes = notes[l.id] || []
    const notesText = leadNotes.map(n => n.content).join(' ').toLowerCase()
    return (
      l.company_name.toLowerCase().includes(q) ||
      l.role_title.toLowerCase().includes(q) ||
      (l.location || '').toLowerCase().includes(q) ||
      (l.industry || '').toLowerCase().includes(q) ||
      notesText.includes(q)
    )
  })

  // Sort
  const displayLeads = [...filteredLeads].sort((a, b) => {
    switch (sortOption) {
      case 'newest':
        return new Date(b.date_identified).getTime() - new Date(a.date_identified).getTime()
      case 'date_posted':
        return new Date(a.date_identified).getTime() - new Date(b.date_identified).getTime()
      case 'company_az':
        return a.company_name.localeCompare(b.company_name)
      case 'role_az':
        return a.role_title.localeCompare(b.role_title)
      case 'status': {
        const stageOrder = STAGES.map(s => s.key)
        return stageOrder.indexOf(a.status) - stageOrder.indexOf(b.status)
      }
      case 'contact_quality': {
        const qOrder: Record<string, number> = { verified: 0, partial: 1, none: 2 }
        return (qOrder[a.contact_quality || 'none'] ?? 2) - (qOrder[b.contact_quality || 'none'] ?? 2)
      }
      default:
        return 0
    }
  })

  // Count active filters (for filter chip badges)
  const activeFilterCount = statusFilter.size + roleFilter.size + locationFilter.size + contactQualityFilter.size + seniorityFilter.size + heatFilter.size + assignedFilter.size

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const updateStatus = useCallback(async (leadId: string, newStatus: string) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, status: newStatus as any } : l)))

    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }, [])

  const archiveLead = useCallback(async (leadId: string) => {
    if (!window.confirm('Archive this lead? This action cannot be undone.')) return

    setLeads(prev => prev.filter(l => l.id !== leadId))

    try {
      await fetch(`/api/leads/${leadId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch (err) {
      console.error('Failed to archive lead:', err)
    }
  }, [])

  const addNote = useCallback(async (leadId: string) => {
    const content = newNoteInput[leadId]?.trim()
    if (!content) return

    const tempNote: LeadNote = {
      id: `temp-${Date.now()}`,
      lead_id: leadId,
      user_id: userId,
      user_name: teamMembers.find(m => m.user_id === userId)?.display_name || 'You',
      content,
      created_at: new Date().toISOString(),
    }

    setNotes(prev => ({
      ...prev,
      [leadId]: [...(prev[leadId] || []), tempNote],
    }))
    setNewNoteInput(prev => ({ ...prev, [leadId]: '' }))

    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()

      if (data.id) {
        setNotes(prev => ({
          ...prev,
          [leadId]: prev[leadId].map(n => (n.id.startsWith('temp-') ? data : n)),
        }))
      }
    } catch (err) {
      console.error('Failed to add note:', err)
    }
  }, [userId, teamMembers, newNoteInput])

  const generatePdf = async (leadId: string) => {
    setGeneratingPdf(leadId)
    setPdfMessage(null)

    try {
      console.log(`[PDF] Starting generation for lead ${leadId}`)
      const res = await fetch(`/api/leads/${leadId}/pdf`, { method: 'POST' })
      console.log(`[PDF] Response status: ${res.status}`)

      const text = await res.text()
      console.log(`[PDF] Response body: ${text.substring(0, 500)}`)

      let data
      try {
        data = JSON.parse(text)
      } catch {
        console.error('[PDF] Response is not JSON:', text.substring(0, 200))
        setPdfMessage({ id: leadId, type: 'error', text: `Server error (${res.status}) — check Vercel logs` })
        return
      }

      if (res.ok && data.pdf_url) {
        setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, pdf_report_link: data.pdf_url } : l)))
        setPdfMessage({ id: leadId, type: 'success', text: 'Briefing generated — opening PDF' })
        window.open(data.pdf_url, '_blank')
      } else if (res.status === 422) {
        setPdfMessage({ id: leadId, type: 'error', text: data.detail || 'Not enough data to generate' })
      } else {
        setPdfMessage({ id: leadId, type: 'error', text: data.error || `Generation failed (${res.status})` })
      }
    } catch (err) {
      console.error('[PDF] Fetch error:', err)
      setPdfMessage({ id: leadId, type: 'error', text: 'Network error — try again' })
    } finally {
      setGeneratingPdf(null)
      setTimeout(() => setPdfMessage(null), 10000)
    }
  }

  const searchCandidates = async (leadId: string, forceRefresh = false) => {
    setSearchingCandidates(leadId)
    setCandidateMessage(null)

    try {
      const url = forceRefresh
        ? `/api/leads/${leadId}/candidates?refresh=true`
        : `/api/leads/${leadId}/candidates`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.candidates?.length > 0) {
        // Update lead in local state with candidate data
        setLeads(prev => prev.map(l => {
          if (l.id !== leadId) return l
          const updated = { ...l }
          data.candidates.forEach((c: { name: string; url: string; headline: string; signal: string; score: number | null; matchedSkills: string | null }, i: number) => {
            const n = i + 1
            ;(updated as any)[`candidate_${n}_name`] = c.name
            ;(updated as any)[`candidate_${n}_url`] = c.url
            ;(updated as any)[`candidate_${n}_headline`] = c.headline
            ;(updated as any)[`candidate_${n}_signal`] = c.signal
            ;(updated as any)[`candidate_${n}_match_score`] = c.score
            ;(updated as any)[`candidate_${n}_matched_skills`] = c.matchedSkills
          })
          return updated
        }))
        const cached = data.fromCache ? ' (cached)' : ''
        setCandidateMessage({ id: leadId, type: 'success', text: `${data.candidates.length} candidates found${cached}` })
      } else if (res.ok && data.candidates?.length === 0) {
        setCandidateMessage({ id: leadId, type: 'error', text: 'No matching candidates found for this role and location' })
      } else if (res.status === 402) {
        setCandidateMessage({ id: leadId, type: 'exhausted', text: 'Credits exhausted — resets next billing cycle' })
      } else if (res.status === 429) {
        setCandidateMessage({ id: leadId, type: 'error', text: 'Rate limited — try again in a few minutes' })
      } else {
        setCandidateMessage({ id: leadId, type: 'error', text: data.detail || data.error || 'Search failed' })
      }
    } catch {
      setCandidateMessage({ id: leadId, type: 'error', text: 'Network error — try again' })
    } finally {
      setSearchingCandidates(null)
      setTimeout(() => setCandidateMessage(null), 6000)
    }
  }

  const exportCsv = () => {
    const headers = [
      'Company', 'Role', 'Location', 'Industry', 'Salary Range',
      'Contact Quality', 'Contact Name', 'Contact Email',
      'Status', 'Date Identified', 'Job URL',
    ]
    const escape = (v: string) => {
      if (!v) return ''
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`
      }
      return v
    }
    const rows = displayLeads.map(l => [
      l.company_name,
      l.role_title,
      l.location || '',
      l.industry || '',
      l.salary_range || '',
      l.contact_quality || '',
      l.hiring_contact_name || '',
      l.hiring_contact_email || '',
      l.status || '',
      l.date_identified || '',
      l.job_posting_url || '',
    ].map(escape).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kurrent-leads-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (stage: string) => {
    if (draggedLead) {
      updateStatus(draggedLead, stage)
      setDraggedLead(null)
    }
  }

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <div style={{ backgroundColor: palette.cream }} className="min-h-screen p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1
            style={{ fontFamily: 'Playfair Display, serif', color: palette.ink }}
            className="text-3xl font-light"
          >
            Leads
          </h1>
          <div className="flex gap-3">
            {/* Scope toggle */}
            <div
              style={{ backgroundColor: palette.line }}
              className="inline-flex rounded-lg p-1"
            >
              {(['my', 'all'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setScopeMode(mode)}
                  style={{
                    backgroundColor: scopeMode === mode ? palette.white : 'transparent',
                    color: palette.ink,
                  }}
                  className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  {mode === 'my' ? 'My Leads' : 'All Leads'}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div
              style={{ backgroundColor: palette.line }}
              className="inline-flex rounded-lg p-1"
            >
              {(['list', 'board'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    backgroundColor: viewMode === mode ? palette.white : 'transparent',
                    color: palette.ink,
                  }}
                  className="px-2 py-1.5 rounded"
                >
                  {mode === 'list' ? <LayoutList size={18} /> : <LayoutGrid size={18} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter/Search bar */}
        <div
          ref={filterBarRef}
          style={{ backgroundColor: palette.white, borderColor: palette.line }}
          className="mb-6 rounded-xl border p-4"
        >
          {/* Row 1: Search */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search size={15} style={{ color: palette.muted, position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search by company, role, location, or industry..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ backgroundColor: palette.parchment, color: palette.ink, border: `1.5px solid ${palette.line}` }}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              />
            </div>
          </div>

          {/* Row 2: Quick date chips + divider + filter dropdowns */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span style={{ color: palette.muted, fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px' }}>QUICK</span>
            {([
              { key: 'today' as const, label: 'Today' },
              { key: 'week' as const, label: 'This Week' },
              { key: 'all' as const, label: 'All Time' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDateFilter(key)}
                style={{
                  backgroundColor: dateFilter === key ? palette.parchment : palette.white,
                  color: dateFilter === key ? palette.ink : palette.secondary,
                  border: dateFilter === key ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
                  fontWeight: dateFilter === key ? 600 : 500,
                }}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                {label}
              </button>
            ))}

            <div style={{ width: '1px', height: '20px', backgroundColor: palette.line, margin: '0 4px' }} />

            <span style={{ color: palette.muted, fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px' }}>FILTERS</span>

            <FilterChip
              label="Status"
              selected={statusFilter}
              options={STAGES.map(s => ({ key: s.key, label: s.label }))}
              onChange={setStatusFilter}
              isOpen={openDropdown === 'status'}
              onToggle={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
            />
            <FilterChip
              label="Role"
              selected={roleFilter}
              options={uniqueRoles.map(r => ({ key: r, label: titleCase(r) }))}
              onChange={setRoleFilter}
              isOpen={openDropdown === 'role'}
              onToggle={() => setOpenDropdown(openDropdown === 'role' ? null : 'role')}
            />
            <FilterChip
              label="Location"
              selected={locationFilter}
              options={uniqueLocations.map(l => ({ key: l, label: l }))}
              onChange={setLocationFilter}
              isOpen={openDropdown === 'location'}
              onToggle={() => setOpenDropdown(openDropdown === 'location' ? null : 'location')}
            />
            {uniqueSeniorities.length > 0 && (
              <FilterChip
                label="Seniority"
                selected={seniorityFilter}
                options={uniqueSeniorities.map(s => ({ key: s, label: s }))}
                onChange={setSeniorityFilter}
                isOpen={openDropdown === 'seniority'}
                onToggle={() => setOpenDropdown(openDropdown === 'seniority' ? null : 'seniority')}
              />
            )}
            <FilterChip
              label="Contact"
              selected={contactQualityFilter}
              options={[
                { key: 'verified', label: 'Verified' },
                { key: 'partial', label: 'Unverified' },
                { key: 'none', label: 'No Contact' },
              ]}
              onChange={setContactQualityFilter}
              isOpen={openDropdown === 'contact'}
              onToggle={() => setOpenDropdown(openDropdown === 'contact' ? null : 'contact')}
            />
            <FilterChip
              label="Heat"
              selected={heatFilter}
              options={[
                { key: 'HOT', label: 'HOT' },
                { key: 'NEW', label: 'NEW' },
                { key: 'WARM', label: 'WARM' },
              ]}
              onChange={setHeatFilter}
              isOpen={openDropdown === 'heat'}
              onToggle={() => setOpenDropdown(openDropdown === 'heat' ? null : 'heat')}
            />
            <FilterChip
              label="Assigned"
              selected={assignedFilter}
              options={[
                { key: 'unassigned', label: 'Unassigned' },
                ...uniqueAssigned.map(m => ({ key: m.user_id, label: m.display_name })),
              ]}
              onChange={setAssignedFilter}
              isOpen={openDropdown === 'assigned'}
              onToggle={() => setOpenDropdown(openDropdown === 'assigned' ? null : 'assigned')}
            />

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter(new Set())
                  setRoleFilter(new Set())
                  setLocationFilter(new Set())
                  setContactQualityFilter(new Set())
                  setSeniorityFilter(new Set())
                  setHeatFilter(new Set())
                  setAssignedFilter(new Set())
                }}
                style={{ color: palette.secondary }}
                className="flex items-center gap-1 text-xs hover:opacity-70 ml-1"
              >
                <X size={12} />
                Clear filters
              </button>
            )}
          </div>

          {/* Row 3: Sort + results count + export */}
          <div className="flex items-center gap-3">
            <select
              value={sortOption}
              onChange={e => setSortOption(e.target.value as SortOption)}
              style={{ backgroundColor: palette.white, color: palette.secondary, border: `1.5px solid ${palette.line}` }}
              className="px-3 py-1.5 rounded-lg text-xs outline-none appearance-none pr-7"
            >
              <option value="newest">Sort: Newest first</option>
              <option value="date_posted">Sort: Oldest first</option>
              <option value="company_az">Sort: Company A-Z</option>
              <option value="role_az">Sort: Role A-Z</option>
              <option value="status">Sort: Pipeline status</option>
              <option value="contact_quality">Sort: Contact quality</option>
            </select>
            <span style={{ color: palette.muted }} className="text-xs ml-auto">
              Showing <strong style={{ color: palette.ink }}>{displayLeads.length}</strong> of {activeLeads.length} leads
            </span>
            <button
              onClick={exportCsv}
              style={{ color: palette.ink }}
              className="flex items-center gap-2 text-xs font-medium hover:opacity-70 transition-opacity"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Lead cards */}
        <div className="space-y-3">
          {displayLeads.map(lead => {
            const isExpanded = expandedIds.has(lead.id)
            const heat = getHeatTag(lead)
            const badge = contactBadge[lead.contact_quality || 'none']
            const BadgeIcon = badge.icon

            return (
              <div
                key={lead.id}
                style={{ backgroundColor: palette.white, borderColor: palette.line }}
                className="border rounded-2xl overflow-hidden"
              >
                {/* Collapsed row */}
                <div
                  onClick={() => toggleExpanded(lead.id)}
                  className="p-5 cursor-pointer hover:opacity-95 transition-opacity"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3
                          style={{ color: palette.ink }}
                          className="font-semibold text-base"
                        >
                          {lead.company_name}
                        </h3>
                        <div
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: badge.border,
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                        >
                          <BadgeIcon size={12} />
                          {badge.label}
                        </div>
                        <HeatTag tag={heat} />
                      </div>
                      <div
                        style={{ color: palette.secondary }}
                        className="text-sm flex items-center gap-3"
                      >
                        <span>{titleCase(lead.role_title)}</span>
                        {lead.seniority_tier && lead.seniority_tier !== 'IC' && (
                          <span style={{
                            padding: '1px 8px',
                            backgroundColor: palette.line,
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: palette.ink,
                          }}>{lead.seniority_tier}</span>
                        )}
                        {lead.location && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {lead.location}
                            </span>
                          </>
                        )}
                        {lead.salary_range && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <DollarSign size={12} />
                              {lead.salary_range}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      <select
                        value={lead.status}
                        onChange={e => {
                          e.stopPropagation()
                          updateStatus(lead.id, e.target.value)
                        }}
                        style={{ backgroundColor: palette.parchment, color: palette.ink, borderColor: palette.line }}
                        className="text-xs rounded px-2 py-1 border outline-none"
                      >
                        {STAGES.map(s => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>

                      <span style={{ color: palette.muted }} className="text-xs whitespace-nowrap">
                        {formatDate(lead.date_identified)}
                      </span>

                      {isExpanded ? (
                        <ChevronUp size={18} style={{ color: palette.secondary }} />
                      ) : (
                        <ChevronDown size={18} style={{ color: palette.secondary }} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div
                    style={{ backgroundColor: palette.parchment, borderTopColor: palette.line }}
                    className="border-t p-5 space-y-5"
                  >
                    {/* Metrics strip */}
                    {(lead.salary_range || lead.time_to_fill_estimate || lead.competing_postings || lead.talent_availability) && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {lead.salary_range && (
                          <MetricBox icon={DollarSign} label="Salary Range" value={lead.salary_range} />
                        )}
                        {lead.time_to_fill_estimate && (
                          <MetricBox icon={Clock} label="Time to Fill" value={lead.time_to_fill_estimate} />
                        )}
                        {lead.competing_postings && (
                          <MetricBox icon={TrendingUp} label="Competing Posts" value={lead.competing_postings} />
                        )}
                        {lead.talent_availability && (
                          <MetricBox icon={Users} label="Talent Available" value={lead.talent_availability} />
                        )}
                      </div>
                    )}

                    {/* Content grid */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Contact card */}
                      {lead.hiring_contact_name && (
                        <div
                          style={{
                            backgroundColor: lead.contact_quality === 'verified' ? palette.ink : 'transparent',
                            color: lead.contact_quality === 'verified' ? palette.cream : palette.ink,
                            border: lead.contact_quality !== 'verified' ? `1.5px dashed ${palette.line}` : 'none',
                          }}
                          className="rounded-lg p-4"
                        >
                          <div className="font-semibold text-sm mb-1">{lead.hiring_contact_name}</div>
                          {lead.hiring_contact_title && (
                            <div
                              style={{ opacity: lead.contact_quality === 'verified' ? 0.9 : 0.7 }}
                              className="text-xs mb-3"
                            >
                              {lead.hiring_contact_title}
                            </div>
                          )}
                          <div className="space-y-2">
                            {lead.hiring_contact_email && (
                              <a
                                href={`mailto:${lead.hiring_contact_email}`}
                                style={{ color: lead.contact_quality === 'verified' ? palette.cream : palette.ink }}
                                className="flex items-center gap-2 text-xs hover:underline"
                              >
                                <LinkIcon size={12} />
                                {lead.hiring_contact_email}
                              </a>
                            )}
                            {lead.hiring_contact_linkedin && (
                              <a
                                href={lead.hiring_contact_linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: lead.contact_quality === 'verified' ? palette.cream : palette.ink }}
                                className="flex items-center gap-2 text-xs hover:underline"
                              >
                                <ExternalLink size={12} />
                                LinkedIn
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Market intelligence */}
                      {lead.market_insight && (
                        <div style={{ backgroundColor: palette.white, borderColor: palette.line }} className="border rounded-lg p-4">
                          <div
                            style={{ color: palette.muted }}
                            className="text-xs uppercase font-semibold mb-2"
                          >
                            Market Intelligence
                          </div>
                          <div style={{ color: palette.ink }} className="text-sm leading-relaxed">
                            {lead.market_insight}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Competitive landscape */}
                    {(lead.scarcity_insight || lead.competition_insight || lead.speed_insight) && (
                      <div>
                        <div
                          style={{ color: palette.muted }}
                          className="text-xs uppercase font-semibold mb-3"
                        >
                          Competitive Landscape
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {lead.scarcity_insight && (
                            <CompetitiveInsightBox
                              icon={AlertCircle}
                              label="Scarcity"
                              text={lead.scarcity_insight}
                            />
                          )}
                          {lead.competition_insight && (
                            <CompetitiveInsightBox
                              icon={Users2}
                              label="Competition"
                              text={lead.competition_insight}
                            />
                          )}
                          {lead.speed_insight && (
                            <CompetitiveInsightBox
                              icon={Zap}
                              label="Speed Signal"
                              text={lead.speed_insight}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Matched candidates OR Find Candidates button */}
                    <div>
                      <div
                        style={{ color: palette.muted }}
                        className="text-xs uppercase font-semibold mb-3 flex items-center gap-2"
                      >
                        <Users size={14} />
                        Matched Candidates
                      </div>
                      {(lead.candidate_1_name || lead.candidate_2_name || lead.candidate_3_name) ? (
                        <div>
                          <div className="space-y-2">
                            {[1, 2, 3].map((idx) => {
                              const name = (lead as any)[`candidate_${idx}_name`]
                              const headline = (lead as any)[`candidate_${idx}_headline`]
                              const signal = (lead as any)[`candidate_${idx}_signal`]
                              const score = (lead as any)[`candidate_${idx}_match_score`]
                              const url = (lead as any)[`candidate_${idx}_url`]
                              const matchedSkills = (lead as any)[`candidate_${idx}_matched_skills`]

                              if (!name) return null
                              return (
                                <CandidateCard
                                  key={idx}
                                  rank={idx}
                                  name={name}
                                  headline={headline}
                                  signal={signal}
                                  score={score}
                                  url={url}
                                  matchedSkills={matchedSkills}
                                />
                              )
                            })}
                          </div>
                          <button
                            onClick={() => searchCandidates(lead.id, true)}
                            disabled={searchingCandidates === lead.id}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: palette.muted,
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: searchingCandidates === lead.id ? 'wait' : 'pointer',
                              padding: '8px 0 0 0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            {searchingCandidates === lead.id ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Refreshing...
                              </>
                            ) : (
                              <>
                                <RefreshCw size={12} />
                                Refresh candidates
                              </>
                            )}
                          </button>
                          {candidateMessage?.id === lead.id && (
                            <p className="text-xs mt-1" style={{ color: candidateMessage.type === 'success' ? palette.ink : palette.muted }}>
                              {candidateMessage.text}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <button
                            onClick={() => searchCandidates(lead.id)}
                            disabled={searchingCandidates === lead.id}
                            style={{
                              backgroundColor: searchingCandidates === lead.id ? palette.line : palette.ink,
                              color: searchingCandidates === lead.id ? palette.secondary : palette.cream,
                              border: 'none',
                              borderRadius: '9px',
                              padding: '10px 20px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: searchingCandidates === lead.id ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              width: '100%',
                              justifyContent: 'center',
                            }}
                          >
                            {searchingCandidates === lead.id ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search size={14} />
                                Find Candidates
                              </>
                            )}
                          </button>
                          {candidateMessage?.id === lead.id && (
                            <p
                              className="text-xs mt-2 text-center"
                              style={{
                                color: candidateMessage.type === 'success' ? palette.ink
                                  : candidateMessage.type === 'exhausted' ? palette.muted
                                  : palette.muted,
                              }}
                            >
                              {candidateMessage.text}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Notes section */}
                    <div>
                      <div
                        style={{ color: palette.muted }}
                        className="text-xs uppercase font-semibold mb-3"
                      >
                        Notes
                      </div>
                      <div className="space-y-3 mb-3">
                        {(notes[lead.id] || []).map(note => (
                          <div
                            key={note.id}
                            style={{ backgroundColor: palette.white, borderColor: palette.line }}
                            className="border rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                style={{ backgroundColor: palette.line, color: palette.ink }}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                              >
                                {getInitials(note.user_name)}
                              </div>
                              <span style={{ color: palette.muted }} className="text-xs">
                                {note.user_name} · {formatDate(note.created_at)}
                              </span>
                            </div>
                            <div style={{ color: palette.ink }} className="text-sm">
                              {note.content}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add note input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a note..."
                          value={newNoteInput[lead.id] || ''}
                          onChange={e => setNewNoteInput(prev => ({ ...prev, [lead.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              addNote(lead.id)
                            }
                          }}
                          style={{ backgroundColor: palette.white, color: palette.ink, borderColor: palette.line }}
                          className="flex-1 text-sm border rounded-lg px-3 py-2 outline-none"
                        />
                        <button
                          onClick={() => addNote(lead.id)}
                          style={{ backgroundColor: palette.ink, color: palette.cream }}
                          className="px-3 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          <Send size={14} />
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div
                      style={{ borderTopColor: palette.line }}
                      className="border-t pt-4 flex gap-2 flex-wrap"
                    >
                      {lead.job_posting_url && (
                        <a
                          href={lead.job_posting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            backgroundColor: 'transparent',
                            color: palette.ink,
                            borderColor: palette.line,
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:opacity-70 transition-opacity"
                        >
                          <ExternalLink size={14} />
                          View Posting
                        </a>
                      )}

                      {lead.pdf_report_link && (
                        <a
                          href={lead.pdf_report_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            backgroundColor: palette.ink,
                            color: palette.cream,
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                          <FileText size={14} />
                          View Briefing
                        </a>
                      )}

                      <button
                        onClick={() => generatePdf(lead.id)}
                        disabled={generatingPdf === lead.id}
                        style={{
                          backgroundColor: lead.pdf_report_link ? 'transparent' : palette.ink,
                          color: lead.pdf_report_link ? palette.ink : palette.cream,
                          borderColor: palette.ink,
                          opacity: generatingPdf === lead.id ? 0.8 : 1,
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity ${lead.pdf_report_link ? 'border' : ''}`}
                      >
                        {generatingPdf === lead.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Generating briefing...
                          </>
                        ) : (
                          <>
                            <FileText size={14} />
                            {lead.pdf_report_link ? 'Regenerate' : 'Generate Briefing'}
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => archiveLead(lead.id)}
                        style={{
                          backgroundColor: 'transparent',
                          color: palette.secondary,
                          borderColor: palette.line,
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:opacity-70 transition-opacity"
                      >
                        <Archive size={14} />
                        Archive
                      </button>
                    </div>

                    {/* PDF message */}
                    {pdfMessage?.id === lead.id && (
                      <div
                        style={{
                          backgroundColor: pdfMessage.type === 'success' ? palette.line : palette.parchment,
                          color: palette.ink,
                          border: pdfMessage.type === 'error' ? `1.5px solid ${palette.ink}` : 'none',
                        }}
                        className="p-3 rounded-lg text-xs"
                      >
                        {pdfMessage.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // BOARD VIEW
  return (
    <div style={{ backgroundColor: palette.cream }} className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1
          style={{ fontFamily: 'Playfair Display, serif', color: palette.ink }}
          className="text-3xl font-light"
        >
          Leads
        </h1>
        <div className="flex gap-3">
          {/* Scope toggle */}
          <div
            style={{ backgroundColor: palette.line }}
            className="inline-flex rounded-lg p-1"
          >
            {(['my', 'all'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setScopeMode(mode)}
                style={{
                  backgroundColor: scopeMode === mode ? palette.white : 'transparent',
                  color: palette.ink,
                }}
                className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              >
                {mode === 'my' ? 'My Leads' : 'All Leads'}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div
            style={{ backgroundColor: palette.line }}
            className="inline-flex rounded-lg p-1"
          >
            {(['list', 'board'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  backgroundColor: viewMode === mode ? palette.white : 'transparent',
                  color: palette.ink,
                }}
                className="px-2 py-1.5 rounded"
              >
                {mode === 'list' ? <LayoutList size={18} /> : <LayoutGrid size={18} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar (shared design with list view) */}
      <div
        ref={filterBarRef}
        style={{ backgroundColor: palette.white, borderColor: palette.line }}
        className="mb-6 rounded-xl border p-4"
      >
        <div className="flex gap-3 mb-3">
          <div className="flex-1 relative">
            <Search size={15} style={{ color: palette.muted, position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search by company, role, location, or industry..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ backgroundColor: palette.parchment, color: palette.ink, border: `1.5px solid ${palette.line}` }}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span style={{ color: palette.muted, fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px' }}>QUICK</span>
          {([
            { key: 'today' as const, label: 'Today' },
            { key: 'week' as const, label: 'This Week' },
            { key: 'all' as const, label: 'All Time' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              style={{
                backgroundColor: dateFilter === key ? palette.parchment : palette.white,
                color: dateFilter === key ? palette.ink : palette.secondary,
                border: dateFilter === key ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
                fontWeight: dateFilter === key ? 600 : 500,
              }}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              {label}
            </button>
          ))}
          <div style={{ width: '1px', height: '20px', backgroundColor: palette.line, margin: '0 4px' }} />
          <span style={{ color: palette.muted, fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px' }}>FILTERS</span>
          <FilterChip label="Role" selected={roleFilter} options={uniqueRoles.map(r => ({ key: r, label: titleCase(r) }))} onChange={setRoleFilter} isOpen={openDropdown === 'role'} onToggle={() => setOpenDropdown(openDropdown === 'role' ? null : 'role')} />
          <FilterChip label="Location" selected={locationFilter} options={uniqueLocations.map(l => ({ key: l, label: l }))} onChange={setLocationFilter} isOpen={openDropdown === 'location'} onToggle={() => setOpenDropdown(openDropdown === 'location' ? null : 'location')} />
          {uniqueSeniorities.length > 0 && <FilterChip label="Seniority" selected={seniorityFilter} options={uniqueSeniorities.map(s => ({ key: s, label: s }))} onChange={setSeniorityFilter} isOpen={openDropdown === 'seniority'} onToggle={() => setOpenDropdown(openDropdown === 'seniority' ? null : 'seniority')} />}
          <FilterChip label="Contact" selected={contactQualityFilter} options={[{ key: 'verified', label: 'Verified' }, { key: 'partial', label: 'Unverified' }, { key: 'none', label: 'No Contact' }]} onChange={setContactQualityFilter} isOpen={openDropdown === 'contact'} onToggle={() => setOpenDropdown(openDropdown === 'contact' ? null : 'contact')} />
          <FilterChip label="Heat" selected={heatFilter} options={[{ key: 'HOT', label: 'HOT' }, { key: 'NEW', label: 'NEW' }, { key: 'WARM', label: 'WARM' }]} onChange={setHeatFilter} isOpen={openDropdown === 'heat'} onToggle={() => setOpenDropdown(openDropdown === 'heat' ? null : 'heat')} />
          <FilterChip label="Assigned" selected={assignedFilter} options={[{ key: 'unassigned', label: 'Unassigned' }, ...uniqueAssigned.map(m => ({ key: m.user_id, label: m.display_name }))]} onChange={setAssignedFilter} isOpen={openDropdown === 'assigned'} onToggle={() => setOpenDropdown(openDropdown === 'assigned' ? null : 'assigned')} />
          {activeFilterCount > 0 && (
            <button onClick={() => { setStatusFilter(new Set()); setRoleFilter(new Set()); setLocationFilter(new Set()); setContactQualityFilter(new Set()); setSeniorityFilter(new Set()); setHeatFilter(new Set()); setAssignedFilter(new Set()) }} style={{ color: palette.secondary }} className="flex items-center gap-1 text-xs hover:opacity-70 ml-1"><X size={12} />Clear</button>
          )}
        </div>
        <div className="flex items-center">
          <span style={{ color: palette.muted }} className="text-xs ml-auto">
            Showing <strong style={{ color: palette.ink }}>{displayLeads.length}</strong> of {activeLeads.length} leads
          </span>
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 gap-4 overflow-x-auto lg:grid-cols-7">
        {STAGES.map(stage => {
          const stageKey = stage.key
          const stageName = stage.label
          const leadsInStage = displayLeads.filter(l => l.status === stageKey)

          return (
            <div
              key={stageName}
              style={{ backgroundColor: palette.parchment, borderColor: palette.line }}
              className="flex-shrink-0 w-full min-h-96 rounded-2xl border p-4 lg:w-80"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stageKey)}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3
                  style={{ fontFamily: 'Playfair Display, serif', color: palette.ink }}
                  className="font-semibold"
                >
                  {stageName}
                </h3>
                <span
                  style={{ backgroundColor: palette.line, color: palette.ink }}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                >
                  {leadsInStage.length}
                </span>
              </div>

              <div className="space-y-3">
                {leadsInStage.map(lead => {
                  const heat = getHeatTag(lead)
                  const fee = estimateFee(lead.salary_range)

                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id)}
                      style={{ backgroundColor: palette.white, borderColor: palette.line, opacity: draggedLead === lead.id ? 0.5 : 1 }}
                      className="border rounded-xl p-3 cursor-move hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <GripHorizontal size={14} style={{ color: palette.muted, flexShrink: 0 }} />
                        <div className="flex-1">
                          <div style={{ color: palette.ink }} className="font-semibold text-sm">
                            {lead.company_name}
                          </div>
                          <div style={{ color: palette.secondary }} className="text-xs flex items-center gap-1.5">
                            <span>{titleCase(lead.role_title)}</span>
                            {lead.seniority_tier && lead.seniority_tier !== 'IC' && (
                              <span style={{
                                padding: '0px 6px',
                                backgroundColor: palette.line,
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600,
                                color: palette.ink,
                              }}>{lead.seniority_tier}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs mb-2">
                        {lead.location && (
                          <span style={{ color: palette.muted }} className="flex items-center gap-1">
                            <MapPin size={12} />
                            {lead.location}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <HeatTag tag={heat} />
                        {fee && (
                          <span
                            style={{ backgroundColor: palette.parchment, color: palette.ink }}
                            className="text-xs px-2 py-1 rounded"
                          >
                            ${fee.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetricBox({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign
  label: string
  value: string
}) {
  return (
    <div style={{ backgroundColor: palette.white, borderColor: palette.line }} className="border rounded-lg p-3">
      <div style={{ color: palette.muted }} className="text-xs uppercase font-semibold mb-1 flex items-center gap-1">
        <Icon size={12} />
        {label}
      </div>
      <div style={{ color: palette.ink }} className="font-semibold text-sm">
        {value}
      </div>
    </div>
  )
}

function CompetitiveInsightBox({
  icon: Icon,
  label,
  text,
}: {
  icon: typeof AlertCircle
  label: string
  text: string
}) {
  return (
    <div style={{ backgroundColor: palette.white, borderColor: palette.line }} className="border rounded-lg p-3">
      <div style={{ color: palette.muted }} className="text-xs uppercase font-semibold mb-2 flex items-center gap-1">
        <Icon size={12} />
        {label}
      </div>
      <div style={{ color: palette.ink }} className="text-xs leading-relaxed">
        {text}
      </div>
    </div>
  )
}

function CandidateCard({
  rank,
  name,
  headline,
  signal,
  score,
  url,
  matchedSkills,
}: {
  rank: number
  name: string
  headline?: string
  signal?: string
  score?: number
  url?: string
  matchedSkills?: string
}) {
  const getRankBg = (r: number) => {
    if (r === 1) return palette.ink
    if (r === 2) return palette.line
    return 'transparent'
  }

  const getRankText = (r: number) => {
    if (r === 1) return palette.cream
    return palette.ink
  }

  const getScoreBg = (s?: number) => {
    if (!s) return palette.parchment
    if (s >= 90) return palette.ink
    if (s >= 75) return palette.line
    return 'transparent'
  }

  const getScoreText = (s?: number) => {
    if (!s) return palette.muted
    if (s >= 90) return palette.cream
    return palette.ink
  }

  return (
    <div style={{ backgroundColor: palette.white, borderColor: palette.line }} className="border rounded-lg p-3">
      <div className="flex items-start gap-2 mb-2">
        <div
          style={{
            backgroundColor: getRankBg(rank),
            color: getRankText(rank),
            border: rank === 3 ? `1.5px solid ${palette.ink}` : 'none',
          }}
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        >
          {rank}
        </div>
        <div className="flex-1">
          <div style={{ color: palette.ink }} className="font-semibold text-sm">
            {name}
          </div>
          {headline && (
            <div style={{ color: palette.secondary }} className="text-xs">
              {headline}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {score != null && score > 0 && (
          <span
            style={{
              backgroundColor: getScoreBg(score),
              color: getScoreText(score),
              border: score < 75 ? `1.5px solid ${palette.ink}` : 'none',
            }}
            className="text-xs font-bold px-2 py-1 rounded"
          >
            {score}% Match
          </span>
        )}

        {signal && (
          <span
            style={{
              backgroundColor: signal === 'WARM' ? palette.line : 'transparent',
              color: palette.ink,
              border: signal !== 'WARM' ? `1.5px solid ${palette.ink}` : 'none',
            }}
            className="text-xs px-2 py-1 rounded"
          >
            {signal}
          </span>
        )}

        {url && (
          <a
            href={url.startsWith('http') ? url : `https://${url}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: palette.ink }}
            className="text-xs hover:underline"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {matchedSkills && (
        <div className="mt-2 flex items-start gap-1.5 flex-wrap">
          <span style={{ color: palette.muted }} className="text-[10px] font-medium uppercase tracking-wide mt-0.5">Skills match:</span>
          {matchedSkills.split(', ').map((skill, i) => (
            <span
              key={i}
              style={{ backgroundColor: palette.line, color: palette.ink }}
              className="text-[10px] px-1.5 py-0.5 rounded"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
