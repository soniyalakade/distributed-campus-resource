FROM node:20-alpine

WORKDIR /app

# Build context is the MONOREPO ROOT (see docker-compose.yml, Phase 5).
COPY gateway/package.json ./
RUN npm install --omit=dev

COPY gateway/src ./src
COPY shared ./shared
COPY proto ./proto

EXPOSE 4000

CMD ["node", "src/server.js"]
