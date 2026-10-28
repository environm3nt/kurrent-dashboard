/**
 * Platform-admin gate.
 *
 * A small set of operator accounts can see the cross-client admin and
 * analytics pages. The list comes from the environment so no addresses
 * live in source:
 *
 *   PLATFORM_ADMIN_EMAILS=ops@example.com,second@example.com
 *
 * Server code reads PLATFORM_ADMIN_EMAILS. The client-side Sidebar only
 * needs the list to decide whether to *show* the admin links (the pages
 * and API routes re-check on the server), so it reads the NEXT_PUBLIC_
 * variant. Set both to the same value.
 */
function parse(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

const SERVER_LIST = parse(process.env.PLATFORM_ADMIN_EMAILS)
const PUBLIC_LIST = parse(process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS)

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.toLowerCase()
  return SERVER_LIST.includes(e) || PUBLIC_LIST.includes(e)
}
