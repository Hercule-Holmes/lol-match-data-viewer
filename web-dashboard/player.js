import { api } from "./src/api.js";
import { clearSession, hasSession, setSession } from "./src/auth.js";

const els = {
  loginPanel: document.getElementById("login-panel"),
  playerPanel: document.getElementById("player-panel"),
  playerId: document.getElementById("player-id"),
  btnLogin: document.getElementById("btn-login"),
  btnStart: document.getElementById("btn-start"),
  btnCancel: document.getElementById("btn-cancel"),
  btnLogout: document.getElementById("btn-logout"),
  welcome: document.getElementById("welcome"),
  statusLine: document.getElementById("status-line"),
  kpiWins: document.getElementById("kpi-wins"),
  kpiTotal: document.getElementById("kpi-total"),
  kpiLosses: document.getElementById("kpi-losses"),
  kpiRate: document.getElementById("kpi-rate"),
  matchInfo: document.getElementById("match-info"),
};

let pollTimer = null;

bindEvents();
bootstrap().catch(showError);

function bindEvents() {
  els.btnLogin.addEventListener("click", login);
  els.btnStart.addEventListener("click", startQueue);
  els.btnCancel.addEventListener("click", cancelQueue);
  els.btnLogout.addEventListener("click", logout);
}

async function bootstrap() {
  if (hasSession("player")) {
    await refreshMe();
    startPolling();
  } else {
    showLoginPanel();
  }
}

async function login() {
  const playerId = els.playerId.value.trim();
  if (!playerId) return showError("请输入选手ID");

  try {
    disable(els.btnLogin, true);
    const data = await api.playerLogin(playerId, playerId);
    setSession({
      token: data.token,
      role: data.role,
      playerId: data.player.playerId,
    });
    await refreshMe();
    startPolling();
  } catch (error) {
    showError(error.message);
  } finally {
    disable(els.btnLogin, false);
  }
}

async function startQueue() {
  try {
    disable(els.btnStart, true);
    const data = await api.startQueue();
    renderPlayer(data.player, data.actions);
  } catch (error) {
    showError(error.message);
  } finally {
    disable(els.btnStart, false);
  }
}

async function cancelQueue() {
  try {
    disable(els.btnCancel, true);
    const data = await api.cancelQueue();
    renderPlayer(data.player, data.actions);
  } catch (error) {
    showError(error.message);
  } finally {
    disable(els.btnCancel, false);
  }
}

async function refreshMe() {
  try {
    const data = await api.me();
    renderPlayer(data.player, data.actions, data.matchInfo);
  } catch (error) {
    clearSession("player");
    stopPolling();
    showLoginPanel();
    showError(error.message);
  }
}

async function logout() {
  try {
    await api.logout("player");
  } catch {
    // ignore logout error
  }
  clearSession("player");
  stopPolling();
  showLoginPanel();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    refreshMe().catch(() => {});
  }, 5000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function renderPlayer(player, actions, matchInfo = null) {
  showPlayerPanel();
  els.welcome.textContent = `${player.displayName}（${player.playerId}）`;
  els.statusLine.innerHTML = `当前状态：<span class="tag tag-${player.status}">${formatStatus(player.status)}</span>`;
  els.kpiWins.textContent = String(player.wins);
  els.kpiTotal.textContent = String(player.totalGames);
  els.kpiLosses.textContent = String(player.losses);
  els.kpiRate.textContent = `${Number(player.winRate).toFixed(2)}%`;

  disable(els.btnStart, !actions.canStartQueue);
  disable(els.btnCancel, !actions.canCancelQueue);
  renderMatchInfo(matchInfo);
}

function showLoginPanel() {
  els.loginPanel.classList.remove("hidden");
  els.playerPanel.classList.add("hidden");
}

function showPlayerPanel() {
  els.loginPanel.classList.add("hidden");
  els.playerPanel.classList.remove("hidden");
}

function renderMatchInfo(matchInfo) {
  if (!matchInfo || !["locked", "in_game"].includes(matchInfo.status)) {
    els.matchInfo.classList.add("hidden");
    els.matchInfo.innerHTML = "";
    return;
  }
  const teamA = (matchInfo.teamAPlayers || []).join("、") || "-";
  const teamB = (matchInfo.teamBPlayers || []).join("、") || "-";
  const selfTeam = matchInfo.selfTeam === "A" ? "A队" : matchInfo.selfTeam === "B" ? "B队" : "-";
  els.matchInfo.classList.remove("hidden");
  els.matchInfo.innerHTML = `
    <div class="title" style="font-size:16px;">当前对局信息</div>
    <div class="notice">场次 #${matchInfo.matchId}｜状态：${formatStatus(matchInfo.status)}｜你所在队伍：${selfTeam}</div>
    <div class="notice">A队：${teamA}</div>
    <div class="notice">B队：${teamB}</div>
  `;
}

function formatStatus(status) {
  const map = {
    idle: "空闲",
    queueing: "匹配中",
    locked: "已锁定（等待开局）",
    in_game: "比赛中",
  };
  return map[status] || status;
}

function disable(el, disabled) {
  el.disabled = !!disabled;
}

function showError(message) {
  if (!message) return;
  window.alert(message);
}
