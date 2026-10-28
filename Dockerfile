# syntax=docker/dockerfile:1
# One Dockerfile, three runtime targets: api, worker (adds Chromium for PDFs) and web (Caddy + static SPA).

FROM node:24-bookworm-slim AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm run build

FROM manifests AS server-deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev -w @poc-intel/server

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production
# PostgreSQL 17 client (pg_dump, pg_restore, psql) for the Admin backup and restore: it must match the
# server's major version, and Debian bookworm ships 15, hence the PostgreSQL apt repository.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSLo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 \
  && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=server-deps /app/node_modules node_modules
COPY apps/server/package.json apps/server/
COPY apps/server/migrations apps/server/migrations
COPY --from=build /app/apps/server/dist apps/server/dist
WORKDIR /app/apps/server
USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/main.js"]

FROM api AS worker
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# fonts-liberation: metric-compatible Helvetica/Arial, the Reports' typeface (the previous PDF used Helvetica).
RUN node /app/node_modules/playwright/cli.js install --with-deps chromium \
  && apt-get update && apt-get install -y --no-install-recommends fonts-liberation fonts-liberation2 \
  && rm -rf /var/lib/apt/lists/*
USER node
CMD ["node", "--enable-source-maps", "dist/worker.js"]

FROM caddy:2-alpine AS web
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
