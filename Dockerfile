# syntax=docker/dockerfile:1
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
# cache mount keeps downloaded packages between deploys; optional deps (embedded-postgres, dev only) are skipped
RUN --mount=type=cache,target=/root/.npm npm ci --omit=optional --no-audit --no-fund
COPY . .
# cache mount keeps Next's build cache between deploys
RUN --mount=type=cache,target=/app/.next/cache npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && npm start"]