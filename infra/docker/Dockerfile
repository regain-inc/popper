# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy workspace files for dependency resolution
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
COPY apps/queue/package.json ./apps/queue/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/cache/package.json ./packages/cache/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build server and queue worker
RUN bun run --filter @popper/server build && \
    bun run --filter @popper/queue build

# Production stage — server
FROM oven/bun:1-slim AS server

WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and dependencies
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/config/policies ./config/policies

# Run as non-root user
USER bun

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/index.js"]

# Production stage — queue worker
FROM oven/bun:1-slim AS queue

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/queue/dist ./dist
COPY --from=builder /app/apps/queue/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Run as non-root user
USER bun

CMD ["bun", "run", "dist/index.js"]
