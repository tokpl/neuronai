-- Demo schema (Postgres). The JS demo uses an in-memory stand-in.
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL,
  total NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id SERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
