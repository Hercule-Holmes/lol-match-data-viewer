const PLAYER_TOKEN_KEY = "lol_match_dashboard_token_player";
const ADMIN_TOKEN_KEY = "lol_match_dashboard_token_admin";
const PLAYER_ID_KEY = "lol_match_dashboard_player_id";

export function setSession({ token, role, playerId }) {
  if (role === "player") {
    localStorage.setItem(PLAYER_TOKEN_KEY, token || "");
    if (playerId) localStorage.setItem(PLAYER_ID_KEY, playerId);
    return;
  }
  if (role === "admin") {
    localStorage.setItem(ADMIN_TOKEN_KEY, token || "");
  }
}

export function clearSession(role) {
  if (!role || role === "player") {
    localStorage.removeItem(PLAYER_TOKEN_KEY);
    localStorage.removeItem(PLAYER_ID_KEY);
  }
  if (!role || role === "admin") {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export function getToken(role) {
  if (role === "player") return localStorage.getItem(PLAYER_TOKEN_KEY) || "";
  if (role === "admin") return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  return "";
}

export function hasSession(role) {
  return Boolean(getToken(role));
}

export function getPlayerId() {
  return localStorage.getItem(PLAYER_ID_KEY) || "";
}
