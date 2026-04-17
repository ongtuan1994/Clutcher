# Clutcher API — Cloud Run (Node 22 + Prisma + Express + tsx)
FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

COPY server ./server
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080
RUN npm prune --omit=dev

EXPOSE 8080
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
