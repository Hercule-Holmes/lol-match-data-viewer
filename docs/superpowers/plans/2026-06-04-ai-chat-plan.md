# AI Chat Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conversational AI chat panel below the ranking table in AnalysisView, using DeepSeek API for multi-turn Q&A about match data.

**Architecture:** ChatPanel.vue (UI component) calls `window.lcuApi.chatWithAI()` which bridges via IPC to `llm.ts` (DeepSeek client). Game data is formatted by `format-for-ai.ts` (pure function) and injected as system prompt. API key has a hardcoded default with optional user override in settings.

**Tech Stack:** Vue 3 Composition API, Naive UI, Electron IPC, DeepSeek API (`deepseek-chat` model), TypeScript

---

### Task 1: Create `format-for-ai.ts` — Game Data Text Formatter

**Files:**
- Create: `src/shared/utils/format-for-ai.ts`

- [ ] **Step 1: Write the file**

```typescript
/**
 * 将对局数据格式化为 AI 可读的结构化文本
 * 纯函数，包含原始字段 + 所有模式指标的高阶聚合
 */
import type { GameRecord, GameDataCache, PlayerStats } from '@shared/types/app'
import { getModeAnalysisConfig, type MetricDef } from '@shared/utils/mode-analysis-config'
import { getQueueName } from '@shared/utils/mappings'

/** 格式化单局对局 */
function formatGame(game: GameRecord, gds: GameDataCache, index: number): string {
  const date = new Date(game.game_creation).toLocaleDateString('zh-CN')
  const dur = `${game.game_duration_min.toFixed(0)}min`
  const lines: string[] = []

  lines.push(`## 对局 #${index + 1} — ${date} · ${dur} · ${gds.queues[game.queue_id]?.shortName || game.game_mode}`)

  const teamLabel = (side: string, win: boolean) => `${side}${win ? ' ✓胜' : ''}`

  // 蓝方
  lines.push(`### ${teamLabel('蓝方', game.blue_team.win)}`)
  for (const p of game.blue_team.players) {
    lines.push(formatPlayer(p, gds))
  }

  // 红方
  lines.push(`### ${teamLabel('红方', game.red_team.win)}`)
  for (const p of game.red_team.players) {
    lines.push(formatPlayer(p, gds))
  }

  return lines.join('\n')
}

/** 格式化单个玩家 */
function formatPlayer(p: { summoner_name: string; champion_id: number; stats: PlayerStats }, gds: GameDataCache): string {
  const s = p.stats
  const champ = gds.champions[p.champion_id]?.name || `英雄#${p.champion_id}`
  const kda = s.deaths > 0 ? ((s.kills + s.assists) / s.deaths).toFixed(2) : s.kills + s.assists

  const items = s.items
    .filter(id => id > 0)
    .map(id => gds.items[id]?.name || id)
    .join(', ')

  const augments = s.arena.player_augments
    .filter(id => id > 0)
    .map(id => gds.augments[id]?.nameTRA || `海克斯#${id}`)
    .join(', ')

  const spells = [s.summoner_spells.spell1, s.summoner_spells.spell2]
    .filter(Boolean)
    .map(id => gds.summonerSpells[id!]?.name || id)
    .join('/')

  const parts = [
    `${p.summoner_name}（${champ}）`,
    `K ${s.kills}/${s.deaths}/${s.assists}（KDA ${kda}）`,
    `伤害 ${s.damage.total_to_champs}（物${s.damage.physical_to_champs}/魔${s.damage.magic_to_champs}/真${s.damage.true_to_champs}）`,
    `经济 ${s.economy.gold_earned}`,
    `补刀 ${s.cs.total}（兵${s.cs.minions}/野${s.cs.neutral_total}）`,
    `视野 ${s.vision.score}`,
    `承伤 ${s.damage.total_taken}`,
    `CC ${s.cc.total_cc_dealt}s`,
    `治疗 ${s.survival.total_heal}`,
    `等级 ${s.champ_level}`,
    `召唤师技能 ${spells}`,
    `装备: ${items}`,
  ]

  if (augments) parts.push(`海克斯: ${augments}`)

  return `- ${parts.join(' | ')}`
}

/** 计算并格式化模式指标排名 */
function formatMetricRanking(
  games: GameRecord[],
  gds: GameDataCache,
  mode: string,
): string {
  const cfg = getModeAnalysisConfig(mode)
  const allMetrics = [...cfg.basicMetrics, ...cfg.advancedMetrics]
  if (allMetrics.length === 0) return ''

  // 聚合所有玩家
  const playerMap = new Map<string, {
    profileIconId: number
    gameCount: number
    winCount: number
    metrics: Record<string, number>
  }>()

  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      const name = p.summoner_name
      if (!playerMap.has(name)) {
        playerMap.set(name, {
          profileIconId: p.profile_icon_id,
          gameCount: 0,
          winCount: 0,
          metrics: {},
        })
      }
      const agg = playerMap.get(name)!
      agg.gameCount++
      if (p.stats.win) agg.winCount++
      for (const m of allMetrics) {
        agg.metrics[m.key] = (agg.metrics[m.key] || 0) + m.getter(p.stats)
      }
    }
  }

  const lines: string[] = ['\n## 高阶聚合指标\n']

  for (const m of allMetrics) {
    const ranking = Array.from(playerMap.entries())
      .map(([name, agg]) => ({
        name,
        total: agg.metrics[m.key] || 0,
        count: agg.gameCount,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    lines.push(`### ${m.label} TOP 5`)
    for (let i = 0; i < ranking.length; i++) {
      const r = ranking[i]
      lines.push(`${i + 1}. ${r.name} — ${m.fmt(r.total)}（${r.count}局）`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** 检测 games 中的多数模式 */
function detectMode(games: GameRecord[]): string {
  const modes = new Map<string, number>()
  for (const g of games) {
    modes.set(g.game_mode, (modes.get(g.game_mode) || 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [mode, count] of modes) {
    if (count > bestCount) { bestCount = count; best = mode }
  }
  return best
}

/**
 * 将对局数据格式化为 AI system prompt 文本
 * @param games 选中的对局记录
 * @param gds 游戏数据缓存（英雄名、装备名等）
 * @returns 格式化的 AI 可读文本
 */
export function formatGamesForAI(games: GameRecord[], gds: GameDataCache): string {
  if (!games || games.length === 0) return '（无对局数据）'

  const mode = detectMode(games)
  const modeName = getModeAnalysisConfig(mode).displayName || mode
  const playerNames = new Set<string>()
  for (const g of games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      playerNames.add(p.summoner_name)
    }
  }

  const lines: string[] = [
    `## 对局数据摘要`,
    `模式：${modeName} · 共 ${games.length} 场 · ${playerNames.size} 位玩家`,
    '',
  ]

  // 逐场详情
  for (let i = 0; i < games.length; i++) {
    lines.push(formatGame(games[i], gds, i))
    lines.push('')
  }

  // 高阶聚合指标
  lines.push(formatMetricRanking(games, gds, mode))

  return lines.join('\n')
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx vue-tsc --noEmit src/shared/utils/format-for-ai.ts 2>&1 | head -20
```

Expected: No errors related to this file.

---

### Task 2: Update `settings.ts` — Add deepseekApiKey

**Files:**
- Modify: `src/main/utils/settings.ts`

- [ ] **Step 1: Add deepseekApiKey to UserSettings interface**

```typescript
// In settings.ts, update the interface:
interface UserSettings {
  autoUpdate: boolean
  deepseekApiKey?: string  // 用户自定义 API Key，可选，留空使用默认
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd electron-app && npx vue-tsc --noEmit 2>&1 | tail -5
```

Expected: No new errors.

---

### Task 3: Create `llm.ts` — DeepSeek API Client

**Files:**
- Create: `src/main/utils/llm.ts`

- [ ] **Step 1: Write the file**

```typescript
/**
 * DeepSeek API 客户端（chat completions）
 * 默认 Key 硬编码用于 beta 测试，用户可通过设置覆盖
 */
import axios from 'axios'
import { getSettings } from './settings'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

/** 默认 API Key（beta 测试用，release 后所有用户可用） */
const DEFAULT_API_KEY = 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'  // TODO: replace with actual key

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 获取 API Key：优先用户自定义，fallback 默认 */
function getApiKey(): string {
  const settings = getSettings()
  return settings.deepseekApiKey || DEFAULT_API_KEY
}

/**
 * 发送多轮对话请求到 DeepSeek
 * @param messages 完整的消息历史（含 system + user + assistant）
 * @returns AI 回复文本
 */
export async function chatWithLLM(messages: ChatMessage[]): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'API Key 未配置。请在设置中配置 DeepSeek API Key，' +
      '或前往 https://platform.deepseek.com/api_keys 获取'
    )
  }

  const resp = await axios.post(
    `${DEEPSEEK_BASE_URL}/v1/chat/completions`,
    {
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 120000, // 2 min timeout
    }
  )

  const choice = resp.data?.choices?.[0]
  if (!choice?.message?.content) {
    throw new Error(`DeepSeek API 返回异常: ${JSON.stringify(resp.data)}`)
  }

  return choice.message.content
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd electron-app && npx vue-tsc --noEmit src/main/utils/llm.ts 2>&1 | tail -5
```

---

### Task 4: Add `llm:chat` IPC Handler in Main Process

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add import and handler**

Add at the top of `src/main/index.ts` (after existing imports):

```typescript
import { chatWithLLM } from './utils/llm'
```

Add the IPC handler before the `// 设置相关 handler` section:

```typescript
// LLM 对话 handler
ipcMain.handle('llm:chat', async (_event, messages: Array<{ role: string; content: string }>) => {
  console.log(`[LLM:MAIN] llm:chat 收到请求: ${messages.length} 条消息, 最后一条长度=${messages[messages.length - 1]?.content?.length || 0}`)
  try {
    const reply = await chatWithLLM(messages as any)
    console.log(`[LLM:MAIN] llm:chat 成功: 回复长度=${reply.length}`)
    return { status: 'success', content: reply }
  } catch (err: any) {
    console.error(`[LLM:MAIN] llm:chat 失败: ${err.message}`)
    return { status: 'error', message: err.message || String(err) }
  }
})
```

- [ ] **Step 2: Run dev to verify no import errors**

```bash
cd electron-app && npx electron-vite dev 2>&1 &
```

Expected: Main process starts without errors.

---

### Task 5: Add `chatWithAI` to Preload Bridge

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add bridge method**

Add inside the `api` object, after the `openExternal` method:

```typescript
/** AI 对话（DeepSeek API） */
chatWithAI(messages: Array<{ role: string; content: string }>): Promise<{ status: string; content?: string; message?: string }> {
  return ipcRenderer.invoke('llm:chat', messages)
},
```

- [ ] **Step 2: Verify syntax**

```bash
cd electron-app && npx vue-tsc --noEmit src/preload/index.ts 2>&1 | tail -5
```

---

### Task 6: Update `env.d.ts` — Add Type Declaration

**Files:**
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: Add chatWithAI to LcuApi interface**

Add inside the `LcuApi` interface, after `openExternal`:

```typescript
chatWithAI(messages: Array<{ role: string; content: string }>): Promise<{ status: string; content?: string; message?: string }>
```

- [ ] **Step 2: Verify typecheck**

```bash
cd electron-app && npx vue-tsc --noEmit 2>&1 | tail -5
```

---

### Task 7: Create `ChatPanel.vue` — Chat UI Component

**Files:**
- Create: `src/renderer/src/components/chat/ChatPanel.vue`

- [ ] **Step 1: Write the component**

```vue
<template>
  <div class="chat-panel">
    <!-- 标题栏 -->
    <div class="chat-header">
      <span class="chat-title">AI 分析助手</span>
      <n-button text size="small" @click="clearChat" :disabled="messages.length === 0">
        清空对话
      </n-button>
    </div>

    <!-- 消息列表 -->
    <div class="chat-messages" ref="messagesContainer">
      <!-- 空状态 -->
      <div v-if="messages.length === 0 && !sending" class="chat-empty">
        <span class="chat-empty-icon">💬</span>
        <p>AI 助手已就绪，共分析 <b>{{ games.length }}</b> 场对局、<b>{{ playerCount }}</b> 位玩家</p>
        <p class="chat-hint">试着问：谁是MVP？谁的输出最高？</p>
      </div>

      <!-- 消息 -->
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="chat-message-row"
        :class="msg.role === 'user' ? 'msg-right' : 'msg-left'"
      >
        <!-- AI 头像 -->
        <div v-if="msg.role === 'assistant'" class="msg-avatar avatar-ai">🤖</div>

        <div class="msg-bubble-wrapper" :class="msg.role === 'user' ? 'bubble-right' : 'bubble-left'">
          <div class="msg-sender">{{ msg.role === 'user' ? '你' : 'AI 助手' }}</div>
          <div class="msg-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-ai'">
            {{ msg.content }}
          </div>
        </div>

        <!-- 用户头像 -->
        <div v-if="msg.role === 'user'" class="msg-avatar avatar-user">👤</div>
      </div>

      <!-- 发送中光标 -->
      <div v-if="sending" class="chat-message-row msg-left">
        <div class="msg-avatar avatar-ai">🤖</div>
        <div class="msg-bubble-wrapper bubble-left">
          <div class="msg-sender">AI 助手</div>
          <div class="msg-bubble bubble-ai typing-cursor">...</div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="chat-error">
        <span>{{ error }}</span>
        <n-button size="tiny" @click="resend">重新发送</n-button>
      </div>
    </div>

    <!-- 输入栏 -->
    <div class="chat-input-bar">
      <n-input
        v-model:value="inputText"
        type="textarea"
        placeholder="输入你的问题..."
        :disabled="sending"
        :autosize="{ minRows: 1, maxRows: 3 }"
        @keydown.enter.exact.prevent="sendMessage"
        @keydown.shift.enter.prevent="inputText += '\n'"
      />
      <n-button type="primary" :disabled="!inputText.trim() || sending" :loading="sending" @click="sendMessage">
        发送
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { NButton, NInput } from 'naive-ui'
import type { GameRecord } from '@shared/types'
import { formatGamesForAI } from '@shared/utils/format-for-ai'
import { useGameDataStore } from '@/stores/game-data'

const props = defineProps<{
  games: GameRecord[]
}>()

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const gds = useGameDataStore()
const messages = ref<Message[]>([])
const inputText = ref('')
const sending = ref(false)
const error = ref('')
const messagesContainer = ref<HTMLElement>()

/** 上次请求中已注入 system prompt 的消息索引 */
const lastSystemIndex = ref(-1)

const playerCount = computed(() => {
  const names = new Set<string>()
  for (const g of props.games) {
    for (const p of [...g.blue_team.players, ...g.red_team.players]) {
      names.add(p.summoner_name)
    }
  }
  return names.size
})

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/** 构建 system prompt */
function buildSystemPrompt(): string {
  if (!props.games.length) return '无对局数据'
  return formatGamesForAI(props.games, gds.$state as any)
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return

  inputText.value = ''
  error.value = ''
  messages.value.push({ role: 'user', content: text })
  sending.value = true
  scrollToBottom()

  try {
    // 构建消息列表：system prompt + 历史消息
    const apiMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: buildSystemPrompt() },
    ]
    for (const msg of messages.value) {
      apiMessages.push({ role: msg.role, content: msg.content })
    }

    const result = await window.lcuApi.chatWithAI(apiMessages)
    if (result.status === 'success' && result.content) {
      messages.value.push({ role: 'assistant', content: result.content })
      lastSystemIndex.value = messages.value.length
    } else {
      error.value = result.message || 'AI 服务返回异常'
    }
  } catch (e: any) {
    error.value = e.message || '请求失败'
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function resend() {
  // 移除最后一条错误后重试上一轮
  error.value = ''
  // 重试：重新构建上一轮（取最后一条用户消息）
  const lastUserIdx = messages.value.map(m => m.role).lastIndexOf('user')
  if (lastUserIdx >= 0) {
    const lastUserMsg = messages.value[lastUserIdx]
    // 只保留到上一轮用户消息之前
    messages.value = messages.value.slice(0, lastUserIdx)
    inputText.value = lastUserMsg.content
    sendMessage()
  }
}

function clearChat() {
  messages.value = []
  error.value = ''
  inputText.value = ''
  lastSystemIndex.value = -1
}

// 监听 games 变化时清理
watch(() => props.games, () => {
  messages.value = []
  error.value = ''
  inputText.value = ''
  lastSystemIndex.value = -1
}, { deep: false })

// 消息变化自动滚动
watch(() => messages.value.length, () => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: #0d1117;
  border: 1px solid rgba(102, 103, 171, 0.15);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-top: 12px;
}

/* ── 标题栏 ── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(102, 103, 171, 0.1);
  flex-shrink: 0;
}

.chat-title {
  font-size: 13px;
  font-weight: 600;
  color: #a09de0;
}

/* ── 消息列表 ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 24px;
}

.chat-empty p {
  font-size: 13px;
  margin: 0;
}

.chat-empty b {
  color: #a09de0;
}

.chat-empty-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.chat-hint {
  font-size: 11px !important;
  color: var(--text-muted) !important;
}

/* ── 消息行 ── */
.chat-message-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.chat-message-row.msg-right {
  justify-content: flex-end;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.avatar-ai {
  background: linear-gradient(135deg, #8884c8, #5e5c9e);
}

.avatar-user {
  background: linear-gradient(135deg, #FFBE98, #e8a078);
}

/* ── 气泡 ── */
.msg-bubble-wrapper {
  max-width: 75%;
}

.msg-bubble-wrapper.bubble-left {
  align-items: flex-start;
}

.msg-bubble-wrapper.bubble-right {
  align-items: flex-end;
}

.msg-sender {
  font-size: 10px;
  margin-bottom: 3px;
}

.bubble-left .msg-sender {
  color: #a09de0;
  padding-left: 2px;
}

.bubble-right .msg-sender {
  color: #8899aa;
  padding-right: 2px;
  text-align: right;
}

.msg-bubble {
  padding: 9px 13px;
  font-size: 13px;
  line-height: 1.55;
  border-radius: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-ai {
  background: linear-gradient(135deg, #181630, #1c1a38);
  border: 1px solid rgba(102, 103, 171, 0.2);
  border-radius: 2px 12px 12px 12px;
  color: #d0cee8;
}

.bubble-user {
  background: linear-gradient(135deg, #2e1f1a, #341f17);
  border: 1px solid rgba(255, 190, 152, 0.15);
  border-radius: 12px 2px 12px 12px;
  color: #f0d8c8;
}

.typing-cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* ── 错误 ── */
.chat-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(232, 64, 87, 0.1);
  border: 1px solid rgba(232, 64, 87, 0.2);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: #e84057;
}

/* ── 输入栏 ── */
.chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid rgba(102, 103, 171, 0.1);
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.15);
}

.chat-input-bar :deep(.n-input) {
  flex: 1;
}

.chat-input-bar :deep(.n-input .n-input__input-el) {
  background: #060d18;
  border-color: rgba(102, 103, 171, 0.15);
}

.chat-input-bar :deep(.n-input .n-input__input-el:focus) {
  border-color: rgba(102, 103, 171, 0.3);
}
</style>
```

- [ ] **Step 2: Verify typecheck**

```bash
cd electron-app && npx vue-tsc --noEmit 2>&1 | tail -10
```

Expected: No new errors from ChatPanel.vue.

---

### Task 8: Integrate ChatPanel into AnalysisView.vue

**Files:**
- Modify: `src/renderer/src/views/AnalysisView.vue`

- [ ] **Step 1: Import ChatPanel**

Add in `<script setup>` after the existing imports:

```typescript
import ChatPanel from '@/components/chat/ChatPanel.vue'
```

- [ ] **Step 2: Add ChatPanel in template**

In the template, inside `<template v-else>` (metric selected), after the closing `</template>` of `<!-- ═══ 普通指标：领奖台 + 排名表 ═══ -->`, but before the closing `</template>` of the outer `<template v-else>`:

Actually, the ChatPanel should be placed inside `.metric-detail`, after `.ranking-section`. The current structure is:

```
.metric-detail
  v-if="!selectedMetric" → .no-selection
  v-else
    .top-panel (podium)
    .ranking-section
```

We need to add ChatPanel AFTER `.ranking-section` but still inside `.metric-detail`. Since `.metric-detail` has `overflow: hidden` and `display: flex; flex-direction: column`, the ChatPanel with `flex: 1` will fill remaining space.

Find the closing `</template>` that ends the `v-else` block (around line 401). Insert BEFORE it:

```vue
<!-- AI 对话 -->
<ChatPanel :games="analysisGames" />
```

The exact location: after line ~397 which closes `</template>` of `普通指标`, before line ~398 which closes `</template>` of the outer `v-else`.

That is, find:

```vue
            </template>
          </template>
        </div>
      </div>
    </template>
```

And insert ChatPanel between the second-to-last `</template>` and `</template>`:

```vue
            </template>

            <!-- ═══ AI 对话 ═══ -->
            <ChatPanel :games="analysisGames" />

          </template>
        </div>
      </div>
    </template>
```

- [ ] **Step 3: Run dev and verify**

```bash
cd electron-app && npm run dev
```

Expected: AnalysisView loads, ChatPanel visible below ranking table when a metric is selected.

---

### Task 9: Add API Key Input to SettingsDialog.vue

**Files:**
- Modify: `src/renderer/src/components/settings/SettingsDialog.vue`

- [ ] **Step 1: Add API key input in template**

After the auto-update section (`<n-divider />` after the switch row), add:

```vue
      <n-divider />

      <!-- DeepSeek API Key -->
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-title">DeepSeek API Key</span>
          <span class="setting-desc">可选，留空则使用默认 Key</span>
        </div>
        <n-input
          type="password"
          show-password-on="click"
          placeholder="sk-..."
          :value="apiKey"
          style="width: 200px"
          size="small"
          @update:value="onApiKeyChange"
        />
      </div>
```

- [ ] **Step 2: Add script logic**

Add state and handler in `<script setup>`:

```typescript
// Add import
import { NInput } from 'naive-ui'

const apiKey = ref('')

// In the watch for props.show, also load api key:
watch(() => props.show, async (visible) => {
  if (!visible) return
  try {
    const settings = await window.lcuApi.getSettings()
    autoUpdate.value = settings.autoUpdate !== false
    apiKey.value = settings.deepseekApiKey || ''
  } catch {
    // 使用默认值
  }
})

// Add handler:
async function onApiKeyChange(val: string) {
  apiKey.value = val
  try {
    await window.lcuApi.setSetting('deepseekApiKey', val || undefined)
  } catch (e: any) {
    message.error(`保存 API Key 失败: ${e.message || e}`)
  }
}
```

- [ ] **Step 3: Add NInput to imports**

Update the import line to include `NInput`:

```typescript
import { NModal, NSwitch, NButton, NDivider, NA, NInput, useMessage } from 'naive-ui'
```

If `NInput` is already imported elsewhere in the file, skip this step.

- [ ] **Step 4: Verify typecheck**

```bash
cd electron-app && npx vue-tsc --noEmit 2>&1 | tail -10
```

Expected: No new errors.

---

### Final Verification

- [ ] **Full typecheck**

```bash
cd electron-app && npx vue-tsc --noEmit 2>&1
```

Expected: Clean output, exit code 0.

- [ ] **Manual smoke test**

1. `npm run dev`
2. Open app, go to match list, select games, click analyze
3. Select a metric → verify ChatPanel appears below ranking table
4. Type a question → verify AI responds
5. Test multi-turn conversation
6. Test resend on error
7. Test clear chat
8. Test settings dialog → API key save/load
9. Test that deselecting metric hides chat
