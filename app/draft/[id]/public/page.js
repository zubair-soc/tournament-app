'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

export default function PublicDraft() {
  const { id } = useParams()
  const [league, setLeague] = useState(null)
  const [session, setSession] = useState(null)
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [picks, setPicks] = useState([])
  const [lastPick, setLastPick] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)
  const prevPickCount = useRef(0)

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 2000)
    return () => { clearInterval(interval); clearInterval(timerRef.current) }
  }, [id])

  useEffect(() => {
    if (picks.length > prevPickCount.current) {
      const newest = [...picks].sort((a, b) => b.pick_number - a.pick_number)[0]
      setLastPick(newest)
      prevPickCount.current = picks.length
    }
  }, [picks])

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

  const currentTeam = getCurrentTeam()
  const sortedTeams = [...teams].sort((a, b) => (a.draft_order || 0) - (b.draft_order || 0))
  const timerColor = timeLeft !== null ? (timeLeft > 30 ? '#00C896' : timeLeft > 10 ? '#FFB800' : '#FF6B6B') : '#4A9EFF'

  const lastPickPlayer = lastPick ? players.find(p => p.id === lastPick.registrant_id) : null
  const lastPickTeam = lastPick ? teams.find(t => t.id === lastPick.team_id) : null

  return (
    <div style={{ minHeight: '100vh', background: '#060A14', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Big header for streaming */}
      <div style={{ background: 'linear-gradient(180deg, #0D1525 0%, #060A14 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '24px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: '#4A9EFF', textTransform: 'uppercase', marginBottom: 8 }}>
          {league?.name} {league?.season ? `— ${league.season}` : ''}
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#F8FAFC', letterSpacing: -1 }}>DRAFT</div>

        {session?.status === 'active' && currentTeam && (
          <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 20, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 12, padding: '12px 32px' }}>
            <div>
              <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 2 }}>Now on the clock</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#00C896' }}>{currentTeam.name}</div>
              {currentTeam.gm_name && <div style={{ fontSize: 13, color: '#6B7280' }}>GM: {currentTeam.gm_name}</div>}
            </div>
            {timeLeft !== null && (
              <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 20 }}>
                <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Clock</div>
                <div style={{ fontSize: 48, fontWeight: 800, color: timerColor, fontFamily: 'monospace', lineHeight: 1 }}>{timeLeft}</div>
              </div>
            )}
          </div>
        )}

        {session?.status === 'paused' && (
          <div style={{ marginTop: 16, display: 'inline-block', background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: 8, padding: '10px 24px', color: '#FFB800', fontSize: 16, fontWeight: 700 }}>
            ⏸ Draft Paused
          </div>
        )}
      </div>

      {/* Last pick banner */}
      {lastPickPlayer && lastPickTeam && (
        <div style={{ background: 'rgba(74,158,255,0.08)', borderBottom: '1px solid rgba(74,158,255,0.15)', padding: '12px 40px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 2 }}>Last Pick</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>{lastPickPlayer.name}</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>→</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#4A9EFF' }}>{lastPickTeam.name}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Pick #{lastPick.pick_number} • Round {lastPick.round}</div>
        </div>
      )}

      {/* Draft board - NO ratings shown */}
      <div style={{ padding: '32px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sortedTeams.length, 6)}, 1fr)`, gap: 16 }}>
          {sortedTeams.map(team => {
            const teamPicks = picks.filter(p => p.team_id === team.id).sort((a, b) => a.pick_number - b.pick_number)
            const isCurrentTeam = currentTeam?.id === team.id && session?.status === 'active'
            return (
              <div key={team.id} style={{
                background: isCurrentTeam ? 'rgba(0,200,150,0.05)' : 'rgba(255,255,255,0.02)',
                border: `2px solid ${isCurrentTeam ? 'rgba(0,200,150,0.4)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 10, overflow: 'hidden',
                boxShadow: isCurrentTeam ? '0 0 30px rgba(0,200,150,0.1)' : 'none',
                transition: 'all 0.3s'
              }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: isCurrentTeam ? 'rgba(0,200,150,0.12)' : 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: isCurrentTeam ? '#00C896' : '#F8FAFC', textTransform: 'uppercase', letterSpacing: 0.5 }}>{team.name}</div>
                  {team.gm_name && <div style={{ fontSize: 11, color: '#6B7280' }}>GM: {team.gm_name}</div>}
                  <div style={{ fontSize: 11, color: isCurrentTeam ? '#00C896' : '#6B7280', marginTop: 2 }}>{teamPicks.length} players</div>
                </div>
                <div style={{ padding: 10 }}>
                  {teamPicks.map((pick, i) => {
                    const player = players.find(p => p.id === pick.registrant_id)
                    const isNewest = pick.id === lastPick?.id
                    return (
                      <div key={pick.id} style={{
                        padding: '7px 10px', borderRadius: 6, marginBottom: 4,
                        background: isNewest ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.03)',
                        border: isNewest ? '1px solid rgba(74,158,255,0.2)' : '1px solid transparent',
                        transition: 'all 0.3s'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 10, color: '#6B7280', minWidth: 20 }}>R{pick.round}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 600 }}>{player?.name || '—'}</div>
                            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'capitalize' }}>{player?.position || ''}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {isCurrentTeam && (
                    <div style={{ padding: '8px 10px', borderRadius: 6, border: '1px dashed rgba(0,200,150,0.4)', textAlign: 'center', fontSize: 12, color: '#00C896', fontWeight: 600 }}>
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
  )
}
