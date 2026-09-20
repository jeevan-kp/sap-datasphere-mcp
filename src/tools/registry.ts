import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface ToolDefinition extends Tool {
  category: string;
  requiresAuth: boolean;
}

const foundationTools: ToolDefinition[] = [
  {
    name: 'test_connection',
    description: "Verify active connectivity to the SAP Datasphere tenant and check OAuth2 token acquisition. WHEN TO USE: Call as the first step upon initialization or to diagnose connection health. PREREQUISITES: DATASPHERE_BASE_URL and OAuth credentials configured in environment. RETURNS: JSON object with tenant status, latency, host URL, and token expiration timestamp.",
    category: 'foundation',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_current_user',
    description: "Retrieve identity, client ID, and account profile of the currently authenticated OAuth technical user or service principal. WHEN TO USE: Call to verify granted privileges, audit service principal identity, or check tenant authorization. PREREQUISITES: test_connection. RETURNS: JSON object containing user ID, name, email, and identity provider details.",
    category: 'foundation',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_tenant_info',
    description: "Retrieve SAP Datasphere tenant metadata, release version, data center, and regional endpoint configuration. WHEN TO USE: Call during environment setup or migration planning to discover tenant capabilities. PREREQUISITES: test_connection. RETURNS: JSON object containing tenantId, version, data center, and service endpoints.",
    category: 'foundation',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_available_scopes',
    description: "List all OAuth2 scopes granted to the current access token. WHEN TO USE: Call when diagnosing 403 Forbidden errors to determine whether Catalog, DW Administrator, or DW Modeler scopes are active. PREREQUISITES: test_connection. RETURNS: Array of granted OAuth scope strings (e.g., dwaas-core, catalog).",
    category: 'foundation',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

const spaceTools: ToolDefinition[] = [
  {
    name: 'list_spaces',
    description: "List all available spaces in the SAP Datasphere tenant with technical names and labels. WHEN TO USE: Fundamental entry point for all Datasphere workflows. Call this first to discover space IDs before querying assets or creating objects. PREREQUISITES: test_connection. RETURNS: Array of space objects containing technical \"name\" (e.g., \"FTDWH_100_INT\") and \"label\".",
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        include_details: {
          type: 'boolean',
          description: "Set true to include extended metadata such as storage quotas and member counts. Default: false.",
        },
      },
      required: [],
    },
  },
  {
    name: 'get_space_info',
    description: "Get comprehensive configuration, storage limits, and metadata for a specific Datasphere space. WHEN TO USE: Use before deploying models or running ETL to check memory/disk quota and space health. PREREQUISITES: Call list_spaces first to obtain a valid space_id. RETURNS: JSON object with space name, label, disk/memory allocation, and properties.",
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\"). Must be an existing space identifier.",
        },
      },
      required: ['space_id'],
    },
  },
  {
    name: 'get_table_schema',
    description: "Get column definitions, data types, lengths, and primary key flags for a table or view. WHEN TO USE: Call before writing SQL queries, ETL flows, or view definitions to understand table structure. PREREQUISITES: Call list_spaces to get space_id, and get_space_assets to get table_name. RETURNS: Array of column definitions with technical name, CDS/SQL data type, and primary key status.",
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        table_name: {
          type: 'string',
          description: "Technical name of the table or view (e.g., \"1LR_EKKO_01\" or \"fact_view\").",
        },
      },
      required: ['space_id', 'table_name'],
    },
  },
  {
    name: 'search_tables',
    description: "Search across spaces for tables and views matching a business keyword. WHEN TO USE: Use when searching for specific business data (e.g., \"billing\", \"inventory\", \"sales\") without knowing exact technical names. PREREQUISITES: list_spaces. RETURNS: Array of matching table definitions with their parent space IDs.",
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        search_term: {
          type: 'string',
          description: "Keyword or substring to match against table names and descriptions (e.g., \"billing\" or \"partner\").",
        },
        space_id: {
          type: 'string',
          description: "Optional space ID (e.g., \"FTDWH_100_INT\") to restrict search to a single space.",
        },
      },
      required: ['search_term'],
    },
  },
  {
    name: 'create_space',
    description: "Create a new governance space in SAP Datasphere via CLI. WHEN TO USE: Use to provision an isolated workspace for a new project or team. PREREQUISITES: Requires DW Administrator role. RETURNS: Creation confirmation with new space ID.",
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: "Unique technical uppercase name for the space (e.g., \"FINANCE_DEV\"). Alphanumeric and underscores only.",
        },
        display_name: {
          type: 'string',
          description: "Human-readable display label for the space (e.g., \"Finance Development Space\").",
        },
        description: {
          type: 'string',
          description: "Detailed description of the business domain and purpose of the space.",
        },
      },
      required: ['name'],
    },
  },
];

const objectTools: ToolDefinition[] = [
  {
    name: 'list_objects',
    description: "List modeling objects in a space filtered by object type via CLI. WHEN TO USE: Use to audit or discover views, local tables, analytic models, data flows, replication flows, or task chains in a space. PREREQUISITES: Call list_spaces first to obtain space_id. RETURNS: JSON array of objects with technicalName and deployment status.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        object_type: {
          type: 'string',
          description: "Object type to filter by. Allowed values: \"local-tables\", \"views\", \"analytic-models\", \"data-flows\", \"replication-flows\", \"task-chains\". Default: \"local-tables\".",
          enum: ['local-tables', 'views', 'analytic-models', 'data-flows', 'task-chains'],
        },
      },
      required: ['space_id'],
    },
  },
  {
    name: 'get_object',
    description: "Retrieve the complete Core Schema Notation (CSN) JSON definition of a modeling object. WHEN TO USE: Use to inspect the full design-time definition of an existing view, local table, or analytic model (including Star Schema associations, dimensions, and measures). PREREQUISITES: Call list_objects to obtain technical name and object type. RETURNS: Full CSN JSON object with definitions, elements, and query specifications.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        object_name: {
          type: 'string',
          description: "Technical name of the object (e.g., \"fact_view\" or \"New_Analytic_Model\").",
        },
        object_type: {
          type: 'string',
          description: "Object type category: \"local-tables\", \"views\", \"analytic-models\", \"data-flows\".",
          enum: ['local-tables', 'views', 'analytic-models', 'data-flows'],
        },
      },
      required: ['space_id', 'object_name', 'object_type'],
    },
  },
  {
    name: 'create_local_table',
    description: "Create and deploy a new local table in the SAP Datasphere Space Catalog using standard CSN schema annotations. WHEN TO USE (CSN APPROACH): Use when the table MUST be visible in the Datasphere Web UI (Data Builder), accessible to business users, or directly consumed by Datasphere Analytic Models and SAP Analytics Cloud (SAC). DO NOT USE FOR: Raw high-speed data lake staging or complex procedural ETL (use hana_create_table instead). PREREQUISITES: Call list_spaces to obtain space_id. Space must have active storage quota. RETURNS: Success confirmation with deployed table name.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        table_name: {
          type: 'string',
          description: "Technical name for the table (e.g., \"MY_CUSTOM_TABLE\"). Must be uppercase and alphanumeric.",
        },
        columns: {
          type: 'array',
          description: "Array of column definition objects: [{ name: \"ID\", type: \"cds.String\", length: 10, isKey: true }, { name: \"AMOUNT\", type: \"cds.Decimal\", precision: 15, scale: 2 }].",
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              nullable: { type: 'boolean' },
            },
          },
        },
      },
      required: ['space_id', 'table_name', 'columns'],
    },
  },
  {
    name: 'create_view',
    description: "Create and deploy a new semantic SQL view in the SAP Datasphere Space Catalog. WHEN TO USE (CSN APPROACH): Use when the view needs to be visible in Datasphere Graphical View Builder, exposed for SAP Analytics Cloud (SAC) reporting, configured with Data Access Controls (DAC), or enriched with CSN associations (e.g. to_Customer). DO NOT USE FOR: Views using proprietary HANA functions like REAL_VECTOR or complex procedures (use hana_create_view instead). PREREQUISITES: Referenced source tables must already be deployed in the space. Call check_source_tables first. RETURNS: Deployment result confirmation.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        view_name: {
          type: 'string',
          description: "Technical name for the view (e.g., \"V_BILLING_SUMMARY\").",
        },
        sql_definition: {
          type: 'string',
          description: "SQL SELECT query defining the view logic (e.g., \"SELECT ebeln, bukrs FROM 1LR_EKKO_01\").",
        },
        description: {
          type: 'string',
          description: "Optional human-readable description for end users.",
        },
      },
      required: ['space_id', 'view_name', 'sql_definition'],
    },
  },
  {
    name: 'deploy_object',
    description: "Deploy a saved modeling object to activate its runtime artifacts in HANA. WHEN TO USE: Use when an object was updated or created without auto-deploy. PREREQUISITES: Object must exist in design-time. RETURNS: Deployment status.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        object_name: {
          type: 'string',
          description: "Technical name of the object to deploy (e.g., \"MY_VIEW\").",
        },
        object_type: {
          type: 'string',
          description: "Type of object: \"views\", \"local-tables\", \"analytic-models\".",
        },
      },
      required: ['space_id', 'object_name', 'object_type'],
    },
  },
  {
    name: 'delete_object',
    description: "Delete a modeling object from a space. WHEN TO USE: Use to clean up temporary test objects. CAUTION: Never call on production or shared assets! PREREQUISITES: Object must not have downstream dependent objects unless force delete is used. RETURNS: Deletion confirmation.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        object_name: {
          type: 'string',
          description: "Technical name of the object to delete (e.g., \"TMP_TEST_TABLE\").",
        },
        object_type: {
          type: 'string',
          description: "Object type: \"views\", \"local-tables\", \"analytic-models\".",
        },
      },
      required: ['space_id', 'object_name', 'object_type'],
    },
  },
  {
    name: 'list_catalog_assets',
    description: "Browse assets across all spaces in the tenant catalog via OData. WHEN TO USE: Use for tenant-wide asset exploration and inventory audits. PREREQUISITES: test_connection. RETURNS: Array of catalog asset objects with spaceName, name, label, and URLs.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        select_fields: {
          type: 'string',
          description: 'Fields to select',
        },
        filter_expression: {
          type: 'string',
          description: "OData $filter expression (e.g., \"spaceName eq 'FTDWH_100_INT'\" or \"supportsAnalyticalQueries eq true\").",
        },
        top: {
          type: 'number',
          description: "Page size limit (e.g., 25).",
        },
        skip: {
          type: 'number',
          description: "Pagination offset.",
        },
        include_count: {
          type: 'boolean',
          description: 'Include total count',
        },
        space_id: {
          type: 'string',
          description: 'Optional space ID to filter (legacy)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_asset_details',
    description: "Get comprehensive catalog metadata, relational data URL, and analytical capability flags for an asset. WHEN TO USE: Call before querying an asset to determine if it supports relational or analytical extraction. PREREQUISITES: Call get_space_assets first to get asset_id. RETURNS: Full asset descriptor JSON.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        asset_id: {
          type: 'string',
          description: "Technical name of the catalog asset (e.g., \"fact_view\" or \"New_Analytic_Model\").",
        },
        expand_fields: {
          type: 'string',
          description: 'Fields to expand',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'get_asset_by_compound_key',
    description: 'Retrieve asset by space and name',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_name: {
          type: 'string',
          description: 'The asset name',
        },
      },
      required: ['space_id', 'asset_name'],
    },
  },
  {
    name: 'get_space_assets',
    description: "List all catalog assets (tables, views, analytical models) in a specific space. WHEN TO USE: Essential discovery step after list_spaces. Returns capabilities such as supportsAnalyticalQueries and data URLs. PREREQUISITES: Call list_spaces first. RETURNS: Array of asset objects with name, label, relational/analytical URLs, and capability flags.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        filter_expression: {
          type: 'string',
          description: 'OData filter expression',
        },
        top: {
          type: 'number',
          description: "Maximum number of assets to return (default: 50).",
        },
        skip: {
          type: 'number',
          description: "Number of assets to skip for pagination.",
        },
      },
      required: ['space_id'],
    },
  },
  {
    name: 'search_catalog',
    description: "Search catalog assets across spaces by keyword or business label. WHEN TO USE: Use to find specific entities (e.g., \"purchase orders\", \"cost center\", \"gl account\") across the tenant. PREREQUISITES: test_connection. RETURNS: Matching asset objects with space, name, label, and capabilities.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: "Search term or substring (e.g., \"billing\" or \"ACDOCA\").",
        },
        space_id: {
          type: 'string',
          description: "Optional space ID (e.g., \"FTDWH_100_INT\") to restrict search.",
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'search_repository',
    description: 'Search repository objects with filters',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: 'Search keyword',
        },
        object_types: {
          type: 'string',
          description: 'Comma-separated object types to filter',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'find_assets_by_column',
    description: 'Find all assets containing a specific column name for data lineage',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        column_name: {
          type: 'string',
          description: 'The column name to search for',
        },
        space_id: {
          type: 'string',
          description: 'Optional space ID to filter',
        },
        max_assets: {
          type: 'number',
          description: 'Maximum assets to return',
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Case sensitive search',
        },
      },
      required: ['column_name'],
    },
  },
  {
    name: 'analyze_column_distribution',
    description: 'Statistical analysis of column data distribution and quality profiling',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_name: {
          type: 'string',
          description: 'The asset name',
        },
        column_name: {
          type: 'string',
          description: 'The column to analyze',
        },
        sample_size: {
          type: 'number',
          description: 'Sample size',
        },
        include_outliers: {
          type: 'boolean',
          description: 'Include outliers',
        },
      },
      required: ['space_id', 'asset_name', 'column_name'],
    },
  },
];

const queryTools: ToolDefinition[] = [
  {
    name: 'smart_query',
    description: 'Execute a natural language query against Datasphere data',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID to query',
        },
        query: {
          type: 'string',
          description: 'Natural language query or SQL SELECT statement',
        },
        mode: {
          type: 'string',
          description: 'Query mode',
        },
        limit: {
          type: 'number',
          description: 'Max rows',
        },
        include_metadata: {
          type: 'boolean',
          description: 'Include metadata',
        },
        fallback: {
          type: 'boolean',
          description: 'Fallback enabled',
        },
      },
      required: ['space_id', 'query'],
    },
  },
  {
    name: 'query_relational',
    description: 'Query a relational entity (table/view) using OData parameters',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        entity_name: {
          type: 'string',
          description: 'The entity (table/view) name',
        },
        select: {
          type: 'string',
          description: 'Comma-separated column names to select',
        },
        filter: {
          type: 'string',
          description: 'OData filter expression',
        },
        top: {
          type: 'number',
          description: 'Number of rows to return (default 100)',
        },
        skip: {
          type: 'number',
          description: 'Number of rows to skip',
        },
        orderby: {
          type: 'string',
          description: 'Order by expression',
        },
      },
      required: ['space_id', 'entity_name'],
    },
  },
  {
    name: 'get_metadata',
    description: 'Get metadata (columns, types) for an entity',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        entity_name: {
          type: 'string',
          description: 'The entity name',
        },
      },
      required: ['space_id', 'entity_name'],
    },
  },
  {
    name: 'search_assets',
    description: 'Search for assets in the Datasphere catalog',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search term',
        },
        space_id: {
          type: 'string',
          description: 'Optional space ID to filter results',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_catalog_metadata',
    description: 'Retrieve CSDL metadata schema for catalog service',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_analytical_metadata',
    description: 'Get analytical model metadata with pre-flight checks',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_id: {
          type: 'string',
          description: 'The asset ID',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'get_relational_metadata',
    description: 'Get relational schema with SQL type mappings',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        entity_name: {
          type: 'string',
          description: 'The entity name',
        },
      },
      required: ['space_id', 'entity_name'],
    },
  },
  {
    name: 'list_analytical_datasets',
    description: 'List all analytical datasets and entity sets for a model',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_id: {
          type: 'string',
          description: 'The asset ID',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'get_analytical_model',
    description: 'Get OData service document and analytical model metadata',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_id: {
          type: 'string',
          description: 'The asset ID',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'get_analytical_service_document',
    description: 'Get service capabilities, entity sets, and navigation properties',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_id: {
          type: 'string',
          description: 'The asset ID',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'query_analytical_data',
    description: "Execute a multi-dimensional OLAP query against an Analytic Model to aggregate measures across dimensions. Automatically injects mandatory Accept-Language header. WHEN TO USE: Use for analytical models (e.g., New_Analytic_Model) to compute sums, averages, and group metrics. PREREQUISITES: Asset must have supportsAnalyticalQueries: true. Call get_space_assets first. RETURNS: Aggregated multidimensional result set.",
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        asset_id: {
          type: 'string',
          description: "Technical name of the analytical model (e.g., \"New_Analytic_Model\").",
        },
        entity_name: {
          type: 'string',
          description: 'The entity name (alias for entity_set)',
        },
        entity_set: {
          type: 'string',
          description: "Entity set name (defaults to asset_id).",
        },
        select: {
          type: 'string',
          description: "Dimensions and measures to include (e.g., \"PRODUCT_ID,REVENUE,QUANTITY\").",
        },
        filter: {
          type: 'string',
          description: "OData analytical filter expression (e.g., \"REVENUE gt 5000\").",
        },
        apply: {
          type: 'string',
          description: 'OData apply expression',
        },
        top: {
          type: 'number',
          description: "Max aggregated rows to return (default: 100).",
        },
        orderby: {
          type: 'string',
          description: 'Order by expression',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'execute_query',
    description: "Execute a SQL query against SAP Datasphere or SAP HANA Cloud. When HANA database credentials (DSP_OPEN_SCHEME) are configured, executes directly in HANA; otherwise falls back to relational OData. WHEN TO USE: Use when the user requests an SQL SELECT statement across tables. PREREQUISITES: Call list_spaces to get space_id. RETURNS: JSON array of query result rows.",
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        sql_query: {
          type: 'string',
          description: "SQL SELECT statement to execute (e.g., \"SELECT * FROM fact_view WHERE REVENUE > 1000\").",
        },
        limit: {
          type: 'number',
          description: "Max rows to return (default: 100).",
        },
      },
      required: ['space_id', 'sql_query'],
    },
  },
  {
    name: 'list_relational_entities',
    description: "Discover the exact internal OData entity set name for a relational asset. CRITICAL: Assets starting with digits (e.g. 4VD_..., 1LR_...) prepend an underscore (_4VD_...). Call this tool before any relational query to avoid 404 errors. WHEN TO USE: Mandatory prerequisite before calling query_relational_entity. PREREQUISITES: Call get_space_assets first. RETURNS: Array of entity set names.",
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        asset_id: {
          type: 'string',
          description: "Technical name of the asset (e.g., \"1LR_100_FTWPINV6_01\" or \"fact_view\").",
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'get_relational_entity_metadata',
    description: 'Get entity metadata with SQL type mappings for data warehouse loading',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_id: {
          type: 'string',
          description: 'The asset ID',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'query_relational_entity',
    description: "Query records from a relational entity set with OData filter, select, orderby, top, and skip parameters. WHEN TO USE: Primary tool for reading table or view data. PREREQUISITES: Call list_relational_entities first to obtain the exact entity_name. RETURNS: JSON array of data records matching the query criteria.",
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        asset_id: {
          type: 'string',
          description: "Technical name of the asset (e.g., \"fact_view\").",
        },
        entity_name: {
          type: 'string',
          description: "Exact entity set name returned by list_relational_entities (e.g., \"fact_view\" or \"_1LR_100_FTWPINV6_01\").",
        },
        select: {
          type: 'string',
          description: "Comma-separated list of columns to retrieve (e.g., \"FACT_ID,NODE_ID,REVENUE\").",
        },
        filter: {
          type: 'string',
          description: "OData $filter expression (e.g., \"REVENUE gt 1000\" or \"NODE_ID eq 'N1'\").",
        },
        top: {
          type: 'number',
          description: "Max number of rows to return (default: 100, max: 1000).",
        },
        skip: {
          type: 'number',
          description: "Number of rows to skip for pagination.",
        },
        orderby: {
          type: 'string',
          description: 'Order by expression',
        },
      },
      required: ['space_id', 'asset_id', 'entity_name'],
    },
  },
  {
    name: 'get_relational_odata_service',
    description: 'Get OData service document with ETL planning capabilities',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_id: {
          type: 'string',
          description: 'The asset ID',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
  {
    name: 'get_asset_variables',
    description: 'Surface input parameters/variables and filter capability annotations',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        asset_id: {
          type: 'string',
          description: 'The asset ID',
        },
      },
      required: ['space_id', 'asset_id'],
    },
  },
];

const connectionTools: ToolDefinition[] = [
  {
    name: 'list_connections',
    description: "List all active remote connections configured in a specific space (e.g., ABAP, SAPBW, S3, HANA). WHEN TO USE: Call to inspect source system integrations, BW aliases, or data replication connections. PREREQUISITES: Call list_spaces first to obtain space_id. RETURNS: Array of connection objects with name, businessName, typeId, creator, and realtimeReplicationStatus.",
    category: 'connections',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        connection_type: {
          type: 'string',
          description: 'Filter by connection type',
        },
      },
      required: [],
    },
  },
  {
    name: 'test_connection_health',
    description: 'Test if a data source connection is healthy',
    category: 'connections',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        connection_name: {
          type: 'string',
          description: 'The connection name to test',
        },
      },
      required: ['connection_name'],
    },
  },
  {
    name: 'get_consumption_metadata',
    description: 'Get consumption layer metadata (CSDL schema)',
    category: 'connections',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_deployed_objects',
    description: 'List all deployed objects in a space',
    category: 'connections',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'browse_marketplace',
    description: 'Browse Data Marketplace assets and packages',
    category: 'connections',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        search_term: {
          type: 'string',
          description: 'Search keyword',
        },
      },
      required: [],
    },
  },
];

const userTools: ToolDefinition[] = [
  {
    name: 'list_users',
    description: 'List all database users',
    category: 'users',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_user',
    description: 'Create a new database user',
    category: 'users',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        username: {
          type: 'string',
          description: 'Username for the new database user',
        },
        password: {
          type: 'string',
          description: 'Password for the new user',
        },
      },
      required: ['username', 'password'],
    },
  },
];

const databaseUserTools: ToolDefinition[] = [
  {
    name: 'list_database_users',
    description: 'List all database users (alias for list_users, Mario: space_id required)',
    category: 'users',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_database_user',
    description: 'Create a new database user',
    category: 'users',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        database_user_id: {
          type: 'string',
          description: 'Database user ID',
        },
        user_definition: {
          type: 'object',
          description: 'User definition object',
        },
      },
      required: ['space_id', 'database_user_id'],
    },
  },
  {
    name: 'update_database_user',
    description: 'Update a database user',
    category: 'users',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        database_user_id: {
          type: 'string',
          description: 'Database user ID',
        },
        updated_definition: {
          type: 'object',
          description: 'Updated definition',
        },
      },
      required: ['space_id', 'database_user_id'],
    },
  },
  {
    name: 'delete_database_user',
    description: 'Delete a database user',
    category: 'users',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        database_user_id: {
          type: 'string',
          description: 'Database user ID',
        },
        force: {
          type: 'boolean',
          description: 'Force deletion',
        },
      },
      required: ['space_id', 'database_user_id'],
    },
  },
  {
    name: 'reset_database_user_password',
    description: 'Reset database user password',
    category: 'users',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        database_user_id: {
          type: 'string',
          description: 'Database user ID',
        },
      },
      required: ['space_id', 'database_user_id'],
    },
  },
  {
    name: 'get_repository_search_metadata',
    description: 'Get repository search metadata',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_task_log',
    description: 'Get task log details',
    category: 'tasks',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        log_id: {
          type: 'string',
          description: 'The log ID',
        },
        detail_level: {
          type: 'string',
          description: 'Detail level',
        },
      },
      required: ['space_id', 'log_id'],
    },
  },
  {
    name: 'get_task_history',
    description: "Retrieve execution logs and run history for an ETL task, replication flow, or data flow in a space. WHEN TO USE: Use to investigate ETL pipeline execution status, diagnose failed runs, or check task duration. PREREQUISITES: Call list_objects to obtain object technical name. RETURNS: Task execution logs with timestamps and status.",
    category: 'tasks',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        object_id: {
          type: 'string',
          description: "Technical name of the flow or task (e.g., \"1RF_100_EKPO_01\" or \"1DF_EKKO_01\").",
        },
      },
      required: ['space_id', 'object_id'],
    },
  },
];

const taskTools: ToolDefinition[] = [
  {
    name: 'list_task_chains',
    description: 'List all task chains in a space',
    category: 'tasks',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
      },
      required: ['space_id'],
    },
  },
  {
    name: 'run_task_chain',
    description: 'Execute a task chain',
    category: 'tasks',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        object_id: {
          type: 'string',
          description: 'The task chain object ID',
        },
        task_chain_id: {
          type: 'string',
          description: 'Alias for object_id (backward compat)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_task_status',
    description: 'Get the status of a running or completed task',
    category: 'tasks',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to check',
        },
        space_id: {
          type: 'string',
          description: 'Optional space ID',
        },
      },
      required: [],
    },
  },
];

const abapTools: ToolDefinition[] = [
  {
    name: 'analyze_abap_file',
    description: "Analyze an ABAP routine or transformation file and extract SQL/CDS conversion patterns. WHEN TO USE: Use during BW migration to convert BW start/end/expert routines into SQL logic. PREREQUISITES: None. RETURNS: Extracted field assignments, SQL expressions, and conversion recommendations.",
    category: 'abap',
    requiresAuth: false,
    inputSchema: {
      type: 'object' as const,
      properties: {
        file_content: {
          type: 'string',
          description: 'The ABAP file content (CDS view, report, BW transformation, or function module)',
        },
      },
      required: ['file_content'],
    },
  },
  {
    name: 'check_source_tables',
    description: "Verify that required replicated source tables exist and are deployed in the target Datasphere space. WHEN TO USE: Mandatory pre-flight check before deploying SQL views or data flows that depend on source tables (e.g., 0FI_ACDOCA_10, 1LR_EKKO_01). PREREQUISITES: Call list_spaces first. RETURNS: Object indicating which tables exist and which are missing.",
    category: 'abap',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (e.g., \"FTDWH_100_INT\").",
        },
        table_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of table names to check',
        },
      },
      required: ['space_id', 'table_names'],
    },
  },
  {
    name: 'validate_sql_view',
    description: "Validate SQL view syntax, check for dangerous operations (DROP, TRUNCATE), and ensure all referenced tables exist in the target space. WHEN TO USE: Call prior to calling create_view or deploy_view_to_datasphere. PREREQUISITES: Call check_source_tables first. RETURNS: Validation status with list of detected issues or confirmation of readiness.",
    category: 'abap',
    requiresAuth: false,
    inputSchema: {
      type: 'object' as const,
      properties: {
        sql_definition: {
          type: 'string',
          description: 'The SQL CREATE VIEW statement to validate',
        },
        source_tables: {
          type: 'array',
          items: { type: 'string' },
          description: "Array of tables that must be referenced by the query.",
        },
      },
      required: ['sql_definition'],
    },
  },
  {
    name: 'deploy_view_to_datasphere',
    description: 'Deploy a SQL view to SAP Datasphere. Use this after you have generated and validated the SQL.',
    category: 'abap',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'Target Datasphere space',
        },
        view_name: {
          type: 'string',
          description: 'Technical name for the view',
        },
        sql_definition: {
          type: 'string',
          description: 'The SQL CREATE VIEW statement',
        },
        description: {
          type: 'string',
          description: 'Description of the view',
        },
      },
      required: ['space_id', 'view_name', 'sql_definition'],
    },
  },
  {
    name: 'get_abap_conversion_guide',
    description: "Retrieve recommended conversion patterns, rules, and best practices for translating ABAP transformation routines into SAP Datasphere SQL/CDS views. WHEN TO USE: Call for architectural guidance when migrating complex ABAP routines. PREREQUISITES: None. RETURNS: Markdown guide with code pattern translations.",
    category: 'abap',
    requiresAuth: false,
    inputSchema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: 'Conversion topic',
          enum: ['CDS_VIEW', 'SELECT', 'JOINS', 'AGGREGATIONS', 'BW_TRANSFORMATION', 'BW_QUERY', 'ALL'],
        },
      },
      required: ['topic'],
    },
  },
];

const monitoringTools: ToolDefinition[] = [
  {
    name: 'get_audit_log',
    description: 'Get audit trail of recent changes in the tenant',
    category: 'monitoring',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of entries to return (default 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'test_analytical_endpoints',
    description: 'Test analytical/query API endpoint availability',
    category: 'diagnostic',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'test_phase67_endpoints',
    description: 'Test Phase 6 and 7 endpoint availability (KPI, monitoring, users)',
    category: 'diagnostic',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'test_phase8_endpoints',
    description: 'Test Phase 8 endpoint availability (data sharing, AI features)',
    category: 'diagnostic',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

const bwQueryTools: ToolDefinition[] = [
  {
    name: 'bw_inspect_provider',
    description: "Inspect an SAP BW InfoProvider (ADSO, CompositeProvider, InfoCube) via remote connection. WHEN TO USE: First step in BW2DSP migration. Call to extract InfoObjects, dimensions, key figures, and compounding logic. PREREQUISITES: Call list_connections to verify SAPBW connection. RETURNS: Detailed structure of dimensions and metrics.",
    category: 'bw_queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        alias: { type: 'string', description: "Connection alias for the SAP BW system configured in Datasphere (e.g., \"FTDWH_x7A\")." },
        project: { type: 'string', description: "BW project or source area name." },
        provider: { type: 'string', description: 'InfoProvider technical name (e.g., 0D_SD01)' },
      },
      required: ['alias', 'project', 'provider'],
    },
  },
  {
    name: 'bw_read_query',
    description: "Read full BEx / BW query specification including formulas, calculated key figures, restricted key figures, variables, and filters. WHEN TO USE: Essential step before modeling Datasphere Analytic Models to replicate BW business logic. PREREQUISITES: Call bw_list_queries to obtain technicalName. RETURNS: Detailed query specification JSON.",
    category: 'bw_queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        alias: { type: 'string', description: "Connection alias for the SAP BW system (e.g., \"FTDWH_x7A\")." },
        project: { type: 'string', description: "BW project name." },
        technicalName: { type: 'string', description: "Technical name of the BW query." },
      },
      required: ['alias', 'project', 'technicalName'],
    },
  },
  {
    name: 'bw_list_queries',
    description: "List all BEx / BW Queries defined on a specific InfoProvider. WHEN TO USE: Use during BW migration planning to inventory all reporting queries built on a provider. PREREQUISITES: Call bw_inspect_provider first. RETURNS: Array of query technical names and descriptions.",
    category: 'bw_queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        alias: { type: 'string', description: "Connection alias for the SAP BW system (e.g., \"FTDWH_x7A\")." },
        project: { type: 'string', description: "BW project name." },
        provider: { type: 'string', description: 'InfoProvider technical name' },
      },
      required: ['alias', 'project', 'provider'],
    },
  },
  {
    name: 'bw_review_query_design',
    description: 'Review BW query against design best practices (BWQ001-BWQ012). Identify issues before converting to Datasphere.',
    category: 'bw_queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        alias: { type: 'string', description: 'Connection alias' },
        project: { type: 'string', description: 'BW project name' },
        technicalName: { type: 'string', description: 'Query technical name' },
      },
      required: ['alias', 'project', 'technicalName'],
    },
  },
  {
    name: 'bw_get_query_spec',
    description: 'Get structured QuerySpec v1 from BW query. Returns machine-readable specification for conversion to Datasphere Analytical Model.',
    category: 'bw_queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        alias: { type: 'string', description: 'Connection alias' },
        project: { type: 'string', description: 'BW project name' },
        technicalName: { type: 'string', description: 'Query technical name' },
      },
      required: ['alias', 'project', 'technicalName'],
    },
  },
];

const hanaTools: ToolDefinition[] = [
  {
    name: 'hana_execute_sql',
    description: "Execute SQL queries or DDL directly on SAP HANA Cloud in the authorized Open SQL Schema (DSP_OPEN_SCHEME). Write operations (CREATE, DROP, INSERT, ALTER) are strictly restricted to DSP_OPEN_SCHEME. WHEN TO USE: Primary tool for direct SQL execution, table creation, and ad-hoc analytics in the user Open SQL Schema. PREREQUISITES: HANA credentials (DSP_host, DSP_Hana_user, DSP_PASSWORD, DSP_OPEN_SCHEME) in .env. RETURNS: Query result rows or execution message.",
    category: 'hana',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        sql_query: {
          type: 'string',
          description: "SQL statement to execute. Write operations must target an authorized schema (default: DSP_OPEN_SCHEME / FTDWH_100_INT).",
        },
        schema_name: {
          type: 'string',
          description: "Optional target schema name (defaults to DSP_OPEN_SCHEME / FTDWH_100_INT if omitted). Supports any authorized space/schema requested by user context (e.g. FTDWH_100_INT).",
        },
      },
      required: ['sql_query'],
    },
  },
  {
    name: 'hana_create_table',
    description: "Create a physical column table directly in SAP HANA Cloud in the authorized Open SQL Schema (DSP_OPEN_SCHEME). WHEN TO USE (HANA SQL APPROACH): Use for high-volume data staging, fast data ingestion (via Python, ODBC, JDBC, or Kafka), temporary/scratchpad tables, or when native HANA features (indexes, partitions, REAL_VECTOR) are required without Datasphere OData catalog overhead. DO NOT USE FOR: Final analytical models that business users need to view and edit in Datasphere Data Builder (use create_local_table for that). PREREQUISITES: HANA database credentials configured. RETURNS: Success confirmation.",
    category: 'hana',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        table_name: {
          type: 'string',
          description: "Technical name of the new table (e.g., \"INVENTORY_STAGING\"). Alphanumeric characters only.",
        },
        columns_definition: {
          type: 'string',
          description: "SQL column definitions (e.g., \"ID INT PRIMARY KEY, PRODUCT_NAME NVARCHAR(100), PRICE DECIMAL(15, 2), UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP\").",
        },
        schema_name: {
          type: 'string',
          description: "Optional target schema name (defaults to DSP_OPEN_SCHEME / FTDWH_100_INT if omitted). Supports any authorized space/schema requested by user context (e.g. FTDWH_100_INT).",
        },
      },
      required: ['table_name', 'columns_definition'],
    },
  },
  {
    name: 'hana_create_view',
    description: "Create a SQL view directly in SAP HANA Cloud in the authorized Open SQL Schema (DSP_OPEN_SCHEME). WHEN TO USE (HANA SQL APPROACH): Use for advanced SQL transforms that leverage full SAP HANA Cloud engine capabilities (multi-tier CTEs, window functions like ROW_NUMBER/RANK, full-text search, graph queries, vector similarity search) or for direct consumption by external BI tools (Power BI, Tableau, DBeaver) connecting to HANA port 443. DO NOT USE FOR: Views that must be edited in Datasphere Graphical View Builder or consumed by SAC without a Database User connection (use create_view for that). PREREQUISITES: HANA database credentials configured. RETURNS: Success confirmation.",
    category: 'hana',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        view_name: {
          type: 'string',
          description: "Technical name of the new view (e.g., \"V_INVENTORY_ACTIVE\").",
        },
        select_query: {
          type: 'string',
          description: "SQL SELECT statement defining the view (e.g., \"SELECT ID, PRODUCT_NAME FROM INVENTORY_STAGING WHERE PRICE > 0\").",
        },
        schema_name: {
          type: 'string',
          description: "Optional target schema name (defaults to DSP_OPEN_SCHEME / FTDWH_100_INT if omitted). Supports any authorized space/schema requested by user context (e.g. FTDWH_100_INT).",
        },
      },
      required: ['view_name', 'select_query'],
    },
  },
  {
    name: 'hana_list_tables',
    description: "List all tables existing in the authorized Open SQL Schema (DSP_OPEN_SCHEME) by querying SYS.TABLES. WHEN TO USE: Call to inspect existing tables created by database users in the Open SQL Schema. PREREQUISITES: HANA database credentials configured. RETURNS: Array of table records with TABLE_NAME, TABLE_TYPE, and COMMENTS.",
    category: 'hana',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema_name: {
          type: 'string',
          description: "Optional target schema name (defaults to DSP_OPEN_SCHEME / FTDWH_100_INT if omitted). Supports any authorized space/schema requested by user context (e.g. FTDWH_100_INT).",
        },
      },
      required: [],
    },
  },
  {
    name: 'hana_list_views',
    description: "List all views existing in the authorized Open SQL Schema (DSP_OPEN_SCHEME) by querying SYS.VIEWS. WHEN TO USE: Call to inspect existing SQL views created in the Open SQL Schema. PREREQUISITES: HANA database credentials configured. RETURNS: Array of view records with VIEW_NAME and COMMENTS.",
    category: 'hana',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema_name: {
          type: 'string',
          description: "Optional target schema name (defaults to DSP_OPEN_SCHEME / FTDWH_100_INT if omitted). Supports any authorized space/schema requested by user context (e.g. FTDWH_100_INT).",
        },
      },
      required: [],
    },
  },
];

const adminTools: ToolDefinition[] = [
  {
    name: 'audit_space_health',
    description: "Perform an evidence-grounded health inspection and fault audit of a Datasphere space. WHEN TO USE: Use by space administrators to evaluate space health score (0-100), identify unmaintained/orphaned tables, find tables missing primary keys, check task chain execution failures, and detect missing business labels. PREREQUISITES: Call list_spaces first. INPUTS: space_id (optional, defaults to FTDWH_100_INT). RETURNS: Space health score, category breakdowns, fault list with severity (CRITICAL, WARNING, INFO), and actionable remediation steps.",
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space to audit (defaults to FTDWH_100_INT if omitted).",
        },
      },
      required: [],
    },
  },
  {
    name: 'audit_table_health',
    description: "Perform an in-depth schema, primary key, nullability, and documentation health audit of a specific table. WHEN TO USE: Use to diagnose why a table is failing delta replication, check if primary keys are missing, and verify column-level documentation coverage. PREREQUISITES: table_name. INPUTS: table_name, space_id (defaults to FTDWH_100_INT). RETURNS: Table health score, column-by-column audit, primary key status, and remediation recommendations.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        table_name: {
          type: 'string',
          description: "Technical name of the table to audit (e.g. \"1LR_VBAP_01\" or \"SALES_TRANSACTIONS\").",
        },
        space_id: {
          type: 'string',
          description: "Technical name of the space (defaults to FTDWH_100_INT).",
        },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'audit_task_chains',
    description: "Audit execution health, reliability, failure rates, and run durations for task chains and data replication pipelines in a space. WHEN TO USE: Use to identify failed ETL pipelines, hung replication tasks, and abnormal run times. PREREQUISITES: space_id. INPUTS: space_id (defaults to FTDWH_100_INT), task_chain_id (optional). RETURNS: Health summary of all task chains, failure diagnosis, and execution durations.",
    category: 'tasks',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: "Technical name of the space (defaults to FTDWH_100_INT).",
        },
        task_chain_id: {
          type: 'string',
          description: "Optional specific task chain ID to inspect.",
        },
      },
      required: [],
    },
  },
  {
    name: 'suggest_table_documentation',
    description: "Intelligently infer and generate business descriptions and labels for a table and its columns using the SAP business context dictionary. Produces a before-and-after diff so administrators can see the changes as is. WHEN TO USE: Call when tables or columns lack business documentation or labels to automatically enrich catalog discoverability. INPUTS: table_name, space_id (defaults to FTDWH_100_INT), column_names (optional array). RETURNS: Before vs. After diff of column labels, business descriptions, confidence levels, and CSN patch preview.",
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        table_name: {
          type: 'string',
          description: "Technical name of the table (e.g. \"1LR_VBAP_01\", \"VBAK\", \"EKPO\").",
        },
        space_id: {
          type: 'string',
          description: "Technical name of the space (defaults to FTDWH_100_INT).",
        },
        column_names: {
          type: 'array',
          items: { type: 'string' },
          description: "Optional list of column names. If omitted, columns are introspected automatically.",
        },
      },
      required: ['table_name'],
    },
  },
];

export function getAllTools(profile: 'lean' | 'full' = 'lean'): ToolDefinition[] {
  const allTools = [
    ...foundationTools,
    ...spaceTools,
    ...objectTools,
    ...queryTools,
    ...connectionTools,
    ...userTools,
    ...databaseUserTools,
    ...taskTools,
    ...abapTools,
    ...bwQueryTools,
    ...monitoringTools,
    ...hanaTools,
    ...adminTools,
  ];

  if (profile === 'lean') {
    return allTools.filter(t => t.category !== 'monitoring' && t.category !== 'diagnostic');
  }

  return allTools;
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return getAllTools('full').find(t => t.name === name);
}
