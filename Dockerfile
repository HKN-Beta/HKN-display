# ==========================================
# Phase 1: Build Environment
# ==========================================
FROM node:26.12.1-alpine AS builder

WORKDIR /app

# Upgrade to latest npm matching package.json packageManager
RUN npm install -g npm@12.2.1

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy all source files
COPY . .

# Build the standalone Nuxt / Nitro production server
RUN npm run build

# ==========================================
# Phase 2: Production Server Runner
# ==========================================
FROM node:26.12.1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Upgrade packages and remove npm/npx (which are not needed at runtime) to eliminate
# base-image vulnerabilities (CVE-2026-102278, CVE-2026-102276, CVE-2026-19534, CVE-2026-101910, etc.)
RUN apk update && apk upgrade --no-cache && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /root/.npm

# Copy production bundle from builder
COPY --from=builder --chown=node:node /app/.output /app/.output

# Build-time arguments for release metadata
ARG BUILD_DATE
ARG VERSION

# OpenContainers metadata labels
LABEL org.opencontainers.image.title="IEEE-HKN Beta Chapter Display" \
      org.opencontainers.image.description="Interactive display platform for IEEE-HKN Beta Chapter at Purdue University" \
      org.opencontainers.image.url="https://purduehkn.org" \
      org.opencontainers.image.vendor="IEEE-HKN Beta Chapter" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# Run directly as non-privileged node user (UID 1000)
USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
