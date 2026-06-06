/**
 * 应用层 — 分析服务
 * 编排"选中对局进行分析"用例：I/O 获取数据 → 领域层计算 → 装配结果
 */

import type { GameRecord, AnalysisResult } from '@shared/types'
import type { MatchRepository } from './ports'
import { computePlayerAnalysis } from '@domain/analysis/aggregation'

export async function analyzeSelectedGames(
  api: MatchRepository,
  gameIds: number[],
): Promise<{ games: GameRecord[]; currentMode: string; result: AnalysisResult }> {
  const games = await api.findByIds(gameIds)

  const modes = new Set(games.map((g) => g.game_mode))
  const currentMode = modes.size === 1 ? [...modes][0] : ''

  const players = computePlayerAnalysis(games)
  const winCount = games.filter(
    (g) => g.blue_team.win || g.red_team.win,
  ).length

  const result: AnalysisResult = {
    selectedGameIds: gameIds,
    gameCount: games.length,
    winCount,
    winRate: (winCount / games.length) * 100,
    loseCount: games.length - winCount,
    players,
  }

  return { games, currentMode, result }
}
