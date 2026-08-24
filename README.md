# SAP Datasphere MCP Server

> Production-ready Model Context Protocol (MCP) server for SAP Datasphere administration and ABAP-to-SQL conversion.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-16%20passing-brightgreen.svg)](https://vitest.dev/)

## 🚀 Features

- **64 MCP Tools** - Complete SAP Datasphere operations
- **ABAP to SQL Conversion** - CDS Views, Reports, BW Transformations, Function Modules
- **BW Query Migration** - Convert BW queries to Analytical Models
- **OAuth 2.0 Authentication** - Enterprise-grade security
- **Mock Data Mode** - Test without real tenant
- **Docker & K8s Ready** - Production deployment

## 📊 Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| Foundation | 4 | Connection, user, tenant info |
| Spaces | 5 | Space management, search |
| Objects | 16 | CRUD operations, catalog, lineage |
| Queries | 18 | SQL, OData, analytical queries |
| Connections | 5 | Connection management |
| Users | 2 | User management |
| Tasks | 3 | Task chain operations |
| ABAP | 5 | ABAP analysis and conversion |
| BW Query | 5 | BW query inspection |
| Monitoring | 1 | Audit logging |
| Diagnostic | 3 | Endpoint testing |

**Total: 64 tools**

## 🏃 Quick Start

### 1. Install

```bash
git clone https://github.com/your-repo/sap-datasphere-mcp.git
cd sap-datasphere-mcp
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run

```bash
# Mock mode (no credentials needed)
$env:USE_MOCK_DATA='true'
npm start

# Real mode
$env:USE_MOCK_DATA='false'
npm start
```

## 🔧 LibreChat Integration

### Option 1: Stdio Transport

```json
{
  "mcpServers": {
    "sap-datasphere": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": {
        "USE_MOCK_DATA": "true",
        "DATASPHERE_BASE_URL": "https://your-tenant.hanacloud.ondemand.com",
        "DATASPHERE_CLIENT_ID": "your-client-id",
        "DATASPHERE_CLIENT_SECRET": "your-client-secret",
        "DATASPHERE_TOKEN_URL": "https://your-tenant.authentication.hanacloud.ondemand.com/oauth/token"
      }
    }
  }
}
```

### Option 2: HTTP Transport

```json
{
  "mcpServers": {
    "sap-datasphere": {
      "type": "streamableHttp",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

## 📖 Usage Examples

### ABAP Conversion

```
User: Convert this CDS View to SQL:
define view ZI_SALES as select from vbak {
  key vbeln as SalesOrder,
  erdat as CreatedOn
}

Assistant: I'll analyze this CDS View and convert it to Datasphere SQL.

**Analysis:**
- File Type: CDS View
- Source Table: VBAK
- Fields: VBELN (key), ERDAT

**Generated SQL:**
CREATE VIEW "V_SALES" AS
SELECT T0."VBELN" AS "SALES_ORDER",
       T0."ERDAT" AS "CREATED_ON"
FROM "VBAK" T0;

Do you want me to deploy this view?
```

### Space Management

```
User: List all spaces in my Datasphere tenant

Assistant: Here are the available spaces:
1. SPACE_SALES - Sales Analytics
2. SPACE_FINANCE - Finance Data
3. SPACE_MASTER_DATA - Master Data Hub
```

### BW Migration

```
User: Migrate BW query Z_SALES_REPORT to Analytical Model

Assistant: I'll analyze the BW query and create an Analytical Model.

**BW Query Structure:**
- Rows: Customer, Product
- Columns: Sales Amount, Quantity
- Filters: Fiscal Year = 2024

**Analytical Model:**
- Dimensions: Customer, Product
- Measures: Sales Amount (SUM), Quantity (SUM)
- Filter: Fiscal Year = 2024

Do you want me to create this Analytical Model?
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LibreChat / AI Agent                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol
┌─────────────────────────▼───────────────────────────────────┐
│                 SAP Datasphere MCP Server                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   ABAP      │  │   BW Query  │  │   Datasphere│         │
│  │   Parser    │  │   Inspector │  │   Client    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Tool Registry (64 tools)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   OAuth     │  │   Mock      │  │   CLI       │         │
│  │   Auth      │  │   Data      │  │   Wrapper   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│              SAP Datasphere REST API / CLI                   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
sap-datasphere-mcp/
├── src/                    # TypeScript source
│   ├── server.ts          # MCP server entry point
│   ├── config.ts          # Configuration
│   ├── api/               # REST API client
│   ├── auth/              # OAuth authentication
│   ├── cli/               # CLI wrapper
│   ├── tools/             # Tool definitions
│   ├── abap/              # ABAP parser & converters
│   ├── mock/              # Mock data
│   └── types/             # Type definitions
├── tests/                  # Unit tests
├── samples/                # ABAP samples
├── docker/                 # Docker files
├── k8s/                    # Kubernetes manifests
└── docs/                   # Documentation
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
npx vitest run tests/unit/abap.test.ts

# Run with coverage
npm run test:coverage
```

## 🐳 Docker

```bash
# Build
docker build -t sap-datasphere-mcp -f docker/Dockerfile .

# Run
docker run --env-file .env -p 8080:8080 sap-datasphere-mcp
```

## ☸️ Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | This file |
| [AGENTS.md](AGENTS.md) | Agent context and file structure |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Detailed architecture |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment guide |
| [LIBRECHAT_CONFIG.md](LIBRECHAT_CONFIG.md) | LibreChat configuration |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Quick reference card |

## 🔐 Security

- OAuth 2.0 with automatic token refresh
- No credentials in code
- Environment-based configuration
- SQL injection prevention
- PII masking support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `npm test`
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- [MarioDeFelipe/sap-datasphere-mcp](https://github.com/MarioDeFelipe/sap-datasphere-mcp) - Reference implementation
- [secondsky/sap-skills](https://github.com/secondsky/sap-skills) - BW Query skills
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
