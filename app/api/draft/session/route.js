import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const league_id = searchParams.get('league_id')

  const { data, error } = await supabase
    .from('draft_sessions')
    .select('*')
    .eq('league_id', league_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return Response.json(null)
  return Response.json(data)
}

export async function POST(request) {
  const { league_id, timer_seconds } = await request.json()

  // Check if session already exists
  const { data: existing } = await supabase
    .from('draft_sessions')
    .select('id')
    .eq('league_id', league_id)
    .limit(1)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('draft_sessions')
      .update({ status: 'active', timer_seconds, timer_started_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }

  const { data, error } = await supabase
    .from('draft_sessions')
    .insert({ league_id, status: 'active', current_pick: 1, timer_seconds, timer_started_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(request) {
  const { league_id, current_pick, status, timer_started_at } = await request.json()

  const updates = {}
  if (current_pick !== undefined) updates.current_pick = current_pick
  if (status !== undefined) updates.status = status
  if (timer_started_at !== undefined) updates.timer_started_at = timer_started_at

  const { data, error } = await supabase
    .from('draft_sessions')
    .update(updates)
    .eq('league_id', league_id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
