import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Verify a GM code — matches against any team in the league
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const league_id = searchParams.get('league_id')
  const code = searchParams.get('code')

  if (!league_id || !code) return Response.json({ valid: false })

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, gm_name, gm_code')
    .eq('league_id', league_id)

  if (!teams) return Response.json({ valid: false })

  const match = teams.find(t => t.gm_code && t.gm_code.toUpperCase() === code.toUpperCase())
  if (!match) return Response.json({ valid: false })

  return Response.json({ valid: true, team_id: match.id, team_name: match.name, gm_name: match.gm_name })
}

// Generate or reset a GM code for a specific team
export async function POST(request) {
  const { team_id, reset } = await request.json()

  if (!team_id) return Response.json({ error: 'team_id required' }, { status: 400 })

  if (!reset) {
    const { data: existing } = await supabase
      .from('teams')
      .select('gm_code')
      .eq('id', team_id)
      .single()

    if (existing?.gm_code) {
      return Response.json({ code: existing.gm_code })
    }
  }

  const code = generateCode()

  const { error } = await supabase
    .from('teams')
    .update({ gm_code: code })
    .eq('id', team_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ code })
}
