'use client'

import { useState, useEffect } from 'react'
import { palette } from '@/lib/theme'

interface BriefingGreetingProps {
  userName: string | null
  newLeadCount: number
  latestRunDate: string | null
  todayRoles?: string[]
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function BriefingGreeting({ userName, newLeadCount, latestRunDate: _latestRunDate, todayRoles = [] }: BriefingGreetingProps) {
  const [greeting, setGreeting] = useState('Good morning')
  const [dateStr, setDateStr] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setGreeting(getGreeting())
    setDateStr(formatDate())
    setMounted(true)
  }, [])

  // Extract first name
  const firstName = userName
    ? userName.split(' ')[0].charAt(0).toUpperCase() + userName.split(' ')[0].slice(1).toLowerCase()
    : null

  return (
    <div className="mb-6 sm:mb-8" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
      {/* Left: greeting */}
      <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '28px',
            fontWeight: 700,
            color: palette.ink,
            lineHeight: 1.2,
          }}
        >
          {mounted ? greeting : 'Good morning'},{firstName ? (
            <>
              <br />{firstName}
            </>
          ) : ''}
        </h1>

        <p className="mt-2" style={{ color: palette.secondary, fontSize: '15px' }}>
          {mounted ? dateStr : ''} &mdash; {newLeadCount > 0
            ? `Here's what's hot for you today.`
            : `Your intelligence briefing is up to date.`}
        </p>
      </div>

      {/* Right: RUNNING TODAY card */}
      {todayRoles.length > 0 && (
        <div style={{
          backgroundColor: palette.parchment,
          border: `1px solid ${palette.line}`,
          borderRadius: '12px',
          padding: '16px 20px',
          minWidth: '200px',
          maxWidth: '280px',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            color: palette.muted,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '10px',
          }}>
            Running Today
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {todayRoles.map((role, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#fff',
                  border: `1px solid ${palette.line}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: palette.ink,
                }}
              >
                {role}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
