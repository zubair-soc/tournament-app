import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Verify a GM code
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const league_id = searchParams.get('league_id')
  const code = searchParams.get('code')

  const { data } = await supabase
    .from('leagues')
    .select('gm_code')
    .eq('id', league_id)
    .single()

  if (!data) return Response.json({ valid: false })

  const valid = data.gm_code && data.gm_code.toUpperCase() === code.toUpperCase()
  return Response.json({ valid })
}

// Generate a new GM code (or return existing if not resetting)
export async function POST(request) {
  const { league_id, reset } = await request.json()

  // If not resetting, check if code already exists
  if (!reset) {
    const { data: existing } = await supabase
      .from('leagues')
      .select('gm_code')
      .eq('id', league_id)
      .single()

    if (existing?.gm_code) {
      return Response.json({ code: existing.gm_code })
    }
  }

  // Generate new code
  const code = generateCode()

  const { error } = await supabase
    .from('leagues')
    .update({ gm_code: code, updated_at: new Date().toISOString() })
    .eq('id', league_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ code })
}
