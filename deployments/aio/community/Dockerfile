ARG PLANE_VERSION=v0.27.1
FROM --platform=$BUILDPLATFORM tonistiigi/binfmt AS binfmt

# **************************************************
#  STAGE 0: Image Loading
# **************************************************
FROM node:22-alpine AS node

FROM makeplane/plane-frontend:${PLANE_VERSION} AS web-img
FROM makeplane/plane-backend:${PLANE_VERSION} AS backend-img
FROM makeplane/plane-space:${PLANE_VERSION} AS space-img
FROM makeplane/plane-admin:${PLANE_VERSION} AS admin-img
FROM makeplane/plane-live:${PLANE_VERSION} AS live-img
FROM makeplane/plane-proxy:${PLANE_VERSION} AS proxy-img

# **************************************************
#  STAGE 1: Runner
# **************************************************
FROM backend-img AS runner

COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /uvx /bin/

WORKDIR /app

RUN apk add --no-cache \
    "libpq" \
    "libxslt" \
    "xmlsec"


COPY --from=node /usr/lib /usr/lib
COPY --from=node /usr/local/lib /usr/local/lib
COPY --from=node /usr/local/include /usr/local/include
COPY --from=node /usr/local/bin /usr/local/bin

COPY --from=web-img /usr/share/nginx/html /app/web
COPY --from=space-img /app /app/space
COPY --from=admin-img /usr/share/nginx/html/god-mode /app/admin
COPY --from=live-img /app /app/live

RUN rm -rf /app/space/apps/space/.next/cache

COPY --from=proxy-img /usr/bin/caddy /usr/bin/caddy
COPY dist/Caddyfile /app/proxy/Caddyfile

COPY --from=backend-img /code /app/backend

RUN apk add --no-cache nss-tools bash curl uuidgen ncdu vim

COPY pyproject.toml uv.lock ./
RUN uv export --frozen --no-default-groups --no-emit-project --output-file /tmp/plane-aio.lock \
    && uv pip install --system --strict --compile-bytecode --no-cache --requirements /tmp/plane-aio.lock \
    && rm /tmp/plane-aio.lock
RUN mkdir -p /etc/supervisor/conf.d

COPY start.sh /app/start.sh
COPY dist/plane.env /app/plane.env
COPY supervisor.conf /etc/supervisor/conf.d/supervisor.conf

RUN mkdir -p /app/logs/access && \
    mkdir -p /app/logs/error && \
    mkdir -p /app/data && \
    chmod +x /app/start.sh

VOLUME ["/app/data", "/app/logs"]

EXPOSE 80 443

CMD ["/app/start.sh"] 
