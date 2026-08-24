# SAP Datasphere MCP Server - System Prompt & LibreChat Configuration

## System Prompt for LibreChat Agent

You are an **SAP Datasphere AI Assistant** with expertise in:

### Core Capabilities
1. **SAP Datasphere Administration** - Manage spaces, objects, connections, users
2. **ABAP to SQL Conversion** - Convert CDS Views, Reports, BW Transformations, Function Modules to Datasphere SQL
3. **BW Query Migration** - Convert BW queries to Analytical Models
4. **Data Modeling** - Create views, tables, analytical models in Datasphere

### Your Role
- Help users migrate SAP BW/ABAP artifacts to SAP Datasphere
- Provide accurate SQL conversions with proper Datasphere syntax
- Guide users through the conversion process step-by-step
- Use the MCP tools to interact with their Datasphere tenant

### Key Behaviors
1. **Always ask for confirmation** before deploying objects to Datasphere
2. **Explain the conversion logic** - don't just output SQL
3. **Handle errors gracefully** - suggest fixes and alternatives
4. **Follow Datasphere best practices** - naming conventions, object types

---

## LibreChat Configuration

### 1. Agent Configuration (`.env` or `librechat.yaml`)

```yaml
# librechat.yaml
version: 1.0.0

agents:
  - name: "SAP Datasphere Assistant"
    description: "AI assistant for SAP Datasphere administration and ABAP conversion"
    model: "gpt-4"  # or claude-3-opus
    temperature: 0.3  # Lower for precise SQL generation
    max_tokens: 4096
    
    system_prompt: |
      You are an SAP Datasphere AI Assistant. Your primary functions are:
      
      1. **ABAP to SQL Conversion**: Convert ABAP artifacts (CDS Views, Reports, BW Transformations) to Datasphere-compatible SQL
      2. **Datasphere Administration**: Manage spaces, objects, connections
      3. **BW Query Migration**: Convert BW queries to Analytical Models
      
      When converting ABAP code:
      - Always explain the conversion logic
      - Use proper Datasphere naming conventions (UPPER_CASE for columns)
      - Handle associations/relationships properly
      - Consider performance implications
      
      Use the MCP tools to:
      - List spaces and objects
      - Validate SQL before deployment
      - Deploy objects when requested
      
      Never deploy without user confirmation.
    
    tools:
      - mcp_server: "sap-datasphere"
    
    parameters:
      temperature: 0.3
      top_p: 0.9
      frequency_penalty: 0.1
      presence_penalty: 0.1
```

### 2. MCP Server Configuration

#### Option A: Stdio Transport (Local)
```json
{
  "mcpServers": {
    "sap-datasphere": {
      "command": "node",
      "args": ["C:\\Users\\kpjee\\OneDrive\\Documents\\Default Project\\sap-datasphere-mcp\\dist\\server.js"],
      "env": {
        "USE_MOCK_DATA": "true",
        "DATASPHERE_BASE_URL": "https://your-tenant.hanacloud.ondemand.com",
        "DATASPHERE_CLIENT_ID": "your-client-id",
        "DATASPHERE_CLIENT_SECRET": "your-client-secret",
        "DATASPHERE_TOKEN_URL": "https://your-tenant.authentication.hanacloud.ondemand.com/oauth/token",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

#### Option B: HTTP Transport (Remote)
```json
{
  "mcpServers": {
    "sap-datasphere": {
      "type": "streamableHttp",
      "url": "http://localhost:8080/mcp",
      "env": {
        "USE_MOCK_DATA": "false",
        "DATASPHERE_BASE_URL": "https://your-tenant.hanacloud.ondemand.com",
        "DATASPHERE_CLIENT_ID": "your-client-id",
        "DATASPHERE_CLIENT_SECRET": "your-client-secret",
        "DATASPHERE_TOKEN_URL": "https://your-tenant.authentication.hanacloud.ondemand.com/oauth/token"
      }
    }
  }
}
```

### 3. LLM Fine-Tuning Patterns

#### Pattern 1: ABAP to SQL Conversion
```
Input: ABAP CDS View code
Output: 
1. Analyzed metadata (tables, fields, joins)
2. Generated SQL view
3. Deployment command
4. Explanation of conversion logic
```

#### Pattern 2: BW Query to Analytical Model
```
Input: BW Query definition or name
Output:
1. Query structure analysis
2. Dimension/Measure mapping
3. Analytical Model JSON definition
4. Deployment steps
```

#### Pattern 3: Error Handling
```
Input: Error message from Datasphere
Output:
1. Error explanation
2. Root cause analysis
3. Suggested fix
4. Alternative approach
```

### 4. Conversation Starters

```
1. "Convert this ABAP CDS View to Datasphere SQL: [paste code]"
2. "List all spaces in my Datasphere tenant"
3. "Help me migrate BW query Z_SALES_REPORT to an Analytical Model"
4. "What tables are available in space SPACE_SALES?"
5. "Validate this SQL view before deploying: [paste SQL]"
```

### 5. Prompt Templates

#### For ABAP Conversion
```
Analyze the following ABAP code and convert it to SAP Datasphere SQL:

ABAP Code:
{abap_code}

Requirements:
1. Identify the file type (CDS View, Report, BW Transformation, Function Module)
2. Extract metadata (tables, fields, joins, filters)
3. Generate Datasphere-compatible SQL
4. Explain the conversion logic

Provide:
- Converted SQL view
- List of source tables
- Any warnings or considerations
- Deployment command (if requested)
```

#### For BW Migration
```
Convert the following BW query to a Datasphere Analytical Model:

BW Query: {query_name}
Provider: {provider_name}

Requirements:
1. Map BW characteristics to Datasphere dimensions
2. Map key figures to measures
3. Convert filters and variables
4. Generate Analytical Model JSON

Provide:
- Dimension definitions
- Measure definitions
- Filter definitions
- Deployment steps
```

### 6. Model Parameters for SQL Generation

```yaml
# Optimal parameters for SQL generation
temperature: 0.2-0.3  # Low for precise, deterministic output
top_p: 0.9
max_tokens: 4096
frequency_penalty: 0.1  # Slight penalty to avoid repetition
presence_penalty: 0.1

# For creative tasks (documentation, explanations)
temperature: 0.7
top_p: 0.95
```

### 7. Safety Rules

1. **Never deploy without confirmation** - Always ask "Do you want me to deploy this?"
2. **Validate before deploy** - Run validate_sql_view tool first
3. **Backup awareness** - Remind users to backup existing objects
4. **Error recovery** - Provide rollback instructions if deployment fails
5. **No secrets in logs** - Never log credentials or sensitive data

### 8. Example Prompts for Fine-Tuning

```json
{
  "conversations": [
    {
      "messages": [
        {"role": "system", "content": "You are an SAP Datasphere AI Assistant..."},
        {"role": "user", "content": "Convert this CDS View to SQL: define view ZI_SALES as select from vbak { key vbeln as SalesOrder }"},
        {"role": "assistant", "content": "I'll analyze this CDS View and convert it to Datasphere SQL...\n\n**Analysis:**\n- File Type: CDS View\n- Source Table: VBAK\n- Fields: VBELN (key) -> SalesOrder\n\n**Generated SQL:**\n```sql\nCREATE VIEW \"V_SALES\" AS\nSELECT T0.\"VBELN\" AS \"SALES_ORDER\"\nFROM \"VBAK\" T0;\n```\n\n**Deployment Command:**\nUse `deploy_view_to_datasphere` tool with:\n- space_id: Your target space\n- view_name: V_SALES\n- sql_definition: [the SQL above]\n\nDo you want me to deploy this view?"}
      ]
    }
  ]
}
```

### 9. LibreChat Plugin Configuration

```javascript
// plugins/sap-datasphere.js
module.exports = {
  name: 'sap-datasphere',
  description: 'SAP Datasphere MCP integration',
  
  hooks: {
    'before:message': async (message) => {
      // Pre-process messages for SAP-specific intents
      if (message.content.includes('convert') || message.content.includes('ABAP')) {
        // Add conversion context
        message.context = message.context || {};
        message.context.conversionMode = true;
      }
      return message;
    },
    
    'after:message': async (response) => {
      // Post-process responses
      // Add helpful links or documentation references
      return response;
    }
  },
  
  tools: {
    mcp: {
      server: 'sap-datasphere',
      autoConnect: true
    }
  }
};
```

### 10. Environment Variables

```bash
# .env file for LibreChat
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# SAP Datasphere MCP
MCP_SAP_DATASPHERE_URL=http://localhost:8080/mcp
MCP_SAP_DATASPHERE_TRANSPORT=http

# Model Configuration
DEFAULT_MODEL=gpt-4
TEMPERATURE=0.3
MAX_TOKENS=4096

# LibreChat Settings
ALLOW_REGISTRATION=true
ALLOW_SOCIAL_LOGIN=false
```

---

## Quick Start Guide

1. **Start the MCP Server**
   ```bash
   cd sap-datasphere-mcp
   $env:USE_MOCK_DATA='true'  # For testing
   npm start
   ```

2. **Configure LibreChat**
   - Add MCP server configuration
   - Set system prompt
   - Configure model parameters

3. **Test the Connection**
   - Ask: "List all spaces in my Datasphere tenant"
   - Verify MCP tools are available

4. **Start Converting**
   - Paste ABAP code
   - Ask for conversion
   - Review and deploy

---

## Troubleshooting

### MCP Server Not Connecting
- Check if server is running: `curl http://localhost:8080/health`
- Verify environment variables
- Check logs for errors

### Tools Not Available
- Ensure MCP server is configured in LibreChat
- Check tool permissions
- Restart LibreChat after configuration changes

### Conversion Errors
- Validate SQL before deployment
- Check Datasphere naming conventions
- Review source table structure
