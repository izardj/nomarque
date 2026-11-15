# Builds the Angular application and serves it as static files with nginx.
# Usage: docker build -f docker/web.Dockerfile .

FROM node:24-alpine AS build

ENV CI=true \
    NX_DAEMON=false \
    NX_CLOUD=false

RUN corepack enable && corepack prepare pnpm@12.14.0 --activate

WORKDIR /workspace

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm nx build web --configuration=production

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/apps/web/browser /usr/share/nginx/html

EXPOSE 80
