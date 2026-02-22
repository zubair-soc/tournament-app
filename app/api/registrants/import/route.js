import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  const { league_id, rows } = await request.json()

  const { data: existing } = await supabase
    .from('registrants')
    .select('name, email')
    .eq('league_id', league_id)

  const existingEmails = new Set(existing.filter(r => r.email).map(r => r.email.toLowerCase()))
  const existingNames = new Set(existing.map(r => r.name.toLowerCase()))

  const { data: players } = await supabase
    .from('players')
    .select('id, name, email')

  let added = 0
  let skipped = 0

  for (const row of rows) {
    const emailMatch = row.email && existingEmails.has(row.email.toLowerCase())
    const nameMatch = existingNames.has(row.name.toLowerCase())
    if (emailMatch || nameMatch) { skipped++; continue }

    let player_id = null

    if (row.email) {
      const playerByEmail = players.find(p => p.email && p.email.toLowerCase() === row.email.toLowerCase())
      if (playerByEmail) player_id = playerByEmail.id
    }

    if (!player_id) {
      const playerByName = players.find(p => p.name.toLowerCase() === row.name.toLowerCase())
      if (playerByName) player_id = playerByName.id
    }

    const { error } = await supabase.from('registrants').insert({
      league_id,
      player_id,
      name: row.name,
      email: row.email || null,
      position: row.position || null,
      status: 'unpaid',
      registered_at: new Date().toISOString()
    })

    if (!error) {
      added++
      existingNames.add(row.name.toLowerCase())
      if (row.email) existingEmails.add(row.email.toLowerCase())
    }
  }

  return Response.json({ added, skipped })
}
