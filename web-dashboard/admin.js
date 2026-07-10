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
  btnSaveConfig: document.getElementById("btn-save-config"),
  btnGenerateMatches: document.getElementById("btn-generate-matches"),
  btnResetCycle: document.getElementById("btn-reset-cycle"),
  btnRefreshOverview: document.getElementById("btn-refresh-overview"),
  btnImportPlayers: document.getElementById("btn-import-players"),
  btnSetAllIdle: document.getElementById("btn-set-all-idle"),
  btnSetAllQueueing: document.getElementById("btn-set-all-queueing"),
  teamA: document.getElementById("team-a"),
  teamB: document.getElementById("team-b"),
  cfgTargetGames: document.getElementById("cfg-target-games"),
  cfgWinrateTolerance: document.getElementById("cfg-winrate-tolerance"),
  cfgMaxTries: document.getElementById("cfg-max-tries"),
  cfgGenerateMaxMatches: document.getElementById("cfg-generate-max-matches"),
  resetPlayerTotals: document.getElementById("reset-player-totals"),
  playersImportText: document.getElementById("players-import-text"),
  importReplaceExisting: document.getElementById("import-replace-existing"),
  actionMessage: document.getElementById("action-message"),
  summaryGrid: document.getElementById("summary-grid"),
  matchmakingOverviewWrap: document.getElementById("matchmaking-overview-wrap"),
  queueWrap: document.getElementById("queue-wrap"),
  matchWrap: document.getElementById("match-wrap"),
  playerWrap: document.getElementById("player-wrap"),
};

let pollTimer = null;
let latestDashboardData = null;
const POLL_INTERVAL_VISIBLE_MS = 10000;
const listViewState = {
  matchKeyword: "",
  playerKeyword: "",
  matchesPage: 1,
  playersPage: 1,
  matchesPageSize: 12,
  playersPageSize: 20,
};

bindEvents();
bootstrap().catch(showError);

function bindEvents() {
  els.btnLogin.addEventListener("click", login);
  els.btnLogout.addEventListener("click", logout);
  els.btnRefreshQueue.addEventListener("click", refreshDashboard);
  els.btnPublish.addEventListener("click", publishMatch);
  els.btnSaveConfig.addEventListener("click", saveMatchmakingConfig);
  els.btnGenerateMatches.addEventListener("click", generateMatchesByGap);
  els.btnResetCycle.addEventListener("click", resetMatchmakingCycle);
  els.btnRefreshOverview.addEventListener("click", refreshMatchmakingOverview);
  els.btnImportPlayers.addEventListener("click", importPlayersFromExcel);
  els.btnSetAllIdle.addEventListener("click", () => setAllPlayersStatus("idle"));
  els.btnSetAllQueueing.addEventListener("click", () => setAllPlayersStatus("queueing"));
  document.addEventListener("visibilitychange", handleVisibilityChange);
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
    latestDashboardData = data;
    renderSummary(data.summary);
    renderQueue(data.queue);
    renderMatches(data.matches);
    renderPlayers(data.players);
    renderMatchmakingOverview(data.matchmaking);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      await logout(false);
    }
    showError(error.message);
  }
}

async function saveMatchmakingConfig() {
  const payload = {
    targetGamesPerPlayer: toPositiveNumberOrUndefined(els.cfgTargetGames.value),
    winrateTolerance: toNumberOrUndefined(els.cfgWinrateTolerance.value),
    maxShuffleTries: toPositiveNumberOrUndefined(els.cfgMaxTries.value),
  };
  try {
    disable(els.btnSaveConfig, true);
    const data = await api.updateMatchmakingConfig(payload);
    setActionMessage(
      `已保存配置：Y=${data.targetGamesPerPlayer}，容差=${Number(data.winrateTolerance * 100).toFixed(
        2
      )}% ，尝试次数=${data.maxShuffleTries}`
    );
    fillConfigInputs(data);
    await refreshMatchmakingOverview();
  } catch (error) {
    setActionMessage(`保存配置失败：${error.message}`);
    showError(error.message);
  } finally {
    disable(els.btnSaveConfig, false);
  }
}

async function generateMatchesByGap() {
  const maxMatches = toPositiveNumberOrUndefined(els.cfgGenerateMaxMatches.value);
  try {
    disable(els.btnGenerateMatches, true);
    setActionMessage("正在按缺口优先批量生成对局...");
    const data = await api.generateMatchmakingMatches(maxMatches);
    setActionMessage(
      `均衡模式已生成 ${data.createdMatchIds.length} 场；消耗 ${data.consumedPlayers} 人；剩余 ${data.remainingQueuePlayers} 人；平均胜率差 ${data.averageWinrateDelta}%`
    );
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`均衡生成失败：${error.message}`);
    showError(error.message);
  } finally {
    disable(els.btnGenerateMatches, false);
  }
}

async function resetMatchmakingCycle() {
  const withTotals = !!els.resetPlayerTotals.checked;
  const tip = withTotals
    ? "将清空当前场次/队列，并重置所有选手总战绩，确认继续？"
    : "将清空当前场次/队列并重置赛程统计，确认继续？";
  const ok = window.confirm(tip);
  if (!ok) return;
  try {
    disable(els.btnResetCycle, true);
    const data = await api.resetMatchmakingCycle(withTotals);
    setActionMessage(
      `已重置并创建新赛程（ID: ${data.newCycleId}）；已清空 ${data.clearedMatches} 场对局；选手状态已恢复为空闲`
    );
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`重置失败：${error.message}`);
    showError(error.message);
  } finally {
    disable(els.btnResetCycle, false);
  }
}

async function refreshMatchmakingOverview() {
  try {
    const data = await api.getMatchmakingOverview();
    renderMatchmakingOverview(data);
  } catch (error) {
    setActionMessage(`均衡概览刷新失败：${error.message}`);
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

async function setAllPlayersStatus(status) {
  const targetText = status === "idle" ? "空闲" : "匹配中";
  const ok = window.confirm(`确认将可操作选手批量设置为${targetText}吗？`);
  if (!ok) return;
  const triggerBtn = status === "idle" ? els.btnSetAllIdle : els.btnSetAllQueueing;
  try {
    disable(triggerBtn, true);
    const data = await api.setAllPlayersStatus(status);
    setActionMessage(
      `批量设置完成：目标=${targetText}，更新 ${data.updatedCount} 人，跳过 ${data.skippedCount} 人（锁定/比赛中）`
    );
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`批量设置失败：${error.message}`);
    showError(error.message);
  } finally {
    disable(triggerBtn, false);
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

async function voidMatch(matchId) {
  const ok = window.confirm(`确认将对局 #${matchId} 判定为流局吗？该操作会把参赛选手恢复为空闲。`);
  if (!ok) return;
  try {
    await api.voidMatch(matchId);
    setActionMessage(`已将对局 #${matchId} 判定为流局`);
    await refreshDashboard();
  } catch (error) {
    setActionMessage(`流局失败：${error.message}`);
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
  if (document.visibilityState !== "visible") return;
  stopPolling();
  pollTimer = setInterval(() => {
    refreshDashboard().catch(() => {});
  }, POLL_INTERVAL_VISIBLE_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function handleVisibilityChange() {
  if (!hasSession("admin")) return;
  if (document.visibilityState === "visible") {
    refreshDashboard().catch(() => {});
    startPolling();
    return;
  }
  stopPolling();
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

function renderMatchmakingOverview(matchmaking) {
  if (!matchmaking) {
    els.matchmakingOverviewWrap.innerHTML = `<div class="notice">暂无均衡数据。</div>`;
    return;
  }
  fillConfigInputs(matchmaking.config);
  const allRows = matchmaking.players || [];
  const summary = matchmaking.summary || {};
  els.matchmakingOverviewWrap.innerHTML = `
    <div class="notice" style="margin-top:8px;">
      当前赛程：${escapeHtml(matchmaking.config?.cycleName || "-")}（ID: ${matchmaking.config?.cycleId || "-" }）；
      选手数 ${allRows.length}；
      缺口统计：最大 ${summary.maxGap ?? 0}，最小 ${summary.minGap ?? 0}，平均 ${summary.avgGap ?? 0}
    </div>
    <div class="table-scroll" style="margin-top:8px;">
    <table>
      <thead>
        <tr>
          <th>playerId</th>
          <th>状态</th>
          <th>assigned</th>
          <th>finished</th>
          <th>gap</th>
          <th>胜/总</th>
        </tr>
      </thead>
      <tbody>
        ${allRows
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p.playerId)}</td>
            <td>${escapeHtml(formatStatus(p.status))}</td>
            <td>${p.assignedGames}</td>
            <td>${p.finishedGames}</td>
            <td>${p.gap}</td>
            <td>${p.wins}/${p.totalGames}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    </div>
  `;
}

function fillConfigInputs(config) {
  if (!config) return;
  if (!els.cfgTargetGames.value) els.cfgTargetGames.value = String(config.targetGamesPerPlayer ?? 10);
  if (!els.cfgWinrateTolerance.value) els.cfgWinrateTolerance.value = String(config.winrateTolerance ?? 0.1);
  if (!els.cfgMaxTries.value) els.cfgMaxTries.value = String(config.maxShuffleTries ?? 60);
}

function renderQueue(queue) {
  if (!queue.length) {
    els.queueWrap.innerHTML = `<div class="notice">暂无匹配中的选手。</div>`;
    return;
  }

  els.queueWrap.innerHTML = `
    <div class="table-scroll">
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
    </div>
  `;
}

function renderMatches(matches) {
  if (!matches.length) {
    els.matchWrap.innerHTML = `<div class="notice">暂无场次。</div>`;
    return;
  }

  const keyword = listViewState.matchKeyword.trim().toLowerCase();
  const filtered = !keyword
    ? matches
    : matches.filter((m) => {
      const text = [
        String(m.id || ""),
        String(m.status || ""),
        String(m.winner_team || ""),
        ...(m.teamAPlayers || []),
        ...(m.teamBPlayers || []),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(keyword);
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / listViewState.matchesPageSize));
  if (listViewState.matchesPage > totalPages) listViewState.matchesPage = totalPages;
  const start = (listViewState.matchesPage - 1) * listViewState.matchesPageSize;
  const paged = filtered.slice(start, start + listViewState.matchesPageSize);

  els.matchWrap.innerHTML = `
    <div class="row" style="margin-bottom:8px;justify-content:space-between;">
      <input id="match-filter-input" style="min-width:260px;" placeholder="筛选：场次ID/状态/选手ID" value="${escapeHtml(
        listViewState.matchKeyword
      )}">
      <div class="notice">共 ${filtered.length} 条，当前第 ${listViewState.matchesPage}/${totalPages} 页</div>
    </div>
    <div class="table-scroll">
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
        ${paged
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
            const voidBtn =
              m.status === "locked" || m.status === "in_game"
                ? `<button class="warn" data-action="void" data-id="${m.id}">流局</button>`
                : `<button disabled>流局</button>`;
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
                <td>${startBtn} ${finishBtns} ${voidBtn} ${correctBtns}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
    </div>
    <div class="row" style="margin-top:8px;justify-content:flex-end;">
      <button class="secondary" id="match-page-prev" ${listViewState.matchesPage <= 1 ? "disabled" : ""}>上一页</button>
      <button class="secondary" id="match-page-next" ${listViewState.matchesPage >= totalPages ? "disabled" : ""}>下一页</button>
    </div>
  `;

  els.matchWrap.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const matchId = Number(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === "start") await startMatch(matchId);
      if (action === "finishA") await finishMatch(matchId, "A");
      if (action === "finishB") await finishMatch(matchId, "B");
      if (action === "void") await voidMatch(matchId);
      if (action === "correctA") await correctWinner(matchId, "A");
      if (action === "correctB") await correctWinner(matchId, "B");
    });
  });
  const matchFilterInput = document.getElementById("match-filter-input");
  if (matchFilterInput) {
    matchFilterInput.addEventListener("input", () => {
      listViewState.matchKeyword = matchFilterInput.value || "";
      listViewState.matchesPage = 1;
      renderMatches((latestDashboardData && latestDashboardData.matches) || []);
    });
  }
  const prevBtn = document.getElementById("match-page-prev");
  const nextBtn = document.getElementById("match-page-next");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (listViewState.matchesPage <= 1) return;
      listViewState.matchesPage -= 1;
      renderMatches((latestDashboardData && latestDashboardData.matches) || []);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (listViewState.matchesPage >= totalPages) return;
      listViewState.matchesPage += 1;
      renderMatches((latestDashboardData && latestDashboardData.matches) || []);
    });
  }
}

function renderPlayers(players) {
  const keyword = listViewState.playerKeyword.trim().toLowerCase();
  const filtered = !keyword
    ? players
    : players.filter((p) => {
      const text = [p.playerId, p.displayName, p.status].join(" ").toLowerCase();
      return text.includes(keyword);
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / listViewState.playersPageSize));
  if (listViewState.playersPage > totalPages) listViewState.playersPage = totalPages;
  const start = (listViewState.playersPage - 1) * listViewState.playersPageSize;
  const paged = filtered.slice(start, start + listViewState.playersPageSize);

  els.playerWrap.innerHTML = `
    <div class="row" style="margin-bottom:8px;justify-content:space-between;">
      <input id="player-filter-input" style="min-width:260px;" placeholder="筛选：playerId/显示名/状态" value="${escapeHtml(
        listViewState.playerKeyword
      )}">
      <div class="notice">共 ${filtered.length} 人，当前第 ${listViewState.playersPage}/${totalPages} 页</div>
    </div>
    <div class="table-scroll">
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
        ${paged
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
    </div>
    <div class="row" style="margin-top:8px;justify-content:flex-end;">
      <button class="secondary" id="player-page-prev" ${listViewState.playersPage <= 1 ? "disabled" : ""}>上一页</button>
      <button class="secondary" id="player-page-next" ${listViewState.playersPage >= totalPages ? "disabled" : ""}>下一页</button>
    </div>
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
  const playerFilterInput = document.getElementById("player-filter-input");
  if (playerFilterInput) {
    playerFilterInput.addEventListener("input", () => {
      listViewState.playerKeyword = playerFilterInput.value || "";
      listViewState.playersPage = 1;
      renderPlayers((latestDashboardData && latestDashboardData.players) || []);
    });
  }
  const prevBtn = document.getElementById("player-page-prev");
  const nextBtn = document.getElementById("player-page-next");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (listViewState.playersPage <= 1) return;
      listViewState.playersPage -= 1;
      renderPlayers((latestDashboardData && latestDashboardData.players) || []);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (listViewState.playersPage >= totalPages) return;
      listViewState.playersPage += 1;
      renderPlayers((latestDashboardData && latestDashboardData.players) || []);
    });
  }
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
    const cols = splitImportColumns(line);
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

function splitImportColumns(line) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(",") || line.includes("，")) return line.split(/[,\uff0c]/);
  // 兼容用户直接输入 playerId/displayName/wins/totalGames/status
  if (line.includes("/")) return line.split("/");
  return [line];
}

function toNonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function toPositiveNumberOrUndefined(value) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

function toNumberOrUndefined(value) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  const n = Number(text);
  if (!Number.isFinite(n)) return undefined;
  return n;
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
