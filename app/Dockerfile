# Build Stage
FROM oven/bun:latest AS builder
WORKDIR /app
COPY app/client/package.json app/client/bun.lock ./
RUN bun install
COPY app/client .
RUN bun run build

# Run Stage
FROM oven/bun:latest
WORKDIR /app
COPY app/server/package.json app/server/bun.lock ./
RUN bun install
COPY app/server .
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["bun", "run", "index.ts"]
