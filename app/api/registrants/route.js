import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const league_id = searchParams.get('league_id')

  const { data, error } = await supabase
    .from('registrants')
    .select('*, players(rating)')
    .eq('league_id', league_id)
    .order('name', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(request) {
  const { id, approval_status, payment_status, name, email } = await request.json()

  // Name update — also try to relink player_id
  if (name !== undefined) {
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .ilike('name', name.trim())
      .limit(1)
      .single()

    const { data, error } = await supabase
      .from('registrants')
      .update({ name: name.trim(), player_id: player?.id || null })
      .eq('id', id)
      .select('*, players(rating)')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }

  // Email update
  if (email !== undefined) {
    const { data, error } = await supabase
      .from('registrants')
      .update({ email: email.trim() || null })
      .eq('id', id)
      .select('*, players(rating)')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }

  // Status updates
  const updates = {}
  if (approval_status !== undefined) updates.approval_status = approval_status
  if (payment_status !== undefined) updates.payment_status = payment_status

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('registrants')
    .update(updates)
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
