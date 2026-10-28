'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { palette } from '@/lib/theme'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showMagicLink, setShowMagicLink] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const supabase = createClient()

  const handleOAuthLogin = async (provider: 'google' | 'azure') => {
    setSsoLoading(provider)
    setMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(provider === 'azure' && {
          scopes: 'email profile openid',
        }),
      },
    })

    if (error) {
      setMessage(error.message)
      setSsoLoading(null)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the login link!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: palette.nearBlack }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-2xl p-8" style={{ backgroundColor: palette.cream }}>
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center font-serif font-bold text-2xl mx-auto mb-4"
              style={{ backgroundColor: palette.line, color: palette.ink }}
            >
              K
            </div>
            <h1 className="text-3xl font-serif font-bold mb-2" style={{ color: palette.ink }}>Kurrent</h1>
            <p style={{ color: palette.secondary }}>Sign in to your client portal</p>
          </div>

          {/* SSO Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuthLogin('google')}
              disabled={ssoLoading !== null}
              className="w-full py-3 px-4 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-3"
              style={{ backgroundColor: palette.parchment, border: `1.5px solid ${palette.line}`, color: palette.ink }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {ssoLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
            </button>

            <button
              onClick={() => handleOAuthLogin('azure')}
              disabled={ssoLoading !== null}
              className="w-full py-3 px-4 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-3"
              style={{ backgroundColor: palette.parchment, border: `1.5px solid ${palette.line}`, color: palette.ink }}
            >
              <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              {ssoLoading === 'azure' ? 'Redirecting...' : 'Continue with Microsoft'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ backgroundColor: palette.line }} />
            <span className="text-xs" style={{ color: '#B8A89A' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: palette.line }} />
          </div>

          {/* Email + Password Login */}
          {!showPassword && !showMagicLink && (
            <div className="space-y-3">
              <button
                onClick={() => setShowPassword(true)}
                className="w-full py-3 px-4 rounded-lg font-medium transition text-sm"
                style={{ backgroundColor: 'transparent', border: `1.5px solid ${palette.line}`, color: palette.secondary }}
              >
                Sign in with email
              </button>
            </div>
          )}

          {showPassword && !showMagicLink && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: palette.ink }}>
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg outline-none transition text-sm"
                  style={{
                    border: `1.5px solid ${palette.line}`,
                    backgroundColor: palette.parchment,
                    color: palette.nearBlack,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                  onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: palette.ink }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-4 py-3 pr-12 rounded-lg outline-none transition text-sm"
                    style={{
                      border: `1.5px solid ${palette.line}`,
                      backgroundColor: palette.parchment,
                      color: palette.nearBlack,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                    onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                    style={{ color: palette.muted, background: 'none', border: 'none', cursor: 'pointer' }}
                    tabIndex={-1}
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                  >
                    {passwordVisible ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                style={{ backgroundColor: palette.ink, color: palette.cream }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => { setShowPassword(false); setShowMagicLink(true) }}
                className="w-full text-xs text-center transition"
                style={{ color: palette.muted }}
              >
                Use magic link instead
              </button>
            </form>
          )}

          {/* Magic Link */}
          {showMagicLink && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="magic-email" className="block text-sm font-medium mb-1" style={{ color: palette.ink }}>
                  Email address
                </label>
                <input
                  id="magic-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg outline-none transition text-sm"
                  style={{
                    border: `1.5px solid ${palette.line}`,
                    backgroundColor: palette.parchment,
                    color: palette.nearBlack,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = palette.ink }}
                  onBlur={e => { e.currentTarget.style.borderColor = palette.line }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                style={{ backgroundColor: palette.ink, color: palette.cream }}
              >
                {loading ? 'Sending link...' : 'Send magic link'}
              </button>

              <button
                type="button"
                onClick={() => { setShowMagicLink(false); setShowPassword(true) }}
                className="w-full text-xs text-center transition"
                style={{ color: palette.muted }}
              >
                Use password instead
              </button>
            </form>
          )}

          {message && (
            <div
              className="mt-4 p-3 rounded-lg text-sm"
              style={message.includes('Check') ? {
                backgroundColor: '#EEF5EE',
                color: '#5C8A5E',
              } : {
                backgroundColor: '#FDF2F2',
                color: '#A0522D',
              }}
            >
              {message}
            </div>
          )}

          <p className="text-center text-xs mt-6" style={{ color: '#B8A89A' }}>
            Powered by Kurrent Labs
          </p>
        </div>
      </div>
    </div>
  )
}
