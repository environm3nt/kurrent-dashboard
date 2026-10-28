import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/roles/suggestions?q=senior+acc&limit=8
 *
 * Returns role suggestions from the role_suggestions table,
 * ranked by posting_count (demand signal from Indeed probe).
 * Uses ILIKE for prefix/substring matching.
 *
 * Response shape:
 * [{ title, posting_count, category, seniority_default }]
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 20)

  // Auth check — only authenticated users
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // If no query, return top roles by demand
  if (!query) {
    const { data, error } = await supabase
      .from('role_suggestions')
      .select('title, posting_count, category, seniority_default')
      .order('posting_count', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data || [])
  }

  // Search with ILIKE — handles both trigram and btree indexes
  const { data, error } = await supabase
    .from('role_suggestions')
    .select('title, posting_count, category, seniority_default')
    .ilike('title', `%${query}%`)
    .order('posting_count', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
