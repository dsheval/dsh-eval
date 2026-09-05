FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
# CI audits the full lockfile before building; keep network audits outside cached layers.
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

COPY package.json package-lock.json ./

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist/standalone ./
COPY docker/nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

CMD ["sh", "-c", "nginx && exec node server.js"]
