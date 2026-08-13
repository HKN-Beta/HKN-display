FROM node:24-bookworm-slim AS builder

WORKDIR /app

ARG NPM_VERSION=11.17.0
RUN npm install -g npm@${NPM_VERSION}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]

