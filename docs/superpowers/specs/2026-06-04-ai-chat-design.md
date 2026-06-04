# AI 对话功能设计

## 概述

在 AnalysisView 排名表下方增加一个 AI 对话面板，用户可对已加载的对局数据进行多轮自然语言问答（"谁是MVP？""谁的输出最高？"等）。后端使用 DeepSeek API（`deepseek-chat` 模型）。

## 交互流程

1. 用户在对局列表勾选对局 → 点击分析 → 进入 AnalysisView
2. 从左侧选择一个数据指标 → 排名表 + 领奖台显示
3. 排名表下方出现 AI 对话框（科技蓝/长春花蓝配色区隔）
4. 用户输入自然语言问题，回车发送
5. AI 基于对局数据回答，消息呈微信风格气泡（AI 靠左 / 用户靠右）

## 架构

```
AnalysisView.vue
  └── <ChatPanel :games="analysisGames" v-if="selectedMetric" />

ChatPanel.vue                  # 新建 - 聊天 UI 组件
  └── formatGamesForAI()       # 新建 - shared/utils/ 纯函数，格式化对局数据

Main Process:
  llm.ts                       # 新建 - DeepSeek API 客户端
  index.ts                     # +1 IPC handler: llm:chat
  settings.ts                  # +deepseekApiKey?: string

Preload:
  index.ts                     # +1 桥接方法: chatWithAI
  env.d.ts                     # +1 类型声明
```

## 数据注入

`formatGamesForAI(games, gameData)` 位于 `src/shared/utils/format-for-ai.ts`，纯函数，把对局数据格式化为结构文本，注入到 system prompt 第一条消息中。包含全部可用字段（英雄、KDA、伤害、经济、装备、海克斯、补刀、视野、CC、承伤等），按对局编号逐一列出。ChatPanel 从 `useGameDataStore()` 获取 gameData 传入。

```typescript
// 纯函数，位于 shared/utils/format-for-ai.ts
function formatGamesForAI(games: GameRecord[], gameData: GameDataCache): string
```

ChatPanel 负责调用此函数构建 messages 数组，主进程只做 API 转发不做格式处理。

## 组件设计

### ChatPanel.vue

Props: `games: GameRecord[]`

```
┌─────────────────────────────────────────────────┐
│  AI 分析助手                    🗑 清空对话    │
├─────────────────────────────────────────────────┤
│                                                 │
│  [AI 气泡 - 靠左]                   [用户 - 靠右] │
│                                                 │
├─────────────────────────────────────────────────┤
│  [输入框]                           [发送 →]    │
└─────────────────────────────────────────────────┘
```

- 消息数组 `ref<Message[]>`，本地管理，不依赖 Pinia
- 每条消息: `{ role: 'user' | 'assistant', content: string, timestamp: number }`
- AI 消息: Very Peri 配色，左侧气泡 + 🤖 头像
- 用户消息: Peach Fuzz 配色，右侧气泡 + 👤 头像
- 输入: `NInput` type=textarea，回车发送，Shift+回车换行
- 发送中: 输入禁用 + 按钮 loading + 底部闪烁光标
- 空状态: "AI 助手已就绪，共分析 N 场对局，M 位玩家"
- 清空: 只清前台 messages，后端无状态

### 位置

在 `.metric-detail` 内部，`<template v-else>` (有指标选中时) 中，放在 `.ranking-section` 下方，`flex: 1` 填充剩余空间。

## 配色方案

| 元素 | 颜色 | 色值 |
|------|------|------|
| AI 气泡 | Very Peri 长春花蓝 | #6667AB |
| AI 气泡背景 | 深紫底 | #181630 |
| AI 头像渐变 | 淡紫渐变 | #8884c8 → #5e5c9e |
| 用户气泡 | Peach Fuzz 柔和桃 | #FFBE98 |
| 用户气泡背景 | 暗桃底 | #2e1f1a |
| 用户头像渐变 | 桃色渐变 | #FFBE98 → #e8a078 |
| 对话框底色 | 暗面板 | #0d1117 |
| 对话框边框 | 淡紫半透明 | rgba(102,103,171,0.15) |

## API Key 管理

- 主进程 `llm.ts` 硬编码一个默认 API Key，所有用户开箱即用
- `settings.ts` 增加 `deepseekApiKey?: string`，用户可选覆盖
- `settings:get` 返回 key 时 mask 为 `"***"`，前端不可见明文
- SettingsDialog 增加输入框："自定义 API Key（可选，留空则使用默认）"
- `llm.ts` 优先使用用户自定义 Key，fallback 默认 Key

## 错误处理

| 场景 | 行为 |
|------|------|
| 无可用 Key | 提示 "请在设置中配置 API Key" + 跳转按钮 |
| 网络/API 错误 | 消息列表末尾显示红色错误提示 + "重新发送"按钮 |
| 发送中 | 输入框禁用、按钮 loading、光标闪烁 |

## 需要修改的文件

| 文件 | 变更 |
|------|------|
| `src/renderer/src/components/chat/ChatPanel.vue` | 新建 |
| `src/shared/utils/format-for-ai.ts` | 新建 |
| `src/main/utils/llm.ts` | 新建 |
| `src/main/index.ts` | +1 IPC handler `llm:chat` |
| `src/preload/index.ts` | +1 桥接方法 `chatWithAI` |
| `src/renderer/src/env.d.ts` | +1 类型声明 |
| `src/main/utils/settings.ts` | +`deepseekApiKey?: string` |
| `src/renderer/src/views/AnalysisView.vue` | +ChatPanel 引入与使用 |
| `src/renderer/src/components/settings/SettingsDialog.vue` | +API Key 输入框 |
