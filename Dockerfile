# ---------- 构建阶段 ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma:generate && pnpm build

# ---------- 运行阶段 ----------
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Prisma 引擎运行需要 openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./
EXPOSE 3000
# 启动时自动应用数据库迁移，再启动服务
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
