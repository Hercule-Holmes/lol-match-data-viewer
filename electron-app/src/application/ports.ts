/**
 * 应用层 — 端口定义
 *
 * 应用层通过这些接口访问基础设施，不直接依赖 Electron / window.lcuApi。
 * MatchRepository 用业务语义命名（findXxx），不暴露底层是 LCU 还是 SGP。
 */

import type { GameRecord, LcuConnectionInfo, LcuSummoner, MatchListData } from '@shared/types'

// ═══════════════════════════════════════════════════════════
// MatchRepository — 对局数据访问
// ═══════════════════════════════════════════════════════════

export interface MatchRepository {
  findByIds(ids: number[]): Promise<GameRecord[]>
  findCurrentSummonerMatches(page?: number, pageSize?: number): Promise<MatchListData>
  findPlayerMatches(
    puuid: string,
    summonerName: string,
    profileIconId: number,
    summonerLevel: number,
    page?: number,
    pageSize?: number,
  ): Promise<MatchListData>
}

/**
 * 将 window.lcuApi（LCU 语义方法名）适配为 MatchRepository（业务语义方法名）。
 * 这是应用层唯一的 LCU→业务 名字映射点——未来换 SGP 时，只需新建一个 SGP 版实现。
 */
export function createMatchRepository(raw: {
  fetchGameDetails(gameIds: number[]): Promise<GameRecord[]>
  fetchMatchList(page?: number, pageSize?: number): Promise<MatchListData>
  fetchPlayerMatchList(
    targetPuuid: string,
    summonerName: string,
    profileIconId: number,
    summonerLevel: number,
    page?: number,
    pageSize?: number,
  ): Promise<MatchListData>
}): MatchRepository {
  return {
    findByIds: (ids) => raw.fetchGameDetails(ids),
    findCurrentSummonerMatches: (page, pageSize) => raw.fetchMatchList(page, pageSize),
    findPlayerMatches: (puuid, name, iconId, level, page, pageSize) =>
      raw.fetchPlayerMatchList(puuid, name, iconId, level, page, pageSize),
  }
}

// ═══════════════════════════════════════════════════════════
// SessionPort — 会话/连接操作
// ═══════════════════════════════════════════════════════════

export interface SessionPort {
  checkConnection(): Promise<LcuConnectionInfo | null>
  getCurrentSummoner(): Promise<LcuSummoner>
}
