PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'queueing', 'locked', 'in_game')),
  wins INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  current_match_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK (status IN ('locked', 'in_game', 'finished', 'cancelled')),
  cycle_id INTEGER,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  winner_team TEXT CHECK (winner_team IN ('A', 'B')),
  FOREIGN KEY (cycle_id) REFERENCES match_cycles(id)
);

CREATE TABLE IF NOT EXISTS match_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('A', 'B')),
  result TEXT CHECK (result IN ('win', 'lose')),
  FOREIGN KEY (match_id) REFERENCES matches(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS queue_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queueing', 'locked', 'cancelled', 'matched')),
  cancelled_at TEXT,
  match_id INTEGER,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (match_id) REFERENCES matches(id)
);

CREATE TABLE IF NOT EXISTS match_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_games INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_cycle_stats (
  cycle_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  assigned_games INTEGER NOT NULL DEFAULT 0,
  finished_games INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cycle_id, player_id),
  FOREIGN KEY (cycle_id) REFERENCES match_cycles(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS matchmaking_configs (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  winrate_tolerance REAL NOT NULL DEFAULT 0.10,
  max_shuffle_tries INTEGER NOT NULL DEFAULT 60,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_state ON queue_entries(state);
CREATE INDEX IF NOT EXISTS idx_match_players_match_team ON match_players(match_id, team);
CREATE INDEX IF NOT EXISTS idx_matches_status_created_at ON matches(status, created_at);
CREATE INDEX IF NOT EXISTS idx_player_cycle_stats_player ON player_cycle_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_match_cycles_status ON match_cycles(status);
