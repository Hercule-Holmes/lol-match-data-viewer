# SGP 数据源迁移 — 设计规格

> 日期: 2026-06-23
> 状态: 已确认
> Phase: 1/2 — SGP 数据通道基础设施

## 1. 背景与目标

### 现状

当前仅使用 LCU 本地 API 获取对局数据。`lcu-api.ts` 的 `Stats` 接口约 70 个字段。

### 问题

1. LCU API 缺失技能释放次数、信号次数、团队贡献等 ~40 个分析维度
2. LCU API 单玩家对局上限 ~200 场

### 目标

参考 LeagueAkari 项目实现 SGP（Service Gateway Proxy）接入，作为主线数据源。SGP 提供约 110 个对战数据字段。

## 2. 核心决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据源切换策略 | 启动时一次性决策: SGP 可用→全走 SGP，不可用→全走 LCU | 国服单区场景，无需混合通道 |
| 降级 | LCU 作为完整降级路径 | SGP 不可用时自动切换，用户无感知 |
| Token 管理 | 401 自动续期 | 保证长期游戏 session 不走降级 |
| 服务器配置 | 沿用 LeagueAkari 内置 JSON + schema 校验 | 格式兼容，便于未来扩展全球区服 |

## 3. 新增文件

```
electron-app/src/main/sgp/
├── client.ts              SGP HTTP 客户端
├── config.ts              服务器地址解析
├── config-schema.json     配置 JSON Schema（AJV 校验）
├── extractor.ts           SGP raw → GameSummary + GameRecord
└── tencent-servers.json   内置国服地址（~10 条）
```

## 4. 模块设计

### 4.1 Token 获取与刷新

```
启动 / LCU 连接建立
  → GET /entitlements/v1/token
        │
     成功 → SgpClient.setToken(accessToken) → 标记 SGP 可用
     失败 → 标记降级 → 全走 LCU
        │
   LCU 断开 → SgpClient.setToken(null) → 标记降级
        │
   SGP 请求返回 401 → 重新获取 token → 成功则续期，失败则降级
```

- Token 首次获取附加在现有 LCU 连接检测流程中
- 不需要独立轮询 refresh——仅在 401 时被动续期

### 4.2 SGP Client (`client.ts`)

```typescript
class SgpClient {
  setToken(token: string | null): void     // 外部注入/清空
  getMatchHistory(puuid, start, count): Promise<SgpMatchHistory>
}
```

- axios 实例，baseURL 从 config 动态取
- 12s 超时，失败重试 1 次
- 自动附加 `Authorization: Bearer <token>`
- 401 时触发 onTokenExpired 回调（外部重新获取注入）

### 4.3 服务器配置 (`config.ts` + `tencent-servers.json`)

沿用 LeagueAkari 的配置结构：

```json
{
  "servers": {
    "TENCENT_HN1": {
      "matchHistory": "https://hn1-k8s-sgp.lol.qq.com:21019",
      "common": "https://hn1-k8s-sgp.lol.qq.com:21019"
    }
  }
}
```

- 内置 ~10 条国服地址
- 格式完全兼容 LeagueAkari `league-servers.json`，未来扩展全球区服只需替换配置文件
- 未命中时尝试动态拼域名（`{zone}-sgp.lol.qq.com` / `{zone}-k8s-sgp.lol.qq.com`）
- 用 AJV 做 schema 校验

### 4.4 提取器 (`extractor.ts`)

```
SgpMatchHistory (raw)
  → SgpGame[] (每局完整数据)
       │
       ├──→ GameSummary[]  ──→ 列表卡片
       │     queueId, champion, KDA, win, duration, ...
       │
       └──→ GameRecord[]   ──→ 详情面板 + DB 落盘
             ├── all Participant's PlayerStats (110 字段)
             ├── teams
             └── cherry_subteams
```

关键映射注意点：

- SGP `perks` 是嵌套树（`styles[].selections[].perk`），需展平成现有 `runes.perks[]` 数组
- 其余字段基本是直接搬运或重命名
- SGP `totalEnemyJungleMinionsKilled` ≈ LCU `neutralMinionsKilledEnemyJungle`（同语义不同名）

### 4.5 PlayerStats 扩展 (`app.ts`)

新增 SGP 独有的子结构：

```typescript
spell_casts: { q: number; w: number; e: number; r: number }
summoner_casts: { d: number; f: number }
pings: {                   // 全部 10+ 种信号
  all_in: number; assist: number; bait: number;
  basic: number; command: number; danger: number;
  enemy_missing: number; enemy_vision: number;
  get_back: number; hold: number; need_vision: number;
  on_my_way: number; push: number; vision_cleared: number
}
team_contribution: {
  damage_shielded: number
  heals_on_teammates: number
  objectives_stolen: number
  objectives_stolen_assists: number
}
time_breakdown: {
  total_time_dead: number
  time_played: number
}
items_purchased: number
consumables_purchased: number
detector_wards_placed: number
bounty_level: number
champ_experience: number
```

- LCU 降级时这些字段填 0 或 null
- UI 判断非零才展示，不会因降级崩界面
- DB `game_details` 存完整 JSON blob，自动兼容，无需 migration

## 5. 现有文件改动

| 文件 | 改动 |
|------|------|
| `src/shared/types/app.ts` | PlayerStats 新增 ~25 字段（分 5 个子结构） |
| `src/main/lcu/extractors/match-list.ts` | 列表加载入口：token 可用→SGP，不可用→LCU |
| `src/main/ipc/lcu-handlers.ts` | 新增 entitlements token 获取；新增 SGP 对局列表 IPC |
| `src/preload/index.ts` | 新增 bridge 方法 |
| `src/renderer/src/env.d.ts` | 类型声明更新 |
| `src/main/db/games.ts` | 无需改动（JSON blob 自动兼容新字段） |

## 6. 数据流

```
 程序启动
    │
    ▼
 LCU 连接建立 → 获取 entitlements token
    │
    ├── 成功: SGP 可用标记 = true
    │         │
    │         ├── 加载对局列表 → SGP Client → 完整数据
    │         ├── 展开详情 → 已随列表一起拉回，直接提取
    │         └── 401 错误 → 重新获取 token → 成功续期 / 失败降级
    │
    └── 失败: SGP 可用标记 = false → LCU 全流程（现有逻辑不变）
```

## 7. 不在本次范围

- Phase 2 趣味分析功能（技能释放排名、称号体系、UI 展示）
- 全球区服支持（配置格式已兼容，未来替换 JSON 文件即可）

## 8. 测试策略

- 纯函数提取器 100% 单元测试（SGP raw JSON fixture → PlayerStats）
- SGP vs LCU 字段映射校验（fixture 轮一遍所有 110 字段）
- 降级路径手动验证（故意填错误 token 确认切换 LCU）
- 401 续期手动验证
