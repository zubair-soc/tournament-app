'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

export default function GMDraft() {
  const { id, code } = useParams()
  const [league, setLeague] = useState(null)
  const [session, setSession] = useState(null)
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [picks, setPicks] = useState([])
  const [authorized, setAuthorized] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterPosition, setFilterPosition] = useState('all')
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    // Auto-check code from URL
    if (code) verifyCode(code)
  }, [code])

  useEffect(() => {
    if (authorized) {
      fetchAll()
      pollRef.current = setInterval(fetchAll, 2000)
    }
    return () => { clearInterval(pollRef.current); clearInterval(timerRef.current) }
  }, [authorized])

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

  async function verifyCode(inputCode) {
    const res = await fetch(`/api/draft/codes?league_id=${id}&code=${inputCode}`)
    const data = await res.json()
    if (data.valid) setAuthorized(true)
  }

  async function fetchAll() {
    const [leagueRes, sessionRes, teamsRes, playersRes, picksRes] = await Promise.all([
      fetch(`/api/leagues/${id}`),
      fetch(`/api/draft/session?league_id=${id}`),
      fetch(`/api/draft/teams?league_id=${id}`),
      fetch(`/api/registrants?league_id=${id}`),
      fetch(`/api/draft/pick?league_id=${id}`)
    ])
    setLeague(await leagueRes.json())
    setSession(await sessionRes.json())
    setTeams(await teamsRes.json())
    const p = await playersRes.json()
    setPlayers(Array.isArray(p) ? p.filter(r => r.status === 'paid') : [])
    setPicks(await picksRes.json())
  }

  function getCurrentTeam() {
    if (!session || !teams.length) return null
    const sortedTeams = [...teams].sort((a, b) => (a.draft_order || 0) - (b.draft_order || 0))
    const pick = session.current_pick
    const n = sortedTeams.length
    const round = Math.ceil(pick / n)
    const posInRound = ((pick - 1) % n)
    const idx = round % 2 === 0 ? (n - 1 - posInRound) : posInRound
    return sortedTeams[idx]
  }

  async function makePick(registrantId) {
    const currentTeam = getCurrentTeam()
    if (!currentTeam || session?.status !== 'active') return
    await fetch('/api/draft/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        league_id: id,
        team_id: currentTeam.id,
        registrant_id: registrantId,
        pick_number: session.current_pick,
        round: Math.ceil(session.current_pick / teams.length)
      })
    })
    await fetch('/api/draft/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id, current_pick: session.current_pick + 1, timer_started_at: new Date().toISOString() })
    })
    fetchAll()
  }

  const pickedIds = new Set(picks.map(p => p.registrant_id))
  const currentTeam = getCurrentTeam()
  const sortedTeams = [...teams].sort((a, b) => (a.draft_order || 0) - (b.draft_order || 0))
  const isMyTurn = session?.status === 'active'
  const timerColor = timeLeft !== null ? (timeLeft > 30 ? '#00C896' : timeLeft > 10 ? '#FFB800' : '#FF6B6B') : '#4A9EFF'

  const availablePlayers = players.filter(p => {
    if (pickedIds.has(p.id)) return false
    if (filterPosition !== 'all' && p.position !== filterPosition) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🏒</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>GM Draft Access</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Enter the draft code provided by your commissioner</div>
          <input
            placeholder="Enter GM code"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && verifyCode(codeInput)}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 16, textAlign: 'center', letterSpacing: 3, boxSizing: 'border-box', marginBottom: 12 }} />
          <button onClick={() => verifyCode(codeInput)} style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#4A9EFF', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Join Draft
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#00C896', textTransform: 'uppercase' }}>GM View</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>{league?.name}</div>
        </div>

        {currentTeam && session?.status !== 'complete' && (
          <div style={{ textAlign: 'center', background: isMyTurn ? 'rgba(0,200,150,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isMyTurn ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '10px 20px' }}>
            <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Pick #{session?.current_pick}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: isMyTurn ? '#00C896' : '#94A3B8' }}>{currentTeam.name}</div>
          </div>
        )}

        {timeLeft !== null && (
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: `1px solid ${timerColor}40`, borderRadius: 8, padding: '10px 20px', minWidth: 80 }}>
            <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Time</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: timerColor, fontFamily: 'monospace' }}>{timeLeft}s</div>
          </div>
        )}

        {session?.status === 'paused' && (
          <div style={{ padding: '8px 16px', borderRadius: 6, background: 'rgba(255,184,0,0.1)', color: '#FFB800', fontSize: 13, fontWeight: 600 }}>⏸ Draft Paused</div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Player pool */}
        <div style={{ width: 320, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Available ({availablePlayers.length})
            </div>
            <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }} />
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
            {availablePlayers.sort((a, b) => (b.players?.rating || 0) - (a.players?.rating || 0)).map(p => (
              <div key={p.id}
                onClick={() => isMyTurn && makePick(p.id)}
                style={{
                  padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: isMyTurn ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 10,
                  opacity: isMyTurn ? 1 : 0.6
                }}
                onMouseEnter={e => { if (isMyTurn) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(74,158,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#4A9EFF', flexShrink: 0 }}>
                  {p.players?.rating ?? '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#E2E8F0' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>{p.position || 'unknown'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Draft board */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Draft Board</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sortedTeams.length, 8)}, 1fr)`, gap: 10 }}>
            {sortedTeams.map(team => {
              const teamPicks = picks.filter(p => p.team_id === team.id).sort((a, b) => a.pick_number - b.pick_number)
              const isCurrentTeam = currentTeam?.id === team.id && session?.status === 'active'
              return (
                <div key={team.id} style={{
                  background: isCurrentTeam ? 'rgba(0,200,150,0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isCurrentTeam ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8, overflow: 'hidden'
                }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: isCurrentTeam ? 'rgba(0,200,150,0.1)' : 'transparent' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isCurrentTeam ? '#00C896' : '#E2E8F0' }}>{team.name}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>{teamPicks.length} picks</div>
                  </div>
                  <div style={{ padding: 6 }}>
                    {teamPicks.map(pick => {
                      const player = players.find(p => p.id === pick.registrant_id)
                      return (
                        <div key={pick.id} style={{ padding: '5px 6px', borderRadius: 4, marginBottom: 3, background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: 11, color: '#E2E8F0' }}>{player?.name || '—'}</div>
                          <div style={{ fontSize: 10, color: '#4A9EFF' }}>{player?.players?.rating ? `⭐ ${player.players.rating}` : ''}</div>
                        </div>
                      )
                    })}
                    {isCurrentTeam && (
                      <div style={{ padding: '5px 6px', borderRadius: 4, border: '1px dashed rgba(0,200,150,0.3)', textAlign: 'center', fontSize: 10, color: '#00C896' }}>
                        Picking...
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
