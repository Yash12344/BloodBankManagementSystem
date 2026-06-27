# Multi-stage build for the BloodLine API + worker (shared image).
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install all workspace dependencies ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
# Add pnpm-lock.yaml to the COPY above and use --frozen-lockfile once it is committed.
RUN pnpm install

# ---- build: generate prisma client + compile api ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @bloodline/db generate \
  && pnpm --filter @bloodline/api build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
