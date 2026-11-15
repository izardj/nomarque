# Builds a NestJS application of the monorepo (api or worker).
# The pruned output in apps/<app>/dist contains its own package.json and lockfile.
# Usage: docker build -f docker/node-app.Dockerfile --build-arg APP=api .

FROM node:24-alpine AS build

ARG APP

ENV CI=true \
    NX_DAEMON=false \
    NX_CLOUD=false

RUN corepack enable && corepack prepare pnpm@12.14.0 --activate

WORKDIR /workspace

COPY . .

RUN pnpm install --frozen-lockfile

# Builds the app and prunes its production dependencies into apps/<app>/dist.
RUN pnpm nx run "${APP}:prune"

FROM node:24-alpine AS runtime

ARG APP

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@12.14.0 --activate

WORKDIR /app

COPY --from=build /workspace/apps/${APP}/dist ./

RUN pnpm install --prod --frozen-lockfile

USER node

CMD ["node", "main.js"]
