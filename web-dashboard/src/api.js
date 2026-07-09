import { getToken } from "./auth.js";

const DEFAULT_API_BASE_URL = "https://lol-match-dashboard-api.1693402463.workers.dev";
const API_BASE_URL =
  typeof window !== "undefined" &&
  (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
    ? ""
    : DEFAULT_API_BASE_URL;

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("content-type", "application/json");
  const token = getToken(options.role);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const message = data.message || `请求失败 (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data.data;
}

export const api = {
  health() {
    return request("/api/health", { method: "GET" });
  },
  getPublicBoard() {
    return request("/api/public/board", { method: "GET" });
  },
  playerLogin(playerId, displayName) {
    return request("/api/auth/player-login", {
      method: "POST",
      role: "player",
      body: JSON.stringify({ playerId, displayName }),
    });
  },
  adminLogin(username, password) {
    return request("/api/auth/admin-login", {
      method: "POST",
      role: "admin",
      body: JSON.stringify({ username, password }),
    });
  },
  logout(role) {
    return request("/api/auth/logout", { method: "POST", role, body: JSON.stringify({}) });
  },
  me() {
    return request("/api/player/me", { method: "GET", role: "player" });
  },
  startQueue() {
    return request("/api/player/queue/start", { method: "POST", role: "player", body: JSON.stringify({}) });
  },
  cancelQueue() {
    return request("/api/player/queue/cancel", { method: "POST", role: "player", body: JSON.stringify({}) });
  },
  getDashboard() {
    return request("/api/admin/dashboard", { method: "GET", role: "admin" });
  },
  getQueue() {
    return request("/api/admin/queue", { method: "GET", role: "admin" });
  },
  publishMatch(teamA, teamB) {
    return request("/api/admin/matches/publish", {
      method: "POST",
      role: "admin",
      body: JSON.stringify({ teamA, teamB }),
    });
  },
  randomPublishMatches(maxMatches) {
    return request("/api/admin/matches/random-publish", {
      method: "POST",
      role: "admin",
      body: JSON.stringify({ maxMatches }),
    });
  },
  setPlayerStatus(playerId, status) {
    return request(`/api/admin/players/${encodeURIComponent(playerId)}/status`, {
      method: "POST",
      role: "admin",
      body: JSON.stringify({ status }),
    });
  },
  importPlayers(rows, replaceExisting) {
    return request("/api/admin/players/import", {
      method: "POST",
      role: "admin",
      body: JSON.stringify({ rows, replaceExisting }),
    });
  },
  deletePlayer(playerId) {
    return request(`/api/admin/players/${encodeURIComponent(playerId)}/delete`, {
      method: "POST",
      role: "admin",
      body: JSON.stringify({}),
    });
  },
  startMatch(matchId) {
    return request(`/api/admin/matches/${matchId}/start`, {
      method: "POST",
      role: "admin",
      body: JSON.stringify({}),
    });
  },
  finishMatch(matchId, winnerTeam) {
    return request(`/api/admin/matches/${matchId}/finish`, {
      method: "POST",
      role: "admin",
      body: JSON.stringify({ winnerTeam }),
    });
  },
  correctMatchWinner(matchId, winnerTeam) {
    return request(`/api/admin/matches/${matchId}/correct-winner`, {
      method: "POST",
      role: "admin",
      body: JSON.stringify({ winnerTeam }),
    });
  },
};
