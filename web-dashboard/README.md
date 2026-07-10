# 冬天杯 web-dashboard（Cloudflare + GitHub）

该目录提供三类页面：

- `index.html`：公开数据看板（读取 `/api/public/board`）。
- `player.html`：选手登录页（仅可开始/取消匹配）。
- `admin.html`：后台管理页（看池子、发布场次、开局、结算）。

当前默认行为（便于联调）：
- 数据库为空时，后端会自动生成 21 名测试选手（`player01` ~ `player21`）。
- 这 21 名选手默认处于 `queueing`（已进入匹配池）。

## 目录结构

- `worker/`：Cloudflare Worker API + D1 schema。
- `src/api.js`：前端 API 封装。
- `src/auth.js`：前端会话存储。
- `player.js` / `admin.js` / `app.js`：页面逻辑。

## 一次性初始化

1. 创建 D1 和 KV
2. 将 `worker/wrangler.toml` 中占位符替换为真实 ID
3. 执行数据库建表

```bash
cd web-dashboard/worker
npm install
npx wrangler d1 execute lol-match-dashboard --file ./schema.sql
```

## 本地调试

```bash
cd web-dashboard/worker
npx wrangler dev
```

默认将 API 跑在本地，静态页面可直接在 `web-dashboard` 目录启本地静态服务访问。

## 生产部署

### 1) Pages（前端）

- 在 Cloudflare Pages 连接 GitHub 仓库
- Build command: 留空（纯静态）
- Build output directory: `web-dashboard`
- 生产域名可继续使用 `https://lol-match-data-viewer.pages.dev/`

### 2) Worker（后端 API）

GitHub Actions 已提供 `deploy-web-dashboard-worker.yml`：

- Push `master` 时部署生产 Worker
- PR 时部署 `preview` 环境 Worker（可选）

需要在 GitHub Secrets 配置：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ADMIN_PASSWORD_HASH`（推荐）
- `ADMIN_PASSWORD`（可选，仅开发期）

并在 Cloudflare Worker 中配置变量：

- `ADMIN_USERNAME`（默认 `admin`）
- `SESSION_TTL_SECONDS`（默认 `86400`）

## API 摘要

- `POST /api/auth/player-login`
- `POST /api/auth/admin-login`
- `POST /api/auth/logout`
- `GET /api/player/me`
- `POST /api/player/queue/start`
- `POST /api/player/queue/cancel`
- `GET /api/admin/dashboard`
- `GET /api/admin/queue`
- `POST /api/admin/matches/publish`
- `POST /api/admin/matchmaking/config`
- `POST /api/admin/matchmaking/generate`
- `GET /api/admin/matchmaking/overview`
- `POST /api/admin/matchmaking/reset`
- `POST /api/admin/matches/:id/start`
- `POST /api/admin/matches/:id/finish`
- `GET /api/public/board`

## 状态机约束

- 选手：`idle -> queueing -> locked -> in_game -> idle`
- `queueing` 时可取消
- 管理员发布后进入 `locked`，选手端不可取消
- 结算后自动更新 `wins/total_games`
