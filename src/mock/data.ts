/**
 * Mock Data for SAP Datasphere MCP Server
 * Provides realistic sample data for testing without a real tenant
 */

export interface MockSpace {
  id: string;
  displayName: string;
  description?: string;
  createdAt: string;
  modifiedAt: string;
  owner: string;
  region: string;
}

export interface MockConnection {
  name: string;
  type: string;
  displayName: string;
  description?: string;
  status: 'OK' | 'ERROR' | 'UNKNOWN';
}

export interface MockCatalogAsset {
  name: string;
  type: string;
  spaceId: string;
  displayName: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  createdAt: string;
}

export interface MockUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
  spaces: string[];
}

// ============ SPACES ============
export const MOCK_SPACES: MockSpace[] = [
  {
    id: 'SPACE_SALES',
    displayName: 'Sales Analytics',
    description: 'Sales data and analytics views',
    createdAt: '2024-01-15T10:00:00Z',
    modifiedAt: '2024-03-20T14:30:00Z',
    owner: 'admin@company.com',
    region: 'us10',
  },
  {
    id: 'SPACE_FINANCE',
    displayName: 'Finance Data',
    description: 'Financial reporting and consolidation',
    createdAt: '2024-02-01T09:00:00Z',
    modifiedAt: '2024-03-18T11:00:00Z',
    owner: 'finance.admin@company.com',
    region: 'us10',
  },
  {
    id: 'SPACE_MASTER_DATA',
    displayName: 'Master Data Hub',
    description: 'Shared master data objects',
    createdAt: '2024-01-10T08:00:00Z',
    modifiedAt: '2024-03-15T16:45:00Z',
    owner: 'mdm.admin@company.com',
    region: 'us10',
  },
  {
    id: 'SPACE_MARKETING',
    displayName: 'Marketing Analytics',
    description: 'Campaign and marketing data',
    createdAt: '2024-03-01T10:00:00Z',
    modifiedAt: '2024-03-19T09:15:00Z',
    owner: 'marketing.admin@company.com',
    region: 'us10',
  },
];

// ============ CONNECTIONS ============
export const MOCK_CONNECTIONS: MockConnection[] = [
  {
    name: 'SAP_S4HANA',
    type: 'SAP_HANA',
    displayName: 'SAP S/4HANA Production',
    description: 'Production S/4HANA system',
    status: 'OK',
  },
  {
    name: 'SAP_BW',
    type: 'SAP_BW',
    displayName: 'SAP BW/4HANA',
    description: 'BW data warehouse',
    status: 'OK',
  },
  {
    name: 'AWS_S3_LAKE',
    type: 'S3',
    displayName: 'Data Lake S3',
    description: 'AWS S3 data lake bucket',
    status: 'OK',
  },
  {
    name: 'SNOWFLAKE',
    type: 'SNOWFLAKE',
    displayName: 'Snowflake Analytics',
    description: 'Snowflake analytics warehouse',
    status: 'OK',
  },
  {
    name: 'MYSQL_LEGACY',
    type: 'MYSQL',
    displayName: 'Legacy MySQL',
    description: 'Legacy system database',
    status: 'ERROR',
  },
];

// ============ CATALOG ASSETS ============
export const MOCK_CATALOG_ASSETS: MockCatalogAsset[] = [
  {
    name: 'V_SALES Orders',
    type: 'VIEW',
    spaceId: 'SPACE_SALES',
    displayName: 'Sales Orders View',
    description: 'Active sales orders with customer details',
    status: 'ACTIVE',
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    name: 'V_REVENUE_MONTHLY',
    type: 'VIEW',
    spaceId: 'SPACE_SALES',
    displayName: 'Monthly Revenue View',
    description: 'Monthly revenue aggregation by region',
    status: 'ACTIVE',
    createdAt: '2024-02-05T14:00:00Z',
  },
  {
    name: 'AM_SALES PERFORMANCE',
    type: 'ANALYTIC_MODEL',
    spaceId: 'SPACE_SALES',
    displayName: 'Sales Performance Model',
    description: 'Analytical model for sales KPIs',
    status: 'ACTIVE',
    createdAt: '2024-02-10T09:30:00Z',
  },
  {
    name: 'T_INVOICES',
    type: 'LOCAL_TABLE',
    spaceId: 'SPACE_FINANCE',
    displayName: 'Invoices Table',
    description: 'Customer invoices',
    status: 'ACTIVE',
    createdAt: '2024-01-25T11:00:00Z',
  },
  {
    name: 'V_GL_BALANCE',
    type: 'VIEW',
    spaceId: 'SPACE_FINANCE',
    displayName: 'GL Balance View',
    description: 'General ledger balance reporting',
    status: 'ACTIVE',
    createdAt: '2024-02-15T10:00:00Z',
  },
  {
    name: 'DF_SALES_ETL',
    type: 'DATA_FLOW',
    spaceId: 'SPACE_SALES',
    displayName: 'Sales ETL Flow',
    description: 'Data flow for sales data integration',
    status: 'INACTIVE',
    createdAt: '2024-03-01T08:00:00Z',
  },
  {
    name: 'T_MATERIALS',
    type: 'LOCAL_TABLE',
    spaceId: 'SPACE_MASTER_DATA',
    displayName: 'Materials Master',
    description: 'Product materials master data',
    status: 'ACTIVE',
    createdAt: '2024-01-05T09:00:00Z',
  },
  {
    name: 'T_CUSTOMERS',
    type: 'LOCAL_TABLE',
    spaceId: 'SPACE_MASTER_DATA',
    displayName: 'Customers Master',
    description: 'Customer master data',
    status: 'ACTIVE',
    createdAt: '2024-01-05T09:00:00Z',
  },
];

// ============ USERS ============
export const MOCK_USER: MockUser = {
  id: 'user_12345',
  displayName: 'John Developer',
  email: 'john.developer@company.com',
  role: 'DW Space Developer',
  spaces: ['SPACE_SALES', 'SPACE_FINANCE', 'SPACE_MASTER_DATA'],
};

// ============ TENANT INFO ============
export const MOCK_TENANT = {
  tenantId: 'abc12345',
  displayName: 'Company Analytics Tenant',
  region: 'us10',
  landscape: 'us10.hanacloud.ondemand.com',
  apiEndpoint: 'https://abc12345-us10.hanacloud.ondemand.com',
  authenticationUrl: 'https://abc12345-us10.authentication.hanacloud.ondemand.com',
  features: [
    'DW_MODELER',
    'BUSINESS_FORMATTER',
    'DATA_INTEGRATION',
    'ANALYTIC_MODEL',
  ],
  version: '2024.03',
};

// ============ SQL QUERY RESULTS ============
export const MOCK_QUERY_RESULT = {
  columns: ['SALES_ORDER', 'CUSTOMER_NAME', 'NET_AMOUNT', 'CURRENCY', 'ORDER_DATE'],
  rows: [
    ['SO-2024-001', 'Acme Corporation', 45000.00, 'USD', '2024-03-15'],
    ['SO-2024-002', 'Global Industries', 128500.50, 'USD', '2024-03-14'],
    ['SO-2024-003', 'Tech Solutions GmbH', 89200.00, 'EUR', '2024-03-13'],
    ['SO-2024-004', 'Pacific Trading Co', 15600.75, 'USD', '2024-03-12'],
    ['SO-2024-005', 'European Partners', 67800.25, 'EUR', '2024-03-11'],
  ],
  metadata: {
    totalRows: 5,
    hasMore: false,
    columns: [
      { name: 'SALES_ORDER', type: 'VARCHAR', length: 10 },
      { name: 'CUSTOMER_NAME', type: 'VARCHAR', length: 100 },
      { name: 'NET_AMOUNT', type: 'DECIMAL', precision: 15, scale: 2 },
      { name: 'CURRENCY', type: 'VARCHAR', length: 3 },
      { name: 'ORDER_DATE', type: 'DATE' },
    ],
  },
};

// ============ DEPLOYMENT RESULTS ============
export const MOCK_DEPLOY_RESULT = {
  status: 'success',
  message: 'Object deployed successfully',
  objectName: 'V_SALES_ORDER',
  spaceId: 'SPACE_SALES',
  url: 'https://abc12345-us10.hanacloud.ondemand.com/spaces/SPACE_SALES/views/V_SALES_ORDER',
  activationTime: '2024-03-20T14:30:00Z',
};

// ============ AUDIT LOG ============
export const MOCK_AUDIT_LOG = [
  {
    timestamp: '2024-03-20T14:30:00Z',
    user: 'john.developer@company.com',
    action: 'CREATE',
    objectType: 'VIEW',
    objectName: 'V_NEW_REPORT',
    spaceId: 'SPACE_SALES',
  },
  {
    timestamp: '2024-03-20T13:15:00Z',
    user: 'jane.analyst@company.com',
    action: 'UPDATE',
    objectType: 'ANALYTIC_MODEL',
    objectName: 'AM_SALES KPI',
    spaceId: 'SPACE_SALES',
  },
  {
    timestamp: '2024-03-20T11:00:00Z',
    user: 'admin@company.com',
    action: 'GRANT',
    objectType: 'SPACE',
    objectName: 'SPACE_FINANCE',
    spaceId: 'SPACE_FINANCE',
    details: 'Granted READ access to marketing team',
  },
];

// ============ ABAP SAMPLES ============
export const MOCK_ABAP_SAMPLES = {
  CDS_VIEW: `@AbapCatalog.sqlViewName: 'ZISALESORDER'
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Sales Order View'

define view ZI_SALES_ORDER
  as select from vbak
  association [1] to kna1 as _Customer on $projection.kunnr = _Customer.kunnr
{
  key vbak.vbeln as SalesOrderNumber,
      vbak.erdat as CreationDate,
      vbak.kunnr as CustomerNumber,
      _Customer.name1 as CustomerName,
      vbak.netwr as NetValue,
      vbak.waerk as Currency,
      _Customer
}`,
  
  ABAP_REPORT: `REPORT z_sales_analysis.

SELECT
  a~vbeln,
  a~erdat,
  c~name1,
  SUM( a~netwr ) AS total_sales
FROM vbak AS a
  INNER JOIN kna1 AS c ON a~kunnr = c~kunnr
WHERE a~erdat BETWEEN '20240101' AND '20241231'
GROUP BY a~vbeln, a~erdat, c~name1
ORDER BY total_sales DESCENDING.`,

  BW_TRANSFORMATION: `BEGIN OF TRANSFORMATION z_trans_enhanced
  SOURCE STRUCTURE zts_sales_raw
  TARGET STRUCTURE zts_sales_enhanced.

  RULES FOR FIELDS ( net_amount, customer_category ).
    METHOD calculate_amount.
      TARGET_FIELDS-net_amount = SOURCE_FIELDS-sales_amount
        * ( 1 - SOURCE_FIELDS-discount_rate / 100 ).
    ENDMETHOD.
  ENDRULES.
END OF TRANSFORMATION.`,
};
