import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const league_id = searchParams.get('league_id')

  const { data, error } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('league_id', league_id)
    .order('pick_number', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const { league_id, team_id, registrant_id, pick_number, round } = await request.json()

  const { data, error } = await supabase
    .from('draft_picks')
    .insert({ league_id, team_id, registrant_id, pick_number, round })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const league_id = searchParams.get('league_id')

  const { error } = await supabase
    .from('draft_picks')
    .delete()
    .eq('league_id', league_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
