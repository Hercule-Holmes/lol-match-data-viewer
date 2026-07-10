import test from "node:test";
import assert from "node:assert/strict";
import { calcWinRatePercent, selectPlayersByGap, splitTeamsWithWinrateTuning } from "./matchmaking-core.js";

test("calcWinRatePercent returns fallback when total is zero", () => {
  assert.equal(calcWinRatePercent({ wins: 0, total_games: 0 }, 45), 45);
});

test("selectPlayersByGap prefers players with larger gap", () => {
  const players = [
    { player_id: "p1", assigned_games: 8 },
    { player_id: "p2", assigned_games: 2 },
    { player_id: "p3", assigned_games: 3 },
    { player_id: "p4", assigned_games: 9 },
  ];
  const selected = selectPlayersByGap(players, 10, 2);
  const ids = selected.map((p) => p.player_id);
  assert.ok(ids.includes("p2"));
  assert.ok(ids.includes("p3"));
});

test("splitTeamsWithWinrateTuning always returns 5v5", () => {
  const players = Array.from({ length: 10 }).map((_, i) => ({
    player_id: `p${i + 1}`,
    wins: i + 1,
    total_games: 20,
  }));
  const result = splitTeamsWithWinrateTuning(players, { tolerancePercent: 10, maxShuffleTries: 50 });
  assert.equal(result.teamA.length, 5);
  assert.equal(result.teamB.length, 5);
  assert.equal(new Set([...result.teamA, ...result.teamB]).size, 10);
});
