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

/**
 * 根据 rsoPlatformId 解析 SGP 服务器地址。
 *
 * rsoPlatformId 来自 LCU 命令行 `--rso_platform_id=HN1`，不包含 `TENCENT_` 前缀。
 * JSON 配置文件中使用 `TENCENT_HN1` 格式的完整 key（兼容 LeagueAkari 格式），
 * 因此查找时需同时尝试带前缀和不带前缀的 key。
 */
export function resolveSgpBaseUrl(rsoPlatformId: string): string {
  const raw = rsoPlatformId.toUpperCase()
  // rsoPlatformId 实际为 "HN1" 不带 TENCENT_ 前缀，
  // JSON key 为 "TENCENT_HN1" 格式，两者都尝试
  const tencentKey = raw.startsWith('TENCENT_') ? raw : `TENCENT_${raw}`
  const entry = SERVERS[tencentKey] || SERVERS[raw]
  if (entry?.matchHistory) {
    return entry.matchHistory
  }

  // 动态 fallback: k8s 优先（国服生产环境），非 k8s 兜底
  const zone = tencentKey.replace('TENCENT_', '').toLowerCase()
  return `https://${zone}-k8s-sgp.lol.qq.com:21019`
}

/** 从 rsoPlatformId 提取子 ID，去掉可能存在的 TENCENT_ 前缀 */
export function getSgpSubId(rsoPlatformId: string): string {
  const upper = rsoPlatformId.toUpperCase()
  if (upper.startsWith('TENCENT_')) {
    return upper.split('_')[1]
  }
  return upper
}
