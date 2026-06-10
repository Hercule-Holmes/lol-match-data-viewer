/**
 * LCU 并发控制 — 公共常量与分批工具
 * 实测 LCU localhost 200 并发可能触发 ECONNREFUSED，60 安全，取保守值 30
 */

export const DETAIL_CONCUR = 30

export async function batchAsync<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = await Promise.all(items.slice(i, i + concurrency).map(fn))
    results.push(...batch)
  }
  return results
}
