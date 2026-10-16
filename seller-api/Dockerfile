# The seller API with its own SQLite database (node:sqlite, so no native build step).
FROM node:24-alpine

WORKDIR /app
COPY package.json package-lock.json ./
# Only what runs: the one package (jose) for checking Firebase tokens
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src

ENV BIND_HOST=0.0.0.0 \
    PORT=4200 \
    DB_PATH=/data/seller.db
# The database lives in a volume, so it survives a new container
RUN mkdir /data && chown node:node /data
VOLUME /data

USER node
EXPOSE 4200
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4200/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]
