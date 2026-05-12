/**
 * tournamentScoring.js
 * Calculates tournament standings from raw score data
 */

/**
 * Calculate strokeplay standings for a tournament
 *
 * @param {Array} players       - tournament_players with profiles and divisions
 * @param {Array} tRounds       - tournament_rounds with round_id and layouts
 * @param {Array} scores        - all scores for linked rounds
 * @param {Object} tournament   - tournament record (scoring_type, best_rounds_count)
 * @returns {Array} standings sorted by rank within each division
 */
export function calcStrokeplayStandings(players, tRounds, scores, tournament) {
  const linkedRounds = tRounds.filter((r) => r.round_id);

  // Build a map of round_id -> layout par info
  const roundParMap = {};
  for (const tr of linkedRounds) {
    if (!tr.layouts?.par_json) continue;
    const totalPar =
      tr.layouts.par_json.reduce((s, p) => s + p, 0) * (tr.layouts.loops ?? 1);
    roundParMap[tr.round_id] = totalPar;
  }

  // Build score totals per player per round
  const playerRoundTotals = {}; // { playerId: { roundId: strokes } }
  for (const s of scores) {
    if (!playerRoundTotals[s.player_id]) playerRoundTotals[s.player_id] = {};
    if (!playerRoundTotals[s.player_id][s.round_id])
      playerRoundTotals[s.player_id][s.round_id] = 0;
    playerRoundTotals[s.player_id][s.round_id] += s.strokes;
  }

  return players
    .map((p) => {
      const pid = p.player_id;
      const roundTotals = playerRoundTotals[pid] ?? {};

      // Get per-round results: { roundId, strokes, par, relativeToPar, roundNumber }
      const roundResults = linkedRounds
        .map((tr) => ({
          roundId: tr.round_id,
          roundNumber: tr.round_number,
          strokes: roundTotals[tr.round_id] ?? null,
          par: roundParMap[tr.round_id] ?? 0,
          relativeToPar:
            roundTotals[tr.round_id] != null
              ? roundTotals[tr.round_id] - (roundParMap[tr.round_id] ?? 0)
              : null,
        }))
        .filter((r) => r.strokes != null);

      // Apply scoring type
      let countedRounds = roundResults;
      if (
        tournament.scoring_type === "best_rounds" &&
        tournament.best_rounds_count
      ) {
        // Sort by relative to par ascending, take best N
        countedRounds = [...roundResults]
          .sort((a, b) => a.relativeToPar - b.relativeToPar)
          .slice(0, tournament.best_rounds_count);
      }

      const totalStrokes = countedRounds.reduce((s, r) => s + r.strokes, 0);
      const totalPar = countedRounds.reduce((s, r) => s + r.par, 0);
      const relativeToPar =
        countedRounds.length > 0 ? totalStrokes - totalPar : null;
      const roundsPlayed = roundResults.length;

      return {
        player_id: pid,
        name: p.profiles?.nickname || p.profiles?.full_name,
        division_id: p.division_id,
        division_name: p.tournament_divisions?.name ?? "Open",
        roundResults, // all rounds for display
        countedRounds, // rounds that count toward score
        totalStrokes,
        totalPar,
        relativeToPar,
        roundsPlayed,
      };
    })
    .sort((a, b) => {
      // Null scores go to bottom
      if (a.relativeToPar == null && b.relativeToPar == null) return 0;
      if (a.relativeToPar == null) return 1;
      if (b.relativeToPar == null) return -1;
      return a.relativeToPar - b.relativeToPar;
    });
}

/**
 * Calculate matchplay standings for a tournament
 * Win = 2pts, Halved = 1pt each, Loss = 0pts
 * Tiebreaker: total match score differential (sum of UP/DN across all matches)
 */
export function calcMatchplayStandings(players, tRounds, scores, tournament) {
  const linkedRounds = tRounds.filter((r) => r.round_id);

  // For each linked round, determine the match result (2 players per round)
  // We look at the scores and calculate who won each hole
  const matchResults = []; // { roundId, player1Id, player2Id, winner, differential }

  for (const tr of linkedRounds) {
    const roundScores = scores.filter((s) => s.round_id === tr.round_id);
    const playerIds = [...new Set(roundScores.map((s) => s.player_id))];
    if (playerIds.length !== 2) continue;

    const [p1, p2] = playerIds;
    let p1Score = 0;
    let p2Score = 0;

    // Group by hole
    const holes = [
      ...new Set(roundScores.map((s) => `${s.hole_number}-${s.loop}`)),
    ];
    for (const holeKey of holes) {
      const [hole, loop] = holeKey.split("-").map(Number);
      const p1Strokes = roundScores.find(
        (s) => s.player_id === p1 && s.hole_number === hole && s.loop === loop,
      )?.strokes;
      const p2Strokes = roundScores.find(
        (s) => s.player_id === p2 && s.hole_number === hole && s.loop === loop,
      )?.strokes;
      if (p1Strokes == null || p2Strokes == null) continue;
      if (p1Strokes < p2Strokes) p1Score++;
      else if (p2Strokes < p1Strokes) p2Score++;
    }

    const differential = p1Score - p2Score;
    matchResults.push({
      roundId: tr.round_id,
      roundNumber: tr.round_number,
      p1Id: p1,
      p2Id: p2,
      p1Score,
      p2Score,
      winner: differential > 0 ? p1 : differential < 0 ? p2 : null, // null = halved
      differential: Math.abs(differential),
    });
  }

  return players
    .map((p) => {
      const pid = p.player_id;
      const myMatches = matchResults.filter(
        (m) => m.p1Id === pid || m.p2Id === pid,
      );

      let points = 0;
      let differential = 0;

      for (const m of myMatches) {
        if (m.winner === pid) {
          points += 2;
          differential += m.differential;
        } else if (m.winner === null) {
          points += 1;
        } else {
          differential -= m.differential;
        }
      }

      return {
        player_id: pid,
        name: p.profiles?.nickname || p.profiles?.full_name,
        division_id: p.division_id,
        division_name: p.tournament_divisions?.name ?? "Open",
        matchResults: myMatches,
        matchesPlayed: myMatches.length,
        wins: myMatches.filter((m) => m.winner === pid).length,
        losses: myMatches.filter((m) => m.winner != null && m.winner !== pid)
          .length,
        halved: myMatches.filter((m) => m.winner === null).length,
        points,
        differential,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.differential - a.differential;
    });
}

/**
 * Format relative to par for display
 */
export function formatRelativeToParT(n) {
  if (n == null) return "—";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}
