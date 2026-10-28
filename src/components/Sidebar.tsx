'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Users, BarChart3, Settings, LogOut, Shield, Menu, X, FileText, Briefcase, UserCog, CreditCard, CalendarDays } from 'lucide-react'

import { isPlatformAdmin } from '@/lib/platform-admin'
import { palette } from '@/lib/theme'

const navSections = [
  {
    label: 'Intelligence',
    items: [
      { name: "Today's Briefing", href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
      { name: 'Leads', href: '/dashboard/leads', icon: Users, adminOnly: false },
    ],
  },
  {
    label: 'Configure Automations',
    items: [
      { name: 'My Roles', href: '/dashboard/roles', icon: Briefcase, adminOnly: false },
      { name: 'Plan Your Week', href: '/dashboard/schedule', icon: CalendarDays, adminOnly: false },
      { name: 'Reports', href: '/dashboard/reports', icon: FileText, adminOnly: false },
    ],
  },
  {
    label: 'Admin',
    items: [
      { name: 'Team', href: '/dashboard/team', icon: UserCog, adminOnly: true },
      { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, adminOnly: true },
      { name: 'Plans', href: '/dashboard/pricing', icon: CreditCard, adminOnly: true },
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'Settings', href: '/dashboard/settings', icon: Settings, adminOnly: false },
    ],
  },
]

interface SidebarProps {
  userEmail: string
  clientName: string
  brandColor: string
  userRole: 'admin' | 'member'
}

export default function Sidebar({ userEmail, clientName, brandColor: _brandColor, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = isPlatformAdmin(userEmail)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarContent = (
    <>
      {/* Logo + Agency */}
      <div className="p-6" style={{ borderBottom: '1px solid #2A2824' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-serif font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: palette.line, color: palette.ink }}
          >
            K
          </div>
          <div className="min-w-0">
            <h2 className="font-serif font-bold text-sm truncate" style={{ color: palette.cream }}>
              {pathname === '/dashboard/admin' ? 'Kurrent' : clientName}
            </h2>
            <p className="text-xs" style={{ color: palette.secondary }}>
              {pathname === '/dashboard/admin' ? 'Admin Portal' : 'Client Portal'}
            </p>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto md:hidden flex-shrink-0"
            style={{ color: palette.secondary }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(item => !item.adminOnly || userRole === 'admin')
          if (visibleItems.length === 0) return null
          return (
            <div key={section.label} className="mb-5">
              <p
                className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest"
                style={{ color: palette.muted, fontSize: '10px', letterSpacing: '1.2px' }}
              >
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
                        style={isActive ? {
                          backgroundColor: 'rgba(254, 250, 243, 0.08)',
                          color: palette.cream,
                        } : {
                          color: palette.secondary,
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'rgba(254, 250, 243, 0.04)'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }
                        }}
                      >
                        <item.icon size={18} />
                        {item.name}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}

        {/* Kurrent-internal links — only visible to Kurrent team */}
        {isAdmin && (
          <div className="mt-2 pt-4" style={{ borderTop: '1px solid #2A2824' }}>
            <p
              className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest"
              style={{ color: palette.muted, fontSize: '10px', letterSpacing: '1.2px' }}
            >
              Kurrent
            </p>
            {[
              { name: 'Admin Portal', href: '/dashboard/admin', icon: Shield },
            ].map(item => {
              const isActive = pathname === item.href
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
                  style={isActive ? {
                    backgroundColor: 'rgba(254, 250, 243, 0.08)',
                    color: palette.cream,
                  } : {
                    color: palette.muted,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(254, 250, 243, 0.04)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <item.icon size={18} />
                  {item.name}
                </a>
              )
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4" style={{ borderTop: '1px solid #2A2824' }}>
        <p className="text-xs truncate mb-3" style={{ color: palette.secondary }}>{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm transition"
          style={{ color: palette.secondary }}
          onMouseEnter={e => { e.currentTarget.style.color = palette.cream }}
          onMouseLeave={e => { e.currentTarget.style.color = palette.secondary }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar with hamburger — visible below md breakpoint */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: palette.nearBlack, borderBottom: '1px solid #2A2824' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          style={{ color: palette.cream }}
        >
          <Menu size={22} />
        </button>
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center font-serif font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: palette.line, color: palette.ink }}
        >
          K
        </div>
        <h2 className="font-serif font-bold text-sm truncate" style={{ color: palette.cream }}>{clientName}</h2>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-72 h-full flex flex-col"
            style={{ backgroundColor: palette.nearBlack }}
            onClick={e => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar — hidden below md */}
      <div className="hidden md:flex w-64 flex-col flex-shrink-0" style={{ backgroundColor: palette.nearBlack }}>
        {sidebarContent}
      </div>
    </>
  )
}
