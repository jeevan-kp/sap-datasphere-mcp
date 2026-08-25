import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface ToolDefinition extends Tool {
  category: string;
  requiresAuth: boolean;
}

const foundationTools: ToolDefinition[] = [
  {
    name: 'test_connection',
    description: 'Test connectivity to SAP Datasphere tenant',
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
    description: 'Get the currently authenticated user information',
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
    description: 'Get SAP Datasphere tenant metadata and configuration',
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
    description: 'List OAuth2 scopes available for the current token',
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
    description: 'List all available spaces in the SAP Datasphere tenant',
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        include_details: {
          type: 'boolean',
          description: 'Include detailed space information',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_space_info',
    description: 'Get detailed information about a specific space',
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID to get information about',
        },
      },
      required: ['space_id'],
    },
  },
  {
    name: 'get_table_schema',
    description: 'Get column definitions and data types for a table/view',
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        table_name: {
          type: 'string',
          description: 'The table or view name',
        },
      },
      required: ['space_id', 'table_name'],
    },
  },
  {
    name: 'search_tables',
    description: 'Search for tables and views by keyword',
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        search_term: {
          type: 'string',
          description: 'Search keyword',
        },
        space_id: {
          type: 'string',
          description: 'Optional space ID to filter',
        },
      },
      required: ['search_term'],
    },
  },
  {
    name: 'create_space',
    description: 'Create a new space in SAP Datasphere',
    category: 'spaces',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Technical name for the space',
        },
        display_name: {
          type: 'string',
          description: 'Display name for the space',
        },
        description: {
          type: 'string',
          description: 'Description of the space',
        },
      },
      required: ['name'],
    },
  },
];

const objectTools: ToolDefinition[] = [
  {
    name: 'list_objects',
    description: 'List all modeling objects in a space',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        object_type: {
          type: 'string',
          description: 'Filter by object type (e.g., local-tables, views, analytic-models)',
          enum: ['local-tables', 'views', 'analytic-models', 'data-flows', 'task-chains'],
        },
      },
      required: ['space_id'],
    },
  },
  {
    name: 'get_object',
    description: 'Get the definition of a specific modeling object',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        object_name: {
          type: 'string',
          description: 'The technical name of the object',
        },
        object_type: {
          type: 'string',
          description: 'The object type',
          enum: ['local-tables', 'views', 'analytic-models', 'data-flows'],
        },
      },
      required: ['space_id', 'object_name', 'object_type'],
    },
  },
  {
    name: 'create_local_table',
    description: 'Create a new local table in a space',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        table_name: {
          type: 'string',
          description: 'Technical name for the table',
        },
        columns: {
          type: 'array',
          description: 'Column definitions',
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
    description: 'Create a new view in a space using SQL definition',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        view_name: {
          type: 'string',
          description: 'Technical name for the view',
        },
        sql_definition: {
          type: 'string',
          description: 'SQL SELECT statement defining the view',
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
    name: 'deploy_object',
    description: 'Deploy a modeling object to make it active',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        object_name: {
          type: 'string',
          description: 'The technical name of the object to deploy',
        },
        object_type: {
          type: 'string',
          description: 'The object type',
        },
      },
      required: ['space_id', 'object_name', 'object_type'],
    },
  },
  {
    name: 'delete_object',
    description: 'Delete a modeling object from a space',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        object_name: {
          type: 'string',
          description: 'The technical name of the object to delete',
        },
        object_type: {
          type: 'string',
          description: 'The object type',
        },
      },
      required: ['space_id', 'object_name', 'object_type'],
    },
  },
  {
    name: 'list_catalog_assets',
    description: 'Browse all catalog assets across spaces',
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
          description: 'OData filter expression',
        },
        top: {
          type: 'number',
          description: 'Max results',
        },
        skip: {
          type: 'number',
          description: 'Skip count',
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
    description: 'Get comprehensive asset metadata and schema',
    category: 'objects',
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
    description: 'List all assets within a specific space',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        filter_expression: {
          type: 'string',
          description: 'OData filter expression',
        },
        top: {
          type: 'number',
          description: 'Max results',
        },
        skip: {
          type: 'number',
          description: 'Skip count',
        },
      },
      required: ['space_id'],
    },
  },
  {
    name: 'search_catalog',
    description: 'Search catalog assets by query',
    category: 'objects',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: 'Search keyword',
        },
        space_id: {
          type: 'string',
          description: 'Optional space ID to filter',
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
    description: 'Execute OData analytical queries with $select, $filter, $apply, $top',
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
        entity_name: {
          type: 'string',
          description: 'The entity name (alias for entity_set)',
        },
        entity_set: {
          type: 'string',
          description: 'The entity set name',
        },
        select: {
          type: 'string',
          description: 'Columns to select',
        },
        filter: {
          type: 'string',
          description: 'OData filter expression',
        },
        apply: {
          type: 'string',
          description: 'OData apply expression',
        },
        top: {
          type: 'number',
          description: 'Number of rows to return',
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
    description: 'Execute SQL queries on Datasphere tables/views with SQL to OData conversion',
    category: 'queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The space ID',
        },
        sql_query: {
          type: 'string',
          description: 'SQL SELECT statement',
        },
        limit: {
          type: 'number',
          description: 'Max rows',
        },
      },
      required: ['space_id', 'sql_query'],
    },
  },
  {
    name: 'list_relational_entities',
    description: 'List all available relational entities within an asset for ETL operations',
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
    description: 'Execute OData queries with large batch processing for ETL extraction',
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
        entity_name: {
          type: 'string',
          description: 'The entity name',
        },
        select: {
          type: 'string',
          description: 'Columns to select',
        },
        filter: {
          type: 'string',
          description: 'OData filter expression',
        },
        top: {
          type: 'number',
          description: 'Number of rows to return (up to 50000)',
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
    description: 'List all data source connections',
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
    description: 'Get task history',
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
          description: 'The object ID',
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
    description: 'Analyze an ABAP file and extract its structure (tables, fields, joins, logic). Use this to understand the ABAP code before converting it.',
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
    description: 'Check if the source tables from ABAP code exist in Datasphere and get their metadata',
    category: 'abap',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: {
          type: 'string',
          description: 'The Datasphere space to search in',
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
    description: 'Validate a SQL view definition before deploying. Check syntax, column names, and table references.',
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
          description: 'Expected source tables',
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
    description: 'Get ABAP to SQL conversion patterns and best practices. Use this as reference when converting ABAP code.',
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
    description: 'Read InfoProvider metadata from BW (characteristics, key figures, hierarchies). Read-only. Use for ABAP-to-Datasphere conversion context.',
    category: 'bw_queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        alias: { type: 'string', description: 'Connection alias' },
        project: { type: 'string', description: 'BW project name' },
        provider: { type: 'string', description: 'InfoProvider technical name (e.g., 0D_SD01)' },
      },
      required: ['alias', 'project', 'provider'],
    },
  },
  {
    name: 'bw_read_query',
    description: 'Read BW query definition including axes, key figures, filters, variables, formulas. Essential for understanding ABAP BW query structure before conversion.',
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
    name: 'bw_list_queries',
    description: 'List all BW queries on an InfoProvider. Use to discover existing queries for batch conversion.',
    category: 'bw_queries',
    requiresAuth: true,
    inputSchema: {
      type: 'object' as const,
      properties: {
        alias: { type: 'string', description: 'Connection alias' },
        project: { type: 'string', description: 'BW project name' },
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
  ];

  if (profile === 'lean') {
    return allTools.filter(t => t.category !== 'monitoring' && t.category !== 'diagnostic');
  }

  return allTools;
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return getAllTools('full').find(t => t.name === name);
}
