-- Users: people who sign in. password_hash is null for SSO-only Users.
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE CHECK (email = lower(email)),
  name              text NOT NULL,
  company           text NOT NULL DEFAULT '',
  password_hash     text,
  role              text NOT NULL DEFAULT 'partner' CHECK (role IN ('admin', 'sales_engineer', 'partner')),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'disabled')),
  locale            text NOT NULL DEFAULT 'pt-BR',
  mfa_secret_enc    text,
  mfa_enabled       boolean NOT NULL DEFAULT false,
  mfa_last_step     bigint,
  failed_logins     integer NOT NULL DEFAULT 0,
  locked_until      timestamptz,
  decided_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- External identities (Google SSO, later). A User signs in with SSO only when an identity links to them.
CREATE TABLE auth_identities (
  provider    text NOT NULL,
  subject     text NOT NULL,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);

-- Server-side sessions. id is the SHA-256 of the cookie token, so a database leak yields no usable cookie.
CREATE TABLE sessions (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mfa_verified  boolean NOT NULL DEFAULT false,
  ip            text NOT NULL DEFAULT '',
  user_agent    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- One-time password reset links issued by an Admin. id is the SHA-256 of the token.
CREATE TABLE password_resets (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE TABLE pocs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_url   text NOT NULL,
  tenant_id      text NOT NULL,
  tenant_name    text NOT NULL DEFAULT '',
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  details        jsonb NOT NULL,
  arch_image     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (period_start <= period_end)
);
CREATE INDEX pocs_owner_id_idx ON pocs (owner_id);

-- Report Data: frozen output of one Sync.
CREATE TABLE report_data (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id      uuid NOT NULL REFERENCES pocs(id) ON DELETE CASCADE,
  version     integer NOT NULL,
  data        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_data_poc_id_idx ON report_data (poc_id);
CREATE INDEX report_data_created_at_idx ON report_data (created_at);

CREATE TABLE syncs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id          uuid NOT NULL REFERENCES pocs(id) ON DELETE CASCADE,
  requested_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  progress        jsonb,
  error           text,
  report_data_id  uuid REFERENCES report_data(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz
);
CREATE INDEX syncs_poc_id_idx ON syncs (poc_id);

CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES
  ('retention_days', '90'),
  ('registration_allowed_domains', '[]');

CREATE TABLE audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  target     text,
  ip         text,
  meta       jsonb
);
CREATE INDEX audit_log_at_idx ON audit_log (at);
