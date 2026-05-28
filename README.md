<div align="center">
  <h1>LOL Match Data Viewer</h1>
  <p>基于 Electron + Vue 3 的英雄联盟 LCU API 对战数据分析桌面客户端</p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-34-47848f?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/Vue-3.5-4fc08d?style=flat-square&logo=vue.js" alt="Vue">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

<p align="center">
  通过 LCU API 拉取对战记录，无需第三方 API Key。<br>
  提供 34 项基础数据指标的多维度排名，支持装备 / 海克斯热力图、高阶聚合指标分析。
</p>

# 1. 功能概览

## 1.1 战绩列表

- 分页拉取 LCU 对战记录（匹配模式支持翻页，其他模式全量拉取）
- 每场对局展示：英雄头像、KDA、装备、符文、召唤师技能、段位、游戏模式
- 左侧面板：胜率统计、常用英雄、KDA 趋势、近期队友 / 对手分析
- 勾选多场对局后可跳转数据分析页

## 1.2 数据分析（AnalysisView）

### 基础数据 — 34 个指标，领奖台 + 排名表

| 类别 | 指标 |
|------|------|
| 战斗 | 击杀、死亡、助攻、KDA、最大连杀、连杀次数、最大多杀 |
| 伤害 | 总伤害、承伤、最大暴击 |
| 经济 | 打钱、花钱、补刀、野怪击杀 |
| 生存 | 治疗、自我减伤、最长存活 |
| 视野 | 视野得分、插眼、排眼 |
| 控制 | 控制敌人时间、受控时间 |
| 目标 | 推塔、对塔伤害、破水晶 |
| 首杀 / 首塔 | 一血、一塔 |
| 多杀 | 双杀、三杀、四杀、五杀 |
| 评分 | 战斗评分 |
| 装备 | 全局热门装备 TOP10 + 各玩家最爱装备（悬浮查看购买者） |
| 海克斯 | 全局热门海克斯 TOP10 + 各玩家最爱海克斯（悬浮查看选择者） |

### 高阶数据 — 聚合计算指标，首末名对比

| 指标 | 计算方式 |
|------|----------|
| 伤害 / 经济 | 总伤害 ÷ 总经济（伤害转化效率） |

### 交互特性

- 侧边栏折叠目录（基础数据 / 高阶数据）
- 第 1 名领奖台支持自定义皇冠称号（如死亡最多 →「沙包」）
- 高阶数据首末名支持自定义标签（如伤害 / 经济 →「高效」「低效」）
- 排名表默认展示 10 名玩家，超出滚轮滚动
- 鼠标悬浮查看详情（KDA、胜率、击杀 / 死亡 / 助攻）

## 1.3 对局详情

- 两队阵容展示：英雄头像、KDA、装备、符文、召唤师技能、段位
- 两队统计数据：击杀参与率、伤害占比、承伤占比、经济占比
- 伤害最高 / 承伤最高玩家高亮标识

# 2. 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Electron 34 + electron-vite |
| 前端 | Vue 3 (Composition API) + Pinia + Vue Router |
| UI 组件库 | Naive UI |
| 样式 | Less |
| HTTP | Axios（HTTPS 自签名证书处理） |
| 构建 | Vite + TypeScript |

# 3. 项目结构

```
src/
├── main/                          # 主进程（API 接入层）
│   ├── index.ts                   # 应用入口 + 生命周期
│   ├── lcu/
│   │   ├── client.ts              # LCU 连接发现 + HTTP 客户端
│   │   └── extractor.ts           # LCU 原始数据 → App 类型转换
│   ├── ipc/
│   │   └── lcu-handlers.ts        # IPC 处理器（lcu:* channel）
│   └── utils/
│       ├── logger.ts              # 文件日志（按日轮转）
│       └── asset-proxy.ts         # lcu-asset:// 自定义协议代理
│
├── preload/                       # Preload 脚本
│   └── index.ts                   # contextBridge 暴露 lcuApi
│
├── shared/                        # 共享层（主进程 + 渲染进程共用）
│   ├── types/
│   │   ├── lcu-api.ts             # LCU 原始 API 响应类型
│   │   └── app.ts                 # 应用层数据类型
│   └── utils/
│       ├── analysis.ts            # 纯函数分析算法
│       └── mappings.ts            # 常量映射（队列、装备排除列表等）
│
└── renderer/                      # 渲染进程（前端界面层）
    └── src/
        ├── views/                 # 页面视图
        │   ├── MatchList.vue      # 战绩列表
        │   ├── AnalysisView.vue   # 数据分析
        │   ├── GameDetail.vue     # 对局详情
        │   └── Panel.vue          # 面板容器
        ├── components/            # 组件
        │   ├── match-history/     # 战绩卡片 + 统计面板
        │   ├── widgets/           # 通用小组件（英雄/装备/符文/海克斯图标）
        │   ├── sidebar/           # 侧边栏
        │   └── title-bar/         # 标题栏
        ├── stores/                # Pinia 状态管理
        │   └── game-data.ts       # 游戏基础数据缓存
        ├── router/                # Vue Router 路由配置
        └── utils/                 # 前端工具函数
```

# 4. 数据来源

通过 LCU (League Client Update) 本地 API 获取数据，无需第三方 API Key：

| 端点 | 用途 |
|------|------|
| `/lol-match-history/v1/products/lol/{puuid}/matches` | 对战列表 |
| `/lol-match-history/v1/games/{gameId}` | 单场对局详情 |
| `/lol-summoner/v1/current-summoner` | 当前召唤师信息 |
| `/lol-ranked/v1/current-ranked-stats` | 当前段位信息 |
| `/lol-game-data/assets/v1/*` | CDN 静态数据（英雄 / 装备 / 技能 / 符文 / 海克斯） |
| `/lol-collections/v1/inventories/{id}/champion-mastery` | 英雄熟练度 |

数据字段完整清单见 [`LCU_DATA_FIELDS.json`](./electron-app/LCU_DATA_FIELDS.json)，包含 90+ 字段的中文注释、类型标注和前端展示状态。

# 5. 构建与运行

## 5.1 环境要求

- Node.js 20+
- Windows（LCU API 仅 Windows 可用）
- League of Legends 客户端（需正在运行）
- Python 3 + Pillow（仅打包时，用于图标转换）

## 5.2 安装与运行

```bash
# 安装依赖
npm install

# 启动开发模式（HMR）
npm run dev

# 构建生产版本
npm run build

# 打包为可执行文件
npm run package
```

## 5.3 使用步骤

1. 启动 League of Legends 客户端并登录
2. 运行 `npm run dev` 启动本应用
3. 应用会自动检测 LCU 连接，拉取战绩列表
4. 在战绩列表中勾选需要分析的对局
5. 进入「数据分析」查看各维度排名

# 6. 注意事项

- **国服限制**：TENCENT 区域的 `gameCount` 通常被限制在 ~21 场，非国服地区可获得更多对局记录
- **HTTPS 自签名证书**：LCU API 使用自签名证书，本应用已在 `LcuHttpClient` 中处理
- **海克斯增幅数据**：仅在斗魂竞技场 (CHERRY) / 海克斯大乱斗 (KIWI) 模式中可用
- **管理员权限**：首次运行如提示 PowerShell 权限问题，需以管理员身份运行

# 7. 参考与致谢

本项目的架构设计和诸多实现细节深受以下优秀开源项目的启发，在此向原作者和维护者们致以诚挚的感谢：

| 项目 | 说明 |
|------|------|
| [LeagueAkari](https://github.com/LeagueAkari/LeagueAkari) | 基于 LCU API 的英雄联盟客户端工具集，本项目在模块分层架构（main / shared / renderer）、LCU 连接发现机制、以及 IPC 通信模式上大量参考了 LeagueAkari 的设计思路 |
| [Pengu Loader](https://github.com/PenguLoader/PenguLoader) | 英雄联盟客户端 JavaScript 插件加载器 |
| [lcu-and-riotclient-api](https://github.com/KebsCS/lcu-and-riotclient-api) | LCU 与 Riot Client API 文档参考 |
| [Seraphine](https://github.com/Zzaphkiel/Seraphine) | 英雄联盟 LCU API 工具集，提供了 LCU 数据提取的思路 |

**特别感谢 LeagueAkari 项目**（作者：[@HUPRO3](https://github.com/HUPRO3)），其清晰的代码架构和完善的功能设计为本项目的开发提供了宝贵的参考范例。

# 8. 免责声明

本软件是基于 Riot Games 的 League Client Update (LCU) API 开发的辅助工具，不涉及任何侵入性技术，理论上不会直接干预或修改游戏数据。但请注意游戏更新或反作弊系统可能带来的兼容性风险。

开发者不对因使用本软件而导致的任何后果（包括但不限于账号封禁、数据丢失等）承担责任。用户应在充分了解风险的前提下自行决定是否使用。

**本应用未获得 Riot Games 的官方支持或认可**，所有与 League of Legends 相关的商标、版权均归 Riot Games, Inc. 所有。使用本软件可能违反游戏的用户协议，请自行承担风险。
