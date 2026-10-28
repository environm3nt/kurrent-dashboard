import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/locations/autocomplete?q=Toron
 *
 * Returns location suggestions for city autocomplete.
 *
 * Two sources, merged:
 * 1. Curated list — ~90 cities across Kurrent's target markets (instant, always works)
 * 2. Open-Meteo Geocoding API — free, no key, no rate limit, worldwide coverage
 *
 * Curated matches appear first so known cities are always instant.
 * Open-Meteo fills in less common cities not on the curated list.
 * Filtered to US, CA, GB, AU — primary Kurrent markets.
 */

// Country code mapping for display
const COUNTRY_NAMES: Record<string, string> = {
  us: 'United States',
  ca: 'Canada',
  gb: 'United Kingdom',
  au: 'Australia',
}

// Curated cities across Kurrent's target markets — always available, zero latency
const CURATED_LOCATIONS = [
  // Canada — Ontario (primary market)
  'Toronto Ontario Canada',
  'Mississauga Ontario Canada',
  'Brampton Ontario Canada',
  'Hamilton Ontario Canada',
  'Vaughan Ontario Canada',
  'Kitchener Ontario Canada',
  'London Ontario Canada',
  'Windsor Ontario Canada',
  'Aurora Ontario Canada',
  'Barrie Ontario Canada',
  'Markham Ontario Canada',
  'Richmond Hill Ontario Canada',
  'Oakville Ontario Canada',
  'Burlington Ontario Canada',
  'Oshawa Ontario Canada',
  'Whitby Ontario Canada',
  'Ajax Ontario Canada',
  'Pickering Ontario Canada',
  'Newmarket Ontario Canada',
  'Guelph Ontario Canada',
  'Kingston Ontario Canada',
  'Thunder Bay Ontario Canada',
  'Ottawa Ontario Canada',
  'Sudbury Ontario Canada',
  'Thornhill Ontario Canada',
  'Waterloo Ontario Canada',
  'Cambridge Ontario Canada',
  'St. Catharines Ontario Canada',
  'Niagara Falls Ontario Canada',
  'Peterborough Ontario Canada',
  'Brantford Ontario Canada',
  'Sarnia Ontario Canada',
  'North Bay Ontario Canada',
  'Sault Ste. Marie Ontario Canada',
  'Timmins Ontario Canada',
  'Belleville Ontario Canada',
  'Cornwall Ontario Canada',
  'Chatham Ontario Canada',
  'Woodstock Ontario Canada',
  'Stratford Ontario Canada',
  // Canada — other provinces
  'Vancouver British Columbia Canada',
  'Victoria British Columbia Canada',
  'Calgary Alberta Canada',
  'Edmonton Alberta Canada',
  'Montreal Quebec Canada',
  'Quebec City Quebec Canada',
  'Winnipeg Manitoba Canada',
  'Halifax Nova Scotia Canada',
  'Saskatoon Saskatchewan Canada',
  'Regina Saskatchewan Canada',
  'St. John\'s Newfoundland and Labrador Canada',
  'Fredericton New Brunswick Canada',
  'Charlottetown Prince Edward Island Canada',
  // United States — major metros
  'New York New York United States',
  'Los Angeles California United States',
  'Chicago Illinois United States',
  'Houston Texas United States',
  'Phoenix Arizona United States',
  'San Francisco California United States',
  'Seattle Washington United States',
  'Boston Massachusetts United States',
  'Dallas Texas United States',
  'Atlanta Georgia United States',
  'Miami Florida United States',
  'Denver Colorado United States',
  'Minneapolis Minnesota United States',
  'Charlotte North Carolina United States',
  'Austin Texas United States',
  'Nashville Tennessee United States',
  'Portland Oregon United States',
  'San Diego California United States',
  'Detroit Michigan United States',
  'Philadelphia Pennsylvania United States',
  'Washington District of Columbia United States',
  'San Antonio Texas United States',
  'Columbus Ohio United States',
  'Indianapolis Indiana United States',
  'Jacksonville Florida United States',
  'Tampa Florida United States',
  'Pittsburgh Pennsylvania United States',
  'Cincinnati Ohio United States',
  'Cleveland Ohio United States',
  'Kansas City Missouri United States',
  'Salt Lake City Utah United States',
  'Raleigh North Carolina United States',
  // United Kingdom
  'London England United Kingdom',
  'Manchester England United Kingdom',
  'Birmingham England United Kingdom',
  'Leeds England United Kingdom',
  'Glasgow Scotland United Kingdom',
  'Edinburgh Scotland United Kingdom',
  'Bristol England United Kingdom',
  'Liverpool England United Kingdom',
  'Sheffield England United Kingdom',
  'Newcastle England United Kingdom',
  'Cardiff Wales United Kingdom',
  'Belfast Northern Ireland United Kingdom',
  // Australia
  'Sydney New South Wales Australia',
  'Melbourne Victoria Australia',
  'Brisbane Queensland Australia',
  'Perth Western Australia Australia',
  'Adelaide South Australia Australia',
  'Canberra Australian Capital Territory Australia',
  'Gold Coast Queensland Australia',
  'Hobart Tasmania Australia',
]

// Helper: search the curated list and return formatted matches
function searchCuratedLocations(query: string, limit = 8) {
  const lower = query.toLowerCase()
  return CURATED_LOCATIONS
    .filter(loc => loc.toLowerCase().includes(lower))
    .slice(0, limit)
    .map(loc => {
      let countryName = ''
      let rest = ''
      if (loc.endsWith('United States')) {
        countryName = 'United States'
        rest = loc.slice(0, -14).trim()
      } else if (loc.endsWith('United Kingdom')) {
        countryName = 'United Kingdom'
        rest = loc.slice(0, -15).trim()
      } else if (loc.endsWith('Canada')) {
        countryName = 'Canada'
        rest = loc.slice(0, -7).trim()
      } else if (loc.endsWith('Australia')) {
        countryName = 'Australia'
        rest = loc.slice(0, -10).trim()
      } else {
        const words = loc.split(' ')
        countryName = words[words.length - 1]
        rest = words.slice(0, -1).join(' ')
      }

      return {
        description: rest + ', ' + countryName,
        place_id: null,
        structured: loc,
      }
    })
}

// Helper: deduplicate suggestions by normalized structured name
function deduplicateSuggestions(suggestions: Array<{ description: string; place_id: string | null; structured: string }>) {
  const seen = new Set<string>()
  return suggestions.filter(s => {
    const key = s.structured.toLowerCase().replace(/[,.\s]+/g, ' ').trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() || ''

  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  // 1. Curated list — instant matches for known cities in target markets
  const curatedMatches = searchCuratedLocations(query, 8)

  // 2. Open-Meteo Geocoding — free, no key, no rate limit
  //    Catches cities not on the curated list
  let apiResults: Array<{ description: string; place_id: string | null; structured: string }> = []

  try {
    const meteoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
    meteoUrl.searchParams.set('name', query)
    meteoUrl.searchParams.set('count', '10')
    meteoUrl.searchParams.set('language', 'en')
    meteoUrl.searchParams.set('format', 'json')

    const meteoResponse = await fetch(meteoUrl.toString())

    if (meteoResponse.ok) {
      const meteoData = await meteoResponse.json()

      if (meteoData.results && meteoData.results.length > 0) {
        const allowedCodes = new Set(['US', 'CA', 'GB', 'AU'])
        apiResults = meteoData.results
          .filter((r: any) => allowedCodes.has(r.country_code))
          .slice(0, 8)
          .map((r: any) => {
            const city = r.name || ''
            const admin = r.admin1 || ''
            const countryCode = (r.country_code || '').toLowerCase()
            const country = COUNTRY_NAMES[countryCode] || r.country || ''

            const parts = [city, admin, country].filter(Boolean)
            return {
              description: parts.join(', '),
              place_id: r.id ? String(r.id) : null,
              structured: parts.join(' '),
            }
          })
      }
    }
  } catch {
    // Curated matches still cover the most common cities
  }

  // Merge: curated first (instant, reliable), then API results, deduplicated, max 8
  const merged = deduplicateSuggestions([...curatedMatches, ...apiResults]).slice(0, 8)

  return NextResponse.json(merged)
}
