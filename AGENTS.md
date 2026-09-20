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
| **Total Tools** | 72+ (all enriched with usage, prerequisites, parameter formats) |
| **Tests** | 28 passing (`npm test` / `vitest run`) |
| **Build** | ✅ TypeScript compiles cleanly (`tsc --noEmit` & `npm run build`) |
| **Mock Data** | ✅ Fully functional (`USE_MOCK_DATA=true`) |
| **Live Verification** | ✅ Verified live on space `FTDWH_100_INT` (Catalog, Relational, Analytics, CLI CSN deploy) |
| **HANA Cloud Open SQL** | ✅ Integrated with Schema Isolation Guard (`DSP_OPEN_SCHEME`) |
| **Kyma Readiness** | ✅ Manifests configured for namespace `datasphere-mcp-v2` |


## 📁 File Structure

```
sap-datasphere-mcp/
├── src/                          # TypeScript source code
│   ├── server.ts                 # Main MCP server entry point (72+ tools wired)
│   ├── config.ts                 # Environment config loader (with getRawEnv() comment protection)
│   ├── api/
│   │   └── client.ts            # Datasphere REST/OData API client
│   ├── auth/
│   │   └── token-manager.ts     # OAuth 2.0 token management
│   ├── cli/
│   │   └── datasphere-cli.ts    # SAP Datasphere CLI wrapper (CSN creation & deployment)
│   ├── hana/
│   │   └── client.ts            # HANA Cloud client with Schema Isolation Guard (DSP_OPEN_SCHEME)
│   ├── security/
│   │   └── sanitizer.ts         # LLM sanitization and credential masking
│   ├── tools/
│   │   └── registry.ts          # All 72+ tool definitions with enriched WHEN TO USE & formats
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
│   │   ├── index.ts             # TypeScript type definitions
│   │   └── hdb.d.ts             # Type definitions for hdb library
│   └── mock/
│       └── data.ts              # Mock data for testing
│
├── skills/                       # Specialized Agent Skills
│   ├── sap-datasphere-platform/ # Skill 1: Tenant exploration, space management, relational/analytics
│   │   └── SKILL.md
│   ├── bw2dsp-migration-expert/  # Skill 2: BW2DSP migration, ABAP routines, community edge cases
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── bw2dsp-abap-migration.md # In-depth BW2DSP handbook
│   │       └── sap-standard-tables-business-reference.md # SAP standard tables, business logic & official links
│   └── sap-datasphere-expert/    # Combined expert skill & reference
│       └── SKILL.md
│
├── scripts/                      # Diagnostic and testing utilities
│   ├── test-connection.ts       # Test live Datasphere REST/OAuth connection
│   ├── check-tool-implementations.ts # Verification of tool handlers
│   └── test-live-system.ts      # Live integration tests
│
├── tests/                        # Unit tests (26 passing)
│   ├── unit/
│   │   ├── client.test.ts       # API client unit tests
│   │   ├── hana.test.ts         # HANA client & schema isolation tests
│   │   ├── sanitizer.test.ts    # Secret masking tests
│   │   ├── registry.test.ts     # Tool registry tests
│   │   ├── validation.test.ts   # Validation tests
│   │   └── abap.test.ts         # ABAP parser tests
│   └── fixtures/                 # Test data
│
├── k8s/                          # Kubernetes / Kyma manifests (namespace: datasphere-mcp-v2)
│   ├── namespace.yaml
│   ├── secrets.yaml             # Datasphere & HANA Cloud credential placeholders
│   ├── configmap.yaml           # MCP server configuration
│   ├── deployment.yaml          # Kyma deployment with sidecars & probes
│   ├── service.yaml             # Cluster service
│   └── apirule.yaml             # Kyma API Gateway ingress rule
│
├── docker/                       # Container definitions
│   ├── Dockerfile
│   └── docker-compose.yml
│
└── librechat.yaml                # LibreChat multi-agent configuration
```

## 🔧 Build & Test Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run all unit tests
npm run test:run

# Typecheck with TypeScript
npm run typecheck

# Start server (mock mode)
$env:USE_MOCK_DATA='true'
npm start

# Start server (live mode on port 8080)
$env:USE_MOCK_DATA='false'
$env:MCP_TRANSPORT='http'
npm run start:http
```

## 🎯 What's Complete ✅

1. **MCP Server Core** - Full MCP protocol over stdio and HTTP/SSE.
2. **72+ Enriched Tool Definitions** - Complete with `WHEN TO USE`, `PREREQUISITES`, parameter formats, and returns.
3. **Live System Verified on `FTDWH_100_INT`**:
   - Technical user OAuth 2.0 authentication and token refresh.
   - Live CLI object creation & deployment tested with valid CSN payloads (`TMP_TEST_MCP_TABLE`).
   - Catalog inspection, relational queries (handling digit prefix underscore `_`), and analytical queries (`Accept-Language: en`).
4. **HANA Cloud Open SQL Schema Integration**:
   - Native TLS connection via `HanaClient`.
   - **Schema Isolation Guard**: Enforces write operations strictly within `DSP_OPEN_SCHEME`.
   - Comment truncation protection via `getRawEnv()` in `src/config.ts`.
5. **Security & Sanitization**:
   - `sanitizeForLLM()` and `maskSensitiveObject()` ensure zero credential leakage in tool outputs or logs.
6. **Two Specialized Agent Skills**:
   - `sap-datasphere-platform`: Tenant exploration, catalog discovery, relational/analytical queries, and object authoring.
   - `bw2dsp-migration-expert`: Comprehensive BW to Datasphere migration logic, ABAP routine conversions (Start, Field, End, Expert, Lookup), and community edge cases.
7. **SAP BTP Kyma Readiness**:
   - Manifests in `k8s/` configured for namespace `datasphere-mcp-v2` with APIRule and health probes.
8. **Unit Tests**: 26/26 tests passing (`vitest run`).
9. **Build**: TypeScript compiles with zero errors (`tsc --noEmit`, `tsc`).

## ⏳ Operational Notes for Agents & Clients

1. **Space & Schema Selection**: `FTDWH_100_INT` is the **default option** for space and schema operations. The actual target depends on context and user request. For now, access is provisioned for the `FTDWH` space (e.g. `FTDWH_100_INT` or other `FTDWH` schemas).
2. **Schema Isolation Guard**: Direct HANA SQL write operations are verified against authorized schemas (`FTDWH` space / `DSP_OPEN_SCHEME`), protecting system and unauthorized spaces.
3. **CSN Format**: `@sap/datasphere-cli` rejects non-CSN JSON. Always use CSN structure (`@ObjectModel.modelingPattern: { "#": "DATA_STRUCTURE" }`).
4. **Digit-prefixed Entity Sets**: If an asset starts with a digit, OData entity sets are prepended with `_`. Always call `list_relational_entities` before querying.
5. **Analytical Queries**: The analytical engine requires `'Accept-Language': 'en'`.
6. **CSN vs. HANA SQL Object Creation Decision**:
   - Use **CSN Approach** (`create_local_table`, `create_view`) when objects must be visible in the Datasphere Web UI (Data Builder), consumed by SAP Analytics Cloud (SAC) Analytic Models, or need CSN semantic annotations (`#FACT`, `#CUBE`, associations, Data Access Controls).
   - Use **Direct HANA SQL Approach** (`hana_create_table`, `hana_create_view`, `hana_execute_sql`) for high-speed raw data staging, complex multi-tier CTE deduplication, native HANA engine features (windowing `ROW_NUMBER`, vector search `REAL_VECTOR`), or external BI consumption (Power BI/Tableau on port 443).
   - **Production Hybrid Pattern**: Ingest & transform in `DSP_OPEN_SCHEME` using HANA SQL, then expose as a CSN View for SAC!


## 🔄 Recent Changelog & Agent Memory (Current Cycle)

- **Universal Standard & Custom Table Conversion Engine**: Upgraded `BWConverter` and `CDSConverter` to dynamically convert any standard SAP table (`ACDOCA`, `VBAK`, `EKKO`, `MATDOC`, etc.) and custom table (`Z*`, `Y*`, `ZZ*`, `X*`, `/BIC/*`). Generates 100% compliant SAP Core Schema Notation (CSN) JSON (`@ObjectModel.modelingPattern: { "#": "FACT" | "DIMENSION" }`, `@Analytics.dataCategory: { "#": "CUBE" }`) and multi-stage CTEs with `ROW_NUMBER() OVER (...)` deduplication to prevent Cartesian explosions on lookups.
- **CLI Command Syntax Modernization**: Updated CLI command generation to use exact accepted syntax (`datasphere objects views create -y "<space>" -F "<file>.json"`).
- **Schema Isolation Guard**: Implemented `validateSchemaIsolation(sql)` in `src/hana/client.ts` to strictly prohibit write operations outside `DSP_OPEN_SCHEME`.
- **HANA Tools Added**: Registered `hana_execute_sql`, `hana_create_table`, `hana_create_view`, `hana_list_tables`, `hana_list_views`.
- **Tool Description Enrichment**: Enhanced all 72+ tools in `src/tools/registry.ts` with explicit scenarios, dependencies, and parameter formats.
- **Dotenv Unquoted Hash Trap**: Fixed `getRawEnv()` in `src/config.ts` so usernames/passwords containing `#` are not truncated as inline comments.
- **Context-Driven Schema Selection & FTDWH Scope**: Enhanced `HanaClient` and all HANA tools with optional `schema_name` support. `FTDWH_100_INT` serves as the default option; operations dynamically adapt to any requested schema within the authorized `FTDWH` space while continuing to block foreign unauthorized spaces.
- **Two Specialized Skills & Deep References**: Created `skills/sap-datasphere-platform/` and `skills/bw2dsp-migration-expert/` with `references/bw2dsp-abap-migration.md` and `references/sap-standard-tables-business-reference.md`.
- **Test Suite Expansion**: Added unit tests for HANA client, Schema Isolation Guard, API client, sanitizer, and universal CSN converter (28 passing).

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
