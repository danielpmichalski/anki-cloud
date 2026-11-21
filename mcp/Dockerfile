FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json ./
COPY api/package.json ./api/
COPY db/package.json ./db/
COPY mcp/package.json ./mcp/
COPY bun.lock ./

RUN bun install --frozen-lockfile

# Copy source
COPY mcp/src ./mcp/src
COPY mcp/tsconfig.json ./mcp/

ARG VERSION=dev
ENV APP_VERSION=$VERSION
ENV MCP_TRANSPORT=http
EXPOSE 3001

CMD ["bun", "run", "mcp/src/index.ts"]
