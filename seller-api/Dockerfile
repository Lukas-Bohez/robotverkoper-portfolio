# The seller API: NestJS + GraphQL + MongoDB. Two stages: build with everything, run with only what runs.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
# The schema stays in memory: the container runs as `node` and may not write in dist/
ENV BIND_HOST=0.0.0.0 \
    PORT=4200 \
    GRAPHQL_SCHEMA_FILE=memory
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist

# The demo (docker-compose.yml) uses local logins; the firebase override sets NODE_ENV=production, which refuses them
USER node
EXPOSE 4200
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4200/health || exit 1
CMD ["node", "dist/main.js"]
