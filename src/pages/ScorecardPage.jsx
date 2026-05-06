import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getPlayOrder, getParForHole, calcPlayerScore, formatRelativeToPar } from '../lib/scoring'
import Layout from '../components/shared/Layout'

export default function ScorecardPage() {
  const { roundId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [round, setRound] = useState(null)
  const [layout, setLayout] = useState(null)
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState({}) // { "playerId-holeNum-loop": strokes }
  const [playOrder, setPlayOrder] = useState([])
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    loadRound()
  }, [roundId])

  async function loadRound() {
    const { data: roundData } = await supabase
      .from('rounds')
      .select('*, courses(name), layouts(*)')
      .eq('id', roundId)
      .single()

    if (!roundData) return

    setRound(roundData)
    setLayout(roundData.layouts)
    setIsOwner(roundData.created_by === user.id)

    const parJson = roundData.layouts.par_json
    const order = getPlayOrder(
      roundData.starting_hole,
      roundData.layouts.number_of_holes,
      roundData.layouts.loops,
      parJson
    )
    setPlayOrder(order)

    // Load players
    const { data: rp } = await supabase
      .from('round_players')
      .select('profiles(id, full_name)')
      .eq('round_id', roundId)
    setPlayers(rp?.map(r => r.profiles) ?? [])

    // Load existing scores
    const { data: existingScores } = await supabase
      .from('scores')
      .select('*')
      .eq('round_id', roundId)

    const scoreMap = {}
    for (const s of existingScores ?? []) {
      scoreMap[scoreKey(s.player_id, s.hole_number, s.loop)] = s.strokes
    }
    setScores(scoreMap)

    // Find first incomplete hole
    const firstIncomplete = order.findIndex(h =>
      rp?.some(r => scoreMap[scoreKey(r.profiles.id, h.holeNumber, h.loop)] == null)
    )
    setCurrentHoleIndex(firstIncomplete === -1 ? 0 : firstIncomplete)
  }

  function scoreKey(playerId, holeNumber, loop) {
    return `${playerId}-${holeNumber}-${loop}`
  }

  function updateScore(playerId, holeNumber, loop, strokes) {
    setScores(prev => ({ ...prev, [scoreKey(playerId, holeNumber, loop)]: strokes }))
  }

  async function saveHole() {
    if (!isOwner) return
    setSaving(true)
    const hole = playOrder[currentHoleIndex]

    const upserts = players.map(p => ({
      round_id: roundId,
      player_id: p.id,
      hole_number: hole.holeNumber,
      loop: hole.loop,
      play_order: hole.playOrder,
      strokes: scores[scoreKey(p.id, hole.holeNumber, hole.loop)] ?? null,
      created_by: user.id,
    }))

    await supabase.from('scores').upsert(upserts, {
      onConflict: 'round_id,player_id,hole_number,loop',
    })

    setSaving(false)

    if (currentHoleIndex < playOrder.length - 1) {
      setCurrentHoleIndex(i => i + 1)
    }
  }

  async function finishRound() {
    setFinishing(true)
    await saveHole()
    await supabase.from('rounds').update({ status: 'complete' }).eq('id', roundId)
    navigate('/history')
  }

  if (!round || !layout) return <Layout title="Scorecard"><p>Loading...</p></Layout>

  const hole = playOrder[currentHoleIndex]
  const parJson = layout.par_json
  const isLastHole = currentHoleIndex === playOrder.length - 1

  return (
    <Layout>
      {/* Header strip */}
      <div style={styles.roundHeader}>
        <div>
          <div style={styles.courseName}>{round.courses?.name}</div>
          <div style={styles.layoutName}>{layout.layout_name} · {round.format}</div>
        </div>
        <div style={styles.progress}>{currentHoleIndex + 1} / {playOrder.length}</div>
      </div>

      {/* Current hole card */}
      {hole && (
        <div style={styles.holeCard}>
          <div style={styles.holeHeader}>
            <div>
              <div style={styles.holeLabel}>{hole.scorecardLabel}</div>
              {hole.loop > 1 && <div style={styles.loopBadge}>Loop {hole.loop}</div>}
            </div>
            <div style={styles.parBadge}>Par {hole.par}</div>
          </div>

          {/* Score entry per player */}
          <div style={styles.playerList}>
            {players.map(player => {
              const key = scoreKey(player.id, hole.holeNumber, hole.loop)
              const strokes = scores[key] ?? ''
              const rel = strokes !== '' ? strokes - hole.par : null

              return (
                <div key={player.id} style={styles.playerRow}>
                  <span style={styles.playerName}>{player.full_name}</span>
                  <div style={styles.scoreControls}>
                    <button style={styles.adjBtn}
                      disabled={!isOwner || strokes <= 1}
                      onClick={() => updateScore(player.id, hole.holeNumber, hole.loop, Math.max(1, (strokes || hole.par) - 1))}>
                      −
                    </button>
                    <div style={{ ...styles.scoreDisplay, ...(rel != null ? getRelStyle(rel) : {}) }}>
                      {strokes !== '' ? strokes : '—'}
                    </div>
                    <button style={styles.adjBtn}
                      disabled={!isOwner}
                      onClick={() => updateScore(player.id, hole.holeNumber, hole.loop, (strokes || hole.par) + 1)}>
                      +
                    </button>
                  </div>
                  {rel != null && (
                    <span style={{ ...styles.relScore, ...getRelStyle(rel) }}>
                      {formatRelativeToPar(rel)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {isOwner && (
            <div style={styles.holeActions}>
              {isLastHole ? (
                <button style={{ ...styles.nextBtn, background: '#1d6b3a' }} onClick={finishRound} disabled={finishing}>
                  {finishing ? 'Finishing...' : 'Finish round ✓'}
                </button>
              ) : (
                <button style={styles.nextBtn} onClick={saveHole} disabled={saving}>
                  {saving ? 'Saving...' : `Save & next hole →`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hole navigation dots */}
      <div style={styles.holeDots}>
        {playOrder.map((h, i) => {
          const allScored = players.every(p => scores[scoreKey(p.id, h.holeNumber, h.loop)] != null)
          return (
            <button key={i} style={{ ...styles.dot, ...(i === currentHoleIndex ? styles.dotCurrent : allScored ? styles.dotDone : {}) }}
              onClick={() => setCurrentHoleIndex(i)} />
          )
        })}
      </div>

      {/* Running totals */}
      <div style={styles.totalsCard}>
        <div style={styles.totalsTitle}>Running totals</div>
        {players.map(p => {
          const playerScores = Object.entries(scores)
            .filter(([k]) => k.startsWith(p.id))
            .map(([k, strokes]) => {
              const [, holeNum, loop] = k.split('-')
              return { hole_number: parseInt(holeNum), loop: parseInt(loop), strokes }
            })
          const { total, relativeToPar, holesPlayed } = calcPlayerScore(playerScores, parJson)
          return (
            <div key={p.id} style={styles.totalRow}>
              <span style={styles.totalName}>{p.full_name}</span>
              <span style={styles.totalHoles}>{holesPlayed} holes</span>
              <span style={{ ...styles.totalScore, ...(relativeToPar < 0 ? { color: '#dc2626' } : relativeToPar > 0 ? { color: '#2563eb' } : {}) }}>
                {holesPlayed > 0 ? `${total} (${formatRelativeToPar(relativeToPar)})` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}

function getRelStyle(rel) {
  if (rel < 0) return { background: '#fee2e2', color: '#dc2626' }   // under par = red (good in disc golf)
  if (rel === 0) return { background: '#f0fdf4', color: '#16a34a' } // par = green
  if (rel === 1) return { background: '#fef9c3', color: '#ca8a04' } // +1 = yellow
  return { background: '#eff6ff', color: '#2563eb' }                // +2+ = blue
}

const styles = {
  roundHeader: { background: '#1d6b3a', color: '#fff', padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  courseName: { fontWeight: 700, fontSize: 16 },
  layoutName: { fontSize: 12, opacity: 0.8, marginTop: 2, textTransform: 'capitalize' },
  progress: { fontSize: 22, fontWeight: 700, opacity: 0.9 },
  holeCard: { background: '#fff', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  holeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  holeLabel: { fontSize: 20, fontWeight: 700, color: '#1a2e1a' },
  loopBadge: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  parBadge: { background: '#f0faf4', color: '#1d6b3a', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 15 },
  playerList: { display: 'flex', flexDirection: 'column', gap: 12 },
  playerRow: { display: 'flex', alignItems: 'center', gap: 8 },
  playerName: { flex: 1, fontSize: 15, fontWeight: 500, color: '#374151' },
  scoreControls: { display: 'flex', alignItems: 'center', gap: 6 },
  adjBtn: { width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #e5e7eb', background: '#f9fafb', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, lineHeight: 1 },
  scoreDisplay: { width: 44, height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, background: '#f3f4f6' },
  relScore: { fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 4, minWidth: 28, textAlign: 'center' },
  holeActions: { marginTop: '1.25rem' },
  nextBtn: { width: '100%', padding: '0.875rem', background: '#1d6b3a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: 'pointer' },
  holeDots: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: '0.75rem' },
  dot: { width: 10, height: 10, borderRadius: '50%', background: '#e5e7eb', border: 'none', cursor: 'pointer', padding: 0 },
  dotCurrent: { background: '#1d6b3a', transform: 'scale(1.3)' },
  dotDone: { background: '#86efac' },
  totalsCard: { background: '#fff', borderRadius: 12, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  totalsTitle: { fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  totalRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' },
  totalName: { flex: 1, fontSize: 14, fontWeight: 500 },
  totalHoles: { fontSize: 12, color: '#9ca3af' },
  totalScore: { fontSize: 15, fontWeight: 700, color: '#1a2e1a' },
}
