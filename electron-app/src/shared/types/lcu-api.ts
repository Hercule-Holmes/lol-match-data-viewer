/**
 * LCU API 原始响应类型
 * 对标 LeagueAkari shared/types/league-client/match-history.ts
 * 描述 LOL 客户端 API 返回的原始 JSON 数据结构
 */

export interface MatchHistory {
  accountId: number
  games: Games
  platformId: string
}

export interface Games {
  gameBeginDate: string
  gameCount: number
  gameEndDate: string
  gameIndexBegin: number
  gameIndexEnd: number
  games: Game[]
}

export interface Game {
  endOfGameResult: string
  gameCreation: number
  gameCreationDate: string
  gameDuration: number
  gameId: number
  gameMode: string
  gameType: string
  gameVersion: string
  mapId: number
  participantIdentities: ParticipantIdentity[]
  participants: Participant[]
  platformId: string
  queueId: number
  seasonId: number
  teams: Team[]
}

export interface Team {
  bans: any[]
  baronKills: number
  dominionVictoryScore: number
  dragonKills: number
  firstBaron: boolean
  firstBlood: boolean
  firstDargon: boolean // LCU 接口原文如此（疑似拼写错误）
  firstInhibitor: boolean
  firstTower: boolean
  inhibitorKills: number
  riftHeraldKills: number
  teamId: number
  towerKills: number
  vilemawKills: number
  win: string // 'Win' | 'Fail'
}

export interface Participant {
  championId: number
  highestAchievedSeasonTier: string
  participantId: number
  spell1Id: number
  spell2Id: number
  stats: Stats
  teamId: number
  timeline: Timeline
}

export interface Timeline {
  creepsPerMinDeltas: Record<string, number>
  csDiffPerMinDeltas: Record<string, number>
  damageTakenDiffPerMinDeltas: Record<string, number>
  damageTakenPerMinDeltas: Record<string, number>
  goldPerMinDeltas: Record<string, number>
  lane: string
  participantId: number
  role: string
  xpDiffPerMinDeltas: Record<string, number>
  xpPerMinDeltas: Record<string, number>
}

export interface Stats {
  assists: number
  causedEarlySurrender: boolean
  champLevel: number
  combatPlayerScore: number
  damageDealtToObjectives: number
  damageDealtToTurrets: number
  damageSelfMitigated: number
  deaths: number
  doubleKills: number
  earlySurrenderAccomplice: boolean
  firstBloodAssist: boolean
  firstBloodKill: boolean
  firstInhibitorAssist: boolean
  firstInhibitorKill: boolean
  firstTowerAssist: boolean
  firstTowerKill: boolean
  gameEndedInEarlySurrender: boolean
  gameEndedInSurrender: boolean
  goldEarned: number
  goldSpent: number
  inhibitorKills: number
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
  playerAugment1: number
  playerAugment2: number
  playerAugment3: number
  playerAugment4: number
  playerAugment5: number
  playerAugment6: number
  killingSprees: number
  kills: number
  largestCriticalStrike: number
  largestKillingSpree: number
  largestMultiKill: number
  longestTimeSpentLiving: number
  magicDamageDealt: number
  magicDamageDealtToChampions: number
  magicalDamageTaken: number
  neutralMinionsKilled: number
  neutralMinionsKilledEnemyJungle: number
  neutralMinionsKilledTeamJungle: number
  objectivePlayerScore: number
  participantId: number
  pentaKills: number
  perk0: number
  perk0Var1: number
  perk0Var2: number
  perk0Var3: number
  perk1: number
  perk1Var1: number
  perk1Var2: number
  perk1Var3: number
  perk2: number
  perk2Var1: number
  perk2Var2: number
  perk2Var3: number
  perk3: number
  perk3Var1: number
  perk3Var2: number
  perk3Var3: number
  perk4: number
  perk4Var1: number
  perk4Var2: number
  perk4Var3: number
  perk5: number
  perk5Var1: number
  perk5Var2: number
  perk5Var3: number
  perkPrimaryStyle: number
  perkSubStyle: number
  physicalDamageDealt: number
  physicalDamageDealtToChampions: number
  physicalDamageTaken: number
  playerScore0: number
  playerScore1: number
  playerScore2: number
  playerScore3: number
  playerScore4: number
  playerScore5: number
  playerScore6: number
  playerScore7: number
  playerScore8: number
  playerScore9: number
  quadraKills: number
  sightWardsBoughtInGame: number
  subteamPlacement: number
  teamEarlySurrendered: boolean
  timeCCingOthers: number
  totalDamageDealt: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  totalHeal: number
  totalMinionsKilled: number
  totalPlayerScore: number
  totalScoreRank: number
  totalTimeCrowdControlDealt: number
  totalUnitsHealed: number
  tripleKills: number
  trueDamageDealt: number
  trueDamageDealtToChampions: number
  trueDamageTaken: number
  turretKills: number
  unrealKills: number
  visionScore: number
  visionWardsBoughtInGame: number
  wardsKilled: number
  wardsPlaced: number
  win: boolean
  playerSubteamId: number
  // SGP 扩展字段
  individualPosition: string
  lane: string
  teamPosition: string
}

export interface ParticipantIdentity {
  participantId: number
  player: Player
}

export interface Player {
  accountId: number
  currentAccountId: number
  currentPlatformId: string
  matchHistoryUri: string
  platformId: string
  profileIcon: number
  summonerId: number
  puuid: string
  gameName: string
  tagLine: string
  summonerName: string
}

// ═══════════════════════════════════════════════════════════
// LCU CDN 游戏数据静态资源类型
// ═══════════════════════════════════════════════════════════

/** LCU /lol-summoner/v1/summoners/{id} 原始响应 */
export interface LcuSummoner {
  accountId: number
  displayName: string
  gameName: string
  tagLine: string
  internalName: string
  nameChangeFlag: boolean
  percentCompleteForNextLevel: number
  profileIconId: number
  puuid: string
  rerollPoints: {
    currentPoints: number
    numberOfRolls: number
    pointsCostToRoll: number
    pointsToReroll: number
  }
  summonerId: number
  summonerLevel: number
  xpSinceLastLevel: number
  xpUntilNextLevel: number
}

export interface LcuChampionSummary {
  id: number
  name: string
  alias: string
  squarePortraitPath: string
  roles: string[]
}

export interface LcuItem {
  id: number
  name: string
  description: string
  active: boolean
  inStore: boolean
  from: number[]
  to: number[]
  categories: string[]
  maxStacks: number
  requiredChampion: string
  requiredAlly: string
  specialRecipe: number
  isEnchantment: boolean
  price: number
  priceTotal: number
  iconPath: string
}

export interface LcuSummonerSpell {
  id: number
  name: string
  description: string
  summonerLevel: number
  cooldown: number
  gameModes: string[]
  iconPath: string
}

export interface LcuPerk {
  id: number
  name: string
  majorChangePatchVersion: string
  tooltip: string
  shortDesc: string
  longDesc: string
  iconPath: string
  endOfGameStatDescs: string[]
}

export interface LcuPerkStyle {
  id: number
  name: string
  tooltip: string
  iconPath: string
  allowedSubStyles: number[]
  slots: { type: string; slotLabel: string; perks: number[] }[]
  defaultPageName: string
  defaultSubStyle: number
  defaultPerks: number[]
}

export interface LcuPerkstyles {
  schemaVersion: number
  styles: LcuPerkStyle[]
}

export interface LcuQueue {
  id: number
  name: string
  shortName: string
  description: string
  detailedDescription: string
  gameSelectModeGroup: string
  gameSelectCategory: string
  gameSelectPriority: number
}

/** 海克斯增幅（斗魂竞技场/海克斯大乱斗） */
export interface LcuAugment {
  id: number
  nameTRA: string
  augmentSmallIconPath: string
  rarity: string
}
