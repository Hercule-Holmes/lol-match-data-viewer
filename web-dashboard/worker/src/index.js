export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const status = Number(error?.status || 500);
      const code = error?.code || "INTERNAL_ERROR";
      return json(
        {
          ok: false,
          error: code,
          message: error instanceof Error ? error.message : "Unknown error",
        },
        status
      );
    }
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (pathname === "/api/health") {
    return json({
      ok: true,
      data: {
        service: "lol-match-dashboard-api",
        time: new Date().toISOString(),
      },
    });
  }

  await ensureSeedPlayers(env);

  if (pathname === "/api/public/board" && request.method === "GET") {
    const board = await buildBoard(env);
    return json({ ok: true, data: board });
  }

  if (pathname === "/api/auth/player-login" && request.method === "POST") {
    await requireRateLimit(env, request, "player-login");
    const payload = await readJsonBody(request);
    const playerId = safeText(payload.playerId);
    const displayName = safeText(payload.displayName || payload.playerId);

    if (!playerId) return badRequest("playerId 不能为空");

    const player = await upsertPlayer(env, playerId, displayName);
    const token = await createSession(env, {
      role: "player",
      playerDbId: player.id,
      playerId: player.player_id,
    });

    return json({
      ok: true,
      data: {
        token,
        role: "player",
        player: sanitizePlayer(player),
      },
    });
  }

  if (pathname === "/api/auth/admin-login" && request.method === "POST") {
    await requireRateLimit(env, request, "admin-login");
    const payload = await readJsonBody(request);
    const username = safeText(payload.username);
    const password = safeText(payload.password);

    const expectedUser = env.ADMIN_USERNAME || "admin";
    const expectedHash = safeText(env.ADMIN_PASSWORD_HASH);
    const expectedRaw = safeText(env.ADMIN_PASSWORD);
    const passHash = await sha256Hex(password);

    const validByHash = expectedHash && timingSafeEqual(passHash, expectedHash);
    const validByRaw = expectedRaw && timingSafeEqual(password, expectedRaw);
    // 临时开发模式：未配置密钥时，仅要求密码为 123456（用户名可忽略）
    const isTempDevLogin = !expectedHash && !expectedRaw && timingSafeEqual(password, "123456");
    const isValid = (username === expectedUser && (validByHash || validByRaw)) || isTempDevLogin;
    if (!isValid) return unauthorized("后台账号或密码错误");

    const token = await createSession(env, {
      role: "admin",
      playerDbId: null,
      playerId: username || expectedUser,
    });

    return json({
      ok: true,
      data: { token, role: "admin", username },
    });
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const session = await requireAuth(request, env, ["player", "admin"]);
    await deleteSession(env, session.token);
    return json({ ok: true, data: { loggedOut: true } });
  }

  if (pathname === "/api/player/me" && request.method === "GET") {
    const session = await requireAuth(request, env, ["player"]);
    const player = await getPlayerByDbId(env, session.playerDbId);
    if (!player) return unauthorized("玩家会话无效");

    return json({
      ok: true,
      data: {
        player: sanitizePlayer(player),
        actions: getPlayerActions(player.status),
      },
    });
  }

  if (pathname === "/api/player/queue/start" && request.method === "POST") {
    const session = await requireAuth(request, env, ["player"]);
    const now = nowIso();

    const player = await getPlayerByDbId(env, session.playerDbId);
    if (!player) return unauthorized("玩家不存在");
    if (player.status !== "idle") return badRequest(`当前状态 ${player.status} 不能开始匹配`);

    await env.DB.batch([
      env.DB.prepare("UPDATE players SET status='queueing', updated_at=?, last_seen_at=? WHERE id=?")
        .bind(now, now, player.id),
      await insertQueueEntryStmt(env, player.id, now),
    ]);

    const next = await getPlayerByDbId(env, player.id);
    return json({
      ok: true,
      data: {
        player: sanitizePlayer(next),
        actions: getPlayerActions(next.status),
      },
    });
  }

  if (pathname === "/api/player/queue/cancel" && request.method === "POST") {
    const session = await requireAuth(request, env, ["player"]);
    const now = nowIso();

    const player = await getPlayerByDbId(env, session.playerDbId);
    if (!player) return unauthorized("玩家不存在");
    if (player.status !== "queueing") return badRequest(`当前状态 ${player.status} 不能取消匹配`);

    await env.DB.batch([
      env.DB.prepare("UPDATE players SET status='idle', updated_at=?, last_seen_at=? WHERE id=?")
        .bind(now, now, player.id),
      env.DB.prepare(
        "UPDATE queue_entries SET state='cancelled', cancelled_at=? WHERE id=(SELECT id FROM queue_entries WHERE player_id=? AND state='queueing' ORDER BY id DESC LIMIT 1)"
      ).bind(now, player.id),
    ]);

    const next = await getPlayerByDbId(env, player.id);
    return json({
      ok: true,
      data: {
        player: sanitizePlayer(next),
        actions: getPlayerActions(next.status),
      },
    });
  }

  if (pathname === "/api/admin/dashboard" && request.method === "GET") {
    await requireAuth(request, env, ["admin"]);
    const dashboard = await getAdminDashboard(env);
    return json({ ok: true, data: dashboard });
  }

  if (pathname === "/api/admin/queue" && request.method === "GET") {
    await requireAuth(request, env, ["admin"]);
    const queue = await getQueuePlayers(env);
    return json({ ok: true, data: { queue } });
  }

  const setPlayerStatus = pathname.match(/^\/api\/admin\/players\/([^/]+)\/status$/);
  if (setPlayerStatus && request.method === "POST") {
    await requireAuth(request, env, ["admin"]);
    const playerId = decodeURIComponent(setPlayerStatus[1]);
    const payload = await readJsonBody(request);
    const status = safeText(payload.status);
    if (!["idle", "queueing"].includes(status)) {
      return badRequest("仅支持设置为 idle 或 queueing");
    }

    const player = await env.DB.prepare("SELECT * FROM players WHERE player_id=?").bind(playerId).first();
    if (!player) return notFound("选手不存在");

    const now = nowIso();
    if (status === "idle") {
      await env.DB.batch([
        env.DB.prepare("UPDATE players SET status='idle', current_match_id=NULL, updated_at=?, last_seen_at=? WHERE id=?")
          .bind(now, now, player.id),
        env.DB.prepare(
          "UPDATE queue_entries SET state='cancelled', cancelled_at=? WHERE player_id=? AND state='queueing'"
        ).bind(now, player.id),
      ]);
    } else {
      await env.DB.batch([
        env.DB.prepare("UPDATE players SET status='queueing', current_match_id=NULL, updated_at=?, last_seen_at=? WHERE id=?")
          .bind(now, now, player.id),
        await insertQueueEntryStmt(env, player.id, now),
      ]);
    }

    const next = await env.DB.prepare("SELECT * FROM players WHERE id=?").bind(player.id).first();
    return json({ ok: true, data: { player: sanitizePlayer(next) } });
  }

  const deletePlayer = pathname.match(/^\/api\/admin\/players\/([^/]+)\/delete$/);
  if (deletePlayer && request.method === "POST") {
    await requireAuth(request, env, ["admin"]);
    const playerId = decodeURIComponent(deletePlayer[1]);
    const player = await env.DB.prepare("SELECT * FROM players WHERE player_id=?").bind(playerId).first();
    if (!player) return notFound("选手不存在");
    if (["locked", "in_game"].includes(player.status)) {
      return badRequest("选手正在进行中的对局流程中，不能删除");
    }

    const usedByMatches = await env.DB.prepare("SELECT COUNT(*) AS c FROM match_players WHERE player_id=?")
      .bind(player.id)
      .first();
    if (Number(usedByMatches?.c || 0) > 0) {
      return badRequest("该选手已有历史场次记录，暂不支持直接删除");
    }

    await env.DB.batch([
      env.DB.prepare("DELETE FROM queue_entries WHERE player_id=?").bind(player.id),
      env.DB.prepare("DELETE FROM players WHERE id=?").bind(player.id),
    ]);
    return json({ ok: true, data: { deleted: true, playerId } });
  }

  if (pathname === "/api/admin/players/import" && request.method === "POST") {
    await requireAuth(request, env, ["admin"]);
    const payload = await readJsonBody(request);
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const replaceExisting = !!payload.replaceExisting;
    if (!rows.length) return badRequest("rows 不能为空");

    const now = nowIso();
    if (replaceExisting) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM queue_entries"),
        env.DB.prepare("DELETE FROM match_players"),
        env.DB.prepare("DELETE FROM matches"),
        env.DB.prepare("DELETE FROM players"),
      ]);
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let queueingCount = 0;
    let idleCount = 0;

    for (const row of rows) {
      const playerId = safeText(row.playerId);
      if (!playerId) continue;
      const displayName = safeText(row.displayName || playerId);
      const wins = toNonNegativeInt(row.wins);
      const totalGames = Math.max(toNonNegativeInt(row.totalGames), wins);
      const status = normalizeImportStatus(row.status);

      if (status === "queueing") queueingCount += 1;
      if (status === "idle") idleCount += 1;

      const existing = await env.DB.prepare("SELECT * FROM players WHERE player_id=?").bind(playerId).first();
      if (existing) {
        updatedCount += 1;
        await env.DB.prepare(
          "UPDATE players SET display_name=?, status=?, wins=?, total_games=?, current_match_id=NULL, updated_at=?, last_seen_at=? WHERE id=?"
        )
          .bind(displayName, status, wins, totalGames, now, now, existing.id)
          .run();

        await env.DB.prepare("UPDATE queue_entries SET state='cancelled', cancelled_at=? WHERE player_id=? AND state='queueing'")
          .bind(now, existing.id)
          .run();
        if (status === "queueing") {
          await (await insertQueueEntryStmt(env, existing.id, now)).run();
        }
      } else {
        insertedCount += 1;
        const inserted = await env.DB.prepare(
          "INSERT INTO players (player_id, display_name, status, wins, total_games, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(playerId, displayName, status, wins, totalGames, now, now, now)
          .run();

        if (status === "queueing") {
          await (await insertQueueEntryStmt(env, inserted.meta.last_row_id, now)).run();
        }
      }
    }

    return json({
      ok: true,
      data: { insertedCount, updatedCount, queueingCount, idleCount },
    });
  }

  if (pathname === "/api/admin/matches/publish" && request.method === "POST") {
    const session = await requireAuth(request, env, ["admin"]);
    const payload = await readJsonBody(request);
    const teamAIds = Array.isArray(payload.teamA) ? payload.teamA : [];
    const teamBIds = Array.isArray(payload.teamB) ? payload.teamB : [];
    const allIds = [...teamAIds, ...teamBIds];

    if (teamAIds.length !== 5 || teamBIds.length !== 5) {
      return badRequest("必须传入 A/B 队各 5 名选手");
    }
    if (new Set(allIds).size !== 10) {
      return badRequest("10 名选手不能重复");
    }

    const players = await getPlayersByPlayerIds(env, allIds);
    if (players.length !== 10) return badRequest("存在无效 playerId");

    for (const p of players) {
      if (p.status !== "queueing") {
        return badRequest(`选手 ${p.player_id} 当前状态为 ${p.status}，不能发布匹配`);
      }
    }

    const matchId = await createLockedMatch(env, session.playerId, teamAIds, teamBIds, players);
    return json({ ok: true, data: { matchId } });
  }

  if (pathname === "/api/admin/matches/random-publish" && request.method === "POST") {
    const session = await requireAuth(request, env, ["admin"]);
    const payload = await readJsonBody(request);
    const maxMatchesRaw = Number(payload.maxMatches || 9999);
    const maxMatches = Number.isFinite(maxMatchesRaw) && maxMatchesRaw > 0 ? Math.floor(maxMatchesRaw) : 9999;

    const queue = await getQueuePlayers(env);
    const queueIds = queue.map((x) => x.playerId);
    if (queueIds.length < 10) {
      return json({
        ok: true,
        data: { createdMatchIds: [], consumedPlayers: 0, remainingQueuePlayers: queueIds.length },
      });
    }

    const randomized = shuffleArray(queueIds);
    const groups = [];
    const possibleMatches = Math.floor(randomized.length / 10);
    const matchCount = Math.min(possibleMatches, maxMatches);
    for (let i = 0; i < matchCount; i += 1) {
      groups.push(randomized.slice(i * 10, i * 10 + 10));
    }

    const createdMatchIds = [];
    for (const group of groups) {
      const teamSeed = shuffleArray([...group]);
      const teamA = teamSeed.slice(0, 5);
      const teamB = teamSeed.slice(5, 10);
      const players = await getPlayersByPlayerIds(env, [...teamA, ...teamB]);
      if (players.length !== 10) continue;
      const canPublish = players.every((p) => p.status === "queueing");
      if (!canPublish) continue;

      const matchId = await createLockedMatch(env, session.playerId, teamA, teamB, players);
      createdMatchIds.push(matchId);
    }

    const queueAfter = await getQueuePlayers(env);
    return json({
      ok: true,
      data: {
        createdMatchIds,
        consumedPlayers: createdMatchIds.length * 10,
        remainingQueuePlayers: queueAfter.length,
      },
    });
  }

  const startMatch = pathname.match(/^\/api\/admin\/matches\/(\d+)\/start$/);
  if (startMatch && request.method === "POST") {
    await requireAuth(request, env, ["admin"]);
    const matchId = Number(startMatch[1]);
    const match = await getMatchById(env, matchId);
    if (!match) return notFound("对局不存在");
    if (match.status !== "locked") return badRequest(`当前对局状态 ${match.status} 不能开局`);

    const now = nowIso();
    await env.DB.batch([
      env.DB.prepare("UPDATE matches SET status='in_game', started_at=? WHERE id=?").bind(now, matchId),
      env.DB.prepare("UPDATE players SET status='in_game', updated_at=? WHERE current_match_id=?").bind(now, matchId),
      env.DB.prepare("UPDATE queue_entries SET state='matched' WHERE match_id=? AND state='locked'").bind(matchId),
    ]);
    return json({ ok: true, data: { matchId, status: "in_game" } });
  }

  const finishMatch = pathname.match(/^\/api\/admin\/matches\/(\d+)\/finish$/);
  if (finishMatch && request.method === "POST") {
    await requireAuth(request, env, ["admin"]);
    const matchId = Number(finishMatch[1]);
    const payload = await readJsonBody(request);
    const winnerTeam = payload.winnerTeam;
    if (!["A", "B"].includes(winnerTeam)) return badRequest("winnerTeam 仅允许 A 或 B");

    const match = await getMatchById(env, matchId);
    if (!match) return notFound("对局不存在");
    if (!["locked", "in_game"].includes(match.status)) {
      return badRequest(`当前对局状态 ${match.status} 不能结算`);
    }

    const participants = await env.DB.prepare(
      "SELECT mp.player_id as db_player_id, mp.team, p.player_id FROM match_players mp JOIN players p ON p.id=mp.player_id WHERE mp.match_id=?"
    )
      .bind(matchId)
      .all();
    if ((participants.results || []).length !== 10) {
      return badRequest("对局参与人数不是10，无法结算");
    }

    const now = nowIso();
    const statements = [
      env.DB.prepare("UPDATE matches SET status='finished', ended_at=?, winner_team=? WHERE id=?").bind(
        now,
        winnerTeam,
        matchId
      ),
    ];

    for (const row of participants.results) {
      const win = row.team === winnerTeam ? 1 : 0;
      const result = win ? "win" : "lose";

      statements.push(
        env.DB.prepare("UPDATE match_players SET result=? WHERE match_id=? AND player_id=?").bind(
          result,
          matchId,
          row.db_player_id
        )
      );
      statements.push(
        env.DB.prepare(
          "UPDATE players SET status='idle', current_match_id=NULL, wins=wins+?, total_games=total_games+1, updated_at=? WHERE id=?"
        ).bind(win, now, row.db_player_id)
      );
    }

    await env.DB.batch(statements);
    return json({ ok: true, data: { matchId, status: "finished", winnerTeam } });
  }

  const correctWinner = pathname.match(/^\/api\/admin\/matches\/(\d+)\/correct-winner$/);
  if (correctWinner && request.method === "POST") {
    await requireAuth(request, env, ["admin"]);
    const matchId = Number(correctWinner[1]);
    const payload = await readJsonBody(request);
    const winnerTeam = payload.winnerTeam;
    if (!["A", "B"].includes(winnerTeam)) return badRequest("winnerTeam 仅允许 A 或 B");

    const match = await getMatchById(env, matchId);
    if (!match) return notFound("对局不存在");
    if (match.status !== "finished") return badRequest("仅已完成对局支持改判");
    if (!match.winner_team) return badRequest("当前对局无已记录胜方，无法改判");
    if (match.winner_team === winnerTeam) {
      return json({ ok: true, data: { matchId, winnerTeam, unchanged: true } });
    }

    const participants = await env.DB.prepare(
      "SELECT mp.player_id as db_player_id, mp.team FROM match_players mp WHERE mp.match_id=?"
    )
      .bind(matchId)
      .all();
    if ((participants.results || []).length !== 10) {
      return badRequest("对局参与人数不是10，无法改判");
    }

    const oldWinner = match.winner_team;
    const now = nowIso();
    const statements = [
      env.DB.prepare("UPDATE matches SET winner_team=?, ended_at=? WHERE id=?").bind(winnerTeam, now, matchId),
    ];

    for (const row of participants.results) {
      const wasWin = row.team === oldWinner ? 1 : 0;
      const nowWin = row.team === winnerTeam ? 1 : 0;
      const delta = nowWin - wasWin;
      const result = nowWin ? "win" : "lose";

      statements.push(
        env.DB.prepare("UPDATE match_players SET result=? WHERE match_id=? AND player_id=?").bind(
          result,
          matchId,
          row.db_player_id
        )
      );
      if (delta !== 0) {
        statements.push(
          env.DB.prepare("UPDATE players SET wins=wins+?, updated_at=? WHERE id=?").bind(delta, now, row.db_player_id)
        );
      }
    }

    await env.DB.batch(statements);
    return json({ ok: true, data: { matchId, winnerTeam, correctedFrom: oldWinner } });
  }

  return notFound("接口不存在");
}

async function buildBoard(env) {
  const playersRes = await env.DB.prepare(
    "SELECT player_id, display_name, wins, total_games, status FROM players ORDER BY wins DESC, total_games DESC, player_id ASC"
  ).all();
  const players = playersRes.results || [];

  const rankingWins = players.map((p) => ({
    name: p.display_name || p.player_id,
    playerId: p.player_id,
    value: p.wins,
  }));
  const rankingTotal = players.map((p) => ({
    name: p.display_name || p.player_id,
    playerId: p.player_id,
    value: p.total_games,
  }));
  const rankingLoss = players.map((p) => ({
    name: p.display_name || p.player_id,
    playerId: p.player_id,
    value: Math.max(0, p.total_games - p.wins),
  }));
  const rankingRate = players.map((p) => ({
    name: p.display_name || p.player_id,
    playerId: p.player_id,
    value: p.total_games > 0 ? Number(((p.wins / p.total_games) * 100).toFixed(2)) : 0,
  }));
  const rankingQueue = players.map((p) => ({
    name: p.display_name || p.player_id,
    playerId: p.player_id,
    value: p.status === "queueing" ? 1 : 0,
  }));
  const rankingReady = players.map((p) => ({
    name: p.display_name || p.player_id,
    playerId: p.player_id,
    value: p.status === "idle" ? 1 : 0,
  }));

  return {
    meta: {
      round: "冬天杯4.0",
      mode: "5v5 匹配",
      playerCount: players.length,
      updatedAt: nowIso(),
    },
    metrics: {
      score: { label: "胜场", icon: "🏆", ranking: rankingWins },
      mvp: { label: "总场次", icon: "🎮", ranking: rankingTotal },
      kills: { label: "胜率(%)", icon: "📈", ranking: rankingRate },
      deaths: { label: "负场", icon: "📉", ranking: rankingLoss },
      kda: { label: "匹配中", icon: "⏳", ranking: rankingQueue },
      damage: { label: "空闲", icon: "✅", ranking: rankingReady },
    },
  };
}

async function ensureSeedPlayers(env) {
  const countRes = await env.DB.prepare("SELECT COUNT(*) AS c FROM players").first();
  const existing = Number(countRes?.c || 0);
  if (existing > 0) return;

  const baseTime = Date.now() - 21 * 60000;
  const statements = [];
  for (let i = 1; i <= 21; i += 1) {
    const pid = `player${String(i).padStart(2, "0")}`;
    const displayName = `选手${String(i).padStart(2, "0")}`;
    const totalGames = 4 + Math.floor(Math.random() * 17);
    const wins = Math.floor(Math.random() * (totalGames + 1));
    const time = new Date(baseTime + i * 60000).toISOString();

    statements.push(
      env.DB.prepare(
        "INSERT INTO players (player_id, display_name, status, wins, total_games, created_at, updated_at, last_seen_at) VALUES (?, ?, 'queueing', ?, ?, ?, ?, ?)"
      ).bind(pid, displayName, wins, totalGames, time, time, time)
    );
  }

  await env.DB.batch(statements);

  const inserted = await env.DB.prepare("SELECT id FROM players ORDER BY id ASC").all();
  const queueStatements = [];
  for (const row of inserted.results || []) {
    queueStatements.push(await insertQueueEntryStmt(env, row.id, nowIso()));
  }
  await env.DB.batch(queueStatements);
}

async function getAdminDashboard(env) {
  const playersRes = await env.DB.prepare(
    "SELECT id, player_id, display_name, status, wins, total_games, current_match_id, updated_at, last_seen_at FROM players ORDER BY status ASC, player_id ASC"
  ).all();
  const queue = await getQueuePlayers(env);
  const matchesRes = await env.DB.prepare(
    "SELECT id, status, created_by, created_at, started_at, ended_at, winner_team FROM matches ORDER BY id DESC LIMIT 20"
  ).all();

  const matches = matchesRes.results || [];
  const teamMap = await getMatchTeamMap(env, matches.map((m) => m.id));
  const enrichedMatches = matches.map((m) => ({
    ...m,
    teamAPlayers: teamMap.get(m.id)?.A || [],
    teamBPlayers: teamMap.get(m.id)?.B || [],
  }));

  const players = (playersRes.results || []).map((p) => ({
    id: p.id,
    playerId: p.player_id,
    displayName: p.display_name || p.player_id,
    status: p.status,
    wins: p.wins,
    totalGames: p.total_games,
    losses: Math.max(0, p.total_games - p.wins),
    winRate: p.total_games ? Number(((p.wins / p.total_games) * 100).toFixed(2)) : 0,
    currentMatchId: p.current_match_id,
    updatedAt: p.updated_at,
    lastSeenAt: p.last_seen_at,
  }));

  return {
    summary: {
      totalPlayers: players.length,
      idlePlayers: players.filter((p) => p.status === "idle").length,
      queueingPlayers: players.filter((p) => p.status === "queueing").length,
      lockedPlayers: players.filter((p) => p.status === "locked").length,
      inGamePlayers: players.filter((p) => p.status === "in_game").length,
    },
    queue,
    matches: enrichedMatches,
    players,
    updatedAt: nowIso(),
  };
}

async function getQueuePlayers(env) {
  const queueRes = await env.DB.prepare(
    "SELECT p.id, p.player_id, p.display_name, p.wins, p.total_games FROM players p JOIN queue_entries q ON q.player_id=p.id WHERE p.status='queueing' AND q.state='queueing' ORDER BY q.id ASC"
  ).all();

  return (queueRes.results || []).map((row) => ({
    id: row.id,
    playerId: row.player_id,
    displayName: row.display_name || row.player_id,
    wins: row.wins,
    totalGames: row.total_games,
  }));
}

async function getMatchTeamMap(env, matchIds) {
  const map = new Map();
  if (!matchIds.length) return map;
  const placeholders = matchIds.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT mp.match_id, mp.team, p.player_id
     FROM match_players mp
     JOIN players p ON p.id = mp.player_id
     WHERE mp.match_id IN (${placeholders})
     ORDER BY mp.match_id ASC, mp.team ASC, p.player_id ASC`
  )
    .bind(...matchIds)
    .all();

  for (const row of rows.results || []) {
    if (!map.has(row.match_id)) {
      map.set(row.match_id, { A: [], B: [] });
    }
    map.get(row.match_id)[row.team].push(row.player_id);
  }
  return map;
}

async function upsertPlayer(env, playerId, displayName) {
  const now = nowIso();
  const existing = await env.DB.prepare("SELECT * FROM players WHERE player_id=?").bind(playerId).first();
  if (existing) {
    await env.DB.prepare("UPDATE players SET display_name=?, updated_at=?, last_seen_at=? WHERE id=?")
      .bind(displayName || playerId, now, now, existing.id)
      .run();
    return getPlayerByDbId(env, existing.id);
  }

  const inserted = await env.DB.prepare(
    "INSERT INTO players (player_id, display_name, status, created_at, updated_at, last_seen_at) VALUES (?, ?, 'idle', ?, ?, ?)"
  )
    .bind(playerId, displayName || playerId, now, now, now)
    .run();
  return getPlayerByDbId(env, inserted.meta.last_row_id);
}

async function getPlayerByDbId(env, id) {
  return env.DB.prepare("SELECT * FROM players WHERE id=?").bind(id).first();
}

async function getPlayersByPlayerIds(env, playerIds) {
  if (!playerIds.length) return [];
  const placeholders = playerIds.map(() => "?").join(",");
  const query = `SELECT * FROM players WHERE player_id IN (${placeholders})`;
  const res = await env.DB.prepare(query)
    .bind(...playerIds)
    .all();
  return res.results || [];
}

async function createLockedMatch(env, createdBy, teamAIds, teamBIds, players) {
  const now = nowIso();
  const inserted = await env.DB.prepare(
    "INSERT INTO matches (status, created_by, created_at) VALUES ('locked', ?, ?)"
  )
    .bind(createdBy, now)
    .run();
  const matchId = inserted.meta.last_row_id;
  const playerByPid = new Map(players.map((p) => [p.player_id, p]));
  const statements = [];

  for (const pid of teamAIds) {
    const p = playerByPid.get(pid);
    statements.push(
      env.DB.prepare("INSERT INTO match_players (match_id, player_id, team) VALUES (?, ?, 'A')").bind(matchId, p.id)
    );
    statements.push(
      env.DB.prepare("UPDATE players SET status='locked', current_match_id=?, updated_at=? WHERE id=?").bind(
        matchId,
        now,
        p.id
      )
    );
    statements.push(
      env.DB.prepare(
        "UPDATE queue_entries SET state='locked', match_id=? WHERE id=(SELECT id FROM queue_entries WHERE player_id=? AND state='queueing' ORDER BY id DESC LIMIT 1)"
      ).bind(matchId, p.id)
    );
  }

  for (const pid of teamBIds) {
    const p = playerByPid.get(pid);
    statements.push(
      env.DB.prepare("INSERT INTO match_players (match_id, player_id, team) VALUES (?, ?, 'B')").bind(matchId, p.id)
    );
    statements.push(
      env.DB.prepare("UPDATE players SET status='locked', current_match_id=?, updated_at=? WHERE id=?").bind(
        matchId,
        now,
        p.id
      )
    );
    statements.push(
      env.DB.prepare(
        "UPDATE queue_entries SET state='locked', match_id=? WHERE id=(SELECT id FROM queue_entries WHERE player_id=? AND state='queueing' ORDER BY id DESC LIMIT 1)"
      ).bind(matchId, p.id)
    );
  }

  await env.DB.batch(statements);
  return matchId;
}

async function insertQueueEntryStmt(env, playerDbId, now) {
  const hasQueuedAt = await hasColumn(env, "queue_entries", "queued_at");
  if (hasQueuedAt) {
    return env.DB.prepare("INSERT INTO queue_entries (player_id, state, queued_at) VALUES (?, 'queueing', ?)")
      .bind(playerDbId, now);
  }
  return env.DB.prepare("INSERT INTO queue_entries (player_id, state) VALUES (?, 'queueing')")
    .bind(playerDbId);
}

async function hasColumn(env, tableName, columnName) {
  const info = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
  return (info.results || []).some((row) => row.name === columnName);
}

async function getMatchById(env, matchId) {
  return env.DB.prepare("SELECT * FROM matches WHERE id=?").bind(matchId).first();
}

async function createSession(env, session) {
  const token = crypto.randomUUID().replaceAll("-", "");
  const ttl = Number(env.SESSION_TTL_SECONDS || "86400");
  const data = {
    role: session.role,
    playerDbId: session.playerDbId,
    playerId: session.playerId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + ttl * 1000,
  };
  await env.SESSIONS.put(`session:${token}`, JSON.stringify(data), { expirationTtl: ttl });
  return token;
}

async function requireAuth(request, env, allowedRoles) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw httpError(401, "UNAUTHORIZED", "缺少登录令牌");

  const raw = await env.SESSIONS.get(`session:${token}`);
  if (!raw) throw httpError(401, "UNAUTHORIZED", "登录已过期");

  const session = JSON.parse(raw);
  if (!allowedRoles.includes(session.role)) {
    throw httpError(403, "FORBIDDEN", "无权限访问");
  }

  return { ...session, token };
}

async function deleteSession(env, token) {
  if (!token) return;
  await env.SESSIONS.delete(`session:${token}`);
}

function getPlayerActions(status) {
  return {
    canStartQueue: status === "idle",
    canCancelQueue: status === "queueing",
    canOperate: status === "idle" || status === "queueing",
  };
}

function sanitizePlayer(player) {
  return {
    id: player.id,
    playerId: player.player_id,
    displayName: player.display_name || player.player_id,
    status: player.status,
    wins: player.wins,
    totalGames: player.total_games,
    losses: Math.max(0, player.total_games - player.wins),
    winRate: player.total_games ? Number(((player.wins / player.total_games) * 100).toFixed(2)) : 0,
    currentMatchId: player.current_match_id || null,
    updatedAt: player.updated_at,
  };
}

function safeText(v) {
  return typeof v === "string" ? v.trim() : "";
}

function toNonNegativeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeImportStatus(v) {
  const text = String(v || "").trim().toLowerCase();
  if (text === "queueing" || text === "匹配中") return "queueing";
  return "idle";
}

function nowIso() {
  return new Date().toISOString();
}

function json(payload, status = 200) {
  return withCors(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    })
  );
}

function withCors(response) {
  response.headers.set("access-control-allow-origin", "*");
  response.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  response.headers.set("access-control-allow-headers", "content-type,authorization");
  return response;
}

function badRequest(message) {
  return json({ ok: false, error: "BAD_REQUEST", message }, 400);
}

function unauthorized(message) {
  return json({ ok: false, error: "UNAUTHORIZED", message }, 401);
}

function notFound(message) {
  return json({ ok: false, error: "NOT_FOUND", message }, 404);
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function requireRateLimit(env, request, action) {
  const cfIp = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const key = `ratelimit:${action}:${cfIp}`;
  const raw = await env.SESSIONS.get(key);
  const now = Date.now();

  if (!raw) {
    await env.SESSIONS.put(key, JSON.stringify({ count: 1, ts: now }), { expirationTtl: 60 });
    return;
  }

  const parsed = JSON.parse(raw);
  const count = Number(parsed.count || 0) + 1;
  if (count > 20) {
    throw httpError(429, "RATE_LIMITED", "请求过于频繁，请稍后重试");
  }
  await env.SESSIONS.put(key, JSON.stringify({ count, ts: now }), { expirationTtl: 60 });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
