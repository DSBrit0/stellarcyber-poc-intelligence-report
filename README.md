# Stellar Cyber PoC Intelligence Report

An internal tool for Stellar Cyber Sales Engineers and Partners. It connects to a customer's Stellar Cyber Instance through the Open API, collects the evidence from a PoC period, and produces the final PoC Report: a responsive HTML page that can also be exported to PDF, in pt-BR, en or es.

It is the successor to [stellarcyber-poc-report](https://github.com/DSBrit0/stellarcyber-poc-report). The domain and decisions behind the redesign are documented in:
- [`CONTEXT.md`](CONTEXT.md): the domain glossary. Use these terms in code and conversation.
- [`docs/adr/`](docs/adr): the architecture decisions and why they were made.

## How it works

```
Browser ──HTTPS──▶ Caddy ──▶ api (Fastify) ──▶ PostgreSQL ◀── worker (Sync, PDF, retention)
                   (SPA)       sign-in, PoCs,     data + job queue       │
                               Reports (HTML)                            └──▶ Stellar Cyber Instance API
```

1. A User signs in with e-mail, password and TOTP. New accounts come from Registration and wait for an Admin's approval.
2. The User types a Stellar Credential, picks a Tenant and a period, and starts a Sync. The credential is never stored ([ADR 0005](docs/adr/0005-stellar-credential-never-stored.md)).
3. The worker calls the Instance API using pooled keep-alive connections behind an SSRF guard, condenses the results into Report Data, and stores it.
4. Reports render from the stored Report Data in any Template (Technical, Executive or Insight) and any language. The PDF is the same HTML printed by headless Chromium.
5. Report Data is deleted permanently once the Retention Period ends (90 days by default; an Admin can change it).

## Repository layout

| Path | What lives there |
|---|---|
| `apps/server` | Fastify API (`src/main.ts`) and worker (`src/worker.ts`): one codebase, two processes |
| `apps/server/src/stellar` | Typed Stellar Cyber client, endpoints, response schemas, collectors, SSRF guard |
| `apps/server/src/metrics` | Ported business rules (License Compliance, …) with unit tests |
| `apps/server/src/report` | Report Templates (React rendered to static HTML) and PDF rendering |
| `apps/server/migrations` | SQL migrations, applied automatically at start-up |
| `apps/web` | React + Vite SPA |
| `packages/shared` | Zod schemas and types shared by server and web; i18n catalogues |
| `infra/` | Caddyfile and server scripts (env bootstrap, deploy, backup, cron) |

## Development

Requires Node 24+ and Docker (to run PostgreSQL locally).

```bash
npm install
docker run -d --name poc-pg -e POSTGRES_USER=pocintel -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=pocintel -p 5432:5432 postgres:17-alpine
cp .env.example .env    # then set:
#   APP_ORIGIN=http://localhost:5173
#   DATABASE_URL=postgres://pocintel:dev@localhost:5432/pocintel
#   ENCRYPTION_KEY=$(openssl rand -base64 32)
npm run admin:create -w @poc-intel/server -- you@stellarcyber.ai "Your Name"
npm run dev:api      # :3000
npm run dev:worker
npm run dev:web      # :5173, proxies /api to :3000
```

Checks: `npm run typecheck` and `npm test`.

## Deployment (srv-poc-tool, 10.30.11.150)

The server is already prepared: Docker, ufw allowing only 10.30.0.0/16, fail2ban, and `/opt/poc-intel/{app,data,backups}`.

```bash
cd /opt/poc-intel/app
infra/scripts/init-env.sh        # first time only: .env with random secrets (back up ENCRYPTION_KEY)
infra/scripts/deploy.sh          # build and (re)start
docker compose exec api node dist/cli/create-admin.js admin@stellarcyber.ai "Full Name"   # first time only
infra/scripts/install-cron.sh    # daily backup at 02:30, keeps 14 dumps
```

Open `https://10.30.11.150`. The certificate comes from Caddy's internal CA, so browsers warn until that CA is trusted. Its root certificate is at `/opt/poc-intel/data/caddy/caddy/pki/authorities/local/root.crt`.

**When a domain is added**, set the following in `.env` and run `deploy.sh`; Caddy then obtains a Let's Encrypt certificate:
- `SITE_ADDRESS=poc.example.com`
- `TLS_MODE=you@example.com`
- `APP_ORIGIN=https://poc.example.com`

## Security model, in short

- **Passwords and MFA**: Argon2id password hashes. TOTP is required for every local account, with replay protection. A lockout with growing delays follows repeated failures, and auth routes are rate-limited per IP.
- **Sessions**: kept server-side in a `__Host-` cookie (HttpOnly, Secure, SameSite=Lax). Sessions last 12 h, expire after 30 minutes idle, and get a new id after MFA. The database stores only the SHA-256 of the token.
- **CSRF**: state-changing requests must carry the app's own `Origin`.
- **SSRF**: Instance URLs must be HTTPS. Every connection is checked at connect time against private, loopback and metadata ranges, which also defeats DNS rebinding.
- **Report pages**: served with a CSP that allows no scripts. Headless Chromium prints them with JavaScript and networking disabled.
- **Audit log**: covers sign-ins, Admin actions, Syncs and Report renders.
- **Prepared but not active**: Google SSO (the `auth_identities` table) and SMTP (`SMTP_*`).
