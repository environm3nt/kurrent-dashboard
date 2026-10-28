'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { palette } from '@/lib/theme'

export default function SignOutButton() {
  const supabase = createClient()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 20px',
        fontSize: '13px',
        fontWeight: 600,
        color: palette.cream,
        backgroundColor: palette.ink,
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'Inter, -apple-system, sans-serif',
        marginTop: '20px',
      }}
    >
      <LogOut size={14} /> Sign Out
    </button>
  )
}
