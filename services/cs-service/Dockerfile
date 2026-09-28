FROM node:20-alpine

WORKDIR /app

# Build context is the MONOREPO ROOT (see docker-compose.yml, Phase 5),
# not this service's own folder - this lets us copy shared/ alongside
# the service without a symlink or npm workspace setup.
COPY services/cs-service/package.json ./
RUN npm install --omit=dev

COPY services/cs-service/src ./src
COPY shared ./shared
COPY proto ./proto

EXPOSE 5001

CMD ["node", "src/server.js"]
