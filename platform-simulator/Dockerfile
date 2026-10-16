# The platform simulator: plays the platform of the companies with made-up data. Demo only: it refuses NODE_ENV=production.
# No packages are needed to run it (Node strips the TypeScript types itself).
FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src

# 0.0.0.0: reachable from the other containers and from a robot app on the host or a phone
ENV BIND_HOST=0.0.0.0 \
    PORT=4100 \
    STATE_FILE=/data/state.json
RUN mkdir /data && chown node:node /data
VOLUME /data

USER node
EXPOSE 4100
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4100/health || exit 1
CMD ["node", "src/main.ts"]
