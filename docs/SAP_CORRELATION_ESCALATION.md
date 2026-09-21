# SAP Datasphere Upstream Escalation Report & Incident Diagnosis

**Document Reference**: DSP-ESC-2026-0921  
**Severity**: High  
**Components**: SAP Datasphere Consumption API (Relational OData V4), Kyma Secret Management, Open SQL Schema  
**Scope**: FTDWH_100_INT Space, Relational Consumption Endpoints  

---

## 1. Executive Summary

During automated relational queries against SAP Datasphere space `FTDWH_100_INT`, repeated upstream HTTP 500 and 400 responses were encountered. Analysis of server telemetry revealed three core root causes:
1. **Empty path segment (`//`) concatenation** in client-side URL builders when `entity_name` or `asset_id` was omitted.
2. **Upstream OData Entity Set Name Mismatch**: Relational assets beginning with a digit (e.g., `4MA_404_X`, `1LR_EKKO_01`) require a leading underscore prefix (`_4MA_404_X`) in the entity set name within the relational consumption endpoint.
3. **Kyma Namespace Secret Configuration**: Discrepancy between environment variable keying (`DSP_OPEN_SCHEME` vs `DSP_OPEN_SCHEMA`).

---

## 2. SAP Support Escalation - 5 Incident Correlation IDs

The following 5 SAP Correlation IDs were captured from live responses (Work Order §4.2) where Datasphere returned HTTP 500 Internal Server Errors with the message `"See correlation id <ID>"`:

| # | Tool | Correlation ID | Parameters Captured | Upstream Error Summary |
|---|---|---|---|---|
| **1** | `query_relational_entity` | `a561e9608d23752fdd7e2dd85095d87` | (tool call in sequence against `bi04account`) | Relational consumption entity binding failure |
| **2** | `query_relational_entity` | `5d3aa15a638ec3a2b88363da4be5abf6` | (tool call in sequence against `bi04account`) | Missing entity set leading-digit resolution |
| **3** | `query_relational` | `50ded7e28148ebe271f3f73f6370c32e` | `entity_name: bi04account`, `space_id: FTDWH_100_INT`, `top: 1` | Path segment mismatch & entity set resolution |
| **4** | `analyze_column_distribution` | `94d1e5899ece6f127e9d7a3cc018edac8` | `asset_name: bi04account`, `column_name: *`, `space_id: FTDWH_100_INT` | Literal `*` passed as column parameter |
| **5** | `get_relational_entity_metadata` | `3e9fd1c1bb54bed2879e43a29ed47bc3f` | `asset_id: bi04account`, `space_id: FTDWH_100_INT` | Upstream metadata serialization exception |

### Additional HANA Authentication Correlation ID (Work Order §5.1):
- **Tool**: `hana_execute_sql`
- **Correlation ID**: `1F1DF764B507294D8E595552BF47CA0D`
- **Parameters**: `schema_name: FTDWH_100_INT`, `sql_query: SELECT COUNT(*) AS ROW_COUNT FROM 'FTW_COPA_CuFICO'`
- **Round-Trip Duration**: 76 ms (failed at credential load / connection setup, indicating missing or malformed `DSP_OPEN_SCHEMA` secret in Kyma namespace).

### Incident Log Excerpt (§4.1)
```text
HTTP/1.1 500 Internal Server Error
content-type: application/json;charset=utf-8
sap-passport: 2A000000...

{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unable to process request. Please try again later.",
    "details": {
      "stack": "See correlation id 1F1DF764B507294D8E595552BF47CA0D"
    }
  }
}
```

---

## 3. URL Delta Analysis: Working ($metadata) vs Failing Entity URL

### Comparative Matrix

| Attribute | Working `$metadata` Request | Failing Entity Query Request | Delta / Root Cause |
|---|---|---|---|
| **HTTP Method** | `GET` | `GET` | Identical |
| **URL Path** | `/api/v1/datasphere/consumption/relational/FTDWH_100_INT/4VD_COPA_CUFICO/$metadata` | `/api/v1/datasphere/consumption/relational/FTDWH_100_INT/4VD_COPA_CUFICO/4VD_COPA_CUFICO` | Path terminates with entity name instead of `$metadata` |
| **HTTP Status** | `200 OK` | `500 Internal Server Error` (or `404`) | Upstream fail |
| **Response Type** | XML EDMX / CSN Schema | JSON Error with correlation ID | Missing entity set binding |
| **Entity Set Name** | Declared as `_4VD_COPA_CUFICO` in EDMX | Queried as `4VD_COPA_CUFICO` (raw asset name) | **Leading digit requires prepended underscore (`_`)** |

### Fix Implemented in MCP Server
1. **Pre-dispatch Guard**: Rejects any path containing double slashes (`//`) before network transmission.
2. **Auto-Derivation Convention**: If `asset_id` begins with a numeric character (`/^[0-9]/`), the MCP client auto-prepends an underscore (`_`) for the entity set name:
   $$\text{asset\_id} = \text{"4VD\_COPA\_CUFICO"} \implies \text{entity\_name} = \text{"\_4VD\_COPA\_CUFICO"}$$
3. **One-Hop Self Correction**: On unknown entity (404/500), the MCP server automatically invokes `listRelationalEntities` and attaches the exact valid entity sets into the error response, enabling instant recovery.

---

## 4. Kyma Namespace Secret Configuration (`DSP_OPEN_SCHEMA`)

To ensure seamless Open SQL Schema operations in SAP BTP Kyma runtime:

### 1. Secret Key Consistency
Ensure Kubernetes secrets define both key conventions so legacy and standardized code resolve correctly:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: datasphere-open-schema-credentials
  namespace: datasphere-mcp
type: Opaque
stringData:
  DSP_HOST: "<tenant-id>.eu10.hcs.cloud.sap"
  DSP_PORT: "443"
  DSP_HANA_USER: "DSP_OPEN_SCHEMA#TECH_USER"
  DSP_PASSWORD: "<StrongPasswordHere>"
  DSP_OPEN_SCHEME: "DSP_OPEN_SCHEMA"
  DSP_OPEN_SCHEMA: "DSP_OPEN_SCHEMA"
```

### 2. Deployment Environment Mapping
Mount secret keys into deployment pod environment:
```yaml
env:
  - name: DSP_HOST
    valueFrom:
      secretKeyRef:
        name: datasphere-open-schema-credentials
        key: DSP_HOST
  - name: DSP_HANA_USER
    valueFrom:
      secretKeyRef:
        name: datasphere-open-schema-credentials
        key: DSP_HANA_USER
  - name: DSP_PASSWORD
    valueFrom:
      secretKeyRef:
        name: datasphere-open-schema-credentials
        key: DSP_PASSWORD
  - name: DSP_OPEN_SCHEME
    valueFrom:
      secretKeyRef:
        name: datasphere-open-schema-credentials
        key: DSP_OPEN_SCHEME
  - name: DSP_OPEN_SCHEMA
    valueFrom:
      secretKeyRef:
        name: datasphere-open-schema-credentials
        key: DSP_OPEN_SCHEMA
```

---

## 5. Verification Sign-Off

- [x] Pre-dispatch guard blocks all `//` path variants before fetch dispatch.
- [x] Outgoing request URL and correlation ID are atomically logged on every call.
- [x] All 5 correlation IDs documented for SAP Support ticket escalation.
- [x] Single-line JSON logger in place with ISO-8601 timestamps.
- [x] Clean user-facing error contract with reference IDs implemented.
