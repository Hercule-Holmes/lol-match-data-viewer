import { getDbSafe, flushDb } from './database'
import type { GameSummary } from '@shared/types'
import type { Game } from '@shared/types/lcu-api'

export function saveGameSummaries(puuid: string, summaries: GameSummary[]): void {
  const db = getDbSafe()
  if (!db) return

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO games
      (game_id, puuid, game_mode, queue_id, champion_id, win, kills, deaths, assists, game_creation, game_duration, summary_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const g of summaries) {
    stmt.run([
      g.gameId,
      puuid,
      g.gameMode,
      g.queueId,
      g.championId,
      g.win ? 1 : 0,
      g.kills,
      g.deaths,
      g.assists,
      g.gameCreation,
      g.gameDuration,
      JSON.stringify(g),
    ])
  }
  stmt.free()

  db.run('INSERT OR REPLACE INTO summoners (puuid, last_updated) VALUES (?, ?)', [
    puuid, Date.now(),
  ])

  flushDb()
}

export function getRecentGameSummaries(puuid: string, limit: number): GameSummary[] {
  const db = getDbSafe()
  if (!db) return []

  const rows = db.exec(
    `SELECT summary_json FROM games WHERE puuid = ? ORDER BY game_creation DESC LIMIT ?`,
    [puuid, limit],
  )
  if (!rows.length) return []

  return rows[0].values.map(([json]: any) => JSON.parse(json as string) as GameSummary)
}

export function getGameSummaryCount(puuid: string): number {
  const db = getDbSafe()
  if (!db) return 0
  const rows = db.exec('SELECT COUNT(*) FROM games WHERE puuid = ?', [puuid])
  if (!rows.length) return 0
  return Number(rows[0].values[0][0])
}

/** 持久化单场对局详情（原始 LCU JSON） */
export function saveGameDetail(gameId: number, detail: Game): void {
  const db = getDbSafe()
  if (!db) return
  try {
    db.run('INSERT OR REPLACE INTO game_details (game_id, detail_json) VALUES (?, ?)', [
      gameId,
      JSON.stringify(detail),
    ])
    flushDb()
  } catch {
    // 写入失败静默降级——数据在内存缓存中，不影响当前显示
  }
}

/** 批量持久化对局详情 */
export function saveGameDetailsBatch(entries: Array<{ gameId: number; detail: Game }>): void {
  const db = getDbSafe()
  if (!db || entries.length === 0) return
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO game_details (game_id, detail_json) VALUES (?, ?)')
    for (const { gameId, detail } of entries) {
      stmt.run([gameId, JSON.stringify(detail)])
    }
    stmt.free()
    flushDb()
  } catch {
    // 写入失败静默降级
  }
}

/** 从 DB 读取单场对局详情（原始 LCU JSON），不存在返回 null */
export function getGameDetail(gameId: number): Game | null {
  const db = getDbSafe()
  if (!db) return null
  try {
    const rows = db.exec('SELECT detail_json FROM game_details WHERE game_id = ?', [gameId])
    if (!rows.length) return null
    const json = rows[0].values[0][0] as string
    return JSON.parse(json) as Game
  } catch {
    return null
  }
}

/** 批量从 DB 读取对局详情，返回 gameId → detail 映射 */
export function getGameDetailsBatch(gameIds: number[]): Map<number, Game> {
  const result = new Map<number, Game>()
  const db = getDbSafe()
  if (!db || gameIds.length === 0) return result
  try {
    const placeholders = gameIds.map(() => '?').join(',')
    const rows = db.exec(
      `SELECT game_id, detail_json FROM game_details WHERE game_id IN (${placeholders})`,
      gameIds,
    )
    if (rows.length) {
      for (const [id, json] of rows[0].values as any[]) {
        try {
          result.set(Number(id), JSON.parse(json as string) as Game)
        } catch { /* 跳过损坏的 JSON */ }
      }
    }
  } catch { /* DB 读取失败返回空 Map */ }
  return result
}

export function hasGameDetail(gameId: number): boolean {
  const db = getDbSafe()
  if (!db) return false
  const rows = db.exec('SELECT 1 FROM game_details WHERE game_id = ?', [gameId])
  return rows.length > 0
}

export interface DailyGameRow {
  game_id: number
  game_mode: string
  queue_id: number
  champion_id: number
  win: number
  kills: number
  deaths: number
  assists: number
  game_creation: number
  game_duration: number
}

/** 查询指定玩家某天的全部对局 */
export function getDailyGames(puuid: string, dateStr: string): DailyGameRow[] {
  const db = getDbSafe()
  if (!db) return []
  try {
    const rows = db.exec(
      `SELECT game_id, game_mode, queue_id, champion_id, win, kills, deaths, assists, game_creation, game_duration
       FROM games WHERE puuid = ?
       ORDER BY game_creation DESC`,
      [puuid]
    )
    if (!rows.length) return []
    const results: DailyGameRow[] = []
    for (const r of rows[0].values as any[]) {
      const d = new Date(r[8] as number)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (key === dateStr) {
        results.push({
          game_id: r[0], game_mode: r[1], queue_id: r[2], champion_id: r[3],
          win: r[4], kills: r[5], deaths: r[6], assists: r[7],
          game_creation: r[8], game_duration: r[9],
        })
      }
    }
    return results
  } catch { return [] }
}

/** 获取 DB 中有数据的最近日期列表 */
export function getRecentDates(puuid: string, limit: number = 14): string[] {
  const db = getDbSafe()
  if (!db) return []
  try {
    const rows = db.exec(
      `SELECT DISTINCT game_creation FROM games WHERE puuid = ? ORDER BY game_creation DESC LIMIT ?`,
      [puuid, limit * 20] // oversample since each game is a row
    )
    if (!rows.length) return []
    const dates = new Set<string>()
    for (const [ts] of rows[0].values as any[]) {
      const d = new Date(ts as number)
      dates.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
      if (dates.size >= limit) break
    }
    return [...dates]
  } catch { return [] }
}
