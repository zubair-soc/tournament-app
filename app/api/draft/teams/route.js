import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const league_id = searchParams.get('league_id')

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', league_id)
    .order('draft_order', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const { league_id, name, gm_name } = await request.json()

  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('league_id', league_id)

  const { data, error } = await supabase
    .from('teams')
    .insert({ league_id, name, gm_name, draft_order: (existing?.length || 0) + 1 })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(request) {
  const { updates } = await request.json()

  for (const update of updates) {
    await supabase
      .from('teams')
      .update({ draft_order: update.draft_order })
      .eq('id', update.id)
  }

  return Response.json({ success: true })
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
