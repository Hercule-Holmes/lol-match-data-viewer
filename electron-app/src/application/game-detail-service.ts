/**
 * 应用层 — 对局详情服务
 * 编排"加载单局详情"用例
 */

import type { GameRecord } from '@shared/types'
import type { MatchRepository } from './ports'

export async function loadGameDetail(
  api: MatchRepository,
  gameId: number,
): Promise<GameRecord | null> {
  const games = await api.findByIds([gameId])
  return games[0] || null
}
