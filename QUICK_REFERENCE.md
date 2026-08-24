# SAP Datasphere MCP - Quick Reference Card

## 🎯 System Prompt (Copy this)

```
You are an SAP Datasphere AI Assistant. Your primary functions:

1. **ABAP to SQL Conversion** - Convert CDS Views, Reports, BW Transformations
2. **Datasphere Administration** - Manage spaces, objects, connections  
3. **BW Query Migration** - Convert BW queries to Analytical Models

**Rules:**
- Always explain conversion logic before outputting SQL
- Use UPPER_CASE for column names
- Ask confirmation before deploying
- Validate SQL before deployment

**Available MCP Tools:**
- analyze_abap_file
- get_abap_conversion_guide
- list_spaces
- deploy_view_to_datasphere
- validate_sql_view
- bw_read_query
- bw_get_query_spec
```

## 🔧 LibreChat Config (Copy to librechat.yaml)

```yaml
version: 1.0.0
agents:
  - name: "SAP Datasphere Assistant"
    model: "gpt-4"
    temperature: 0.3
    system_prompt: |
      [Insert system prompt above]
mcpServers:
  sap-datasphere:
    command: "node"
    args: ["dist/server.js"]
    env:
      USE_MOCK_DATA: "true"
      MCP_TRANSPORT: "stdio"
```

## 💬 Example Prompts

| User Prompt | Expected Response |
|-------------|-------------------|
| "Convert this CDS View: define view ZI_SALES..." | Analyzed metadata + SQL + explanation |
| "List spaces" | JSON list of Datasphere spaces |
| "Migrate BW query Z_SALES_REPORT" | Analytical Model JSON + deployment steps |
| "Validate this SQL: CREATE VIEW..." | Validation result + suggestions |

## 🛠️ MCP Tools (64 total)

### Foundation (4)
- test_connection
- get_current_user
- get_tenant_info
- get_available_scopes

### Spaces (5)
- list_spaces
- get_space_info
- get_table_schema
- search_tables
- create_space

### Objects (16)
- list_objects, get_object
- create_local_table, create_view
- deploy_object, delete_object
- list_catalog_assets, get_asset_details
- search_catalog, search_repository
- find_assets_by_column, analyze_column_distribution

### Queries (18)
- smart_query, query_relational
- get_metadata, search_assets
- get_catalog_metadata, get_analytical_metadata
- get_relational_metadata, list_analytical_datasets
- get_analytical_model, get_analytical_service_document
- query_analytical_data, execute_query
- list_relational_entities, get_relational_entity_metadata
- query_relational_entity, get_relational_odata_service
- get_asset_variables

### Connections (5)
- list_connections, test_connection_health
- get_consumption_metadata, get_deployed_objects
- browse_marketplace

### Users (2)
- list_users, create_user

### Tasks (3)
- list_task_chains, run_task_chain, get_task_status

### ABAP (5)
- analyze_abap_file
- check_source_tables
- validate_sql_view
- deploy_view_to_datasphere
- get_abap_conversion_guide

### BW Query (5)
- bw_inspect_provider
- bw_read_query
- bw_list_queries
- bw_review_query_design
- bw_get_query_spec

### Monitoring (1)
- get_audit_log

### Diagnostic (3)
- test_analytical_endpoints
- test_phase67_endpoints
- test_phase8_endpoints

## 🚀 Quick Start

```bash
# 1. Start MCP Server
cd sap-datasphere-mcp
$env:USE_MOCK_DATA='true'
npm start

# 2. Configure LibreChat
# Copy librechat.yaml to LibreChat root

# 3. Test
# Ask: "List all spaces in my Datasphere tenant"
```

## ⚠️ Safety Rules

1. **Never deploy without confirmation**
2. **Always validate SQL first**
3. **No credentials in logs**
4. **Ask before destructive operations**
