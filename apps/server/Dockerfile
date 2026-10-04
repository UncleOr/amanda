# Amanda multiplayer server.
#
# A plain Node WebSocket server — it needs a host that keeps a connection open,
# so it runs on Fly.io / Railway / Render / any VPS, NOT on serverless functions.
# The client is a static site and can live anywhere.
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# The server imports the shared and engine workspaces as TypeScript source, so
# the whole monorepo comes along.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY data ./data

RUN pnpm install --frozen-lockfile --filter @amanda/server...

ENV NODE_ENV=production
# Hosts inject their own PORT; the server already reads it.
EXPOSE 2567
CMD ["pnpm", "--filter", "@amanda/server", "start"]
