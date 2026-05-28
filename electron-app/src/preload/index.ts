/**
 * Preload 脚本 —— 通过 contextBridge 向渲染进程暴露安全的 LCU API
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { LcuConnectionInfo, MatchData, MatchListData, GameRecord, GameDataCache } from '@shared/types'

const api = {
  /** 向主进程发送日志（渲染进程专用），主进程会写入日志文件 */
  log(level: 'log' | 'warn' | 'error', ...args: any[]): void {
    ipcRenderer.invoke('log:write', level, ...args)
  },

  /** 检查 LOL 客户端是否运行 */
  checkConnection(): Promise<LcuConnectionInfo | null> {
    console.log('[LCU:PRELOAD] checkConnection 调用')
    return ipcRenderer.invoke('lcu:check-connection')
  },

  /** 拉取对局列表（轻量，仅摘要，支持分页） */
  fetchMatchList(page = 1, pageSize = 20): Promise<MatchListData> {
    console.log(`[LCU:PRELOAD] fetchMatchList 调用: page=${page}, pageSize=${pageSize}`)
    return ipcRenderer.invoke('lcu:fetch-match-list', page, pageSize)
  },

  /** 批量拉取对局完整详情（并发，用于分析） */
  fetchGameDetails(gameIds: number[]): Promise<GameRecord[]> {
    return ipcRenderer.invoke('lcu:fetch-game-details', gameIds)
  },

  /** 拉取最近的 N 场对局完整数据（旧版，较重） */
  fetchMatches(gameCount = 10): Promise<MatchData> {
    return ipcRenderer.invoke('lcu:fetch-matches', gameCount)
  },

  /** 获取指定对局的原始详情 */
  fetchGame(gameId: number): Promise<any> {
    return ipcRenderer.invoke('lcu:fetch-game', gameId)
  },

  /** 拉取游戏基础数据（英雄、装备、技能、符文等，含 iconPath） */
  fetchGameData(): Promise<GameDataCache> {
    console.log('[LCU:PRELOAD] fetchGameData 调用')
    return ipcRenderer.invoke('lcu:fetch-game-data')
  },
}

contextBridge.exposeInMainWorld('lcuApi', api)
console.log('[LCU:PRELOAD] lcuApi 已暴露到 window')
