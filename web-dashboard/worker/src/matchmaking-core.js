export function calcWinRatePercent(player, fallback = 50) {
  const total = Number(player.total_games ?? player.totalGames ?? 0);
  const wins = Number(player.wins ?? 0);
  if (!Number.isFinite(total) || total <= 0) return fallback;
  return (wins / total) * 100;
}

export function selectPlayersByGap(players, targetGamesPerPlayer, needCount) {
  const withGap = players.map((p) => {
    const assigned = Number(p.assigned_games ?? p.assignedGames ?? 0);
    const gap = targetGamesPerPlayer - assigned;
    return { ...p, _gap: gap, _rand: Math.random() };
  });

  withGap.sort((a, b) => {
    if (b._gap !== a._gap) return b._gap - a._gap;
    return a._rand - b._rand;
  });
  return withGap.slice(0, needCount);
}

export function splitTeamsWithWinrateTuning(players, opts = {}) {
  const tolerancePercent = Number(opts.tolerancePercent ?? 10);
  const maxShuffleTries = Number(opts.maxShuffleTries ?? 60);
  const fallback = Number(opts.fallbackWinRatePercent ?? 50);
  const source = [...players];
  if (source.length !== 10) throw new Error("splitTeamsWithWinrateTuning requires 10 players");

  let best = null;
  for (let i = 0; i < Math.max(1, maxShuffleTries); i += 1) {
    shuffleInPlace(source);
    const teamA = source.slice(0, 5);
    const teamB = source.slice(5, 10);
    const delta = calcTeamDelta(teamA, teamB, fallback);
    if (!best || delta < best.delta) {
      best = {
        delta,
        teamA: teamA.map((p) => p.player_id ?? p.playerId),
        teamB: teamB.map((p) => p.player_id ?? p.playerId),
      };
    }
    if (delta <= tolerancePercent) break;
  }
  return best;
}

function calcTeamDelta(teamA, teamB, fallback) {
  const avgA = average(teamA.map((p) => calcWinRatePercent(p, fallback)));
  const avgB = average(teamB.map((p) => calcWinRatePercent(p, fallback)));
  return Math.abs(avgA - avgB);
}

function average(values) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, x) => acc + x, 0);
  return sum / values.length;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
