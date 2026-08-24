# AGENTS.md - SAP Datasphere MCP Server

> **Purpose**: This file helps any AI agent understand the project, its current state, and how to continue work.

## 🎯 Project Overview

**SAP Datasphere MCP Server** - A production-ready Model Context Protocol (MCP) server that enables AI assistants to interact with SAP Datasphere for:

1. **ABAP to SQL Conversion** - Convert CDS Views, Reports, BW Transformations, Function Modules
2. **Datasphere Administration** - Manage spaces, objects, connections, users
3. **BW Query Migration** - Convert BW queries to Analytical Models
4. **Data Querying** - Execute SQL and OData queries

## 📊 Current Status

| Metric | Value |
|--------|-------|
| **Total Tools** | 64 |
| **Tests** | 16 passing |
| **Build** | ✅ TypeScript compiles |
| **Mock Data** | ✅ Fully functional |
| **Real API** | ⏳ Pending tenant credentials |

## 📁 File Structure

```
sap-datasphere-mcp/
├── src/                          # TypeScript source code
│   ├── server.ts                 # Main MCP server entry point
│   ├── config.ts                 # Environment configuration loader
│   ├── api/
│   │   └── client.ts            # Datasphere REST API client
│   ├── auth/
│   │   └── token-manager.ts     # OAuth 2.0 token management
│   ├── cli/
│   │   └── datasource-cli.ts    # SAP Datasphere CLI wrapper
│   ├── tools/
│   │   └── registry.ts          # All 64 tool definitions
│   ├── abap/
│   │   ├── lexer.ts             # ABAP tokenizer
│   │   ├── parser.ts            # Built-in ABAP parser
│   │   ├── index.ts             # ABAP exports
│   │   └── converters/
│   │       ├── cds.ts           # CDS View converter
│   │       ├── report.ts        # ABAP Report converter
│   │       ├── bw.ts            # BW Transformation converter
│   │       └── fm.ts            # Function Module converter
│   ├── validation/
│   │   └── schemas.ts           # Zod validation schemas
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── mock/
│   │   └── data.ts              # Mock data for testing
│   └── skills/
│       └── abap-skill/
│           ├── skill.json       # ABAP skill manifest
│           ├── prompts/         # Conversion prompts
│           ├── patterns/        # Conversion patterns
│           ├── templates/       # SQL templates
│           └── conversion-patterns.json  # Advanced patterns
│
├── tests/                        # Unit tests
│   ├── unit/
│   │   ├── registry.test.ts     # Tool registry tests
│   │   ├── validation.test.ts   # Validation tests
│   │   └── abap.test.ts         # ABAP parser tests
│   └── fixtures/                 # Test data
│       ├── ZI_SALES_ORDER.ddl   # Sample CDS View
│       ├── Z_SALES_REPORT.abap  # Sample ABAP Report
│       └── Z_BW_TRANSFORMATION.abap  # Sample BW Transformation
│
├── samples/                      # Advanced ABAP samples
│   └── abap/
│       ├── ZI_SALES_ORDER_ADV.ddl      # Complex CDS View
│       ├── Z_SALES_ANALYSIS_ADV.abap   # Advanced Report
│       ├── Z_BW_TRANSFORMATION_ADV.abap # Complex BW Transformation
│       └── Z_FUNCTION_SALES_ANALYSIS.abap  # Function Module
│
├── python-abap-parser/           # Optional Python ABAP parser
│   ├── abap_parser/
│   │   ├── lexer.py
│   │   ├── parser.py
│   │   └── __init__.py
│   ├── converters/
│   │   ├── cds_converter.py
│   │   ├── report_converter.py
│   │   ├── bw_converter.py
│   │   └── fm_converter.py
│   ├── tests/
│   ├── requirements.txt
│   └── README.md
│
├── docker/                       # Docker configuration
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── k8s/                          # Kubernetes manifests
│   ├── namespace.yaml
│   ├── secrets.yaml
│   ├── configmap.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── apirule.yaml
│
├── .github/workflows/            # CI/CD
│   ├── ci.yml
│   └── deploy.yml
│
├── Configuration Files
│   ├── package.json             # Node.js project config
│   ├── tsconfig.json            # TypeScript config
│   ├── .env.example             # Environment variables template
│   ├── .gitignore               # Git ignore rules
│   ├── eslint.config.js         # ESLint config
│   ├── vitest.config.ts         # Vitest config
│   ├── librechat.yaml           # LibreChat agent config
│   └── .mcp.json                # MCP server config
│
├── Documentation
│   ├── README.md                # Main documentation
│   ├── AGENTS.md                # This file (agent context)
│   ├── ARCHITECTURE.md          # Architecture details
│   ├── DEPLOYMENT.md            # Deployment guide
│   ├── LIBRECHAT_CONFIG.md      # LibreChat configuration
│   └── QUICK_REFERENCE.md       # Quick reference card
│
└── Reference Implementation
    └── REPO_COMPARISON.md       # Comparison with reference repo
```

## 🔧 Build & Test Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Start server (mock mode)
$env:USE_MOCK_DATA='true'
npm start

# Start server (real API)
$env:USE_MOCK_DATA='false'
# Configure .env with real credentials
npm start
```

## 🎯 What's Complete ✅

1. **MCP Server Core** - Full MCP protocol implementation
2. **64 Tool Definitions** - All categories covered
3. **ABAP Parser** - Built-in TypeScript parser
4. **Mock Data System** - Complete test data
5. **Unit Tests** - 16 tests passing
6. **Docker Support** - Dockerfile and docker-compose
7. **K8s Manifests** - Full Kubernetes deployment
8. **CI/CD** - GitHub Actions workflows
9. **LibreChat Config** - Agent configuration ready

## ⏳ What's Pending

1. **Real Tenant Testing** - Need actual Datasphere credentials
2. **OAuth Flow Testing** - Test with real OAuth client
3. **BW Query Tools** - Test with real BW system
4. **Performance Testing** - Load testing with large datasets

## 🔗 Reference Repos

| Repo | Purpose | Status |
|------|---------|--------|
| [MarioDeFelipe/sap-datasphere-mcp](https://github.com/MarioDeFelipe/sap-datasphere-mcp) | Reference implementation (45 tools) | ✅ All tools covered |
| [secondsky/sap-skills](https://github.com/secondsky/sap-skills) | BW Query skills | ✅ Integrated |

## 🛠️ How to Continue Work

### If you need to add a new tool:
1. Add tool definition to `src/tools/registry.ts`
2. Add handler in `src/server.ts` (handleTool function)
3. Add mock data in `src/mock/data.ts` (handleMockTool function)
4. Add tests in `tests/unit/registry.test.ts`

### If you need to fix ABAP conversion:
1. Check `src/abap/parser.ts` for parsing logic
2. Check `src/abap/converters/` for conversion logic
3. Check `src/skills/abap-skill/` for patterns
4. Test with samples in `samples/abap/`

### If you need to modify API client:
1. Check `src/api/client.ts` for REST API calls
2. Check `src/cli/datasphere-cli.ts` for CLI wrapper
3. Check `src/auth/token-manager.ts` for OAuth

## 📝 Code Conventions

- **Language**: TypeScript (strict mode)
- **Naming**: UPPER_CASE for SQL columns, camelCase for JS/TS
- **File structure**: One class/module per file
- **Exports**: Named exports only
- **Testing**: Vitest with unit tests
- **Build**: TypeScript compiler (tsc)

## ⚠️ Important Notes

1. **Never commit .env** - Contains secrets
2. **Always validate SQL** before deployment
3. **Ask confirmation** before deploying objects
4. **Use mock data** for testing (`USE_MOCK_DATA=true`)
5. **Check logs** if tools not working

## 🔄 Context Continuity

When starting a new session:
1. Read this file first
2. Check `package.json` for dependencies
3. Run `npm run build` to verify build
4. Run `npm test` to verify tests
5. Check `.env` for configuration

## 📞 Getting Help

- Check `README.md` for detailed documentation
- Check `DEPLOYMENT.md` for deployment guide
- Check `LIBRECHAT_CONFIG.md` for agent setup
- Check `QUICK_REFERENCE.md` for quick commands
