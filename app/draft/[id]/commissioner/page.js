'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function CommissionerDraft() {
  const { id } = useParams()
  const router = useRouter()
  const [league, setLeague] = useState(null)
  const [session, setSession] = useState(null)
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [picks, setPicks] = useState([])
  const [search, setSearch] = useState('')
  const [filterPosition, setFilterPosition] = useState('all')
  const [timeLeft, setTimeLeft] = useState(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [linksCopied, setLinksCopied] = useState({})
  const timerRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    fetchAll()
    pollRef.current = setInterval(fetchAll, 3000)
    return () => { clearInterval(pollRef.current); clearInterval(timerRef.current) }
  }, [id])

  useEffect(() => {
    if (session?.timer_seconds && session?.timer_started_at && session?.status === 'active') {
      clearInterval(timerRef.current)
      const tick = () => {
        const elapsed = Math.floor((Date.now() - new Date(session.timer_started_at).getTime()) / 1000)
        const left = session.timer_seconds - elapsed
        setTimeLeft(left > 0 ? left : 0)
      }
      tick()
      timerRef.current = setInterval(tick, 1000)
    } else {
      setTimeLeft(null)
    }
    return () => clearInterval(timerRef.current)
  }, [session])

  async function fetchAll() {
    const [leagueRes, sessionRes, teamsRes, playersRes, picksRes] = await Promise.all([
      fetch('/api/leagues/' + id),
      fetch('/api/draft/session?league_id=' + id),
      fetch('/api/draft/teams?league_id=' + id),
      fetch('/api/registrants?league_id=' + id),
      fetch('/api/draft/pick?league_id=' + id)
    ])
    const leagueData = await leagueRes.json()
    setLeague(leagueData)
    setSession(await sessionRes.json())
    setTeams(await teamsRes.json())
    const p = await playersRes.json()
    setPlayers(Array.isArray(p) ? p.filter(r => r.status === 'paid') : [])
    const picksData = await picksRes.json()
    setPicks(Array.isArray(picksData) ? picksData : [])

    // Auto-generate GM code if missing
    if (leagueData && !leagueData.gm_code) {
      const res = await fetch('/api/draft/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ league_id: id, reset: false })
      })
      const data = await res.json()
      if (data.code) setLeague(prev => ({ ...prev, gm_code: data.code }))
    }
  }

  // Fixed snake draft logic
  function getCurrentTeam() {
    if (!session || !teams.length) return null
    const sortedTeams = [...teams].sort((a, b) => (a.draft_order || 0) - (b.draft_order || 0))
    const pick = session.current_pick
    const n = sortedTeams.length
    const round = Math.ceil(pick / n)
    const posInRound = (pick - 1) % n
    // Odd rounds go forward (1,2,3,4), even rounds go backward (4,3,2,1)
    const idx = round % 2 === 1 ? posInRound : (n - 1 - posInRound)
    return sortedTeams[idx]
  }

  async function makePick(registrantId) {
    const currentTeam = getCurrentTeam()
    if (!currentTeam || !session || session?.status !== 'active') return
    await fetch('/api/draft/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        league_id: id, team_id: currentTeam.id, registrant_id: registrantId,
        pick_number: session.current_pick, round: Math.ceil(session.current_pick / teams.length)
      })
    })
    await fetch('/api/draft/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id, current_pick: session.current_pick + 1, timer_started_at: new Date().toISOString() })
    })
    fetchAll()
  }

  async function undoLastPick() {
    if (!picks.length) return
    const lastPick = [...picks].sort((a, b) => b.pick_number - a.pick_number)[0]
    await fetch('/api/draft/pick-edit', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pick_id: lastPick.id })
    })
    await fetch('/api/draft/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id, current_pick: lastPick.pick_number })
    })
    fetchAll()
  }

  async function togglePause() {
    const newStatus = session.status === 'active' ? 'paused' : 'active'
    await fetch('/api/draft/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id, status: newStatus, timer_started_at: new Date().toISOString() })
    })
    fetchAll()
  }

  async function resetGMCode() {
    const res = await fetch('/api/draft/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id, reset: true })
    })
    const data = await res.json()
    if (data.code) setLeague(prev => ({ ...prev, gm_code: data.code }))
  }

  async function copyCode() {
    if (!league?.gm_code) return
    await navigator.clipboard.writeText(league.gm_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  async function copyLink(type, text) {
    await navigator.clipboard.writeText(text)
    setLinksCopied(prev => ({ ...prev, [type]: true }))
    setTimeout(() => setLinksCopied(prev => ({ ...prev, [type]: false })), 2000)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const gmLink = `${baseUrl}/draft/${id}/gm`
  const publicLink = `${baseUrl}/draft/${id}/public`

  const pickedIds = new Set(picks.map(p => p.registrant_id))
  const currentTeam = getCurrentTeam()
  const sortedTeams = [...teams].sort((a, b) => (a.draft_order || 0) - (b.draft_order || 0))
  const timerColor = timeLeft !== null ? (timeLeft > 30 ? '#00C896' : timeLeft > 10 ? '#FFB800' : '#FF6B6B') : '#4A9EFF'

  const availablePlayers = players
    .filter(p => {
      if (pickedIds.has(p.id)) return false
      if (filterPosition !== 'all' && p.position !== filterPosition) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => (b.players?.rating || 0) - (a.players?.rating || 0))

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: '#4A9EFF', textTransform: 'uppercase' }}>Commissioner</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>{league?.name}</div>
        </div>

        {/* GM Code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,200,150,0.05)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 8, padding: '8px 14px' }}>
          <div>
            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>GM Code</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#00C896', letterSpacing: 4, fontFamily: 'monospace' }}>
              {league?.gm_code || '—'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={copyCode} style={{ background: 'transparent', border: '1px solid rgba(0,200,150,0.3)', color: codeCopied ? '#00C896' : '#6B7280', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              {codeCopied ? '✓ Copied' : 'Copy'}
            </button>
            <button onClick={resetGMCode} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#6B7280', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Reset</button>
          </div>
        </div>

        {/* Draft links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'GM View', link: gmLink, type: 'gm', color: '#00C896' },
            { label: 'Public', link: publicLink, type: 'public', color: '#4A9EFF' },
          ].map(({ label, link, type, color }) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#6B7280', width: 44 }}>{label}</span>
              <button
                onClick={() => window.open(link, '_blank')}
                style={{ fontSize: 11, color, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Open ↗
              </button>
              <button
                onClick={() => copyLink(type, link)}
                style={{ fontSize: 10, color: linksCopied[type] ? '#00C896' : '#6B7280', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, cursor: 'pointer', padding: '2px 6px' }}
              >
                {linksCopied[type] ? '✓' : 'Copy'}
              </button>
            </div>
          ))}
        </div>

        {/* Current pick */}
        {currentTeam && session?.status !== 'complete' && (
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 16px' }}>
            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Pick #{session?.current_pick}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#00C896' }}>{currentTeam.name}</div>
            {currentTeam.gm_name && <div style={{ fontSize: 10, color: '#6B7280' }}>{currentTeam.gm_name}</div>}
          </div>
        )}

        {/* Timer */}
        {timeLeft !== null && (
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid ' + timerColor + '40', borderRadius: 8, padding: '8px 16px', minWidth: 70 }}>
            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Clock</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: timerColor, fontFamily: 'monospace' }}>{timeLeft}s</div>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={undoLastPick} disabled={!picks.length} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid rgba(255,100,100,0.3)', background: 'rgba(255,100,100,0.08)', color: picks.length ? '#FF6B6B' : '#6B7280', cursor: picks.length ? 'pointer' : 'default', fontSize: 12, fontWeight: 600 }}>
            ↩ Undo Last
          </button>
          <button onClick={togglePause} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: session?.status === 'paused' ? 'rgba(0,200,150,0.1)' : 'rgba(255,184,0,0.1)', color: session?.status === 'paused' ? '#00C896' : '#FFB800', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {session?.status === 'paused' ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={() => window.open(`/draft/${id}/setup`, '_blank')} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: 12 }}>⚙️ Setup</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Player pool */}
        <div style={{ width: 280, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Available ({availablePlayers.length})
            </div>
            <input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'player', 'goalie'].map(pos => (
                <button key={pos} onClick={() => setFilterPosition(pos)} style={{
                  padding: '4px 10px', borderRadius: 4, border: '1px solid',
                  borderColor: filterPosition === pos ? '#4A9EFF' : 'rgba(255,255,255,0.1)',
                  background: filterPosition === pos ? 'rgba(74,158,255,0.1)' : 'transparent',
                  color: filterPosition === pos ? '#4A9EFF' : '#6B7280',
                  cursor: 'pointer', fontSize: 11, textTransform: 'capitalize'
                }}>{pos}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {availablePlayers.map(p => (
              <div
                key={p.id}
                onClick={() => session?.status === 'active' && makePick(p.id)}
                style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: session?.status === 'active' ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 10 }}
                onMouseEnter={e => { if (session?.status === 'active') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(74,158,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#4A9EFF', flexShrink: 0 }}>
                  {p.players?.rating ?? '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#E2E8F0' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>{p.position || 'unknown'}</div>
                </div>
                {session?.status === 'active' && <div style={{ fontSize: 11, color: '#00C896', opacity: 0.5 }}>Pick</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Draft board */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: 20 }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
            Draft Board — {picks.length} picks made
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + sortedTeams.length + ', minmax(140px, 1fr))', gap: 10, minWidth: sortedTeams.length * 150 + 'px' }}>
            {sortedTeams.map(team => {
              const teamPicks = picks.filter(p => p.team_id === team.id).sort((a, b) => a.pick_number - b.pick_number)
              const isCurrentTeam = currentTeam?.id === team.id && session?.status === 'active'

              return (
                <div key={team.id} style={{
                  background: isCurrentTeam ? 'rgba(0,200,150,0.05)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid ' + (isCurrentTeam ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.06)'),
                  borderRadius: 8, overflow: 'hidden'
                }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: isCurrentTeam ? 'rgba(0,200,150,0.1)' : 'transparent' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isCurrentTeam ? '#00C896' : '#E2E8F0' }}>{team.name}</div>
                    {team.gm_name && <div style={{ fontSize: 10, color: '#6B7280' }}>{team.gm_name}</div>}
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{teamPicks.length} picks</div>
                  </div>
                  <div style={{ padding: 6 }}>
                    {teamPicks.map(pick => {
                      const player = players.find(p => p.id === pick.registrant_id)
                      return (
                        <div key={pick.id} style={{ padding: '5px 7px', borderRadius: 4, marginBottom: 3, background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: 11, color: '#E2E8F0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player?.name || '—'}</div>
                          <div style={{ fontSize: 10, color: '#4A9EFF' }}>R{pick.round} #{pick.pick_number}{player?.players?.rating ? ' · ⭐' + player.players.rating : ''}</div>
                        </div>
                      )
                    })}
                    {isCurrentTeam && (
                      <div style={{ padding: '5px 7px', borderRadius: 4, border: '1px dashed rgba(0,200,150,0.3)', textAlign: 'center', fontSize: 10, color: '#00C896' }}>
                        On the clock...
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
