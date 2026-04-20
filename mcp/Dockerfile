FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json ./
COPY mcp/package.json ./mcp/
COPY bun.lock ./

RUN bun install --frozen-lockfile

# Copy source
COPY mcp/src ./mcp/src
COPY mcp/tsconfig.json ./mcp/

CMD ["bun", "run", "mcp/src/index.ts"]
