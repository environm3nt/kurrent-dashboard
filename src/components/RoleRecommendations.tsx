'use client'

import { useState, useEffect } from 'react'
import { Plus, TrendingUp } from 'lucide-react'
import { palette } from '@/lib/theme'

interface RoleSuggestion {
  title: string
  posting_count: number
  category: string | null
  seniority_default: string | null
}

interface RoleRecommendation {
  title: string
  category: string
  location: string
  posting_count: number
  demand_label: string
  salary_low: number
  salary_high: number
}

interface RoleRecommendationsProps {
  currentRoles: string[]
  locations: string[]
}

// Estimate salary range by category (placeholder logic — will improve with real market data)
function estimateSalary(category: string | null): { low: number; high: number } {
  const ranges: Record<string, { low: number; high: number }> = {
    'Healthcare': { low: 78000, high: 95000 },
    'Technology': { low: 130000, high: 165000 },
    'Finance': { low: 85000, high: 110000 },
    'Engineering': { low: 95000, high: 130000 },
    'Marketing': { low: 70000, high: 95000 },
    'Legal': { low: 90000, high: 125000 },
    'Operations': { low: 75000, high: 100000 },
    'Human Resources': { low: 70000, high: 95000 },
    'Sales': { low: 65000, high: 90000 },
    'Administration': { low: 55000, high: 75000 },
  }
  return ranges[category || ''] || { low: 65000, high: 95000 }
}

function getDemandLabel(count: number): string {
  if (count >= 200) return 'High demand'
  if (count >= 75) return 'Surging'
  if (count >= 30) return 'Steady demand'
  if (count >= 10) return 'Growing'
  return 'Emerging'
}

function formatSalary(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n.toLocaleString()}`
}

function formatFee(n: number): string {
  return `$${n.toLocaleString()}`
}

export default function RoleRecommendations({ currentRoles, locations }: RoleRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RoleRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [addedRoles, setAddedRoles] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        // Fetch top suggestions (no query = popular roles)
        const res = await fetch('/api/roles/suggestions?limit=12')
        if (!res.ok) { setLoading(false); return }
        const suggestions: RoleSuggestion[] = await res.json()

        // Filter out roles user is already tracking
        const currentLower = new Set(currentRoles.map(r => r.toLowerCase()))
        const filtered = suggestions
          .filter(s => !currentLower.has(s.title.toLowerCase()))
          .filter(s => s.posting_count >= 10) // Only show roles with meaningful demand
          .sort((a, b) => b.posting_count - a.posting_count)
          .slice(0, 3) // Top 3

        const recs: RoleRecommendation[] = filtered.map(s => {
          const salary = estimateSalary(s.category)
          return {
            title: s.title,
            category: s.category || 'General',
            location: locations[0] ? locations[0].split(' ').slice(0, 2).join(', ') : 'Your market',
            posting_count: s.posting_count,
            demand_label: getDemandLabel(s.posting_count),
            salary_low: salary.low,
            salary_high: salary.high,
          }
        })

        setRecommendations(recs)
      } catch {
        // Silently fail — recommendations are supplementary
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
  }, [currentRoles, locations])

  if (loading || recommendations.length === 0) return null

  return (
    <div style={{
      backgroundColor: palette.parchment,
      border: `1px solid ${palette.line}`,
      borderRadius: '14px',
      padding: '24px',
      marginTop: '24px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '17px',
          fontWeight: 700,
          color: palette.ink,
          marginBottom: '4px',
        }}>
          Kurrent Recommends
        </div>
        <div style={{ fontSize: '13px', color: palette.secondary }}>
          Roles with high demand you&apos;re not tracking yet
        </div>
      </div>

      {/* Recommendation cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '12px',
      }}>
        {recommendations.map((rec, i) => {
          const feeLow = Math.round(rec.salary_low * 0.15)
          const feeHigh = Math.round(rec.salary_high * 0.25)
          const isAdded = addedRoles.has(rec.title)

          return (
            <div
              key={i}
              style={{
                backgroundColor: '#fff',
                border: `1px solid ${palette.line}`,
                borderRadius: '10px',
                padding: '18px 20px',
              }}
            >
              {/* Role title */}
              <div style={{
                fontWeight: 600,
                fontSize: '15px',
                color: palette.ink,
                marginBottom: '4px',
              }}>
                {rec.title}
              </div>

              {/* Category + location */}
              <div style={{ fontSize: '13px', color: palette.secondary, marginBottom: '12px' }}>
                {rec.category} · {rec.location}
              </div>

              {/* Demand signal */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
              }}>
                <TrendingUp size={13} style={{ color: palette.ink }} />
                <span style={{ fontSize: '13px', color: palette.ink }}>
                  {rec.posting_count} postings this week · <strong>{rec.demand_label}</strong>
                </span>
              </div>

              {/* Salary + fee */}
              <div style={{ fontSize: '13px', color: palette.secondary, marginBottom: '14px' }}>
                Avg salary: {formatSalary(rec.salary_low)}-{formatSalary(rec.salary_high)} · Est. fee: {formatFee(feeLow)}-{formatFee(feeHigh)}
              </div>

              {/* Add button */}
              <button
                onClick={() => {
                  setAddedRoles(prev => new Set([...prev, rec.title]))
                }}
                disabled={isAdded}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: isAdded ? palette.line : 'transparent',
                  border: isAdded ? `1px solid ${palette.line}` : `1.5px solid ${palette.ink}`,
                  borderRadius: '8px',
                  color: isAdded ? palette.muted : palette.ink,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isAdded ? 'default' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <Plus size={14} />
                {isAdded ? 'Added to my roles' : 'Add to my roles'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
