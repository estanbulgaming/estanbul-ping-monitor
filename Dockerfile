FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --production

COPY . .

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
