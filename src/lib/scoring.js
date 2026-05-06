/**
 * scoring.js — core scoring logic
 * All hole numbering, wrapping, and par lookups live here.
 */

/**
 * Generate the ordered list of holes to play for a round.
 *
 * @param {number} startingHole  - The true course hole to start on (1-indexed)
 * @param {number} courseHoles   - How many holes the course/layout has (e.g. 9 or 18)
 * @param {number} loops         - How many times to go around (1 or 2)
 * @param {number[]} parJson     - Array of par values, e.g. [3,4,3,3,4,3,4,3,3]
 * @returns {Array} ordered list of hole objects
 *
 * Example output entry:
 * { playOrder: 1, holeNumber: 4, loop: 1, par: 3, scorecardLabel: 'Hole 1' }
 */
export function getPlayOrder(startingHole, courseHoles, loops = 1, parJson = []) {
  const total = courseHoles * loops

  return Array.from({ length: total }, (_, i) => {
    // True course hole number (wraps around using modulo)
    const holeNumber = ((startingHole - 1 + i) % courseHoles) + 1

    // Which pass through the course (1 or 2)
    const loop = Math.floor(i / courseHoles) + 1

    // Par for this hole — always index into parJson by the true hole number
    const par = parJson[(holeNumber - 1) % courseHoles] ?? 3

    // What the scorecard shows to the player (always sequential 1→total)
    const scorecardLabel = `Hole ${i + 1}`

    return {
      playOrder: i + 1,   // 1-indexed position in this round
      holeNumber,          // true course hole (used for storage)
      loop,                // 1 or 2 (used for storage + display)
      par,
      scorecardLabel,
    }
  })
}

/**
 * Get par for a specific hole given a layout's parJson.
 * Safe to call with any holeNumber — handles wrapping automatically.
 */
export function getParForHole(holeNumber, parJson) {
  if (!parJson || parJson.length === 0) return 3
  return parJson[(holeNumber - 1) % parJson.length]
}

/**
 * Calculate total par for a layout (accounting for loops).
 */
export function getTotalPar(parJson, loops = 1) {
  const singleLoopPar = parJson.reduce((sum, p) => sum + p, 0)
  return singleLoopPar * loops
}

/**
 * Calculate a player's score relative to par for a set of score rows.
 *
 * @param {Array} scoreRows  - Array of { strokes, hole_number, loop } from DB
 * @param {number[]} parJson
 * @returns {{ total: number, relativeToPar: number, holesPlayed: number }}
 */
export function calcPlayerScore(scoreRows, parJson) {
  let total = 0
  let parTotal = 0
  let holesPlayed = 0

  for (const row of scoreRows) {
    if (row.strokes == null) continue
    total += row.strokes
    parTotal += getParForHole(row.hole_number, parJson)
    holesPlayed++
  }

  return {
    total,
    relativeToPar: total - parTotal,
    holesPlayed,
  }
}

/**
 * Format a score relative to par for display.
 * E.g. -3 → "-3", 0 → "E", +2 → "+2"
 */
export function formatRelativeToPar(n) {
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * For matchplay: calculate running score (e.g. "2 UP", "1 DN", "AS")
 * given an array of per-hole results for the lead player.
 *
 * @param {Array} results - Array of 'win' | 'loss' | 'halved' in play order
 * @returns {string}
 */
export function calcMatchplayScore(results) {
  let score = 0
  for (const r of results) {
    if (r === 'win') score++
    else if (r === 'loss') score--
  }
  if (score === 0) return 'AS'
  return score > 0 ? `${score} UP` : `${Math.abs(score)} DN`
}
