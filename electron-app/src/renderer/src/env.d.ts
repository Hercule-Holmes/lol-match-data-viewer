/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/** LCU API 桥接对象（由 preload 注入） */
interface LcuApi {
  log(level: 'log' | 'warn' | 'error', ...args: any[]): void
  checkConnection(): Promise<import('@shared/types').LcuConnectionInfo | null>
  fetchMatchList(page?: number, pageSize?: number): Promise<import('@shared/types').MatchListData>
  fetchGameDetails(gameIds: number[]): Promise<import('@shared/types').GameRecord[]>
  fetchMatches(gameCount?: number): Promise<import('@shared/types').MatchData>
  fetchGame(gameId: number): Promise<any>
  fetchGameData(): Promise<import('@shared/types').GameDataCache>
}

declare global {
  interface Window {
    lcuApi: LcuApi
  }
}

export {}
