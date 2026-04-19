FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json bun.lock ./
COPY api/package.json ./api/
COPY db/package.json ./db/

# Install all workspace dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY api/src ./api/src
COPY api/tsconfig.json ./api/
COPY db/src ./db/src

# Run migrations then start API
CMD ["sh", "-c", "bun run db/src/migrate.ts && bun run api/src/index.ts"]
