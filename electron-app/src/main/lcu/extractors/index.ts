/**
 * 数据提取模块 barrel
 *
 * 公开接口（供 lcu-handlers.ts 使用）:
 *   fetchMatchList, fetchMatchListForPlayer, fetchGameDetailsBatched, fetchGameData
 *   fetchAllMatchData (deprecated)
 */

// 纯数据提取函数（供内部模块使用）
export {
  safeInt,
  mapById,
  extractPlayerIdentity,
  extractStatsFull,
  extractTeamData,
  extractRankedData,
  extractChampionMasteryForGame,
} from './extractors'

// 对局列表 + 分页 + 缓存
export { fetchMatchList, fetchMatchListForPlayer } from './match-list'

// 批量详情 + 静态数据
export { fetchGameDetailsBatched, fetchGameData } from './game-data'

// ═══════════════════════════════════════════════════════════
// 废弃 API
// ═══════════════════════════════════════════════════════════

import { LcuHttpClient } from '../client'
import type { MatchData, PlayerData, GameRecord } from '@shared/types/app'
import type { Team } from '@shared/types/lcu-api'
import {
  extractPlayerIdentity,
  extractStatsFull,
  extractTeamData,
  extractRankedData,
  extractChampionMasteryForGame,
} from './extractors'

/** @deprecated 使用 `fetchMatchList` 替代，该函数不支持分页且逐场串行请求 */
export async function fetchAllMatchData(
  client: LcuHttpClient,
  gameCount: number
): Promise<MatchData> {
  const summoner = await client.getCurrentSummoner()
  const puuid = summoner.puuid

  const [ranked, allMastery, history] = await Promise.all([
    client.getRankedStats(puuid),
    client.getChampionMastery(),
    client.getMatchHistory(puuid, 0, Math.max(gameCount - 1, 0)),
  ])

  const games = history?.games?.games || []
  const allGames: GameRecord[] = []

  for (const game of games) {
    const gameId = game.gameId
    const detail = await client.getGameDetail(gameId)

    const identities: Record<number, any> = {}
    for (const pi of detail?.participantIdentities || []) {
      identities[pi.participantId] = pi.player || {}
    }

    const bluePlayers: PlayerData[] = []
    const redPlayers: PlayerData[] = []
    const usedChampionIds: number[] = []

    for (const p of detail?.participants || []) {
      const pid = p.participantId
      const playerInfo = identities[pid] || {}
      const cid = p.championId
      usedChampionIds.push(cid)

      const playerData: PlayerData = {
        ...extractPlayerIdentity(playerInfo),
        champion_id: cid,
        stats: extractStatsFull(p),
      }

      if (p.teamId === 100) {
        bluePlayers.push(playerData)
      } else {
        redPlayers.push(playerData)
      }
    }

    const teams = detail?.teams || []
    const blueTeamData = extractTeamData(
      teams.find((t) => t.teamId === 100) || ({} as Team),
      bluePlayers
    )
    const redTeamData = extractTeamData(
      teams.find((t) => t.teamId === 200) || ({} as Team),
      redPlayers
    )

    const gameMastery = extractChampionMasteryForGame(allMastery, usedChampionIds)

    allGames.push({
      game_id: gameId,
      game_creation: game.gameCreationDate || '',
      game_duration_min: Math.round(((game.gameDuration || 0) / 60) * 10) / 10,
      game_mode: game.gameMode || '',
      game_type: game.gameType || '',
      queue_id: game.queueId,
      map_id: game.mapId,
      game_version: game.gameVersion || '',
      blue_team: blueTeamData,
      red_team: redTeamData,
      champion_mastery: gameMastery,
    })
  }

  return {
    summoner: {
      puuid,
      name: summoner.displayName || '',
      level: summoner.summonerLevel || 0,
      region: client.region,
      platform: client.rsoPlatformId,
      profileIconId: summoner.profileIconId || 0,
    },
    ranked: extractRankedData(ranked),
    champion_mastery_total: allMastery.length,
    games_count: allGames.length,
    games: allGames,
  }
}
