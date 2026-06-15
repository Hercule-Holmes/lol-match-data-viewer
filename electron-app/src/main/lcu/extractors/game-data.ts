/**
 * 批量对局详情拉取 + 静态游戏数据加载
 */
import { LcuHttpClient } from '../client'
import { DETAIL_CONCUR, batchAsync } from '../concurrency'
import type {
  GameRecord,
  CherrySubteamData,
  PlayerData,
  GameDataCache,
  PerkStyleData,
  PerkstylesData,
  QueueData,
} from '@shared/types/app'
import type { Team } from '@shared/types/lcu-api'
import {
  extractPlayerIdentity,
  extractStatsFull,
  extractTeamData,
  mapById,
} from './extractors'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ═══════════════════════════════════════════════════════════
// 批量拉取对局详情（并发，用于分析）
// ═══════════════════════════════════════════════════════════

export async function fetchGameDetailsBatched(
  client: LcuHttpClient,
  gameIds: number[]
): Promise<GameRecord[]> {
  const results = await batchAsync(gameIds, DETAIL_CONCUR, async (gameId) => {
      try {
        const detail = await client.getGameDetail(gameId)

        const identities: Record<number, any> = {}
        for (const pi of detail?.participantIdentities || []) {
          identities[pi.participantId] = pi.player || {}
        }

        const bluePlayers: PlayerData[] = []
        const redPlayers: PlayerData[] = []
        const usedChampionIds: number[] = []
        const allPlayers: PlayerData[] = []

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
          allPlayers.push(playerData)

          if (p.teamId === 100) {
            bluePlayers.push(playerData)
          } else {
            redPlayers.push(playerData)
          }
        }

        const teams = detail?.teams || []
        const blueTeamData = extractTeamData(
          teams.find((t: Team) => t.teamId === 100) || {},
          bluePlayers
        )
        const redTeamData = extractTeamData(
          teams.find((t: Team) => t.teamId === 200) || {},
          redPlayers
        )

        // 斗魂竞技场 (CHERRY)：按子队分组，按排名 1→6 排列
        let cherry_subteams: CherrySubteamData[] | undefined
        const isCherry = detail?.gameMode === 'CHERRY' || detail?.queueId === 1750
        if (isCherry) {
          const subteamMap = new Map<number, { placement: number; players: PlayerData[] }>()
          for (const p of allPlayers) {
            const sid = p.stats.arena.player_subteam_id
            if (sid == null) continue
            const placement = p.stats.arena.subteam_placement
            if (!subteamMap.has(sid)) {
              subteamMap.set(sid, { placement, players: [] })
            }
            subteamMap.get(sid)!.players.push(p)
          }
          cherry_subteams = [...subteamMap.entries()]
            .sort((a, b) => a[1].placement - b[1].placement)
            .map(([id, data]) => ({
              subteam_id: id,
              placement: data.placement,
              players: data.players,
            }))
        }

        return {
          game_id: gameId,
          game_creation: detail?.gameCreationDate || '',
          game_duration_min:
            Math.round(((detail?.gameDuration || 0) / 60) * 10) / 10,
          game_mode: detail?.gameMode || '',
          game_type: detail?.gameType || '',
          queue_id: detail?.queueId || 0,
          map_id: detail?.mapId || 0,
          game_version: detail?.gameVersion || '',
          blue_team: blueTeamData,
          red_team: redTeamData,
          champion_mastery: {},
          cherry_subteams,
        }
      } catch (err: unknown) {
        console.warn(`[LCU:MAIN] 跳过对局 #${gameId}: ${errMsg(err)}`)
        return null
      }
    })

  const valid = results.filter(Boolean) as GameRecord[]
  if (valid.length < gameIds.length) {
    console.warn(`[LCU:MAIN] ${gameIds.length} 场中成功拉取 ${valid.length} 场, 跳过 ${gameIds.length - valid.length} 场`)
  }
  return valid
}

// ═══════════════════════════════════════════════════════════
// 游戏数据聚合拉取（供 Pinia store 初始化）
// ═══════════════════════════════════════════════════════════

export async function fetchGameData(client: LcuHttpClient): Promise<GameDataCache> {
  console.log('[LCU:MAIN] 开始拉取游戏基础数据（英雄/装备/技能/符文/队列/增幅）...')
  const [champions, items, spells, perks, perkstylesRaw, queuesRaw, augmentsRaw] = await Promise.all([
    client.getGameChampions().catch((err: unknown) => { console.error(`[LCU:MAIN] 英雄数据拉取失败: ${errMsg(err)}`); return [] }),
    client.getGameItems().catch((err: unknown) => { console.error(`[LCU:MAIN] 装备数据拉取失败: ${errMsg(err)}`); return [] }),
    client.getGameSummonerSpells().catch((err: unknown) => { console.error(`[LCU:MAIN] 技能数据拉取失败: ${errMsg(err)}`); return [] }),
    client.getGamePerks().catch((err: unknown) => { console.error(`[LCU:MAIN] 符文数据拉取失败: ${errMsg(err)}`); return [] }),
    client.getGamePerkstyles().catch((err: unknown) => { console.error(`[LCU:MAIN] 符文系数据拉取失败: ${errMsg(err)}`); return { schemaVersion: 0, styles: [] } }),
    client.getGameQueues().catch((err: unknown) => { console.error(`[LCU:MAIN] 队列数据拉取失败: ${errMsg(err)}`); return {} }),
    client.getGameAugments().catch((err: unknown) => { console.warn(`[LCU:MAIN] 增幅数据拉取失败（非斗魂模式可忽略）: ${errMsg(err)}`); return [] }),
  ])

  const perkstyles: PerkstylesData = {
    schemaVersion: perkstylesRaw.schemaVersion,
    styles: mapById(perkstylesRaw.styles) as Record<number, PerkStyleData>,
  }

  const queues: Record<number, QueueData> = {}
  for (const [key, val] of Object.entries(queuesRaw)) {
    queues[Number(key)] = val
  }

  return {
    champions: mapById(champions),
    items: mapById(items),
    summonerSpells: mapById(spells),
    perks: mapById(perks),
    perkstyles,
    queues,
    augments: mapById(augmentsRaw),
  }
}
