'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

export default function GMDraft() {
  const { id } = useParams()
  const [league, setLeague] = useState(null)
  const [session, setSession] = useState(null)
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [picks, setPicks] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [authorized, setAuthorized] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPosition, setFilterPosition] = useState('all')
  const [timeLeft, setTimeLeft] = useState(null)
  const [myTeam, setMyTeam] = useState(null)
  const [activeSlot, setActiveSlot] = useState(null)
  const [slotSearch, setSlotSearch] = useState('')
  const timerRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    if (authorized && myTeam) {
      fetchAll()
      pollRef.current = setInterval(fetchAll, 2000)
    }
    return () => { clearInterval(pollRef.current); clearInterval(timerRef.current) }
  }, [authorized, myTeam, id])

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

  async function verifyCode() {
    setCodeError(false)
    const res = await fetch('/api/draft/codes?league_id=' + id + '&code=' + codeInput.trim().toUpperCase())
    const data = await res.json()
    if (data.valid) {
      setMyTeam({ id: data.team_id, name: data.team_name, gm_name: data.gm_name })
      setAuthorized(true)
    } else {
      setCodeError(true)
    }
  }

  async function fetchAll() {
    const [leagueRes, sessionRes, teamsRes, playersRes, picksRes, wishlistRes] = await Promise.all([
      fetch('/api/leagues/' + id),
      fetch('/api/draft/session?league_id=' + id),
      fetch('/api/draft/teams?league_id=' + id),
      fetch('/api/registrants?league_id=' + id),
      fetch('/api/draft/pick?league_id=' + id),
      fetch('/api/draft/wishlist?team_id=' + myTeam?.id)
    ])
    setLeague(await leagueRes.json())
    setSession(await sessionRes.json())
    setTeams(await teamsRes.json())
    const p = await playersRes.json()
    setPlayers(Array.isArray(p) ? p.filter(r => r.approval_status === 'approved' && r.payment_status === 'paid') : [])
    const picksData = await picksRes.json()
    setPicks(Array.isArray(picksData) ? picksData : [])
    const wData = await wishlistRes.json()
    setWishlist(Array.isArray(wData) ? wData : [])
  }

  async function assignSlot(slot, registrant_id) {
    await fetch('/api/draft/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: myTeam.id, registrant_id, slot })
    })
    setActiveSlot(null)
    setSlotSearch('')
    fetchAll()
  }

  async function clearSlot(slot) {
    await fetch(`/api/draft/wishlist?team_id=${myTeam.id}&slot=${slot}`, { method: 'DELETE' })
    fetchAll()
  }

  function getCurrentTeam() {
    if (!session || !teams.length) return null
    const sortedTeams = [...teams].sort((a, b) => (a.draft_order || 0) - (b.draft_order || 0))
    const pick = session.current_pick
    const n = sortedTeams.length
    const round = Math.ceil(pick / n)
    const posInRound = (pick - 1) % n
    const idx = round % 2 === 1 ? posInRound : (n - 1 - posInRound)
    return sortedTeams[idx]
  }

  const pickedIds = new Set(picks.map(p => p.registrant_id))
  const currentTeam = getCurrentTeam()
  const sortedTeams = [...teams].sort((a, b) => (a.draft_order || 0) - (b.draft_order || 0))
  const isActive = session?.status === 'active'
  const timerColor = timeLeft !== null ? (timeLeft > 30 ? '#00C896' : timeLeft > 10 ? '#FFB800' : '#FF6B6B') : '#4A9EFF'
  const isMyTurn = isActive && currentTeam?.id === myTeam?.id

  const picksPerTeam = (league?.skaters_per_team || 0) + (league?.goalies_per_team || 0) || Math.ceil(players.length / (teams.length || 1))
  const slots = Array.from({ length: picksPerTeam }, (_, i) => i + 1)

  const availablePlayers = players
    .filter(p => {
      if (pickedIds.has(p.id)) return false
      if (filterPosition !== 'all' && p.position !== filterPosition) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => (b.players?.rating || 0) - (a.players?.rating || 0))

  const slotPlayers = players
    .filter(p => {
      if (pickedIds.has(p.id)) return false
      if (slotSearch && !p.name.toLowerCase().includes(slotSearch.toLowerCase())) return false
      return true
    })
    .sort((a, b) => (b.players?.rating || 0) - (a.players?.rating || 0))
    .slice(0, 8)

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 360, padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏒</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>GM Draft Access</div>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 28 }}>Enter the code provided by your commissioner</div>
          <input
            placeholder="Enter GM code"
            value={codeInput}
            onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(false) }}
            onKeyDown={e => e.key === 'Enter' && verifyCode()}
            style={{
              width: '100%', padding: '14px', borderRadius: 8,
              border: '1px solid ' + (codeError ? '#FF6B6B' : 'rgba(255,255,255,0.1)'),
              background: 'rgba(255,255,255,0.05)', color: '#E2E8F0',
              fontSize: 20, textAlign: 'center', letterSpacing: 4,
              boxSizing: 'border-box', marginBottom: 12, fontFamily: 'monospace'
            }}
          />
          {codeError && <div style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>Invalid code — check with your commissioner</div>}
          <button
            onClick={verifyCode}
            style={{ width: '100%', padding: '13px', borderRadius: 8, border: 'none', background: '#4A9EFF', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            Join Draft
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: '#00C896', textTransform: 'uppercase' }}>GM View</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>{league?.name}</div>
        </div>

        {myTeam && (
          <div style={{ background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.25)', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Your Team</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4A9EFF' }}>{myTeam.name}</div>
            {myTeam.gm_name && <div style={{ fontSize: 10, color: '#6B7280' }}>{myTeam.gm_name}</div>}
          </div>
        )}

        {isMyTurn && (
          <div style={{ background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#00C896' }}>🏒 You're on the clock!</div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>Commissioner will make your pick</div>
          </div>
        )}

        {currentTeam && session?.status !== 'complete' && !isMyTurn && (
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 16px' }}>
            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Pick #{session?.current_pick}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#94A3B8' }}>{currentTeam.name}</div>
          </div>
        )}

        {timeLeft !== null && (
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid ' + timerColor + '40', borderRadius: 8, padding: '8px 16px', minWidth: 70 }}>
            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Clock</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: timerColor, fontFamily: 'monospace' }}>{timeLeft}s</div>
          </div>
        )}

        {session?.status === 'paused' && (
          <div style={{ padding: '8px 14px', borderRadius: 6, background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)', color: '#FFB800', fontSize: 13, fontWeight: 600 }}>⏸ Paused</div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left - Player pool */}
        <div style={{ width: 260, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
              <div key={p.id} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(74,158,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#4A9EFF', flexShrink: 0 }}>
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

        {/* Middle - Draft board */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: 20 }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
            Draft Board — {picks.length} picks made
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + sortedTeams.length + ', minmax(140px, 1fr))', gap: 10, minWidth: sortedTeams.length * 150 + 'px' }}>
            {sortedTeams.map(team => {
              const teamPicks = picks.filter(p => p.team_id === team.id).sort((a, b) => a.pick_number - b.pick_number)
              const isCurrentTeam = currentTeam?.id === team.id && isActive
              const isMyTeamCol = team.id === myTeam?.id

              return (
                <div key={team.id} style={{
                  background: isCurrentTeam ? 'rgba(0,200,150,0.05)' : isMyTeamCol ? 'rgba(74,158,255,0.03)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid ' + (isCurrentTeam ? 'rgba(0,200,150,0.3)' : isMyTeamCol ? 'rgba(74,158,255,0.2)' : 'rgba(255,255,255,0.06)'),
                  borderRadius: 8, overflow: 'hidden'
                }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: isCurrentTeam ? 'rgba(0,200,150,0.1)' : isMyTeamCol ? 'rgba(74,158,255,0.08)' : 'transparent' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isCurrentTeam ? '#00C896' : isMyTeamCol ? '#4A9EFF' : '#E2E8F0' }}>
                      {team.name}{isMyTeamCol ? ' (You)' : ''}
                    </div>
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

        {/* Right - Wishlist */}
        <div style={{ width: 240, borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>My Draft List</div>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>Click a slot to assign a player</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {slots.map(slot => {
              const entry = wishlist.find(w => w.slot === slot)
              const isPicked = entry && pickedIds.has(entry.registrant_id)
              const isOpen = activeSlot === slot

              return (
                <div key={slot} style={{ marginBottom: 6 }}>
                  <div
                    onClick={() => !isPicked && setActiveSlot(isOpen ? null : slot)}
                    style={{
                      padding: '8px 10px', borderRadius: 6,
                      border: '1px solid ' + (isOpen ? 'rgba(74,158,255,0.4)' : isPicked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'),
                      background: isOpen ? 'rgba(74,158,255,0.06)' : isPicked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)',
                      cursor: isPicked ? 'default' : 'pointer',
                      opacity: isPicked ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 10, color: '#6B7280', width: 40, flexShrink: 0 }}>Pick {slot}</div>
                      {entry ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: isPicked ? '#6B7280' : '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isPicked ? '✓ ' : ''}{entry.registrants?.name}
                            </div>
                            {entry.registrants?.players?.rating && (
                              <div style={{ fontSize: 10, color: '#4A9EFF' }}>⭐ {entry.registrants.players.rating}</div>
                            )}
                          </div>
                          {!isPicked && (
                            <button onClick={e => { e.stopPropagation(); clearSlot(slot) }} style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✕</button>
                          )}
                        </div>
                      ) : (
                        <div style={{ flex: 1, fontSize: 11, color: '#4B5563', fontStyle: 'italic' }}>— empty —</div>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ background: '#0F1629', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 6, marginTop: 4, overflow: 'hidden' }}>
                      <input
                        autoFocus
                        placeholder="Search player..."
                        value={slotSearch}
                        onChange={e => setSlotSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '100%', padding: '7px 10px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#E2E8F0', fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
                      />
                      {slotPlayers.map(p => (
                        <div
                          key={p.id}
                          onClick={() => assignSlot(slot, p.id)}
                          style={{ padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,158,255,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontSize: 11, color: '#4A9EFF', width: 20, textAlign: 'center' }}>{p.players?.rating ?? '?'}</div>
                          <div>
                            <div style={{ fontSize: 12, color: '#E2E8F0' }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'capitalize' }}>{p.position}</div>
                          </div>
                        </div>
                      ))}
                      {slotPlayers.length === 0 && (
                        <div style={{ padding: '10px', fontSize: 11, color: '#6B7280', textAlign: 'center' }}>No players found</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
