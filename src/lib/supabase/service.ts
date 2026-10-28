import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for server-side data queries.
 * Bypasses RLS — only use on the server after verifying the user via auth.getUser().
 * Never expose to the client or pass to client components.
 *
 * Returns null if service role key is not available (falls back to anon client in caller).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn('[SERVICE-CLIENT] SUPABASE_SERVICE_ROLE_KEY not set — will use anon client')
    return null
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
