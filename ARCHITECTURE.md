# ARCHITECTURE.md - SAP Datasphere MCP Server

> Detailed architecture documentation for the SAP Datasphere MCP Server.

## 🎯 System Overview

The SAP Datasphere MCP Server is a **TypeScript-based Model Context Protocol (MCP) server** that enables AI assistants to interact with SAP Datasphere environments. It provides:

1. **64 MCP Tools** for Datasphere operations
2. **ABAP Parser** for code analysis and conversion
3. **OAuth 2.0 Authentication** for secure access
4. **Mock Data System** for testing without credentials

## 🏗️ High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              AI CLIENT LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ LibreChat   │  │ Claude      │  │ Cursor      │  │ Custom      │        │
│  │             │  │ Desktop     │  │ IDE         │  │ Client      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │ MCP Protocol (stdio/HTTP)
┌─────────────────────────────────────▼────────────────────────────────────────┐
│                           MCP SERVER LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Server Core (server.ts)                       │    │
│  │  - HTTP Transport (Express)                                         │    │
│  │  - Stdio Transport                                                  │    │
│  │  - Tool Registration                                                │    │
│  │  - Request Handling                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────▼─────────────────────────────────┐  │
│  │                         Tool Registry (64 tools)                       │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │  Foundation (4) │ Spaces (5) │ Objects (16) │ Queries (18)            │  │
│  │  Connections (5) │ Users (2) │ Tasks (3) │ ABAP (5) │ BW (5)         │  │
│  │  Monitoring (1) │ Diagnostic (3)                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌─────────────────────────────────────▼─────────────────────────────────┐  │
│  │                        Service Layer                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │ Datasphere  │  │ Datasphere  │  │ ABAP        │  │ Mock Data   │ │  │
│  │  │ Client      │  │ CLI         │  │ Parser      │  │ Service     │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼────────────────────────────────────────┐
│                         EXTERNAL SERVICES LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SAP Datasphere REST API                           │    │
│  │  - /api/v1/spaces                                                  │    │
│  │  - /api/v1/datasphere/consumption/...                              │    │
│  │  - OAuth 2.0 Token Endpoint                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────▼─────────────────────────────────┐  │
│  │                    SAP Datasphere CLI (Optional)                       │  │
│  │  - datasphere objects create                                         │  │
│  │  - datasphere objects deploy                                         │  │
│  │  - datasphere spaces list                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 🔧 Component Details

### 1. Server Core (`src/server.ts`)

**Responsibilities:**
- Initialize MCP server with stdio or HTTP transport
- Register all 64 tools
- Handle incoming tool requests
- Route to appropriate service

**Key Functions:**
```typescript
// Tool registration
server.tool(name, description, schema, handler)

// Request handling
async function handleTool(name: string, args: Record<string, unknown>): Promise<ToolResult>

// Mock data handling
function handleMockTool(name: string, args: Record<string, unknown>): ToolResult
```

**Transport Options:**
- **Stdio**: For local integration (Claude Desktop, LibreChat)
- **HTTP**: For remote access (Docker, K8s)

### 2. Tool Registry (`src/tools/registry.ts`)

**Structure:**
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  requiresAuth: boolean;
  inputSchema: JSONSchema;
}

// Tool categories
const foundationTools: ToolDefinition[] = [...];
const spaceTools: ToolDefinition[] = [...];
const objectTools: ToolDefinition[] = [...];
const queryTools: ToolDefinition[] = [...];
// ... etc
```

**Categories:**
| Category | Count | Purpose |
|----------|-------|---------|
| Foundation | 4 | Connection, auth, tenant |
| Spaces | 5 | Space management |
| Objects | 16 | CRUD, catalog, search |
| Queries | 18 | SQL, OData, analytical |
| Connections | 5 | Connection management |
| Users | 2 | User operations |
| Tasks | 3 | Task chain ops |
| ABAP | 5 | ABAP analysis |
| BW Query | 5 | BW query inspection |
| Monitoring | 1 | Audit logging |
| Diagnostic | 3 | Endpoint testing |

### 3. Datasphere Client (`src/api/client.ts`)

**Responsibilities:**
- Make REST API calls to Datasphere
- Handle OAuth token management
- Parse API responses

**API Endpoints:**
```typescript
// Spaces
GET /api/v1/spaces
GET /api/v1/spaces/{spaceId}

// Catalog
GET /api/v1/datasphere/consumption/catalog/assets

// Relational
GET /api/v1/datasphere/consumption/relational/{space}/{entity}

// Analytical
GET /api/v1/datasphere/consumption/analytical/{space}/{entity}
```

### 4. OAuth Token Manager (`src/auth/token-manager.ts`)

**Flow:**
```
1. Client ID + Client Secret → Token Endpoint
2. Token Endpoint → Access Token (expires in 3600s)
3. Auto-refresh 60 seconds before expiry
4. Encrypted storage in memory
```

**Token Storage:**
```typescript
interface OAuthToken {
  accessToken: string;
  expiresAt: number;
  tokenType: string;
}
```

### 5. ABAP Parser (`src/abap/`)

**Components:**
- **Lexer** (`lexer.ts`): Tokenizes ABAP code
- **Parser** (`parser.ts`): Extracts structure (tables, fields, joins)
- **Converters** (`converters/`): Generate SQL from parsed structure

**Supported ABAP Types:**
| Type | File Extension | Parser |
|------|----------------|--------|
| CDS View | `.ddl` | `parseCDSView()` |
| ABAP Report | `.abap` | `parseReport()` |
| BW Transformation | `.abap` | `parseBWTransformation()` |
| Function Module | `.abap` | `parseFunctionModule()` |

### 6. Mock Data Service (`src/mock/data.ts`)

**Purpose:**
- Test MCP server without real credentials
- Development and debugging
- CI/CD testing

**Mock Data:**
```typescript
MOCK_SPACES: MockSpace[]           // 4 spaces
MOCK_CONNECTIONS: MockConnection[] // 5 connections
MOCK_CATALOG_ASSETS: MockCatalogAsset[] // 8 assets
MOCK_USER: MockUser                // Current user
MOCK_TENANT: TenantInfo            // Tenant metadata
MOCK_QUERY_RESULT: QueryResult     // Sample query data
MOCK_DEPLOY_RESULT: DeployResult   // Deployment response
MOCK_AUDIT_LOG: AuditEntry[]       // Audit entries
```

## 🔄 Request Flow

### Tool Call Flow

```
1. AI Client sends MCP request
   ↓
2. Server receives request (stdio/HTTP)
   ↓
3. Server parses JSON-RPC message
   ↓
4. Server routes to handleTool()
   ↓
5. Check if mock mode enabled
   ↓ (Yes)                ↓ (No)
6a. handleMockTool()    6b. Call service (Client/CLI)
   ↓                        ↓
7a. Return mock data    7b. Process response
   ↓                        ↓
8. Return JSON-RPC response to client
```

### ABAP Conversion Flow

```
1. User provides ABAP code
   ↓
2. analyze_abap_file tool called
   ↓
3. ABAP Parser extracts metadata
   - File type detection
   - Table extraction
   - Field extraction
   - Join detection
   ↓
4. Return parsed structure to AI
   ↓
5. AI generates SQL using conversion guide
   ↓
6. validate_sql_view tool called
   ↓
7. SQL validated
   ↓
8. deploy_view_to_datasphere tool called (with user confirmation)
   ↓
9. View deployed to Datasphere
```

## 📊 Data Flow

### Read Operations

```
AI Client → MCP Server → Datasphere API → Response → AI Client
```

### Write Operations

```
AI Client → MCP Server → Validate → User Confirmation → Datasphere API → Response → AI Client
```

### ABAP Conversion

```
AI Client → ABAP Code → Parser → Metadata → AI → SQL → Validator → Deployer → Datasphere
```

## 🔐 Security Architecture

### Authentication

```
1. Client Credentials Flow
   - Client ID + Client Secret
   - Token Endpoint: https://tenant.authentication.hanacloud.ondemand.com/oauth/token
   - Response: Access Token (Bearer)

2. Token Management
   - Auto-refresh 60s before expiry
   - Encrypted storage in memory
   - Retry on 401 Unauthorized
```

### Authorization

```
1. OAuth Scopes (from token)
   - Read operations
   - Write operations
   - Admin operations

2. Tool-level checks
   - requiresAuth flag in tool definition
   - Auth middleware in server
```

### Data Protection

```
1. PII Masking (optional)
   - Config-driven policy
   - Fail-closed design
   - Audit logging

2. SQL Injection Prevention
   - Input validation
   - Parameterized queries
   - Read-only enforcement
```

## 🧪 Testing Architecture

### Unit Tests

```
tests/unit/
├── registry.test.ts      # Tool registry tests
├── validation.test.ts    # Input validation tests
└── abap.test.ts          # ABAP parser tests
```

### Test Coverage

| Component | Coverage | Status |
|-----------|----------|--------|
| Tool Registry | 100% | ✅ |
| Validation | 100% | ✅ |
| ABAP Parser | 80% | ✅ |
| API Client | 0% | ⏳ |
| OAuth | 0% | ⏳ |

### Mock Data Testing

```bash
# Run with mock data
$env:USE_MOCK_DATA='true'
npm start

# Test tools
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_spaces","arguments":{}}}'
```

## 🚀 Deployment Architecture

### Local Development

```
┌─────────────┐     ┌─────────────┐
│ LibreChat   │────▶│ MCP Server  │ (stdio)
│             │     │ (mock data) │
└─────────────┘     └─────────────┘
```

### Docker Deployment

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ AI Client   │────▶│ Docker      │────▶│ Datasphere  │
│ (HTTP)      │     │ Container   │     │ API         │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Kubernetes Deployment

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ AI Client   │────▶│ K8s Service │────▶│ Datasphere  │
│ (HTTP)      │     │ + Pod       │     │ API         │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 📈 Performance Considerations

### Tool Execution

- **Mock mode**: < 10ms
- **API calls**: 100-500ms (network dependent)
- **ABAP parsing**: < 50ms
- **SQL validation**: < 100ms

### Caching

- **Token cache**: In-memory, auto-refresh
- **Space cache**: Not implemented (fetch each time)
- **Asset cache**: Not implemented (fetch each time)

### Rate Limiting

- Not implemented (respect Datasphere API limits)
- Recommend: 100 requests/minute max

## 🔮 Future Enhancements

### Short Term

1. **PII Masking** - Config-driven sensitive data protection
2. **Caching** - Cache spaces, assets for better performance
3. **Retry Logic** - Exponential backoff for API failures
4. **Logging** - Structured logging for debugging

### Long Term

1. **WebSocket Transport** - Real-time updates
2. **Batch Operations** - Multiple object operations
3. **Schema Sync** - Sync schemas between environments
4. **Data Lineage** - Track data flow across objects

## 📚 References

- [MCP Specification](https://modelcontextprotocol.io/)
- [SAP Datasphere API](https://help.sap.com/docs/SAP_DATASPHERE)
- [SAP OAuth 2.0](https://help.sap.com/docs/SAP_NETWEAVER)
- [LibreChat Documentation](https://docs.librechat.ai/)

---

*Last updated: 2026-08-25*
