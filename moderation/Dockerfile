FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN chown -R bun:bun /app
EXPOSE 3001
USER bun
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3001/moderate').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "run", "index.ts"]
