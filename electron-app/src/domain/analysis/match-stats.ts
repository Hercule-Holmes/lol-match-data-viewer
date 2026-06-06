/**
 * 分析领域 — 对局列表统计
 * 纯计算，操作 GameSummary 类型（与 aggregation/frequency 的 GameRecord 不同）
 */

import type { GameRecord, GameSummary, ParticipantBrief } from '@shared/types'

export interface PlayerFreq {
  puuid: string
  gameName: string
  summonerName: string
  profileIconId: number
  count: number
}

/** 常用英雄 TOP 5 */
export function computeFrequentChampions(
  games: GameSummary[],
): { championId: number; count: number }[] {
  const map: Record<number, number> = {}
  for (const g of games) {
    map[g.championId] = (map[g.championId] || 0) + 1
  }
  return Object.entries(map)
    .map(([id, count]) => ({ championId: Number(id), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

/** 通用玩家频次统计（排除自己，≥2 场才显示，TOP 5） */
export function countPlayerFreq(
  games: GameSummary[],
  selfPuuid: string,
  predicate: (g: GameSummary) => ParticipantBrief[],
): PlayerFreq[] {
  const map = new Map<string, PlayerFreq>()
  for (const g of games) {
    for (const p of predicate(g)) {
      if (p.puuid === selfPuuid) continue
      const existing = map.get(p.puuid)
      if (existing) {
        existing.count++
      } else {
        map.set(p.puuid, { ...p, count: 1 })
      }
    }
  }
  return Array.from(map.values())
    .filter((f) => f.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

/** 从对局中提取队友（同队且非自己） */
export function extractTeammates(
  g: GameSummary,
  selfPuuid: string,
): ParticipantBrief[] {
  const selfTeam = g.blueParticipants.some((p) => p.puuid === selfPuuid)
    ? g.blueParticipants
    : g.redParticipants
  return selfTeam.filter((p) => p.puuid !== selfPuuid)
}

/** 从对局中提取对手（对方队伍全部成员） */
export function extractOpponents(
  g: GameSummary,
  selfPuuid: string,
): ParticipantBrief[] {
  const selfTeam = g.blueParticipants.some((p) => p.puuid === selfPuuid)
    ? g.blueParticipants
    : g.redParticipants
  return selfTeam === g.blueParticipants ? g.redParticipants : g.blueParticipants
}

/** 计算平均 KDA */
export function computeAvgKda(games: Pick<GameSummary, 'kdaRatio'>[]): string {
  if (games.length === 0) return '-'
  const sum = games.reduce((s, g) => s + g.kdaRatio, 0)
  return (sum / games.length).toFixed(2)
}

/** 计算胜负统计（排除练习模式） */
export function computeWinStats(games: Pick<GameSummary, 'win' | 'gameMode'>[]): {
  wins: number
  losses: number
  ratePercent: string
} {
  let wins = 0
  let losses = 0
  for (const g of games) {
    if (g.win) wins++
    else if (g.gameMode !== 'PRACTICETOOL') losses++
  }
  const total = wins + losses
  return {
    wins,
    losses,
    ratePercent: total === 0 ? '0' : ((wins / total) * 100).toFixed(0),
  }
}

/** 格式化总场次展示文本 */
export function formatTotalGamesDisplay(
  totalGames: number,
  gamesLength: number,
  currentPage: number,
  pageSize: number,
): string {
  if (totalGames > 0 && totalGames > gamesLength) {
    return `${totalGames} 场`
  }
  if (gamesLength < pageSize) {
    return `${(currentPage - 1) * pageSize + gamesLength} 场`
  }
  return `${(currentPage - 1) * pageSize + gamesLength}+ 场`
}

// ═══════════════════════════════════════════════════════════
// 数据谓词 & 变换（供应用层/表示层使用，纯计算）
// ═══════════════════════════════════════════════════════════

/** 判断指定玩家是否参加了全部对局 */
export function isPlayerInAllGames(
  games: Pick<GameRecord, 'blue_team' | 'red_team'>[],
  puuid: string,
): boolean {
  if (!games.length || !puuid) return false
  return games.every((g) =>
    g.blue_team.players.some((p) => p.puuid === puuid) ||
    g.red_team.players.some((p) => p.puuid === puuid),
  )
}

/** 只保留指定玩家所在方，清空对方队伍（用于"只看队友"模式） */
export function filterToPlayerTeam(games: GameRecord[], puuid: string): GameRecord[] {
  return games.map((g) => {
    const onBlue = g.blue_team.players.some((p) => p.puuid === puuid)
    const onRed = g.red_team.players.some((p) => p.puuid === puuid)
    if (onBlue) return { ...g, red_team: { ...g.red_team, players: [] } }
    if (onRed) return { ...g, blue_team: { ...g.blue_team, players: [] } }
    return g
  })
}

/** 判断对局列表是否属于同一游戏模式 */
export function hasUniformGameMode(
  games: Pick<GameSummary, 'gameMode'>[],
): boolean {
  if (games.length <= 1) return true
  const first = games[0].gameMode
  return games.every((g) => g.gameMode === first)
}
