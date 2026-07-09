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
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  winner_team TEXT CHECK (winner_team IN ('A', 'B'))
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

CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_state ON queue_entries(state);
CREATE INDEX IF NOT EXISTS idx_match_players_match_team ON match_players(match_id, team);
CREATE INDEX IF NOT EXISTS idx_matches_status_created_at ON matches(status, created_at);
