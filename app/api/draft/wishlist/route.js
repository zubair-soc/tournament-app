import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const team_id = searchParams.get('team_id')

  const { data, error } = await supabase
    .from('wishlists')
    .select('*, registrants(id, name, players(rating))')
    .eq('team_id', team_id)
    .order('slot', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const { team_id, registrant_id, slot } = await request.json()

  // Upsert — if slot already exists for this team, replace it
  const { data, error } = await supabase
    .from('wishlists')
    .upsert({ team_id, registrant_id, slot }, { onConflict: 'team_id,slot' })
    .select('*, registrants(id, name, players(rating))')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const team_id = searchParams.get('team_id')
  const slot = searchParams.get('slot')

  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('team_id', team_id)
    .eq('slot', slot)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
