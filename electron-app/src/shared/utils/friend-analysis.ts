/**
 * 好友分析 —— 纯函数算法
 * 接受任意 puuid 作为分析主体，不硬编码"当前用户"
 */
import type { GameSummary, ParticipantBrief } from '@shared/types/app'

export interface FriendStats {
  puuid: string
  name: string
  profileIconId: number
  gamesTogether: number
  winsTogether: number
  winRate: number
  soloWinRate: number
  lastPlayedTime: number
  gameIds: number[]
}

/** 从 GameSummary 列表中分析所有队友频次与胜率 */
export function analyzeFriends(games: GameSummary[], targetPuuid: string): FriendStats[] {
  const map = new Map<string, FriendStats>()

  // 仅统计有效对局
  const validGames = games.filter(g => g.gameMode !== 'PRACTICETOOL')
  if (validGames.length === 0) return []

  let totalWins = 0

  for (const g of validGames) {
    if (g.win) totalWins++

    const teammates =
      g.teamId === 100 ? g.blueParticipants : g.redParticipants

    for (const p of teammates) {
      if (p.puuid === targetPuuid) continue

      const existing = map.get(p.puuid)
      if (existing) {
        existing.gamesTogether++
        if (g.win) existing.winsTogether++
        if (g.gameCreation > existing.lastPlayedTime) {
          existing.lastPlayedTime = g.gameCreation
        }
        existing.gameIds.push(g.gameId)
      } else {
        map.set(p.puuid, {
          puuid: p.puuid,
          name: friendDisplayName(p),
          profileIconId: p.profileIconId,
          gamesTogether: 1,
          winsTogether: g.win ? 1 : 0,
          winRate: 0,
          soloWinRate: 0,
          lastPlayedTime: g.gameCreation,
          gameIds: [g.gameId],
        })
      }
    }
  }

  const totalGames = validGames.length

  for (const f of map.values()) {
    f.winRate = f.gamesTogether > 0 ? f.winsTogether / f.gamesTogether : 0
    const soloTotal = totalGames - f.gamesTogether
    const soloWins = totalWins - f.winsTogether
    f.soloWinRate = soloTotal > 0 ? soloWins / soloTotal : 0
  }

  return Array.from(map.values())
    .filter(f => f.gamesTogether >= 3)
    .sort((a, b) => b.gamesTogether - a.gamesTogether)
}

function friendDisplayName(p: ParticipantBrief): string {
  if (p.gameName) {
    return p.tagLine ? `${p.gameName}#${p.tagLine}` : p.gameName
  }
  return p.summonerName || '?'
}

export interface FriendSummary {
  totalFriends: number
  mostPlayed: { name: string; count: number } | null
  bestWinRate: { name: string; rate: number } | null
  totalGames: number
}

export function computeFriendSummary(friends: FriendStats[], totalGames: number): FriendSummary {
  if (friends.length === 0) {
    return { totalFriends: 0, mostPlayed: null, bestWinRate: null, totalGames }
  }

  const mostPlayed = friends[0]
  const bestWR = friends.reduce((best, f) =>
    f.winRate > best.winRate && f.gamesTogether >= 5 ? f : best
  , friends[0])

  return {
    totalFriends: friends.length,
    mostPlayed: { name: mostPlayed.name, count: mostPlayed.gamesTogether },
    bestWinRate: bestWR.winRate > 0
      ? { name: bestWR.name, rate: bestWR.winRate }
      : null,
    totalGames,
  }
}
