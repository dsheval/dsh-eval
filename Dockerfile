FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
# CI audits the full lockfile before building; keep network audits outside cached layers.
RUN npm ci --no-audit --no-fund

# Keep website inputs explicit: docs, CI scripts and evaluation runners do not
# affect the compiled site. The two result snapshots are imported by app/data.
COPY vite.config.ts next.config.ts tsconfig.json ./
COPY .openai/hosting.json ./.openai/hosting.json
COPY app ./app
COPY public ./public
COPY evals/deep-research/results/v12/results.json evals/deep-research/results/v12/leaderboard.json ./evals/deep-research/results/v12/
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

# System packages can stay cached when only the npm lockfile changes.
RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist/standalone ./
COPY docker/nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

CMD ["sh", "-c", "nginx && exec node server.js"]
