FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN chown -R bun:bun /app
EXPOSE 3001
USER bun
CMD ["bun", "run", "index.ts"]
