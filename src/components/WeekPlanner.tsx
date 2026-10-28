'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RecruiterConfig } from '@/types/database'
import { X, Check, AlertCircle, GripVertical } from 'lucide-react'
import { palette } from '@/lib/theme'

interface WeekPlannerProps {
  userId: string
  clientId: string
}

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
]

const TODAY_KEY = (() => {
  const d = new Date().getDay()
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d]
})()

export default function WeekPlanner({ userId, clientId }: WeekPlannerProps) {
  const supabase = createClient()
  const [config, setConfig] = useState<RecruiterConfig | null>(null)
  const [schedule, setSchedule] = useState<Record<string, string[]>>({})
  const [roles, setRoles] = useState<Array<{ title: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>()
  const [draggedRole, setDraggedRole] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(undefined), 3000)
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('recruiter_configs')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', userId)
        .single()

      if (data) {
        const cfg = data as unknown as RecruiterConfig
        setConfig(cfg)
        setRoles(cfg.target_roles || [])
        setSchedule(cfg.schedule || {})
      }
      setLoading(false)
    }
    load()
  }, [clientId, userId, supabase])

  // Get roles scheduled for a specific day
  const getRolesForDay = useCallback((dayKey: string): string[] => {
    return roles
      .map(r => r.title)
      .filter(title => (schedule[title] || []).includes(dayKey))
  }, [roles, schedule])

  // Get unscheduled roles (not assigned to any day)
  const unscheduledRoles = roles
    .map(r => r.title)
    .filter(title => !schedule[title] || schedule[title].length === 0)

  // Add role to a day
  const addRoleToDay = (roleTitle: string, dayKey: string) => {
    setSchedule(prev => {
      const days = prev[roleTitle] || []
      if (days.includes(dayKey)) return prev
      return { ...prev, [roleTitle]: [...days, dayKey] }
    })
    setIsDirty(true)
  }

  // Remove role from a day
  const removeRoleFromDay = (roleTitle: string, dayKey: string) => {
    setSchedule(prev => {
      const days = (prev[roleTitle] || []).filter(d => d !== dayKey)
      return { ...prev, [roleTitle]: days }
    })
    setIsDirty(true)
  }

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, roleTitle: string) => {
    setDraggedRole(roleTitle)
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/plain', roleTitle)
  }

  const handleDragOver = (e: React.DragEvent, dayKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverDay(dayKey)
  }

  const handleDragLeave = () => {
    setDragOverDay(null)
  }

  const handleDrop = (e: React.DragEvent, toDay: string) => {
    e.preventDefault()
    if (draggedRole) {
      addRoleToDay(draggedRole, toDay)
    }
    setDraggedRole(null)
    setDragOverDay(null)
  }

  const handleDragEnd = () => {
    setDraggedRole(null)
    setDragOverDay(null)
  }

  // Save
  const save = async () => {
    if (!config) return
    setSaving(true)
    const { error } = await supabase
      .from('recruiter_configs')
      .update({ schedule })
      .eq('id', config.id)

    if (error) {
      showToast('Failed to save', 'error')
    } else {
      showToast('Schedule saved')
      setIsDirty(false)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: palette.muted }}>
        Loading your schedule...
      </div>
    )
  }

  if (!config || roles.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: palette.parchment,
        border: `1px solid ${palette.line}`,
        borderRadius: '12px',
      }}>
        <p style={{ color: palette.secondary, marginBottom: '12px' }}>
          No roles configured yet. Add roles in <a href="/dashboard/roles" style={{ color: palette.ink, fontWeight: 600 }}>My Roles</a> first.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 100,
            padding: '12px 20px', borderRadius: '9px',
            backgroundColor: toast.type === 'success' ? palette.ink : palette.line,
            color: toast.type === 'success' ? palette.cream : palette.ink,
            fontSize: '13px', fontWeight: 500,
            boxShadow: '0 4px 16px rgba(47,44,37,0.12)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      {/* Unscheduled roles — draggable pool */}
      {unscheduledRoles.length > 0 && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: palette.parchment,
          border: `1.5px solid ${palette.line}`,
          borderRadius: '12px',
          marginBottom: '20px',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: palette.ink,
            marginBottom: '10px',
          }}>
            Unscheduled roles — drag into a day to activate
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {unscheduledRoles.map(title => (
              <div
                key={title}
                draggable
                onDragStart={e => handleDragStart(e, title)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#fff',
                  border: `1.5px solid ${palette.line}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: palette.ink,
                  cursor: 'grab',
                  userSelect: 'none',
                  opacity: draggedRole === title ? 0.5 : 1,
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                }}
              >
                <GripVertical size={14} style={{ color: palette.muted, flexShrink: 0 }} />
                {title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5-day grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {DAYS.map(day => {
          const dayRoles = getRolesForDay(day.key)
          const isToday = day.key === TODAY_KEY
          const isDropTarget = dragOverDay === day.key
          // Roles available to add to this day (not yet on this day)
          const availableForDay = roles
            .map(r => r.title)
            .filter(title => !(schedule[title] || []).includes(day.key))

          return (
            <div
              key={day.key}
              onDragOver={e => handleDragOver(e, day.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, day.key)}
              style={{
                backgroundColor: isDropTarget ? palette.line : 'white',
                border: isToday
                  ? `2px solid ${palette.ink}`
                  : isDropTarget
                    ? `2px dashed ${palette.ink}`
                    : `1px solid ${palette.line}`,
                borderRadius: '10px',
                padding: '16px',
                minHeight: '220px',
                transition: 'background-color 0.15s, border 0.15s',
              }}
            >
              {/* Day header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: `1px solid ${palette.line}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: palette.ink }}>
                    {day.label}
                  </span>
                  {isToday && (
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: palette.ink,
                      color: palette.cream,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      TODAY
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: palette.muted }}>
                  {dayRoles.length} role{dayRoles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Role cards in this day */}
              {dayRoles.map(roleTitle => (
                <div
                  key={roleTitle}
                  draggable
                  onDragStart={e => handleDragStart(e, roleTitle)}
                  onDragEnd={handleDragEnd}
                  style={{
                    backgroundColor: palette.parchment,
                    border: `1px solid ${palette.line}`,
                    padding: '7px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    marginBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'grab',
                    color: palette.ink,
                    userSelect: 'none',
                    opacity: draggedRole === roleTitle ? 0.4 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <GripVertical size={12} style={{ color: palette.muted, flexShrink: 0 }} />
                    <span>{roleTitle}</span>
                  </div>
                  <button
                    onClick={() => removeRoleFromDay(roleTitle, day.key)}
                    style={{
                      color: palette.muted,
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: '0',
                      display: 'flex',
                      flexShrink: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {/* Drop zone hint when dragging */}
              {draggedRole && !dayRoles.includes(draggedRole) && (
                <div style={{
                  padding: '8px',
                  border: '1.5px dashed #D4CFC5',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: palette.muted,
                  marginTop: dayRoles.length > 0 ? '4px' : '0',
                }}>
                  Drop here
                </div>
              )}

              {/* Empty state when not dragging */}
              {dayRoles.length === 0 && !draggedRole && availableForDay.length > 0 && (
                <div style={{
                  padding: '16px 8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: palette.muted,
                }}>
                  Drag roles here
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* All roles scheduled confirmation */}
      {unscheduledRoles.length === 0 && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: palette.parchment,
          border: `1px solid ${palette.line}`,
          borderRadius: '10px',
          marginBottom: '16px',
          fontSize: '13px',
          color: palette.ink,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Check size={16} style={{ color: palette.ink }} />
          <span><strong>All roles scheduled.</strong> Each role will generate leads on its assigned days.</span>
        </div>
      )}

      {/* Digest delivery card */}
      <div style={{
        backgroundColor: palette.parchment,
        border: `1px solid ${palette.line}`,
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '16px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: palette.ink, fontSize: '14px' }}>
              Digest delivery
            </div>
            <div style={{ fontSize: '13px', color: palette.secondary }}>
              Your daily briefing email arrives based on this plan
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Send time
              </div>
              <div style={{ fontWeight: 500, fontSize: '14px', color: palette.ink }}>7:00 AM ET</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Active days
              </div>
              <div style={{ fontWeight: 500, fontSize: '14px', color: palette.ink }}>Mon — Fri</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Weekends
              </div>
              <div style={{ fontWeight: 500, fontSize: '14px', color: palette.ink }}>Off</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      {isDirty && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            backgroundColor: palette.cream,
            borderTop: `1.5px solid ${palette.line}`,
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            onClick={() => {
              if (config) {
                setSchedule(config.schedule || {})
                setIsDirty(false)
              }
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
            onClick={save}
            disabled={saving}
            type="button"
            style={{
              padding: '10px 28px', fontSize: '13px', fontWeight: 600,
              backgroundColor: palette.ink, color: palette.cream, borderRadius: '10px',
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      )}
      {isDirty && <div style={{ height: '80px' }} />}
    </div>
  )
}
