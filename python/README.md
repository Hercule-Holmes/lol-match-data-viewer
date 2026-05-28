# Python 数据抓取工具 (`python/`)

基于 LCU (League Client Update) 本地 API 的 LOL 对局数据抓取工具集。

## 前置条件

- **Python 3.9+**
- **依赖**: `pip install requests urllib3`
- **League of Legends 客户端必须正在运行**（工具通过进程命令行发现连接凭据）
- 仅支持 Windows（使用 PowerShell Get-CimInstance 查找进程）

## 模块说明

```
python/
├── lcu_client.py         # 核心模块：LCU 连接发现 + HTTP 客户端 + 数据提取
├── fetch_game.py         # CLI 工具：按对局 ID 查看单局详细数据
└── extract_matches.py    # CLI 工具：批量拉取近期 N 场对局并导出 JSON
```

## 核心模块：`lcu_client.py`

提供连接发现、HTTP 请求封装、以及全维度 Stats 数据提取。独立模块，不依赖第三方项目。

**主要类/函数：**

| 函数 | 职责 |
|------|------|
| `find_lol_client()` | 通过 PowerShell 查找 LeagueClientUx.exe 进程，解析 `--app-port` 和 `--remoting-auth-token` |
| `LcuClient(conn)` | HTTP 客户端封装：自签名证书处理 + Basic Auth + 15s 超时 |
| `extract_stats_full(p)` | 从 LCU raw stats 提取 **118 个字段**，按维度分组（KDA/伤害/治疗/经济/补刀/视野/控制/推塔/符文等） |
| `extract_player_identity(info)` | 提取玩家身份（兼容国服 gameName#tagLine） |
| `extract_team_data(team, players)` | 提取队伍汇总（击杀/目标/首次事件） |
| `extract_ranked_data(stats)` | 提取排位段位/胜率数据 |
| `extract_champion_mastery_for_game(list, ids)` | 为对局中使用的英雄提取熟练度 |

## CLI 工具

### 批量提取：`extract_matches.py`

拉取近期 N 场对局的全局数据并导出为 JSON。

```bash
# 在项目根目录下运行：
cd D:/LOL/lol-match-data

# 默认拉取 10 场，输出到 output/matches.json
python python/extract_matches.py

# 拉取 20 场，指定输出路径
python python/extract_matches.py -n 20 -o output/recent_20.json
```

**输出 JSON 结构：**
```json
{
  "summoner": { "puuid": "...", "name": "...", "level": 123, ... },
  "ranked": { "queues": { "RANKED_SOLO_5x5": { "tier": "钻石", ... } } },
  "games_count": 10,
  "games": [
    {
      "game_id": 10967588300,
      "game_mode": "CLASSIC",
      "game_duration_min": 28.5,
      "blue_team": { "players": [...], "win": true, ... },
      "red_team": { "players": [...], "win": false, ... },
      "champion_mastery": { "64": { "level": 7, "points": 120000 } }
    }
  ]
}
```

### 单局查看：`fetch_game.py`

按对局 ID 拉取并在终端逐玩家展示全维度数据。

```bash
# 终端友好输出
python python/fetch_game.py 10967588300

# JSON 格式输出
python python/fetch_game.py 10967588300 --json
```

## LCU API 通信原理

1. **连接发现**：调用 PowerShell `Get-CimInstance Win32_Process` 查找 `LeagueClientUx.exe`
2. **命令行解析**：从进程命令行提取 `--app-port`（HTTPS 端口）和 `--remoting-auth-token`（认证令牌）
3. **HTTP 请求**：Basic Auth（用户名固定为 `riot`）+ 忽略自签名 SSL 证书
4. **API 端点**：
   - `/lol-summoner/v1/current-summoner` — 当前召唤师信息
   - `/lol-match-history/v1/products/lol/{puuid}/matches` — 战绩列表（分页）
   - `/lol-match-history/v1/games/{gameId}` — 对局详情（10 人完整 stats）
   - `/lol-ranked/v1/ranked-stats/{puuid}` — 排位数据
   - `/lol-champion-mastery/v1/local-player/champion-mastery` — 英雄熟练度

## 与 Electron 桌面应用的关系

Electron 应用 (`electron-app/`) 是 Python 工具的 Node.js 重写版，提供 GUI 界面。二者共享：
- **相同的 LCU API 端点**
- **相同的数据提取逻辑**（Python 版 `lcu_client.py` ↔ Node.js 版 `main/lcu/extractor.ts`）
- **相同的 JSON 数据格式**（Python 输出可被 Electron 应用的 AnalysisView 直接读取）

Python 版本适合 **批量离线抓取和数据分析脚本**，Electron 版本适合 **实时交互式浏览**。
