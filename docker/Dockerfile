# Multi-stage production image for the Neuron MCP server.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/mcp-server/package.json apps/mcp-server/
COPY apps/cli/package.json apps/cli/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/observability/package.json packages/observability/
COPY packages/security/package.json packages/security/
COPY packages/ops/package.json packages/ops/
COPY packages/storage/package.json packages/storage/
COPY packages/memory-engine/package.json packages/memory-engine/
COPY packages/ai-memory/package.json packages/ai-memory/
COPY packages/ai-provider/package.json packages/ai-provider/
COPY packages/embeddings/package.json packages/embeddings/
COPY packages/project-analyzer/package.json packages/project-analyzer/
COPY packages/agent-workflow/package.json packages/agent-workflow/
COPY packages/knowledge-graph/package.json packages/knowledge-graph/
COPY packages/agent-intelligence/package.json packages/agent-intelligence/
RUN pnpm install --frozen-lockfile --filter @neuron-ai-memory/mcp-server...

FROM deps AS build
COPY . .
RUN pnpm --filter @neuron-ai-memory/mcp-server... build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV LOG_LEVEL=info
RUN groupadd -r neuron && useradd -r -g neuron neuron \
  && corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY --from=build --chown=neuron:neuron /app /app
USER neuron
WORKDIR /app/apps/mcp-server
# Graceful shutdown: Node receives SIGTERM; MCP stdio exits cleanly.
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"
CMD ["node", "dist/index.js"]
