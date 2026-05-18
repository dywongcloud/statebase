FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @statebase/core build \
  && pnpm --filter @statebase/parser build \
  && pnpm --filter @statebase/db build \
  && pnpm --filter @statebase/api build

EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @statebase/db migrate && pnpm --filter @statebase/api start"]
