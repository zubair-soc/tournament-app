'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function DraftSetup() {
  const { id } = useParams()
  const router = useRouter()
  const [league, setLeague] = useState(null)
  const [teams, setTeams] = useState([])
  const [session, setSession] = useState(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newGMName, setNewGMName] = useState('')
  const [timerSeconds, setTimerSeconds] = useState('')
  const [lotteryRunning, setLotteryRunning] = useState(false)
  const [lotteryResult, setLotteryResult] = useState([])
  const [codeCopied, setCodeCopied] = useState(false)
  const [linksCopied, setLinksCopied] = useState({})

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [leagueRes, teamsRes, sessionRes] = await Promise.all([
      fetch(`/api/leagues/${id}`),
      fetch(`/api/draft/teams?league_id=${id}`),
      fetch(`/api/draft/session?league_id=${id}`)
    ])
    const leagueData = await leagueRes.json()
    setLeague(leagueData)
    setTeams(await teamsRes.json())
    const s = await sessionRes.json()
    setSession(s)
    if (s?.timer_seconds) setTimerSeconds(s.timer_seconds)

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

  async function addTeam() {
    if (!newTeamName) return
    const res = await fetch('/api/draft/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id, name: newTeamName, gm_name: newGMName })
    })
    const data = await res.json()
    setTeams([...teams, data])
    setNewTeamName('')
    setNewGMName('')
  }

  async function deleteTeam(teamId) {
    await fetch(`/api/draft/teams?id=${teamId}`, { method: 'DELETE' })
    setTeams(teams.filter(t => t.id !== teamId))
  }

  async function runLottery() {
    setLotteryRunning(true)
    setLotteryResult([])
    const shuffled = [...teams]
    let iterations = 0
    const maxIterations = 20

    const interval = setInterval(() => {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      setLotteryResult([...shuffled])
      iterations++
      if (iterations >= maxIterations) {
        clearInterval(interval)
        setLotteryRunning(false)
        saveDraftOrder([...shuffled])
      }
    }, 100)
  }

  async function saveDraftOrder(orderedTeams) {
    const updates = orderedTeams.map((t, i) => ({ id: t.id, draft_order: i + 1 }))
    await fetch('/api/draft/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    })
    fetchAll()
  }

  async function moveTeam(index, direction) {
    const newTeams = [...teams]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newTeams.length) return;
    [newTeams[index], newTeams[swapIndex]] = [newTeams[swapIndex], newTeams[index]]
    await saveDraftOrder(newTeams)
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

  async function startDraft() {
    await fetch('/api/draft/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id, timer_seconds: timerSeconds ? parseInt(timerSeconds) : null })
    })
    window.open(`/draft/${id}/commissioner`, '_blank')
  }

  async function continueDraft() {
    window.open(`/draft/${id}/commissioner`, '_blank')
  }

  async function restartDraft() {
    const first = window.confirm('Are you sure you want to restart the draft? All picks will be deleted.')
    if (!first) return
    const second = window.confirm('This cannot be undone. Are you absolutely sure you want to restart?')
    if (!second) return
    await fetch('/api/draft/pick?league_id=' + id, { method: 'DELETE' })
    await fetch('/api/draft/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id, timer_seconds: timerSeconds ? parseInt(timerSeconds) : null })
    })
    setSession(null)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const sortedTeams = [...teams].sort((a, b) => (a.draft_order || 999) - (b.draft_order || 999))
  const displayTeams = lotteryResult.length > 0 ? lotteryResult : sortedTeams

  const draftLinks = [
    { label: 'Commissioner', path: 'commissioner', color: '#4A9EFF' },
    { label: 'GM View', path: 'gm', color: '#00C896' },
    { label: 'Public Stream', path: 'public', color: '#FFB800' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#4A9EFF', textTransform: 'uppercase', marginBottom: 4 }}>Draft Setup</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC' }}>{league?.name} {league?.season ? `— ${league.season}` : ''}</div>
        </div>
        <button onClick={() => router.push('/')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          ← Back
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

        {/* Left column - Teams */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', marginBottom: 16 }}>Teams</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input placeholder="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTeam()}
              style={{ flex: 1, minWidth: 120, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13 }} />
            <input placeholder="GM name" value={newGMName} onChange={e => setNewGMName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTeam()}
              style={{ flex: 1, minWidth: 120, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13 }} />
            <button onClick={addTeam} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#4A9EFF', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayTeams.map((team, i) => (
              <div key={team.id} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#4A9EFF', width: 28, textAlign: 'center' }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{team.name}</div>
                  {team.gm_name && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>GM: {team.gm_name}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => moveTeam(i, 'up')} disabled={i === 0} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                  <button onClick={() => moveTeam(i, 'down')} disabled={i === displayTeams.length - 1} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, opacity: i === displayTeams.length - 1 ? 0.3 : 1 }}>↓</button>
                  <button onClick={() => deleteTeam(team.id)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#FF6B6B', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          {teams.length > 1 && (
            <button onClick={runLottery} disabled={lotteryRunning} style={{
              marginTop: 16, width: '100%', padding: '10px', borderRadius: 6,
              border: '1px solid rgba(255,184,0,0.3)', background: lotteryRunning ? 'rgba(255,184,0,0.05)' : 'rgba(255,184,0,0.1)',
              color: '#FFB800', cursor: lotteryRunning ? 'default' : 'pointer', fontSize: 13, fontWeight: 600
            }}>
              {lotteryRunning ? '🎲 Drawing...' : '🎲 Run Draft Lottery'}
            </button>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Timer */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', marginBottom: 12 }}>Draft Clock</div>
            <input
              type="number" placeholder="Seconds per pick (leave blank for no timer)"
              value={timerSeconds} onChange={e => setTimerSeconds(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13, boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>e.g. 60 = 1 minute per pick. Leave blank for no timer.</div>
          </div>

          {/* GM Code */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', marginBottom: 12 }}>GM Code</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid rgba(0,200,150,0.2)', background: 'rgba(0,200,150,0.05)', color: '#00C896', fontSize: 20, fontWeight: 800, letterSpacing: 4, fontFamily: 'monospace' }}>
                {league?.gm_code || '—'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={copyCode} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid rgba(0,200,150,0.3)', background: 'transparent', color: codeCopied ? '#00C896' : '#6B7280', cursor: 'pointer', fontSize: 11 }}>
                  {codeCopied ? '✓ Copied' : 'Copy'}
                </button>
                <button onClick={resetGMCode} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6B7280', cursor: 'pointer', fontSize: 11 }}>Reset</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Share this with GMs on draft day</div>
          </div>

          {/* Draft Links */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', marginBottom: 12 }}>Draft Links</div>
            {draftLinks.map(link => {
              const fullUrl = `${baseUrl}/draft/${id}/${link.path}`
              return (
                <div key={link.path} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>{link.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      onClick={() => window.open(fullUrl, '_blank')}
                      style={{ flex: 1, fontSize: 12, color: link.color, background: 'rgba(255,255,255,0.03)', padding: '7px 10px', borderRadius: 4, fontFamily: 'monospace', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)' }}
                      title="Click to open"
                    >
                      /draft/{id}/{link.path} ↗
                    </div>
                    <button
                      onClick={() => copyLink(link.path, fullUrl)}
                      style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: linksCopied[link.path] ? '#00C896' : '#6B7280', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}
                    >
                      {linksCopied[link.path] ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Start draft */}
          {teams.length < 2 ? (
            <button disabled style={{ padding: '14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.05)', color: '#6B7280', cursor: 'default', fontSize: 15, fontWeight: 700, width: '100%' }}>
              Add at least 2 teams to start
            </button>
          ) : session ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={continueDraft} style={{ padding: '14px', borderRadius: 8, border: 'none', background: '#00C896', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
                ▶ Continue Draft
              </button>
              <button onClick={restartDraft} style={{ padding: '12px', borderRadius: 8, border: '1px solid rgba(255,107,107,0.3)', background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                🔄 Restart Draft
              </button>
            </div>
          ) : (
            <button onClick={startDraft} style={{ padding: '14px', borderRadius: 8, border: 'none', background: '#00C896', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
              🏒 Start Draft
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
