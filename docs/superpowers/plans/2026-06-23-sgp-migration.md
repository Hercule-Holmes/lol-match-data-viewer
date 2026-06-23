# SGP Migration Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SGP (Service Gateway Proxy) as the primary data source for match history, with LCU as automatic fallback. SGP provides ~110 data fields per participant (vs LCU's ~70).

**Architecture:** One-time decision at startup — fetch entitlements token from LCU. If successful, all subsequent data flows through SGP. If token acquisition fails, fall back to the existing LCU pipeline transparently. No mixed channels, no user-facing toggle.

**Tech Stack:** axios (HTTPS to SGP), existing LCU client (token source), sql.js (DB unchanged, JSON blob auto-compatible)

## Global Constraints

- Target: Windows 11, Electron + Vue 3, 国服 only
- New code in `src/main/sgp/` — zero renderer imports from main
- PlayerStats fields added to SGP extractor default to 0/null on LCU fallback
- DB `game_details` stores full JSON blob — new fields auto-compatible, no migration
- All IPC handlers follow existing pattern in `lcu-handlers.ts`
- Server config format compatible with LeagueAkari's `league-servers.json`

---

### Task 1: SGP Raw Response Types

**Files:**
- Create: `electron-app/src/main/sgp/types.ts`

**Interfaces:**
- Produces: `SgpMatchHistory`, `SgpGame`, `SgpParticipant` (used by Task 3 client and Task 5 extractor)

- [ ] **Step 1: Create SGP raw response type definitions**

```typescript
/**
 * SGP API 原始响应类型
 * 子集 — 仅包含 match-history 相关类型（Phase 1 不需要 ranked/summoner/spectator）
 * 字段名和结构直接对应 Riot SGP API JSON
 */

/** GET /match-history-query/v1/products/lol/player/{puuid}/SUMMARY */
export interface SgpMatchHistory {
  games: SgpGame[]
}

export interface SgpGame {
  metadata: SgpGameMetadata
  json: SgpGameJson
}

export interface SgpGameMetadata {
  product: string
  tags: string[]
  participants: string[]
  timestamp: string
  data_version: string
  info_type: string
  match_id: string
  private: boolean
}

export interface SgpGameJson {
  endOfGameResult: string
  gameCreation: number
  gameDuration: number
  gameEndTimestamp: number
  gameId: number
  gameMode: string
  gameName: string
  gameStartTimestamp: number
  gameType: string
  gameVersion: string
  mapId: number
  participants: SgpParticipant[]
  platformId: string
  queueId: number
  seasonId: number
  teams: SgpTeam[]
  tournamentCode: string
}

export interface SgpTeam {
  bans: SgpBan[]
  objectives: SgpObjectives
  teamId: number
  win: boolean
}

export interface SgpBan {
  championId: number
  pickTurn: number
}

export interface SgpObjectives {
  baron: SgpObjectiveDetail
  champion: SgpObjectiveDetail
  dragon: SgpObjectiveDetail
  horde: SgpObjectiveDetail
  inhibitor: SgpObjectiveDetail
  riftHerald: SgpObjectiveDetail
  tower: SgpObjectiveDetail
}

export interface SgpObjectiveDetail {
  first: boolean
  kills: number
}

export interface SgpParticipant {
  allInPings: number
  assistMePings: number
  assists: number
  baronKills: number
  basicPings: number
  bountyLevel: number
  challenges: Record<string, number>
  champExperience: number
  champLevel: number
  championId: number
  championName: string
  championTransform: number
  commandPings: number
  consumablesPurchased: number
  damageDealtToBuildings: number
  damageDealtToObjectives: number
  damageDealtToTurrets: number
  damageSelfMitigated: number
  dangerPings: number
  deaths: number
  detectorWardsPlaced: number
  doubleKills: number
  dragonKills: number
  eligibleForProgression: boolean
  enemyMissingPings: number
  enemyVisionPings: number
  firstBloodAssist: boolean
  firstBloodKill: boolean
  firstTowerAssist: boolean
  firstTowerKill: boolean
  gameEndedInEarlySurrender: boolean
  gameEndedInSurrender: boolean
  getBackPings: number
  goldEarned: number
  goldSpent: number
  holdPings: number
  individualPosition: string
  inhibitorKills: number
  inhibitorTakedowns: number
  inhibitorsLost: number
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
  itemsPurchased: number
  killingSprees: number
  kills: number
  lane: string
  largestCriticalStrike: number
  largestKillingSpree: number
  largestMultiKill: number
  longestTimeSpentLiving: number
  magicDamageDealt: number
  magicDamageDealtToChampions: number
  magicDamageTaken: number
  needVisionPings: number
  neutralMinionsKilled: number
  nexusKills: number
  nexusLost: number
  nexusTakedowns: number
  objectivesStolen: number
  objectivesStolenAssists: number
  onMyWayPings: number
  participantId: number
  pentaKills: number
  perks: SgpPerks
  physicalDamageDealt: number
  physicalDamageDealtToChampions: number
  physicalDamageTaken: number
  placement: number
  playerAugment1: number
  playerAugment2: number
  playerAugment3: number
  playerAugment4: number
  playerAugment5: number
  playerAugment6: number
  playerSubteamId: number
  profileIcon: number
  pushPings: number
  puuid: string
  quadraKills: number
  riotIdGameName: string
  riotIdTagline: string
  role: string
  sightWardsBoughtInGame: number
  spell1Casts: number
  spell1Id: number
  spell2Casts: number
  spell2Id: number
  spell3Casts: number
  spell4Casts: number
  subteamPlacement: number
  summoner1Casts: number
  summoner2Casts: number
  summonerId: number
  summonerLevel: number
  summonerName: string
  teamEarlySurrendered: boolean
  teamId: number
  teamPosition: string
  timeCCingOthers: number
  timePlayed: number
  totalAllyJungleMinionsKilled: number
  totalDamageDealt: number
  totalDamageDealtToChampions: number
  totalDamageShieldedOnTeammates: number
  totalDamageTaken: number
  totalEnemyJungleMinionsKilled: number
  totalHeal: number
  totalHealsOnTeammates: number
  totalMinionsKilled: number
  totalTimeCCDealt: number
  totalTimeSpentDead: number
  totalUnitsHealed: number
  tripleKills: number
  trueDamageDealt: number
  trueDamageDealtToChampions: number
  trueDamageTaken: number
  turretKills: number
  turretTakedowns: number
  turretsLost: number
  unrealKills: number
  visionClearedPings: number
  visionScore: number
  visionWardsBoughtInGame: number
  wardsKilled: number
  wardsPlaced: number
  win: boolean
}

export interface SgpPerks {
  statPerks: SgpStatPerks
  styles: SgpPerkStyle[]
}

export interface SgpStatPerks {
  defense: number
  flex: number
  offense: number
}

export interface SgpPerkStyle {
  description: string // 'primaryStyle' | 'subStyle'
  selections: SgpPerkSelection[]
  style: number
}

export interface SgpPerkSelection {
  perk: number
  var1: number
  var2: number
  var3: number
}
```

- [ ] **Step 2: Verify import works from a sibling module**

From `src/main/sgp/`, run:
```bash
npx tsc --noEmit --project tsconfig.node.json 2>&1 | grep -c sgp/types || echo "0 errors in sgp/types"
```

- [ ] **Step 3: Commit**

```bash
git add electron-app/src/main/sgp/types.ts
git commit -m "feat(sgp): add SGP raw response type definitions"
```

---

### Task 2: Server Config (tencent-servers.json)

**Files:**
- Create: `electron-app/src/main/sgp/tencent-servers.json`

**Interfaces:**
- Produces: JSON file consumed by `config.ts` in Task 3

- [ ] **Step 1: Create built-in Tencent server registry**

```json
{
  "version": 1,
  "lastUpdate": 1719696000000,
  "servers": {
    "TENCENT_HN1": {
      "matchHistory": "https://hn1-k8s-sgp.lol.qq.com:21019",
      "common": "https://hn1-k8s-sgp.lol.qq.com:21019"
    },
    "TENCENT_HN10": {
      "matchHistory": "https://hn10-k8s-sgp.lol.qq.com:21019",
      "common": "https://hn10-k8s-sgp.lol.qq.com:21019"
    },
    "TENCENT_TJ100": {
      "matchHistory": "https://tj100-sgp.lol.qq.com:21019",
      "common": "https://tj100-sgp.lol.qq.com:21019"
    },
    "TENCENT_TJ101": {
      "matchHistory": "https://tj101-sgp.lol.qq.com:21019",
      "common": "https://tj101-sgp.lol.qq.com:21019"
    },
    "TENCENT_NJ100": {
      "matchHistory": "https://nj100-sgp.lol.qq.com:21019",
      "common": "https://nj100-sgp.lol.qq.com:21019"
    },
    "TENCENT_GZ100": {
      "matchHistory": "https://gz100-sgp.lol.qq.com:21019",
      "common": "https://gz100-sgp.lol.qq.com:21019"
    },
    "TENCENT_CQ100": {
      "matchHistory": "https://cq100-sgp.lol.qq.com:21019",
      "common": "https://cq100-sgp.lol.qq.com:21019"
    },
    "TENCENT_BGP2": {
      "matchHistory": "https://bgp2-k8s-sgp.lol.qq.com:21019",
      "common": "https://bgp2-k8s-sgp.lol.qq.com:21019"
    },
    "TENCENT_PBE": {
      "matchHistory": "https://pbe-sgp.lol.qq.com:21019",
      "common": "https://pbe-sgp.lol.qq.com:21019"
    },
    "TENCENT_PREPBE": {
      "matchHistory": "https://prepbe-sgp.lol.qq.com:21019",
      "common": "https://prepbe-sgp.lol.qq.com:21019"
    }
  },
  "tencentServerMatchHistoryInteroperability": [
    "TENCENT_HN1", "TENCENT_HN10", "TENCENT_NJ100",
    "TENCENT_GZ100", "TENCENT_CQ100", "TENCENT_TJ100",
    "TENCENT_TJ101", "TENCENT_BGP2", "TENCENT_PBE", "TENCENT_PREPBE"
  ],
  "tencentServerSpectatorInteroperability": [
    "TENCENT_HN1", "TENCENT_HN10", "TENCENT_NJ100",
    "TENCENT_GZ100", "TENCENT_CQ100", "TENCENT_TJ100",
    "TENCENT_TJ101", "TENCENT_BGP2", "TENCENT_PBE", "TENCENT_PREPBE"
  ],
  "tencentServerSummonerInteroperability": [
    "TENCENT_HN1", "TENCENT_HN10", "TENCENT_NJ100",
    "TENCENT_GZ100", "TENCENT_CQ100", "TENCENT_TJ100",
    "TENCENT_TJ101", "TENCENT_BGP2", "TENCENT_PBE", "TENCENT_PREPBE"
  ],
  "serverNames": {
    "zh-CN": {
      "TENCENT_HN1": "艾欧尼亚",
      "TENCENT_HN10": "黑色玫瑰",
      "TENCENT_TJ100": "联盟四区",
      "TENCENT_TJ101": "联盟五区",
      "TENCENT_NJ100": "联盟一区",
      "TENCENT_GZ100": "联盟二区",
      "TENCENT_CQ100": "联盟三区",
      "TENCENT_BGP2": "峡谷之巅",
      "TENCENT_PBE": "PBE",
      "TENCENT_PREPBE": "PREPBE"
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add electron-app/src/main/sgp/tencent-servers.json
git commit -m "feat(sgp): add builtin tencent server registry"
```

---

### Task 3: SGP HTTP Client + Server Config

**Files:**
- Create: `electron-app/src/main/sgp/config.ts`
- Create: `electron-app/src/main/sgp/client.ts`

**Interfaces:**
- Consumes: `SgpMatchHistory` from Task 1, `tencent-servers.json` from Task 2
- Produces: `SgpClient` class (used by Task 7 orchestrator, Task 8 entry point)

- [ ] **Step 1: Create config resolver**

```typescript
/**
 * SGP 服务器地址解析
 *
 * 查找优先级:
 *   1. 内置 tencent-servers.json 精确匹配
 *   2. 动态拼域名 fallback — {zone}-sgp.lol.qq.com:21019
 *   3. 动态拼域名 fallback — {zone}-k8s-sgp.lol.qq.com:21019
 */

import path from 'path'
import fs from 'fs'

export interface SgpServerEntry {
  matchHistory: string | null
  common: string | null
}

export interface SgpServersConfig {
  version: number
  lastUpdate: number
  servers: Record<string, SgpServerEntry>
}

let _config: SgpServersConfig | null = null

function loadConfig(): SgpServersConfig {
  if (_config) return _config
  const configPath = path.join(__dirname, 'tencent-servers.json')
  const raw = fs.readFileSync(configPath, 'utf-8')
  _config = JSON.parse(raw) as SgpServersConfig
  return _config
}

/** 根据 rsoPlatformId（如 TENCENT_HN1）解析 SGP 服务器地址 */
export function resolveSgpBaseUrl(rsoPlatformId: string): string {
  const config = loadConfig()
  const serverId = rsoPlatformId.toUpperCase()
  const entry = config.servers[serverId]
  if (entry?.matchHistory) {
    return entry.matchHistory
  }

  // 动态拼域名 fallback
  const zone = serverId.replace('TENCENT_', '').toLowerCase()
  // 先尝试直连模式
  return `https://${zone}-sgp.lol.qq.com:21019`
}

/** 从 rsoPlatformId 提取子 ID（去掉 TENCENT_ 前缀） */
export function getSgpSubId(rsoPlatformId: string): string {
  if (rsoPlatformId.toUpperCase().startsWith('TENCENT_')) {
    return rsoPlatformId.split('_')[1]
  }
  return rsoPlatformId
}
```

- [ ] **Step 2: Create SGP HTTP client**

```typescript
/**
 * SGP HTTP 客户端
 *
 * 封装对 Riot SGP API 的 HTTPS 请求。
 * 使用 axios，需要运行时注入 entitlements token（Bearer auth）。
 * 参考 LeagueAkari LeagueSgpApi 实现。
 */

import axios, { AxiosInstance } from 'axios'
import { resolveSgpBaseUrl, getSgpSubId } from './config'
import type { SgpMatchHistory } from './types'

export class SgpClient {
  static USER_AGENT = 'LeagueOfLegendsClient/14.13.596.7996 (rcp-be-lol-match-history)'
  static TIMEOUT = 12500

  private _baseUrl: string
  private _subId: string
  private _token: string | null = null
  private _http: AxiosInstance
  private _onTokenExpired: (() => Promise<string | null>) | null = null

  constructor(rsoPlatformId: string) {
    this._baseUrl = resolveSgpBaseUrl(rsoPlatformId)
    this._subId = getSgpSubId(rsoPlatformId)

    this._http = axios.create({
      headers: { 'User-Agent': SgpClient.USER_AGENT },
      timeout: SgpClient.TIMEOUT,
    })
  }

  get baseUrl(): string { return this._baseUrl }
  get hasToken(): boolean { return this._token !== null }

  setToken(token: string | null): void {
    this._token = token
  }

  /** 注册 token 过期回调 — 返回新 token 或 null（续期失败） */
  onTokenExpired(fn: () => Promise<string | null>): void {
    this._onTokenExpired = fn
  }

  /** 拉取对局历史（含完整详情，一次调用出列表+全部参与者数据） */
  async getMatchHistory(puuid: string, start: number, count: number): Promise<SgpMatchHistory> {
    if (!this._token) throw new Error('SGP token not set')

    return this._request<SgpMatchHistory>(() =>
      this._http.get<SgpMatchHistory>(
        `/match-history-query/v1/products/lol/player/${puuid}/SUMMARY`,
        {
          baseURL: this._baseUrl,
          headers: { Authorization: `Bearer ${this._token}` },
          params: { startIndex: start, count },
        }
      )
    )
  }

  /** 统一请求包装：401 自动续期重试 1 次 */
  private async _request<T>(fn: () => Promise<{ data: T; status: number }>): Promise<T> {
    try {
      const resp = await fn()
      return resp.data
    } catch (err: any) {
      const status = err?.response?.status || 0
      if (status === 401 && this._onTokenExpired) {
        const newToken = await this._onTokenExpired()
        if (newToken) {
          this._token = newToken
          const retryResp = await fn()
          return retryResp.data
        }
      }
      throw err
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd electron-app && npx tsc --noEmit 2>&1 | grep -i "sgp" || echo "no sgp errors"
```

- [ ] **Step 4: Commit**

```bash
git add electron-app/src/main/sgp/config.ts electron-app/src/main/sgp/client.ts
git commit -m "feat(sgp): add HTTP client and server config resolver"
```

---

### Task 4: PlayerStats Extension for SGP Fields

**Files:**
- Modify: `electron-app/src/shared/types/app.ts`

**Interfaces:**
- Consumes: Existing `PlayerStats` interface
- Produces: Extended `PlayerStats` with SGP-exclusive sub-structures (consumed by Task 5 extractor, existing UI)

- [ ] **Step 1: Add new sub-interfaces and extend PlayerStats**

In `app.ts`, add after the existing `PlayerStats` interface (before line 127's closing `}`):

```typescript
// 新增 — SGP 专属子结构，LCU 降级时字段为 0/null
export interface SpellCasts {
  q: number   // spell1Casts
  w: number   // spell2Casts
  e: number   // spell3Casts
  r: number   // spell4Casts
}

export interface SummonerCasts {
  d: number   // summoner1Casts
  f: number   // summoner2Casts
}

export interface Pings {
  all_in: number
  assist: number
  bait: number
  basic: number
  command: number
  danger: number
  enemy_missing: number
  enemy_vision: number
  get_back: number
  hold: number
  need_vision: number
  on_my_way: number
  push: number
  vision_cleared: number
}

export interface TeamContribution {
  damage_shielded: number           // totalDamageShieldedOnTeammates
  heals_on_teammates: number        // totalHealsOnTeammates
  objectives_stolen: number         // objectivesStolen
  objectives_stolen_assists: number // objectivesStolenAssists
}

export interface TimeBreakdown {
  total_time_dead: number  // totalTimeSpentDead
  time_played: number      // timePlayed
}
```

Then insert into the `PlayerStats` interface (before the closing `}` on line 127):

```typescript
  // ── SGP 独有字段（LCU 降级时为 0/null） ──
  spell_casts: SpellCasts
  summoner_casts: SummonerCasts
  pings: Pings
  team_contribution: TeamContribution
  time_breakdown: TimeBreakdown
  items_purchased: number
  consumables_purchased: number
  detector_wards_placed: number
  bounty_level: number
  champ_experience: number
```

- [ ] **Step 2: Update LCU extractor to fill new fields with defaults**

In `extractors.ts`'s `extractStatsFull()` function, add before the `return` statement (line 168):

```typescript
    // SGP 独有字段 — LCU 降级时填默认值
    spell_casts: { q: 0, w: 0, e: 0, r: 0 },
    summoner_casts: { d: 0, f: 0 },
    pings: {
      all_in: 0, assist: 0, bait: 0, basic: 0, command: 0,
      danger: 0, enemy_missing: 0, enemy_vision: 0, get_back: 0,
      hold: 0, need_vision: 0, on_my_way: 0, push: 0, vision_cleared: 0,
    },
    team_contribution: {
      damage_shielded: 0, heals_on_teammates: 0,
      objectives_stolen: 0, objectives_stolen_assists: 0,
    },
    time_breakdown: { total_time_dead: 0, time_played: 0 },
    items_purchased: 0,
    consumables_purchased: 0,
    detector_wards_placed: 0,
    bounty_level: 0,
    champ_experience: 0,
```

- [ ] **Step 3: Verify full type check passes**

```bash
cd electron-app && npx vue-tsc --noEmit 2>&1 | head -20
```

Expected: no new errors from app.ts changes.

- [ ] **Step 4: Commit**

```bash
git add electron-app/src/shared/types/app.ts electron-app/src/main/lcu/extractors/extractors.ts
git commit -m "feat(sgp): extend PlayerStats with SGP-exclusive fields (spell_casts, pings, team_contribution, time_breakdown)"
```

---

### Task 5: SGP Extractor — Raw → GameSummary + GameRecord

**Files:**
- Create: `electron-app/src/main/sgp/extractor.ts`

**Interfaces:**
- Consumes: `SgpGame`, `SgpParticipant` from Task 1; `GameSummary`, `GameRecord`, `PlayerStats`, `PlayerData`, `TeamData`, `CherrySubteamData` from `app.ts`
- Produces: `extractGameSummary()`, `extractGameRecord()`, `extractAllPlayerStats()` (used by Task 7 orchestrator, Task 8 entry point)

- [ ] **Step 1: Create the SGP extractor**

```typescript
/**
 * SGP 原始 JSON → 应用层类型提取器
 *
 * 纯函数，无副作用。直接从 SGP 响应提取到 GameSummary / GameRecord，
 * 不经过 LCU 中间格式。SGP 一次调用返回完整数据（列表+详情一体），
 * 因此一次提取产出摘要和详情两种类型。
 */
import type {
  GameSummary,
  GameRecord,
  PlayerStats,
  PlayerData,
  TeamData,
  TeamStats,
  ParticipantBrief,
  CherrySubteamData,
} from '@shared/types/app'
import type { SgpGame, SgpParticipant } from './types'

// ── 工具 ──

function safeInt(v: any): number {
  return typeof v === 'number' ? v : 0
}

// ── 符文集展平 ──

function flattenPerks(p: SgpParticipant): {
  primary_style: number
  sub_style: number
  perks: number[]
  perk_vars: Record<string, number[]>
} {
  let primaryStyle = 0
  let subStyle = 0
  const selections: { perk: number; var1: number; var2: number; var3: number }[] = []

  for (const style of p.perks.styles) {
    if (style.description === 'primaryStyle') primaryStyle = style.style
    else if (style.description === 'subStyle') subStyle = style.style
    for (const sel of style.selections) {
      selections.push(sel)
    }
  }

  const perks = selections.map(s => s.perk)
  // pad to 6
  while (perks.length < 6) perks.push(0)

  const perkVars: Record<string, number[]> = {}
  selections.forEach((s, i) => {
    perkVars[`perk${i}`] = [s.var1, s.var2, s.var3]
  })

  return { primary_style: primaryStyle, sub_style: subStyle, perks, perk_vars: perkVars }
}

// ── PlayerStats 提取（全 110 字段） ──

export function extractPlayerStats(p: SgpParticipant): PlayerStats {
  const kills = safeInt(p.kills)
  const deaths = safeInt(p.deaths)
  const assists = safeInt(p.assists)

  return {
    kills,
    deaths,
    assists,
    kda: Math.round(((kills + assists) / Math.max(deaths, 1)) * 100) / 100,
    kda_ratio: `${kills}/${deaths}/${assists}`,
    largest_multi_kill: safeInt(p.largestMultiKill),
    largest_killing_spree: safeInt(p.largestKillingSpree),
    killing_sprees: safeInt(p.killingSprees),
    double_kills: safeInt(p.doubleKills),
    triple_kills: safeInt(p.tripleKills),
    quadra_kills: safeInt(p.quadraKills),
    penta_kills: safeInt(p.pentaKills),
    unreal_kills: safeInt(p.unrealKills),
    damage: {
      total_to_champs: safeInt(p.totalDamageDealtToChampions),
      total_dealt: safeInt(p.totalDamageDealt),
      total_taken: safeInt(p.totalDamageTaken),
      physical_to_champs: safeInt(p.physicalDamageDealtToChampions),
      physical_dealt: safeInt(p.physicalDamageDealt),
      physical_taken: safeInt(p.physicalDamageTaken),
      magic_to_champs: safeInt(p.magicDamageDealtToChampions),
      magic_dealt: safeInt(p.magicDamageDealt),
      magic_taken: safeInt(p.magicDamageTaken),
      true_to_champs: safeInt(p.trueDamageDealtToChampions),
      true_dealt: safeInt(p.trueDamageDealt),
      true_taken: safeInt(p.trueDamageTaken),
      largest_critical_strike: safeInt(p.largestCriticalStrike),
    },
    economy: {
      gold_earned: safeInt(p.goldEarned),
      gold_spent: safeInt(p.goldSpent),
    },
    cs: {
      total: safeInt(p.totalMinionsKilled) + safeInt(p.neutralMinionsKilled),
      minions: safeInt(p.totalMinionsKilled),
      neutral_total: safeInt(p.neutralMinionsKilled),
      neutral_enemy_jungle: safeInt(p.totalEnemyJungleMinionsKilled),
      neutral_team_jungle: safeInt(p.totalAllyJungleMinionsKilled),
    },
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    runes: flattenPerks(p),
    vision: {
      score: safeInt(p.visionScore),
      wards_placed: safeInt(p.wardsPlaced),
      wards_killed: safeInt(p.wardsKilled),
      sight_wards_bought: safeInt(p.sightWardsBoughtInGame),
      vision_wards_bought: safeInt(p.visionWardsBoughtInGame),
    },
    objectives: {
      turret_kills: safeInt(p.turretKills),
      inhibitor_kills: safeInt(p.inhibitorKills),
      damage_to_turrets: safeInt(p.damageDealtToTurrets),
      damage_to_objectives: safeInt(p.damageDealtToObjectives),
    },
    cc: {
      time_cc_others: safeInt(p.timeCCingOthers),
      total_cc_dealt: safeInt(p.totalTimeCCDealt),
    },
    survival: {
      longest_time_living: safeInt(p.longestTimeSpentLiving),
      damage_self_mitigated: safeInt(p.damageSelfMitigated),
      total_heal: safeInt(p.totalHeal),
      total_units_healed: safeInt(p.totalUnitsHealed),
    },
    champ_level: safeInt(p.champLevel),
    firsts: {
      first_blood_kill: p.firstBloodKill ?? false,
      first_blood_assist: p.firstBloodAssist ?? false,
      first_tower_kill: p.firstTowerKill ?? false,
      first_tower_assist: p.firstTowerAssist ?? false,
      first_inhibitor_kill: false,  // SGP 无此字段
      first_inhibitor_assist: false,
    },
    summoner_spells: {
      spell1: p.spell1Id ?? null,
      spell2: p.spell2Id ?? null,
    },
    position: {
      individual_position: p.individualPosition || '',
      team_position: p.teamPosition || '',
      lane: p.lane || '',
    },
    surrender: {
      game_ended_in_surrender: p.gameEndedInSurrender ?? false,
      game_ended_in_early_surrender: p.gameEndedInEarlySurrender ?? false,
      game_ended_in_ignb_surrender: false,
      team_early_surrendered: p.teamEarlySurrendered ?? false,
      caused_early_surrender: false,
      caused_game_end_from_ignb_surrender: false,
      early_surrender_accomplice: false,
    },
    arena: {
      subteam_placement: safeInt(p.subteamPlacement),
      player_subteam_id: safeInt(p.playerSubteamId),
      player_augments: [
        p.playerAugment1, p.playerAugment2, p.playerAugment3,
        p.playerAugment4, p.playerAugment5, p.playerAugment6,
      ],
    },
    scores: {
      combat: 0,    // SGP missions 中有 PlayerScore0-11 但结构不同，暂不映射
      objective: 0,
      total: 0,
      rank: safeInt(p.placement),
      details: [],
    },
    role_bound_item: 0,
    was_severe_transgressor: false,
    win: p.win ?? false,

    // ── SGP 独有 ──
    spell_casts: {
      q: safeInt(p.spell1Casts),
      w: safeInt(p.spell2Casts),
      e: safeInt(p.spell3Casts),
      r: safeInt(p.spell4Casts),
    },
    summoner_casts: {
      d: safeInt(p.summoner1Casts),
      f: safeInt(p.summoner2Casts),
    },
    pings: {
      all_in: safeInt(p.allInPings),
      assist: safeInt(p.assistMePings),
      bait: safeInt(p.basicPings),              // 语义最近似
      basic: safeInt(p.basicPings),
      command: safeInt(p.commandPings),
      danger: safeInt(p.dangerPings),
      enemy_missing: safeInt(p.enemyMissingPings),
      enemy_vision: safeInt(p.enemyVisionPings),
      get_back: safeInt(p.getBackPings),
      hold: safeInt(p.holdPings),
      need_vision: safeInt(p.needVisionPings),
      on_my_way: safeInt(p.onMyWayPings),
      push: safeInt(p.pushPings),
      vision_cleared: safeInt(p.visionClearedPings),
    },
    team_contribution: {
      damage_shielded: safeInt(p.totalDamageShieldedOnTeammates),
      heals_on_teammates: safeInt(p.totalHealsOnTeammates),
      objectives_stolen: safeInt(p.objectivesStolen),
      objectives_stolen_assists: safeInt(p.objectivesStolenAssists),
    },
    time_breakdown: {
      total_time_dead: safeInt(p.totalTimeSpentDead),
      time_played: safeInt(p.timePlayed),
    },
    items_purchased: safeInt(p.itemsPurchased),
    consumables_purchased: safeInt(p.consumablesPurchased),
    detector_wards_placed: safeInt(p.detectorWardsPlaced),
    bounty_level: safeInt(p.bountyLevel),
    champ_experience: safeInt(p.champExperience),
  }
}

// ── PlayerData ──

export function extractPlayerData(p: SgpParticipant): PlayerData {
  return {
    puuid: p.puuid || '',
    summoner_name: p.summonerName || p.riotIdGameName
      ? `${p.riotIdGameName}#${p.riotIdTagline}`
      : '',
    profile_icon_id: safeInt(p.profileIcon),
    summoner_id: safeInt(p.summonerId),
    champion_id: safeInt(p.championId),
    stats: extractPlayerStats(p),
  }
}

// ── TeamData ──

export function extractTeamData(
  team: { teamId: number; win: boolean },
  players: PlayerData[],
  allParticipants: SgpParticipant[],
): TeamData {
  const firstBloodTeamId = allParticipants.find(p2 => p2.firstBloodKill)?.teamId
  return {
    team_id: team.teamId,
    win: team.win,
    bans: [],
    baron_kills: 0,
    dragon_kills: 0,
    rift_herald_kills: 0,
    vilemaw_kills: 0,
    horde_kills: 0,
    tower_kills: 0,
    inhibitor_kills: 0,
    first_blood: firstBloodTeamId === team.teamId,
    first_tower: false,  // 可从 participants firstTowerKill 推导，简化处理
    first_inhibitor: false,
    first_baron: false,
    first_dragon: false,
    players,
  }
}

// ── Cherry 子队 ──

export function extractCherrySubteams(participants: SgpParticipant[]): CherrySubteamData[] | undefined {
  const subteamMap = new Map<number, { placement: number; players: PlayerData[] }>()

  for (const p of participants) {
    const sid = safeInt(p.playerSubteamId)
    if (!sid) continue
    if (!subteamMap.has(sid)) {
      subteamMap.set(sid, { placement: safeInt(p.subteamPlacement), players: [] })
    }
    subteamMap.get(sid)!.players.push(extractPlayerData(p))
  }

  if (subteamMap.size === 0) return undefined

  return Array.from(subteamMap.entries())
    .sort(([, a], [, b]) => a.placement - b.placement)
    .map(([id, data]) => ({
      subteam_id: id,
      placement: data.placement,
      players: data.players,
    }))
}

// ── GameSummary ──

export function extractGameSummary(game: SgpGame, selfPuuid: string): GameSummary {
  const json = game.json
  const participants = json.participants

  const selfP = participants.find(p => p.puuid === selfPuuid) || participants[0]
  if (!selfP) throw new Error(`Player ${selfPuuid} not found in game ${json.gameId}`)

  const kills = safeInt(selfP.kills)
  const deaths = safeInt(selfP.deaths)
  const assists = safeInt(selfP.assists)

  // 队伍统计
  const teamIds = [...new Set(participants.map(p => p.teamId))].sort()
  const blueTeamId = teamIds[0] || 100
  const redTeamId = teamIds[1] || 200

  // Cherry team ID 修正 — SGP 有时返回特殊情况
  const isCherry = json.gameMode === 'CHERRY' || json.queueId === 1750

  function buildBrief(teamId: number): ParticipantBrief[] {
    return participants
      .filter(p => p.teamId === teamId)
      .map(p => ({
        participantId: p.participantId,
        puuid: p.puuid,
        gameName: p.riotIdGameName || '',
        tagLine: p.riotIdTagline || '',
        profileIconId: safeInt(p.profileIcon),
        summonerName: p.summonerName || p.riotIdGameName || '',
        championId: safeInt(p.championId),
        teamId: p.teamId,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      }))
  }

  let blueParticipants = buildBrief(blueTeamId)
  let redParticipants = buildBrief(redTeamId)

  // Cherry: 每边最多 5 人，包含用户子队
  if (isCherry) {
    const selfSubteamId = safeInt(selfP.playerSubteamId)
    if (selfSubteamId) {
      const subteamPids = new Set(
        participants
          .filter(p => safeInt(p.playerSubteamId) === selfSubteamId)
          .map(p => p.participantId)
      )
      const trim = (briefs: ParticipantBrief[]) => {
        if (briefs.length <= 5) return briefs
        const sub = briefs.filter(b => subteamPids.has(b.participantId))
        const rest = briefs.filter(b => !subteamPids.has(b.participantId))
        return [...sub, ...rest].slice(0, 5)
      }
      blueParticipants = trim(blueParticipants)
      redParticipants = trim(redParticipants)
    }
  }

  // 团队统计
  const selfTeamId = selfP.teamId
  const teamPlayers = participants.filter(p => p.teamId === selfTeamId)
  let teamKills = 0, teamDamage = 0, teamDamageTaken = 0, teamGold = 0
  let highestDamage = 0, highestDamageTaken = 0

  for (const p of teamPlayers) {
    teamKills += safeInt(p.kills)
    const dmg = safeInt(p.totalDamageDealtToChampions)
    const taken = safeInt(p.totalDamageTaken)
    const gold = safeInt(p.goldEarned)
    teamDamage += dmg
    teamDamageTaken += taken
    teamGold += gold
    if (dmg > highestDamage) highestDamage = dmg
    if (taken > highestDamageTaken) highestDamageTaken = taken
  }

  const playerDamage = safeInt(selfP.totalDamageDealtToChampions)
  const playerDamageTaken = safeInt(selfP.totalDamageTaken)
  const playerGold = safeInt(selfP.goldEarned)

  const teamStats: TeamStats = {
    killParticipation: teamKills > 0 ? Math.round((kills + assists) / teamKills * 100) : 0,
    damageShare: teamDamage > 0 ? Math.round(playerDamage / teamDamage * 100) : 0,
    damageTakenShare: teamDamageTaken > 0 ? Math.round(playerDamageTaken / teamDamageTaken * 100) : 0,
    goldShare: teamGold > 0 ? Math.round(playerGold / teamGold * 100) : 0,
    isHighestDamage: playerDamage > 0 && playerDamage === highestDamage,
    isHighestDamageTaken: playerDamageTaken > 0 && playerDamageTaken === highestDamageTaken,
  }

  return {
    gameId: json.gameId,
    gameMode: json.gameMode || '',
    gameType: json.gameType || '',
    queueId: json.queueId,
    mapId: json.mapId,
    gameCreation: json.gameCreation || 0,
    gameDuration: json.gameDuration || 0,
    gameVersion: json.gameVersion || '',
    championId: safeInt(selfP.championId),
    win: selfP.win ?? false,
    kills,
    deaths,
    assists,
    role: selfP.teamPosition || selfP.role || '',
    spell1Id: selfP.spell1Id || 0,
    spell2Id: selfP.spell2Id || 0,
    perkPrimaryStyle: flattenPerks(selfP).primary_style,
    perkSubStyle: flattenPerks(selfP).sub_style,
    perk0: flattenPerks(selfP).perks[0] || 0,
    items: [selfP.item0, selfP.item1, selfP.item2, selfP.item3, selfP.item4, selfP.item5, selfP.item6],
    champLevel: safeInt(selfP.champLevel),
    teamId: selfP.teamId,
    kdaRatio: Math.round(((kills + assists) / Math.max(deaths, 1)) * 100) / 100,
    blueParticipants,
    redParticipants,
    teamStats,
  }
}

// ── GameRecord ──

export function extractGameRecord(game: SgpGame): GameRecord {
  const json = game.json
  const participants = json.participants

  const teamIds = [...new Set(participants.map(p => p.teamId))].sort()
  const blueTeamId = teamIds[0] || 100
  const redTeamId = teamIds[1] || 200

  const bluePlayers = participants
    .filter(p => p.teamId === blueTeamId)
    .map(p => extractPlayerData(p))

  const redPlayers = participants
    .filter(p => p.teamId === redTeamId)
    .map(p => extractPlayerData(p))

  return {
    game_id: json.gameId,
    game_creation: new Date(json.gameCreation).toISOString(),
    game_duration_min: Math.round((json.gameDuration || 0) / 60),
    game_mode: json.gameMode || '',
    game_type: json.gameType || '',
    queue_id: json.queueId,
    map_id: json.mapId,
    game_version: json.gameVersion || '',
    blue_team: extractTeamData(
      { teamId: blueTeamId, win: bluePlayers[0]?.stats.win ?? false },
      bluePlayers,
      participants,
    ),
    red_team: extractTeamData(
      { teamId: redTeamId, win: redPlayers[0]?.stats.win ?? false },
      redPlayers,
      participants,
    ),
    champion_mastery: {},
    cherry_subteams: json.gameMode === 'CHERRY' || json.queueId === 1750
      ? extractCherrySubteams(participants)
      : undefined,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd electron-app && npx tsc --noEmit 2>&1 | grep -E "sgp/extractor|cannot find" || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add electron-app/src/main/sgp/extractor.ts
git commit -m "feat(sgp): add extractor — SGP raw JSON to GameSummary + GameRecord"
```

---

### Task 6: Entitlements Token Acquisition

**Files:**
- Modify: `electron-app/src/main/ipc/lcu-handlers.ts`

**Interfaces:**
- Consumes: Existing `findLolClient`, `LcuHttpClient`
- Produces: `getEntitlementsToken()` function (called by Task 7 orchestrator)

- [ ] **Step 1: Add entitlements token fetching to LCU handlers**

In `lcu-handlers.ts`, add a new IPC handler and export a standalone function:

```typescript
// At top of file, add:
import { findLolClient, LcuHttpClient } from '../lcu/client'

// After existing imports, add:
export async function fetchEntitlementsToken(): Promise<string | null> {
  try {
    const conn = await findLolClient()
    if (!conn) {
      console.warn('[SGP] No LCU connection — cannot fetch entitlements token')
      return null
    }

    const client = new LcuHttpClient(conn)
    const resp = await client.get<{ accessToken: string; token: string; subject: string }>(
      '/entitlements/v1/token'
    )
    const token = resp?.accessToken || ''
    if (token) {
      console.log('[SGP] entitlements token acquired')
    } else {
      console.warn('[SGP] entitlements token response had no accessToken field')
    }
    return token || null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[SGP] Failed to fetch entitlements token: ${msg}`)
    return null
  }
}
```

Then register the IPC handler inside `registerLcuHandlers()`:

```typescript
// Inside registerLcuHandlers(), add:
ipcMain.handle('sgp:entitlements-token', async (): Promise<string | null> => {
  return fetchEntitlementsToken()
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd electron-app && npx tsc --noEmit 2>&1 | grep -E "entitlements|sgp" || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add electron-app/src/main/ipc/lcu-handlers.ts
git commit -m "feat(sgp): add entitlements token acquisition from LCU"
```

---

### Task 7: SGP Manager (Orchestrator)

**Files:**
- Create: `electron-app/src/main/sgp/index.ts`

**Interfaces:**
- Consumes: `SgpClient` from Task 3; `extractGameSummary`, `extractGameRecord` from Task 5; `fetchEntitlementsToken` from Task 6
- Produces: `SgpManager` singleton (used by Task 8 entry point)

- [ ] **Step 1: Create SGP Manager**

```typescript
/**
 * SGP Manager — 单例，管理 SGP 通道的完整生命周期
 *
 * 职责:
 *   1. 获取并维护 entitlements token（含 401 自动续期）
 *   2. 判断 SGP 是否可用（token 是否就绪）
 *   3. 提供对局数据获取（一次调用出列表 + 详情）
 */
import { SgpClient } from './client'
import { fetchEntitlementsToken } from '../ipc/lcu-handlers'
import { extractGameSummary, extractGameRecord } from './extractor'
import type { GameSummary, GameRecord } from '@shared/types/app'
import type { SgpMatchHistory } from './types'

let _manager: SgpManager | null = null

export class SgpManager {
  private _client: SgpClient | null = null
  private _available: boolean = false

  static get instance(): SgpManager {
    if (!_manager) _manager = new SgpManager()
    return _manager
  }

  get available(): boolean { return this._available }

  /** 初始化：获取 token，创建 client */
  async init(rsoPlatformId: string): Promise<boolean> {
    const token = await fetchEntitlementsToken()
    if (!token) {
      console.warn('[SGP] init failed — no entitlements token, falling back to LCU')
      this._available = false
      return false
    }

    this._client = new SgpClient(rsoPlatformId)
    this._client.setToken(token)
    this._client.onTokenExpired(async () => {
      console.log('[SGP] token expired, attempting refresh...')
      const newToken = await fetchEntitlementsToken()
      if (!newToken) {
        console.warn('[SGP] token refresh failed, falling back to LCU')
        this._available = false
      }
      return newToken
    })
    this._available = true
    console.log('[SGP] initialized successfully')
    return true
  }

  /** 销毁：清空 token + 标记不可用 */
  destroy(): void {
    this._client?.setToken(null)
    this._client = null
    this._available = false
  }

  /**
   * 拉取对局列表（含完整详情）。
   * SGP 一次调用返回完整 Participants，因此同时产出 GameSummary[] 和 GameRecord[]。
   */
  async fetchGames(puuid: string, start: number, count: number): Promise<{
    summaries: GameSummary[]
    records: GameRecord[]
    raw: SgpMatchHistory
  }> {
    if (!this._client || !this._available) {
      throw new Error('SGP not available')
    }

    const raw = await this._client.getMatchHistory(puuid, start, count)

    const games = raw.games || []
    const summaries: GameSummary[] = []
    const records: GameRecord[] = []

    for (const game of games) {
      if (!game.json) continue  // metadata-only entry, skip
      try {
        summaries.push(extractGameSummary(game, puuid))
        records.push(extractGameRecord(game))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[SGP] Failed to extract game #${game.json?.gameId}: ${msg}`)
      }
    }

    return { summaries, records, raw }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd electron-app && npx tsc --noEmit 2>&1 | grep -E "sgp/index" || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add electron-app/src/main/sgp/index.ts
git commit -m "feat(sgp): add SgpManager orchestrator — token lifecycle + data fetching"
```

---

### Task 8: Match List Entry Point Switching

**Files:**
- Modify: `electron-app/src/main/lcu/extractors/match-list.ts`

**Interfaces:**
- Consumes: Existing `fetchMatchList`, `fetchMatchListForPlayer`; `SgpManager` from Task 7
- Produces: Modified entry points that prefer SGP, fall back to LCU

- [ ] **Step 1: Add SGP code path to fetchMatchList**

At the top of `match-list.ts`, add import:

```typescript
import { SgpManager } from '../../sgp'
```

Replace the `fetchMatchList` function body (lines 477-511) with:

```typescript
export async function fetchMatchList(
  client: LcuHttpClient,
  _page: number = 1,
  _pageSize: number = 20
): Promise<MatchListData> {
  const summoner = await client.getCurrentSummoner()
  const puuid = summoner.puuid

  const [ranked] = await Promise.all([
    client.getRankedStats(puuid),
  ])

  const summonerInfo: SummonerInfo = {
    puuid,
    name: summoner.displayName || '',
    level: summoner.summonerLevel || 0,
    region: client.region,
    platform: client.rsoPlatformId,
    profileIconId: summoner.profileIconId || 0,
  }

  // ── 尝试 SGP ──
  const sgp = SgpManager.instance
  if (sgp.available) {
    try {
      console.log('[LCU:MAIN] fetch-match-list: trying SGP...')
      const { summaries } = await sgp.fetchGames(puuid, 0, 200)
      console.log(`[LCU:MAIN] SGP fetch-match-list: ${summaries.length} 场`)

      const result: MatchListData = {
        summoner: summonerInfo,
        ranked: extractRankedData(ranked),
        totalGames: summaries.length,
        pageSize: 0,
        games: summaries,
      }

      try { saveGameSummaries(puuid, result.games) } catch { /* 降级 */ }
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[LCU:MAIN] SGP failed (${msg}), falling back to LCU`)
    }
  }

  // ── LCU fallback（现有逻辑） ──
  const { summaries, totalGames } = await fetchAllSummaries(client, puuid)

  console.log(
    `[LCU:MAIN] fetch-match-list: 分页完成 共 ${summaries.length} 场摘要 (API gameCount=${totalGames})`
  )

  const detailMap = await loadDetailMap(client, summaries.map(g => g.gameId), '详情补载')

  const result = buildMatchListData(summaries, detailMap, puuid, summonerInfo, extractRankedData(ranked), totalGames)
  console.log(`[LCU:MAIN] fetch-match-list: 最终 ${result.games.length} 场 (API gameCount=${totalGames})`)

  try { saveGameSummaries(puuid, result.games) } catch { /* 写入失败静默降级 */ }

  return result
}
```

- [ ] **Step 2: Update fetchMatchListForPlayer similarly**

Replace the function body (lines 513-594) with the same SGP-first pattern:

```typescript
export async function fetchMatchListForPlayer(
  client: LcuHttpClient,
  targetPuuid: string,
  summonerName: string,
  profileIconId: number,
  summonerLevel: number,
  _page: number = 1,
  _pageSize: number = 20
): Promise<MatchListData> {
  const [ranked] = await Promise.all([
    client.getRankedStats(targetPuuid),
  ])

  const summonerInfo: SummonerInfo = {
    puuid: targetPuuid,
    name: summonerName,
    level: summonerLevel,
    region: client.region,
    platform: client.rsoPlatformId,
    profileIconId,
  }

  // ── 尝试 SGP ──
  const sgp = SgpManager.instance
  if (sgp.available) {
    try {
      const { summaries } = await sgp.fetchGames(targetPuuid, 0, 200)
      console.log(`[LCU:MAIN] SGP fetchMatchListForPlayer ${summonerName}: ${summaries.length} 场`)

      const result: MatchListData = {
        summoner: summonerInfo,
        ranked: extractRankedData(ranked),
        totalGames: summaries.length,
        pageSize: 0,
        games: summaries,
      }

      try { saveGameSummaries(targetPuuid, result.games) } catch { /* 降级 */ }
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[LCU:MAIN] SGP for player ${summonerName} failed (${msg}), falling back to LCU`)
    }
  }

  // ── LCU fallback（现有逻辑，保持不变） ──
  // ... existing LCU code starts here, unchanged
```

Then keep ALL the existing LCU fallback code after the SGP block.

- [ ] **Step 3: Wire SGP init into the LCU connection lifecycle**

In `lcu-handlers.ts`, inside `registerLcuHandlers()`, add after the existing `lcu:check-connection` handler:

```typescript
// After LCU connection is established, try to init SGP
ipcMain.handle('sgp:init', async (_event, rsoPlatformId: string): Promise<boolean> => {
  const { SgpManager } = await import('../sgp')
  return SgpManager.instance.init(rsoPlatformId)
})

ipcMain.handle('sgp:destroy', async (): Promise<void> => {
  const { SgpManager } = await import('../sgp')
  SgpManager.instance.destroy()
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd electron-app && npx tsc --noEmit 2>&1 | grep -E "sgp|match-list" || echo "OK"
```

- [ ] **Step 5: Commit**

```bash
git add electron-app/src/main/lcu/extractors/match-list.ts electron-app/src/main/ipc/lcu-handlers.ts
git commit -m "feat(sgp): wire SGP as primary data source with LCU fallback"
```

---

### Task 9: Preload Bridge + Type Declarations

**Files:**
- Modify: `electron-app/src/preload/index.ts`
- Modify: `electron-app/src/renderer/src/env.d.ts`

**Interfaces:**
- Consumes: SGP IPC channels from Task 8
- Produces: `window.lcuApi.sgpInit()`, `window.lcuApi.sgpDestroy()` accessible from renderer

- [ ] **Step 1: Add preload bridge methods**

In `preload/index.ts`, add to the `api` object (before the closing `}`):

```typescript
  /** SGP: 初始化 SGP 通道（获取 entitlements token） */
  sgpInit(rsoPlatformId: string): Promise<boolean> {
    return ipcRenderer.invoke('sgp:init', rsoPlatformId)
  },

  /** SGP: 销毁 SGP 通道 */
  sgpDestroy(): Promise<void> {
    return ipcRenderer.invoke('sgp:destroy')
  },
```

- [ ] **Step 2: Update renderer type declarations**

In `env.d.ts`, add to the `LcuApi` interface:

```typescript
  sgpInit(rsoPlatformId: string): Promise<boolean>
  sgpDestroy(): Promise<void>
```

- [ ] **Step 3: Wire SGP init into app startup**

In `MatchList.vue`'s `onMounted` (or wherever the LCU connection is first established), add after fetching the summoner:

```typescript
// After LCU connection confirmed, init SGP
if (summoner) {
  const sgpOk = await window.lcuApi.sgpInit(summoner.platform || '')
  if (sgpOk) {
    console.log('[APP] SGP initialized — using SGP as primary data source')
  } else {
    console.log('[APP] SGP unavailable — using LCU fallback')
  }
}
```

Actually, looking more carefully at the code structure, the `initializeSession` function in `connection-service.ts` already handles LCU connection. The SGP init should be called after summoner info is available. Let's add it in `MatchList.vue`:

In `MatchList.vue` `<script setup>`, modify the `onMounted` block — after the `initializeSession` call where we update the tab:

```typescript
onMounted(async () => {
  tabStore.ensureDefaultTab()

  if (typeof window.lcuApi === 'undefined') return
  const conn = await window.lcuApi.checkConnection()
  const { connected, summoner } = await initializeSession(createSessionRepository(window.lcuApi))
  if (connected && summoner) {
    tabStore.updateDefaultTab(summoner.puuid, summonerDisplayName(summoner), summoner.profileIconId, summoner.summonerLevel)
    if (!gds.isLoaded) {
      await gds.fetchGameData()
    }
    // Init SGP in background — don't block UI.
    // rsoPlatformId comes from the LCU connection info (e.g. TENCENT_HN1).
    const platform = conn?.rsoPlatformId || ''
    if (platform) {
      window.lcuApi.sgpInit(platform).then(ok => {
        console.log(ok ? '[APP] SGP ready' : '[APP] SGP unavailable, using LCU')
      }).catch(() => {})
    }
  }
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd electron-app && npx vue-tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add electron-app/src/preload/index.ts electron-app/src/renderer/src/env.d.ts electron-app/src/renderer/src/views/MatchList.vue
git commit -m "feat(sgp): add preload bridge + wire SGP init into app startup"
```

---

### Task 10: Verify and Test

**Files:**
- No new files — manual verification steps

- [ ] **Step 1: Verify TypeScript full type check passes**

```bash
cd electron-app && npm run typecheck
```

Expected: all clear, no new errors.

- [ ] **Step 2: Verify dev build succeeds**

```bash
cd electron-app && npm run dev
```

Expected: Electron window opens, app loads normally.

- [ ] **Step 3: Verify SGP data flow manually**

1. Launch the app with LOL client running
2. Check dev console logs for `[SGP] entitlements token acquired` and `[SGP] initialized successfully`
3. If SGP init succeeds, the match list should load via SGP — verify the same games appear as before
4. Check console for `[LCU:MAIN] SGP fetch-match-list: N 场`
5. If SGP init fails (token error), verify `[LCU:MAIN] SGP failed... falling back to LCU` appears and games still load

- [ ] **Step 4: Verify LCU fallback**

1. Close the LOL client
2. Restart the app
3. Verify `[SGP] init failed — no entitlements token` appears
4. Verify match list loads via LCU fallback as before

- [ ] **Step 5: Verify new fields in DB**

After SGP loads games, check that `game_details` table stores the expanded JSON with `spell_casts` field:
```sql
-- In console or sql.js shell
SELECT json_extract(detail, '$.blue_team.players[0].stats.spell_casts') FROM game_details LIMIT 1;
```
Expected: returns `{"q":N,"w":N,"e":N,"r":N}` (not null).

- [ ] **Step 6: Commit if everything passes**

```bash
# No code changes to commit if all passes — just mark verification complete
```
```
