# The seller PWA, in two flavours (choose with `target`):
#   dev   Vite dev server with local demo logins, no Firebase and no internet needed (the default of docker-compose.yml)
#   prod  the built PWA, served by nginx, with Firebase logins (docker-compose.firebase.yml)

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── dev: the same thing `npm run dev` does in Lukas/, in a container ─────────────────────
FROM deps AS dev
COPY . .
# The browser (on the host) calls the API on this address
ENV VITE_API_URL=http://localhost:4200 \
    VITE_AUTH_MODE=dev
EXPOSE 5174
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5174"]

# ── build: the Firebase web config is public by design; it comes in as build arguments ──
FROM deps AS build
ARG VITE_API_URL=http://localhost:4200
ARG VITE_FIREBASE_apiKey
ARG VITE_FIREBASE_authDomain
ARG VITE_FIREBASE_projectId
ARG VITE_FIREBASE_storageBucket
ARG VITE_FIREBASE_messagingSenderId
ARG VITE_FIREBASE_appId
ENV VITE_API_URL=$VITE_API_URL \
    VITE_FIREBASE_apiKey=$VITE_FIREBASE_apiKey \
    VITE_FIREBASE_authDomain=$VITE_FIREBASE_authDomain \
    VITE_FIREBASE_projectId=$VITE_FIREBASE_projectId \
    VITE_FIREBASE_storageBucket=$VITE_FIREBASE_storageBucket \
    VITE_FIREBASE_messagingSenderId=$VITE_FIREBASE_messagingSenderId \
    VITE_FIREBASE_appId=$VITE_FIREBASE_appId
COPY . .
# The types of the API (../seller-types) are checked in CI (type-check); the image only needs the bundle
RUN npx vite build

# ── prod ──────────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
