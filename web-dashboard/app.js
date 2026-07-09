import { api } from "./src/api.js";

const METRIC_ORDER = ["score", "mvp", "kills", "deaths"];
const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

bootstrap().catch((err) => showError(err.message || "加载失败"));

async function bootstrap() {
  // 先渲染本地静态数据，确保公开看板始终有内容
  let rendered = false;
  try {
    const local = await fetchStaticBoard();
    renderAll(local);
    rendered = true;
  } catch {
    // ignore local failure
  }

  // 再尝试覆盖为实时数据
  try {
    const realtime = await api.getPublicBoard();
    renderAll(realtime);
    rendered = true;
  } catch (error) {
    if (!rendered) throw error;
  }
}

async function fetchStaticBoard() {
  const r = await fetch(`data.json?v=${Date.now()}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function renderAll(data) {
  const meta = data.meta || {};
  const metrics = data.metrics || {};

  const ts = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString("zh-CN", { hour12: false }) : "—";
  document.getElementById("update-time").textContent = `更新于 ${ts}`;

  const round = meta.round || "冬天杯4.0";
  document.title = `${round} — 数据看板`;
  const h1 = document.querySelector(".top-bar .brand h1");
  if (h1) h1.textContent = round;

  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  for (const key of METRIC_ORDER) {
    const metric = metrics[key];
    if (!metric || !Array.isArray(metric.ranking) || !metric.ranking.length) continue;

    const ranking = [...metric.ranking].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    const maxVal = Number(ranking[0]?.value || 1);
    const card = document.createElement("div");
    card.className = "card";

    const hd = document.createElement("div");
    hd.className = "card-hd";
    hd.innerHTML = `<span class="icon">${esc(metric.icon || "")}</span><span class="label">${esc(
      metric.label || key
    )}</span>`;
    card.appendChild(hd);

    const body = document.createElement("div");
    body.className = "card-body";

    for (let i = 0; i < ranking.length; i += 1) {
      const entry = ranking[i];
      const rank = i + 1;
      const value = Number(entry.value || 0);
      const pct = maxVal > 0 ? `${((value / maxVal) * 100).toFixed(1)}%` : "0%";

      const row = document.createElement("div");
      row.className = `rr${topClass(rank)}`;
      row.innerHTML = `
        <span class="rk${rankClass(rank)}">${rank}</span>
        <span class="av" style="display:inline-flex;align-items:center;justify-content:center;">👤</span>
        <span class="nm">${esc(entry.name || "—")}</span>
        <span class="bar-wrap"><span class="bar" style="width:${pct}"></span></span>
        <span class="val">${fmtVal(value)}</span>
      `;
      body.appendChild(row);
    }

    card.appendChild(body);
    grid.appendChild(card);
  }

  if (!grid.children.length) {
    grid.innerHTML =
      '<div style="color:rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;height:100%;font-size:0.82rem">暂无公开看板数据</div>';
  }
}

function fmtVal(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

function rankClass(r) {
  if (r === 1) return " g";
  if (r === 2) return " s";
  if (r === 3) return " b";
  return "";
}

function topClass(r) {
  if (r === 1) return " t1";
  if (r === 2) return " t2";
  if (r === 3) return " t3";
  return "";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ENT[c]);
}

function showError(message) {
  const grid = document.getElementById("grid");
  if (grid) {
    grid.innerHTML = `<div style="color:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;height:100%;font-size:0.75rem">数据加载失败: ${esc(
      message
    )}</div>`;
  }
}
