/**
 * SGP 服务器地址解析
 *
 * 查找优先级:
 *   1. 内置 tencent-servers.json 精确匹配
 *   2. 动态拼域名 fallback — {zone}-sgp.lol.qq.com:21019
 *
 * Note: 另有 k8s 域名模式 {zone}-k8s-sgp.lol.qq.com:21019 可作为第三级 fallback，
 *       待确认该模式可用后，将下方注释中的 URL 加入返回值列表。
 *
 * 注意: electron-vite 将所有主进程代码打包为 out/main/index.js，保留目录结构。
 *       因此运行时不能使用 fs.readFileSync + __dirname 读取 JSON —
 *       改用静态 import，让 bundler 在构建时将 JSON 数据内联进 bundle。
 */

import builtinServers from './tencent-servers.json'

const SERVERS = builtinServers.servers as Record<string, { matchHistory?: string | null; common?: string | null }>

/** 根据 rsoPlatformId（如 TENCENT_HN1）解析 SGP 服务器地址 */
export function resolveSgpBaseUrl(rsoPlatformId: string): string {
  const serverId = rsoPlatformId.toUpperCase()
  const entry = SERVERS[serverId]
  if (entry?.matchHistory) {
    return entry.matchHistory
  }

  // 动态拼域名 fallback
  const zone = serverId.replace('TENCENT_', '').toLowerCase()
  return `https://${zone}-sgp.lol.qq.com:21019`
}

/** 从 rsoPlatformId 提取子 ID（去掉 TENCENT_ 前缀） */
export function getSgpSubId(rsoPlatformId: string): string {
  if (rsoPlatformId.toUpperCase().startsWith('TENCENT_')) {
    return rsoPlatformId.split('_')[1]
  }
  return rsoPlatformId
}
