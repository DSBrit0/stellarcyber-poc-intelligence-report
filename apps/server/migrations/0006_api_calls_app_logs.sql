-- Every call to a Stellar Cyber Instance (never headers or bodies, so no credential or customer data).
CREATE TABLE api_calls (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  sync_id   uuid REFERENCES syncs(id) ON DELETE SET NULL,
  user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  instance  text NOT NULL,
  method    text NOT NULL,
  endpoint  text NOT NULL,
  path      text NOT NULL,
  query     jsonb,
  status    integer,
  outcome   text NOT NULL CHECK (outcome IN ('ok', 'http_error', 'network')),
  ms        integer NOT NULL,
  bytes     integer NOT NULL DEFAULT 0,
  retry     boolean NOT NULL DEFAULT false,
  error     text
);
CREATE INDEX api_calls_at_idx ON api_calls (at);
CREATE INDEX api_calls_sync_idx ON api_calls (sync_id);

-- Application log (api and worker): requests, warnings, errors and notable events.
CREATE TABLE app_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  level       text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  source      text NOT NULL,
  category    text NOT NULL,
  message     text NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  request_id  text,
  context     jsonb
);
CREATE INDEX app_logs_at_idx ON app_logs (at);
CREATE INDEX app_logs_level_idx ON app_logs (level, at);
