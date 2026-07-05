FROM node:20-alpine AS base
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/src ./src
COPY datasets ./datasets
COPY docs/figures ./docs/figures

ENV NODE_ENV=production
EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:5050/api/health || exit 1

CMD ["node", "src/server.js"]
