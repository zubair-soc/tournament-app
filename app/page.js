'use client'
import { useState, useEffect } from 'react'

export default function Home() {
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [registrants, setRegistrants] = useState([])
  const [showNewLeague, setShowNewLeague] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [newLeagueSeason, setNewLeagueSeason] = useState('')
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { fetchLeagues() }, [])
  useEffect(() => { if (selectedLeague) fetchRegistrants(selectedLeague.id) }, [selectedLeague])

  async function fetchLeagues() {
    try {
      const res = await fetch('/api/leagues')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLeagues(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch tournaments:', err)
      setLeagues([])
    }
  }

  async function fetchRegistrants(leagueId) {
    setLoading(true)
    try {
      const res = await fetch(`/api/registrants?league_id=${leagueId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRegistrants(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch registrants:', err)
      setRegistrants([])
    }
    setLoading(false)
  }

  async function createLeague() {
    if (!newLeagueName.trim()) return
    setCreating(true)
    setMessage('')
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLeagueName.trim(), season: newLeagueSeason.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(`❌ Failed to create tournament: ${data.error || res.status}`)
        return
      }
      setLeagues(prev => [...prev, data])
      setSelectedLeague(data)
      setShowNewLeague(false)
      setNewLeagueName('')
      setNewLeagueSeason('')
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(registrantId, field, value) {
    try {
      const res = await fetch('/api/registrants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: registrantId, [field]: value })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRegistrants(registrants.map(r => r.id === registrantId ? { ...r, [field]: value } : r))
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  async function saveEdit(registrantId) {
    if (!editingValue.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch('/api/registrants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: registrantId, [editingField]: editingValue.trim() })
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(updated.error || res.status)
      // For name/email edits that return full object, replace row
      if (updated.id) {
        setRegistrants(registrants.map(r => r.id === registrantId ? updated : r))
      }
      setEditingId(null)
      setEditingField(null)
      setEditingValue('')
    } catch (err) {
      console.error('Failed to save:', err)
    }
    setSavingEdit(false)
  }

  function startEdit(r, field) {
    setEditingId(r.id)
    setEditingField(field)
    setEditingValue(field === 'name' ? r.name : r.email || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingField(null)
    setEditingValue('')
  }

  async function handleCSV(e) {
    const file = e.target.files[0]
    if (!file || !selectedLeague) return
    setImporting(true)
    setMessage('')

    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

    const nameIdx = headers.findIndex(h => h.includes('name'))
    const emailIdx = headers.findIndex(h => h.includes('email'))
    const positionIdx = headers.findIndex(h => h.includes('position'))

    if (nameIdx === -1) {
      setMessage('❌ Could not find a "name" column in your CSV')
      setImporting(false)
      return
    }

    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
      return {
        name: cols[nameIdx] || '',
        email: emailIdx !== -1 ? cols[emailIdx] || '' : '',
        position: positionIdx !== -1 ? cols[positionIdx] || '' : '',
      }
    }).filter(r => r.name)

    try {
      const res = await fetch('/api/registrants/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ league_id: selectedLeague.id, rows })
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage(`❌ Import failed: ${result.error || res.status}`)
      } else {
        setMessage(`✅ Imported ${result.added} new registrants. Skipped ${result.skipped} duplicates.`)
        fetchRegistrants(selectedLeague.id)
      }
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}`)
    }

    setImporting(false)
    e.target.value = ''
  }

  const approvalColors = {
    approved: '#00C896',
    pending: '#FFB800',
    waitlist: '#4A9EFF',
    declined: '#FF6B6B',
  }

  const paymentColors = {
    paid: '#00C896',
    unpaid: '#FFB800',
    refunded: '#94A3B8',
  }

  const counts = {
    approved: registrants.filter(r => r.approval_status === 'approved').length,
    pending: registrants.filter(r => r.approval_status === 'pending').length,
    waitlist: registrants.filter(r => r.approval_status === 'waitlist').length,
    paid: registrants.filter(r => r.payment_status === 'paid').length,
    unpaid: registrants.filter(r => r.payment_status === 'unpaid').length,
  }

  const EditableCell = ({ r, field }) => {
    const isEditing = editingId === r.id && editingField === field
    const value = field === 'name' ? r.name : r.email
    return isEditing ? (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={editingValue}
          onChange={e => setEditingValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(r.id); if (e.key === 'Escape') cancelEdit() }}
          autoFocus
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(74,158,255,0.4)', background: 'rgba(74,158,255,0.05)', color: '#E2E8F0', fontSize: 13, width: field === 'name' ? 150 : 180 }}
        />
        <button onClick={() => saveEdit(r.id)} disabled={savingEdit} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#4A9EFF', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          {savingEdit ? '...' : '✓'}
        </button>
        <button onClick={cancelEdit} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#94A3B8', cursor: 'pointer', fontSize: 11 }}>✕</button>
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: field === 'name' ? '#E2E8F0' : '#6B7280', fontWeight: field === 'name' ? 500 : 400 }}>
          {value || '—'}
        </span>
        <button
          onClick={() => startEdit(r, field)}
          style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 11, padding: '2px 4px', opacity: 0.5 }}
        >✏️</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 32px' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: '#4A9EFF', textTransform: 'uppercase', marginBottom: 4 }}>Tournament Manager</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC' }}>Registration</div>
      </div>

      <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Tournament selector */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Select Tournament</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {leagues.map(l => (
              <button key={l.id} onClick={() => setSelectedLeague(l)} style={{
                padding: '8px 16px', borderRadius: 6, border: '1px solid',
                borderColor: selectedLeague?.id === l.id ? '#4A9EFF' : 'rgba(255,255,255,0.1)',
                background: selectedLeague?.id === l.id ? 'rgba(74,158,255,0.1)' : 'transparent',
                color: selectedLeague?.id === l.id ? '#4A9EFF' : '#94A3B8',
                cursor: 'pointer', fontSize: 13, fontWeight: 500
              }}>
                {l.name} {l.season ? `(${l.season})` : ''}
              </button>
            ))}
            <button onClick={() => setShowNewLeague(!showNewLeague)} style={{
              padding: '8px 16px', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.2)',
              background: 'transparent', color: '#6B7280', cursor: 'pointer', fontSize: 13
            }}>+ New Tournament</button>
          </div>

          {showNewLeague && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                placeholder="Tournament name"
                value={newLeagueName}
                onChange={e => setNewLeagueName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createLeague()}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13 }}
              />
              <input
                placeholder="Season (e.g. Winter 2026)"
                value={newLeagueSeason}
                onChange={e => setNewLeagueSeason(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createLeague()}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13 }}
              />
              <button onClick={createLeague} disabled={creating || !newLeagueName.trim()} style={{
                padding: '8px 16px', borderRadius: 6, border: 'none',
                background: creating || !newLeagueName.trim() ? '#2A3A5A' : '#4A9EFF',
                color: creating || !newLeagueName.trim() ? '#6B7280' : '#fff',
                cursor: creating || !newLeagueName.trim() ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600
              }}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              {message && message.startsWith('❌') && (
                <span style={{ fontSize: 13, color: '#FF6B6B' }}>{message}</span>
              )}
            </div>
          )}
        </div>

        {selectedLeague && (
          <>
            {/* Setup button */}
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.location.href = `/draft/${selectedLeague.id}/setup`}
                style={{
                  padding: '8px 18px', borderRadius: 6, border: '1px solid rgba(74,158,255,0.3)',
                  background: 'rgba(74,158,255,0.1)', color: '#4A9EFF',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600
                }}
              >
                ⚙️ Setup / Draft →
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Approved', count: counts.approved, color: approvalColors.approved },
                { label: 'Pending', count: counts.pending, color: approvalColors.pending },
                { label: 'Waitlist', count: counts.waitlist, color: approvalColors.waitlist },
                { label: 'Paid', count: counts.paid, color: paymentColors.paid },
                { label: 'Unpaid', count: counts.unpaid, color: paymentColors.unpaid },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 18px' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color }}>{count}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* CSV Import */}
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{
                padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#94A3B8', cursor: 'pointer', fontSize: 13
              }}>
                {importing ? 'Importing...' : '📥 Import CSV'}
                <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
              </label>
              {message && !message.startsWith('❌') && (
                <span style={{ fontSize: 13, color: '#00C896' }}>{message}</span>
              )}
            </div>

            {/* Registrants table */}
            {loading ? (
              <div style={{ color: '#6B7280', fontSize: 14 }}>Loading...</div>
            ) : registrants.length === 0 ? (
              <div style={{ color: '#6B7280', fontSize: 14 }}>No registrants yet. Import a CSV to get started.</div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Name', 'Email', 'Position', 'Rating', 'Approval', 'Payment'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registrants.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: i < registrants.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td style={{ padding: '10px 16px' }}>
                          <EditableCell r={r} field="name" />
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <EditableCell r={r} field="email" />
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: '#94A3B8', textTransform: 'capitalize' }}>{r.position || '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: r.players?.rating ? '#4A9EFF' : '#6B7280' }}>
                          {r.players?.rating ?? '—'}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <select value={r.approval_status || 'pending'} onChange={e => updateStatus(r.id, 'approval_status', e.target.value)} style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: approvalColors[r.approval_status] || '#94A3B8', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer'
                          }}>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="waitlist">Waitlist</option>
                            <option value="declined">Declined</option>
                          </select>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <select value={r.payment_status || 'unpaid'} onChange={e => updateStatus(r.id, 'payment_status', e.target.value)} style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: paymentColors[r.payment_status] || '#94A3B8', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer'
                          }}>
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                            <option value="refunded">Refunded</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
