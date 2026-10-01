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
RUN node /app/node_modules/playwright/cli.js install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/*
USER node
CMD ["node", "--enable-source-maps", "dist/worker.js"]

FROM caddy:2-alpine AS web
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
