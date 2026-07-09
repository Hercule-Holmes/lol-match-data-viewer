import { api } from "./src/api.js";
import { clearSession, hasSession, setSession } from "./src/auth.js";

const els = {
  loginPanel: document.getElementById("admin-login"),
  consolePanel: document.getElementById("admin-console"),
  username: document.getElementById("admin-username"),
  password: document.getElementById("admin-password"),
  btnLogin: document.getElementById("btn-login"),
  btnLogout: document.getElementById("btn-logout"),
  btnRefreshQueue: document.getElementById("btn-refresh-queue"),
  btnPublish: document.getElementById("btn-publish"),
  btnRandomPublish: document.getElementById("btn-random-publish"),
  btnImportPlayers: document.getElementById("btn-import-players"),
  teamA: document.getElementById("team-a"),
  teamB: document.getElementById("team-b"),
  maxMatches: document.getElementById("max-matches"),
  playersImportText: document.getElementById("players-import-text"),
  importReplaceExisting: document.getElementById("import-replace-existing"),
  actionMessage: document.getElementById("action-message"),
  summaryGrid: document.getElementById("summary-grid"),
  queueWrap: document.getElementById("queue-wrap"),
  matchWrap: document.getElementById("match-wrap"),
  playerWrap: document.getElementById("player-wrap"),
};

let pollTimer = null;

bindEvents();
bootstrap().catch(showError);

function bindEvents() {
  els.btnLogin.addEventListener("click", login);
  els.btnLogout.addEventListener("click", logout);
  els.btnRefreshQueue.addEventListener("click", refreshDashboard);
  els.btnPublish.addEventListener("click", publishMatch);
  els.btnRandomPublish.addEventListener("click", randomPublishMatches);
  els.btnImportPlayers.addEventListener("click", importPlayersFromExcel);
}

async function bootstrap() {
  if (hasSession("admin")) {
    await refreshDashboard();
    showConsole();
    startPolling();
  } else {
    showLogin();
  }
}

async function login() {
  const username = els.username.value.trim();
  const password = els.password.value;
  if (!username || !password) return showError("请输入后台账号和密码");

  try {
    disable(els.btnLogin, true);
    const data = await api.adminLogin(username, password);
    setSession({ token: data.token, role: data.role });
    showConsole();
    await refreshDashboard();
    startPolling();
  } catch (error) {
    showError(error.message);
  } finally {
    disable(els.btnLogin, false);
  }
}

async function refreshDashboard() {
  try {
    const data = await api.getDashboard();
    renderSummary(data.summary);
    renderQueue(data.queue);
    renderMatches(data.matches);
    renderPlayers(data.players);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      await logout(false);
    }
    showError(error.message);
  }
}

async function publishMatch() {
  const teamA = splitIds(els.teamA.value);
  const teamB = splitIds(els.teamB.value);
  try {
    disable(els.btnPublish, true);
    setActionMessage("正在发布单场对局...");
    const data = await api.publishMatch(teamA, teamB);
    setActionMessage(`已发布对局 #${data.matchId}`);
    els.teamA.value = "";
    els.teamB.value = "";
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`发布失败：${error.message}`);
    showError(error.message);
  } finally {
    disable(els.btnPublish, false);
  }
}

async function randomPublishMatches() {
  const maxMatchesText = els.maxMatches.value.trim();
  const maxMatches = maxMatchesText ? Number(maxMatchesText) : undefined;
  if (maxMatchesText && (!Number.isFinite(maxMatches) || maxMatches <= 0)) {
    setActionMessage("场次数必须为大于0的数字");
    return showError("场次数必须为大于0的数字");
  }

  try {
    disable(els.btnRandomPublish, true);
    setActionMessage("正在随机分组并发布...");
    const data = await api.randomPublishMatches(maxMatches);
    setActionMessage(
      `已随机发布 ${data.createdMatchIds.length} 场；消耗 ${data.consumedPlayers} 人；匹配池剩余 ${data.remainingQueuePlayers} 人`
    );
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`随机分组失败：${error.message}`);
    showError(error.message);
  } finally {
    disable(els.btnRandomPublish, false);
  }
}

async function importPlayersFromExcel() {
  const text = els.playersImportText.value.trim();
  if (!text) return showError("请先粘贴 Excel 数据");
  const rows = parsePlayerImportRows(text);
  if (!rows.length) return showError("未解析到有效选手数据");

  const replaceExisting = !!els.importReplaceExisting.checked;
  if (replaceExisting) {
    const ok = window.confirm("将清空现有选手与场次数据后导入，是否继续？");
    if (!ok) return;
  }

  try {
    disable(els.btnImportPlayers, true);
    setActionMessage(`正在导入 ${rows.length} 名选手...`);
    const data = await api.importPlayers(rows, replaceExisting);
    setActionMessage(
      `导入完成：新增 ${data.insertedCount}，更新 ${data.updatedCount}，匹配中 ${data.queueingCount}，空闲 ${data.idleCount}`
    );
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`导入失败：${error.message}`);
    showError(error.message);
  } finally {
    disable(els.btnImportPlayers, false);
  }
}

async function startMatch(matchId) {
  try {
    await api.startMatch(matchId);
    await refreshDashboard();
  } catch (error) {
    showError(error.message);
  }
}

async function finishMatch(matchId, winnerTeam) {
  try {
    await api.finishMatch(matchId, winnerTeam);
    await refreshDashboard();
  } catch (error) {
    showError(error.message);
  }
}

async function correctWinner(matchId, winnerTeam) {
  try {
    await api.correctMatchWinner(matchId, winnerTeam);
    setActionMessage(`已改判对局 #${matchId} 为 ${winnerTeam}队胜`);
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`改判失败：${error.message}`);
    showError(error.message);
  }
}

async function deletePlayer(playerId) {
  const ok = window.confirm(`确认删除选手 ${playerId} 吗？`);
  if (!ok) return;
  try {
    await api.deletePlayer(playerId);
    setActionMessage(`已删除选手 ${playerId}`);
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`删除失败：${error.message}`);
    showError(error.message);
  }
}

async function logout(callApi = true) {
  try {
    if (callApi) await api.logout("admin");
  } catch {
    // ignore
  }
  clearSession("admin");
  stopPolling();
  showLogin();
}

function showLogin() {
  els.loginPanel.classList.remove("hidden");
  els.consolePanel.classList.add("hidden");
  els.btnLogout.classList.add("hidden");
}

function showConsole() {
  els.loginPanel.classList.add("hidden");
  els.consolePanel.classList.remove("hidden");
  els.btnLogout.classList.remove("hidden");
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    refreshDashboard().catch(() => {});
  }, 5000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function renderSummary(summary) {
  const list = [
    ["总选手", summary.totalPlayers],
    ["空闲", summary.idlePlayers],
    ["匹配中", summary.queueingPlayers],
    ["已锁定", summary.lockedPlayers],
    ["比赛中", summary.inGamePlayers],
  ];
  els.summaryGrid.innerHTML = list
    .map(
      ([label, value]) => `
      <div class="kpi">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      </div>
    `
    )
    .join("");
}

function renderQueue(queue) {
  if (!queue.length) {
    els.queueWrap.innerHTML = `<div class="notice">暂无匹配中的选手。</div>`;
    return;
  }

  els.queueWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>playerId</th>
          <th>显示名</th>
          <th>胜/总</th>
        </tr>
      </thead>
      <tbody>
        ${queue
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p.playerId)}</td>
            <td>${escapeHtml(p.displayName)}</td>
            <td>${p.wins}/${p.totalGames}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderMatches(matches) {
  if (!matches.length) {
    els.matchWrap.innerHTML = `<div class="notice">暂无场次。</div>`;
    return;
  }

  els.matchWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>状态</th>
          <th>获胜方</th>
          <th>A队成员</th>
          <th>B队成员</th>
          <th>创建时间</th>
          <th>开局时间</th>
          <th>结算</th>
        </tr>
      </thead>
      <tbody>
        ${matches
          .map((m) => {
            const startBtn =
              m.status === "locked"
                ? `<button class="ok" data-action="start" data-id="${m.id}">确认开局</button>`
                : `<button disabled>确认开局</button>`;
            const finishBtns =
              m.status === "locked" || m.status === "in_game"
                ? `
                  <button class="secondary" data-action="finishA" data-id="${m.id}">A胜</button>
                  <button class="secondary" data-action="finishB" data-id="${m.id}">B胜</button>
                `
                : `<button disabled>A胜</button><button disabled>B胜</button>`;
            const correctBtns =
              m.status === "finished"
                ? `
                  <button class="warn" data-action="correctA" data-id="${m.id}">改判A胜</button>
                  <button class="warn" data-action="correctB" data-id="${m.id}">改判B胜</button>
                `
                : "";
            return `
              <tr>
                <td>#${m.id}</td>
                <td>${escapeHtml(formatMatchStatus(m.status))}</td>
                <td>${escapeHtml(formatWinnerTeam(m.winner_team))}</td>
                <td>${escapeHtml((m.teamAPlayers || []).join(", ") || "-")}</td>
                <td>${escapeHtml((m.teamBPlayers || []).join(", ") || "-")}</td>
                <td>${fmtDateTime(m.created_at)}</td>
                <td>${fmtDateTime(m.started_at)}</td>
                <td>${startBtn} ${finishBtns} ${correctBtns}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  els.matchWrap.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const matchId = Number(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === "start") await startMatch(matchId);
      if (action === "finishA") await finishMatch(matchId, "A");
      if (action === "finishB") await finishMatch(matchId, "B");
      if (action === "correctA") await correctWinner(matchId, "A");
      if (action === "correctB") await correctWinner(matchId, "B");
    });
  });
}

function renderPlayers(players) {
  els.playerWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>playerId</th>
          <th>显示名</th>
          <th>状态</th>
          <th>胜场</th>
          <th>总场次</th>
          <th>胜率</th>
          <th>当前场次</th>
          <th>状态控制</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${players
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p.playerId)}</td>
            <td>${escapeHtml(p.displayName)}</td>
            <td><span class="tag tag-${p.status}">${escapeHtml(formatStatus(p.status))}</span></td>
            <td>${p.wins}</td>
            <td>${p.totalGames}</td>
            <td>${Number(p.winRate).toFixed(2)}%</td>
            <td>${p.currentMatchId || "-"}</td>
            <td>
              <button class="secondary" data-action="set-idle" data-player-id="${escapeHtml(
                p.playerId
              )}">设为空闲</button>
              <button class="ok" data-action="set-queueing" data-player-id="${escapeHtml(
                p.playerId
              )}">设为匹配中</button>
            </td>
            <td>
              <button class="warn" data-action="delete-player" data-player-id="${escapeHtml(
                p.playerId
              )}">删除</button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  els.playerWrap.querySelectorAll("button[data-action][data-player-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const playerId = btn.dataset.playerId;
      const action = btn.dataset.action;
      const targetStatus = action === "set-idle" ? "idle" : action === "set-queueing" ? "queueing" : "";
      try {
        disable(btn, true);
        if (action === "delete-player") {
          await deletePlayer(playerId);
          return;
        }
        if (!targetStatus) return;
        await api.setPlayerStatus(playerId, targetStatus);
        setActionMessage(`已将 ${playerId} 设置为${targetStatus === "idle" ? "空闲" : "匹配中"}`);
        await refreshDashboard();
      } catch (error) {
        setActionMessage(`设置失败：${error.message}`);
        showError(error.message);
      } finally {
        disable(btn, false);
      }
    });
  });
}

function splitIds(text) {
  return text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parsePlayerImportRows(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const rows = [];
  for (const line of lines) {
    const cols = line.includes("\t")
      ? line.split("\t")
      : line.split(/[,\uff0c]/);
    const values = cols.map((x) => x.trim());
    if (!values.length) continue;

    const first = values[0]?.toLowerCase?.() || "";
    if (["playerid", "id", "选手id", "player_id"].includes(first)) continue;

    const playerId = values[0];
    if (!playerId) continue;
    const displayName = values[1] || playerId;
    const wins = toNonNegativeInt(values[2], 0);
    const totalGames = Math.max(toNonNegativeInt(values[3], 0), wins);
    const status = normalizeStatus(values[4]);

    rows.push({ playerId, displayName, wins, totalGames, status });
  }
  return rows;
}

function toNonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function normalizeStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "idle";
  if (text === "queueing" || text === "匹配中") return "queueing";
  if (text === "idle" || text === "空闲" || text === "可匹配") return "idle";
  return "idle";
}

function fmtDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("zh-CN", { hour12: false });
}

function formatStatus(status) {
  const map = {
    idle: "空闲",
    queueing: "匹配中",
    locked: "已锁定",
    in_game: "比赛中",
  };
  return map[status] || status;
}

function formatMatchStatus(status) {
  const map = {
    locked: "已发布（锁定）",
    in_game: "比赛中",
    finished: "已完成",
    cancelled: "已取消",
  };
  return map[status] || status;
}

function formatWinnerTeam(winnerTeam) {
  if (winnerTeam === "A") return "A队";
  if (winnerTeam === "B") return "B队";
  return "-";
}

function disable(el, disabled) {
  el.disabled = !!disabled;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showError(message) {
  if (!message) return;
  window.alert(message);
}

function setActionMessage(message) {
  if (!els.actionMessage) return;
  els.actionMessage.textContent = message || "";
}
