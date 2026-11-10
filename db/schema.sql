CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  timezone      TEXT NOT NULL DEFAULT 'Asia/Dubai',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist (
  id       SERIAL PRIMARY KEY,
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol   TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS briefs (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  status     TEXT NOT NULL,           -- 'quiet' | 'alerts'
  mode       TEXT NOT NULL,           -- 'quiet' | 'ai' | 'template'
  headline   TEXT NOT NULL,
  body       JSONB NOT NULL,
  facts      JSONB NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, brief_date)
);

CREATE TABLE IF NOT EXISTS brief_alerts (
  id         SERIAL PRIMARY KEY,
  brief_id   INT NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol     TEXT NOT NULL,
  kind       TEXT NOT NULL,           -- 'jump' | 'drop' | 'earnings_soon'
  change_pct DOUBLE PRECISION NOT NULL,
  price      DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paper_ideas (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('long','short')),
  entry_price DOUBLE PRECISION NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  alert_id    INT REFERENCES brief_alerts(id) ON DELETE SET NULL,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ,
  close_price DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS job_runs (
  id          SERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running',  -- running | ok | failed
  detail      TEXT
);

CREATE TABLE IF NOT EXISTS prices (
  symbol TEXT NOT NULL,
  day    DATE NOT NULL,
  open   DOUBLE PRECISION NOT NULL,
  high   DOUBLE PRECISION NOT NULL,
  low    DOUBLE PRECISION NOT NULL,
  close  DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION NOT NULL DEFAULT 0,
  PRIMARY KEY (symbol, day)
);

CREATE TABLE IF NOT EXISTS price_sync (
  symbol    TEXT PRIMARY KEY,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source    TEXT NOT NULL
);
