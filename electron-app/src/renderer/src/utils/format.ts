/** 格式化工具函数 */

/** 时间戳 → 相对时间文字，如 "10分钟前", "2小时前", "3天前" */
export function relativeTime(timestamp: number | string): string {
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp
  if (!ts || ts <= 0) return '-'
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return `${Math.floor(days / 30)}月前`
}

/** 秒数 → 游戏时长文字，如 "25分30秒" */
export function formatGameDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}分${sec.toString().padStart(2, '0')}秒`
}

/** 数值格式化：千位逗号分隔 */
export function formatNumber(n: number): string {
  return n.toLocaleString()
}
