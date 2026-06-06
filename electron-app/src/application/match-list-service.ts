/**
 * 应用层 — 对局列表服务
 * 编排"刷新玩家对局列表"用例
 */

import type { MatchListData } from '@shared/types'
import type { MatchRepository } from './ports'

export async function refreshPlayerGames(
  api: MatchRepository,
  puuid: string,
  name: string,
  profileIconId: number,
  summonerLevel: number,
  pageSize: number,
): Promise<MatchListData> {
  return api.findPlayerMatches(
    puuid,
    name,
    profileIconId,
    summonerLevel,
    1,
    pageSize,
  )
}
