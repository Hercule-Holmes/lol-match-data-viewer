/**
 * 应用层 — 会话服务
 * 编排"初始化连接 + 获取当前召唤师"用例
 */

import type { LcuSummoner } from '@shared/types'
import type { SessionPort } from './ports'

export interface SessionInitResult {
  connected: boolean
  summoner: LcuSummoner | null
}

export async function initializeSession(api: SessionPort): Promise<SessionInitResult> {
  try {
    const conn = await api.checkConnection()
    if (!conn) return { connected: false, summoner: null }
    const summoner = await api.getCurrentSummoner()
    return { connected: true, summoner }
  } catch {
    return { connected: false, summoner: null }
  }
}
