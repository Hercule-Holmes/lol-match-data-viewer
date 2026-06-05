/**
 * 分析领域 — 聚合函数
 * 纯计算，不依赖 Vue/Electron，可直接单元测试
 */

import type { GameRecord, PlayerStats } from '@shared/types'
import type { MetricRankEntry, PlayerFullAgg, PodiumEntry } from '@domain/analysis/types'

/** 按玩家聚合对局基本数据（击杀/死亡/助攻/胜场） */
export function buildPlayerAggMap(games: GameRecord[]): Map<string, PlayerFullAgg> {
  const map = new Map<string, PlayerFullAgg>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!map.has(name)) {
        map.set(name, {
          profileIconId: p.profile_icon_id,
          gameCount: 0,
          winCount: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalAssists: 0,
        })
      }
      const agg = map.get(name)!
      agg.gameCount++
      if (p.stats.win) agg.winCount++
      agg.totalKills += p.stats.kills
      agg.totalDeaths += p.stats.deaths
      agg.totalAssists += p.stats.assists
    }
  }
  return map
}

/** 按指标 getter 计算玩家排名（总计降序） */
export function computeMetricRanking(
  games: GameRecord[],
  getter: (stats: PlayerStats) => number,
): MetricRankEntry[] {
  const playerMap = new Map<
    string,
    { total: number; count: number; profileIconId: number; winCount: number }
  >()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      const val = getter(p.stats)
      if (!playerMap.has(name)) {
        playerMap.set(name, {
          total: 0,
          count: 0,
          profileIconId: p.profile_icon_id,
          winCount: 0,
        })
      }
      const entry = playerMap.get(name)!
      entry.total += val
      entry.count++
      if (p.stats.win) entry.winCount++
    }
  }

  return Array.from(playerMap.entries())
    .map(([name, e]) => ({
      playerName: name,
      profileIconId: e.profileIconId,
      total: e.total,
      average: e.total / e.count,
      gameCount: e.count,
      winCount: e.winCount,
      winRate: (e.winCount / e.count) * 100,
    }))
    .sort((a, b) => b.total - a.total)
}

/** 计算领奖台 TOP 3 */
export function computePodium(
  games: GameRecord[],
  aggMap: Map<string, PlayerFullAgg>,
  getter: (stats: PlayerStats) => number,
  fmt: (v: number) => string,
): PodiumEntry[] {
  const playerAgg = new Map<string, { total: number; count: number }>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      const val = getter(p.stats)
      if (!playerAgg.has(name)) {
        playerAgg.set(name, { total: 0, count: 0 })
      }
      const entry = playerAgg.get(name)!
      entry.total += val
      entry.count++
    }
  }

  return Array.from(playerAgg.entries())
    .map(([name, agg]) => {
      const full = aggMap.get(name)!
      const kda =
        full.totalDeaths > 0
          ? ((full.totalKills + full.totalAssists) / full.totalDeaths).toFixed(2)
          : (full.totalKills + full.totalAssists).toFixed(1)
      return {
        playerName: name,
        profileIconId: full.profileIconId,
        totalValue: agg.total,
        displayValue: fmt(agg.total),
        gameCount: full.gameCount,
        winCount: full.winCount,
        totalKills: full.totalKills,
        totalDeaths: full.totalDeaths,
        totalAssists: full.totalAssists,
        avgKda: kda,
      }
    })
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 3)
}
