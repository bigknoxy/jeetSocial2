# Build Stage
FROM oven/bun:1 AS builder
WORKDIR /app
COPY app/client/package.json app/client/bun.lock ./
RUN bun install
COPY app/client .
RUN bun run build

# Run Stage
FROM oven/bun:1
WORKDIR /app
COPY app/server/package.json app/server/bun.lock ./
RUN bun install
COPY app/server .
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data && chown -R bun:bun /app
EXPOSE 3000
USER bun
CMD ["bun", "run", "index.ts"]
