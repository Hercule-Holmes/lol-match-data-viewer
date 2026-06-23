<template>
  <div class="daily-summary-overlay" @click.self="$emit('close')">
    <div class="poster-card">
      <!-- 加载态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner" />
        <span>加载中...</span>
      </div>

      <!-- 顶部装饰 -->
      <template v-else>
      <div class="poster-header">
        <div class="header-glow" />
        <div class="header-line left" />
        <div class="header-diamond">✦</div>
        <div class="header-line right" />
        <h1 class="header-title">昨日战绩总结</h1>
        <p class="header-date">{{ dateText }}</p>
      </div>

      <!-- 三大数字卡片 -->
      <div class="stat-trio">
        <div class="stat-card">
          <div class="stat-number">{{ totalGames }}</div>
          <div class="stat-label">总局数</div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-number">{{ winRate }}<span class="unit">%</span></div>
          <div class="stat-label">胜率</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ formattedDuration }}</div>
          <div class="stat-label">总时长</div>
        </div>
      </div>

      <!-- 英雄表现 -->
      <div class="section">
        <div class="section-title">
          <span class="title-icon">🏆</span> 英雄表现
        </div>
        <div class="champion-list">
          <div
            v-for="c in topChampions"
            :key="c.championId"
            class="champ-row"
          >
            <ChampionIcon
              class="champ-avatar"
              :champion-id="c.championId"
              :size="36"
              round
            />
            <div class="champ-info">
              <div class="champ-name">{{ c.name }}</div>
              <div class="champ-sub">
                {{ c.games }} 场 · KDA {{ c.avgKills }}/{{ c.avgDeaths }}/{{ c.avgAssists }}
              </div>
            </div>
            <div class="champ-bar-wrap">
              <div class="champ-bar">
                <div
                  class="champ-bar-fill"
                  :class="c.winRate >= 50 ? 'win' : 'lose'"
                  :style="{ width: c.barPct + '%' }"
                />
              </div>
            </div>
            <div class="champ-winrate" :class="c.winRate >= 50 ? 'win' : 'lose'">
              {{ c.winRate }}%
            </div>
          </div>
        </div>
      </div>

      <!-- 高光时刻 -->
      <div class="section">
        <div class="section-title">
          <span class="title-icon">⚡</span> 高光时刻
        </div>
        <div class="highlights">
          <div
            v-for="h in highlights"
            :key="h.type"
            class="highlight-row"
          >
            <span class="highlight-icon">{{ h.icon }}</span>
            <span class="highlight-desc">{{ h.description }}</span>
          </div>
        </div>
      </div>

      <!-- 模式分布 -->
      <div class="section">
        <div class="section-title">
          <span class="title-icon">🎮</span> 模式分布
        </div>
        <div class="mode-list">
          <div
            v-for="m in modeStats"
            :key="m.mode"
            class="mode-row"
          >
            <span class="mode-name">{{ m.mode }}</span>
            <div class="mode-bar-wrap">
              <div class="mode-bar">
                <div
                  class="mode-bar-fill"
                  :style="{ width: m.pct + '%' }"
                />
              </div>
            </div>
            <span class="mode-stat">{{ m.games }}场</span>
            <span class="mode-stat" :class="m.winRate >= 50 ? 'win' : 'lose'">{{ m.winRate }}%</span>
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="poster-footer">
        <span class="footer-brand">LOL Match Data Viewer</span>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import { useGameDataStore } from '@/stores/game-data'

const props = defineProps<{ puuid: string }>()
defineEmits<{ close: [] }>()

const gds = useGameDataStore()

const loading = ref(true)
const dateText = ref('')
const totalGames = ref(0)
const wins = ref(0)
const winRate = ref(0)
const totalDurationSec = ref(0)
const topChampions = ref<any[]>([])
const highlights = ref<any[]>([])
const modeStats = ref<any[]>([])

const formattedDuration = computed(() => {
  const h = Math.floor(totalDurationSec.value / 3600)
  const m = Math.floor((totalDurationSec.value % 3600) / 60)
  return `${h}h${m}m`
})

onMounted(async () => {
  if (!window.lcuApi?.getDailyGames || !props.puuid) {
    loading.value = false
    return
  }

  try {
    // 找到最近的非今天日期
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const dates = await window.lcuApi.getRecentDates(props.puuid, 7)
    const target = dates.find(d => d !== todayStr) || dates[0]
    if (!target) { loading.value = false; return }

    const dow = ['日','一','二','三','四','五','六'][new Date(target + 'T00:00:00').getDay()]
    const parts = target.split('-')
    dateText.value = `${parseInt(parts[1])}月${parseInt(parts[2])}日 周${dow}`

    // 拉取该日对局
    const games = await window.lcuApi.getDailyGames(props.puuid, target)
    if (!games.length) { loading.value = false; return }

    totalGames.value = games.length
    const w = games.filter((g: any) => g.win).length
    wins.value = w
    winRate.value = Math.round(w / games.length * 100)
    totalDurationSec.value = games.reduce((s: number, g: any) => s + (g.game_duration || 0), 0)

    // 英雄统计
    const champMap = new Map<number, { games: number; wins: number; kills: number; deaths: number; assists: number }>()
    for (const g of games) {
      const cid = g.champion_id
      if (!champMap.has(cid)) champMap.set(cid, { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 })
      const c = champMap.get(cid)!
      c.games++; if (g.win) c.wins++; c.kills += g.kills; c.deaths += g.deaths; c.assists += g.assists
    }
    const sorted = [...champMap.entries()].sort((a, b) => b[1].games - a[1].games).slice(0, 8)
    const maxGames = sorted[0]?.[1].games || 1
    topChampions.value = sorted.map(([cid, c]) => ({
      championId: cid,
      name: gds.champions[cid]?.name || `英雄${cid}`,
      games: c.games,
      wins: c.wins,
      avgKills: +(c.kills / c.games).toFixed(1),
      avgDeaths: +(c.deaths / c.games).toFixed(1),
      avgAssists: +(c.assists / c.games).toFixed(1),
      winRate: Math.round(c.wins / c.games * 100),
      barPct: Math.round(c.games / maxGames * 100),
    }))

    // 高光时刻
    const hl: any[] = []
    let bestKdaGame: any = null, bestKdaVal = 0
    let mostKillsGame: any = null, mostKillsVal = 0
    for (const g of games) {
      const kdaVal = (g.kills + g.assists) / Math.max(g.deaths, 1)
      if (kdaVal > bestKdaVal) { bestKdaVal = kdaVal; bestKdaGame = g }
      if (g.kills > mostKillsVal) { mostKillsVal = g.kills; mostKillsGame = g }
    }
    if (bestKdaGame) {
      const name = gds.champions[bestKdaGame.champion_id]?.name || '?'
      hl.push({ icon: '🏆', description: `最高 KDA ${bestKdaVal.toFixed(1)} — ${name} ${bestKdaGame.kills}/${bestKdaGame.deaths}/${bestKdaGame.assists}` })
    }
    if (mostKillsGame && mostKillsGame.champion_id !== bestKdaGame?.champion_id) {
      const name = gds.champions[mostKillsGame.champion_id]?.name || '?'
      hl.push({ icon: '⚔️', description: `最多击杀 ${mostKillsVal} — ${name}` })
    }
    const perfects = games.filter((g: any) => g.deaths === 0 && g.kills > 0)
    for (const p of perfects) {
      const name = gds.champions[p.champion_id]?.name || '?'
      hl.push({ icon: '⭐', description: `完美 KDA — ${name} ${p.kills}/${p.deaths}/${p.assists}` })
    }
    highlights.value = hl.slice(0, 3)

    // 模式分布
    const modeMap = new Map<string, { games: number; wins: number; mode: string }>()
    const MODE_LABELS: Record<string, string> = {
      KIWI: '海克斯大乱斗', CHERRY: '斗魂竞技场', CLASSIC: '经典模式', ARAM: '极地大乱斗',
      PRACTICETOOL: '训练模式', URF: '无限火力', NEXUSBLITZ: '极限闪击', ULTBOOK: '终极魔典',
    }
    for (const g of games) {
      const key = g.game_mode
      if (!modeMap.has(key)) modeMap.set(key, { games: 0, wins: 0, mode: key })
      const m = modeMap.get(key)!
      m.games++; if (g.win) m.wins++
    }
    const totalG = games.length
    modeStats.value = [...modeMap.values()].map(m => ({
      mode: MODE_LABELS[m.mode] || m.mode,
      games: m.games,
      wins: m.wins,
      winRate: Math.round(m.wins / m.games * 100),
      pct: Math.round(m.games / totalG * 100),
    }))
  } catch {
    // 静默降级
  } finally {
    loading.value = false
  }
})
</script>

<style lang="less" scoped>
/* ═══ 加载态 ═══ */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: rgba(200,214,229,0.5);
  font-size: 13px;
  .loading-spinner {
    width: 28px; height: 28px;
    border: 2px solid rgba(255,255,255,0.08);
    border-top-color: #0ac8e8;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ═══ 覆盖层 — 暗色遮罩 ═══ */
.daily-summary-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(6px);
  animation: overlayIn 0.25s ease;
}
@keyframes overlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ═══ 海报卡片 ═══ */
.poster-card {
  width: 460px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 16px;
  padding: 32px 28px 24px;
  background: linear-gradient(170deg, #0d1421 0%, #111b2e 40%, #0f1726 100%);
  border: 1px solid rgba(10, 200, 232, 0.12);
  box-shadow:
    0 0 60px rgba(10, 200, 232, 0.06),
    0 8px 40px rgba(0, 0, 0, 0.5);
  color: #c8d6e5;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  animation: cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
}
@keyframes cardIn {
  from { opacity: 0; transform: scale(0.92) translateY(24px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* ═══ 顶部装饰 ═══ */
.poster-header {
  text-align: center;
  margin-bottom: 24px;
  position: relative;

  .header-glow {
    position: absolute;
    top: -48px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 80px;
    background: radial-gradient(ellipse, rgba(10,200,232,0.10) 0%, transparent 70%);
    pointer-events: none;
  }
  .header-line {
    position: absolute;
    top: 50%;
    height: 1px;
    width: 80px;
    background: linear-gradient(90deg, transparent, rgba(10,200,232,0.35), transparent);
    &.left  { left: 16px; }
    &.right { right: 16px; }
  }
  .header-diamond {
    color: rgba(200, 170, 110, 0.7);
    font-size: 14px;
  }
  .header-title {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 4px;
    margin: 4px 0;
    background: linear-gradient(135deg, #c8aa6e 0%, #e8d5a3 40%, #c8aa6e 70%, #a08050 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header-date {
    font-size: 13px;
    color: rgba(200, 214, 229, 0.55);
    margin: 0;
  }
}

/* ═══ 三数字卡片 ═══ */
.stat-trio {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;

  .stat-card {
    flex: 1;
    text-align: center;
    padding: 16px 8px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);

    .stat-number {
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #e8edf3;
      .unit { font-size: 18px; font-weight: 600; }
    }
    .stat-label {
      font-size: 11px;
      color: rgba(200,214,229,0.45);
      margin-top: 2px;
      letter-spacing: 1px;
    }
    &.highlight .stat-number {
      background: linear-gradient(135deg, #c8aa6e, #f0d88a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }
}

/* ═══ 分区 ═══ */
.section {
  margin-bottom: 20px;

  .section-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(200, 214, 229, 0.7);
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    .title-icon { margin-right: 4px; }
  }
}

/* ═══ 英雄列表 ═══ */
.champion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .champ-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.03);

    .champ-avatar {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }
    .champ-info {
      width: 120px;
      flex-shrink: 0;
      .champ-name {
        font-size: 14px;
        font-weight: 600;
        color: #d8e2f0;
      }
      .champ-sub {
        font-size: 11px;
        color: rgba(200,214,229,0.4);
      }
    }
    .champ-bar-wrap {
      flex: 1;
      min-width: 0;
      .champ-bar {
        height: 4px;
        border-radius: 2px;
        background: rgba(255,255,255,0.06);
        .champ-bar-fill {
          height: 100%;
          border-radius: 2px;
          &.win  { background: linear-gradient(90deg, #0ac8e8, #00c3a0); }
          &.lose { background: linear-gradient(90deg, #e84057, #ff6b6b); }
        }
      }
    }
    .champ-winrate {
      width: 40px;
      text-align: right;
      font-size: 14px;
      font-weight: 700;
      &.win  { color: #00c3a0; }
      &.lose { color: #e84057; }
    }
  }
}

/* ═══ 高光时刻 ═══ */
.highlights {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .highlight-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);

    .highlight-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
    .highlight-desc {
      font-size: 13px;
      color: #b0bec5;
    }
  }
}

/* ═══ 模式分布 ═══ */
.mode-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .mode-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;

    .mode-name {
      width: 72px;
      flex-shrink: 0;
      color: rgba(200,214,229,0.7);
    }
    .mode-bar-wrap {
      flex: 1;
      .mode-bar {
        height: 6px;
        border-radius: 3px;
        background: rgba(255,255,255,0.06);
        .mode-bar-fill {
          height: 100%;
          border-radius: 3px;
          background: linear-gradient(90deg, #0ac8e8, #5b8def);
        }
      }
    }
    .mode-stat {
      width: 36px;
      text-align: right;
      color: rgba(200,214,229,0.5);
      &.win  { color: #00c3a0; }
      &.lose { color: #e84057; }
    }
  }
}

/* ═══ 底部 ═══ */
.poster-footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid rgba(255,255,255,0.04);

  .footer-brand {
    font-size: 10px;
    letter-spacing: 2px;
    color: rgba(200,214,229,0.2);
  }
}
</style>
