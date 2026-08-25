FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create Python virtual environment and install ABAP parser
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and setuptools first (fixes PEP 660 compatibility)
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy and install Python ABAP parser (non-editable mode)
COPY python-abap-parser/ ./python-abap-parser/
RUN pip install --no-cache-dir ./python-abap-parser

# Copy Node.js build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN groupadd -r mcpuser && useradd -r -g mcpuser mcpuser
USER mcpuser

EXPOSE 8080 8100

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["sh", "-c", "uvicorn python-abap-parser.api.server:app --host 0.0.0.0 --port 8100 & node dist/server.js"]
