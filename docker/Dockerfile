FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM python:3.11-slim AS python-builder

WORKDIR /app

COPY python-abap-parser/ ./python-abap-parser/
RUN pip install --no-cache-dir -e ./python-abap-parser

FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=python-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn
COPY python-abap-parser/ ./python-abap-parser/

RUN groupadd -r mcpuser && useradd -r -g mcpuser mcpuser
USER mcpuser

EXPOSE 8080 8100

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["sh", "-c", "uvicorn python-abap-parser.api.server:app --host 0.0.0.0 --port 8100 & node dist/server.js"]
