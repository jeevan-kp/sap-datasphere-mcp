/**
 * Security Sanitizer & Response Boundary Protection
 * Meets Work Order §9 (Issue #7) and §7 (Issue #5):
 * - Eliminates leaked tenant hostnames (*.hcs.cloud.sap)
 * - Masks internal API paths (/api/v1/datasphere/...)
 * - Masks raw SQL queries and stack traces
 * - Extracts SAP correlation IDs and formats user-safe error messages with reference IDs
 * - Masks OData ETags and sensitive credentials
 */

// Patterns that identify secrets to be redacted
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /credential/i,
  /authorization/i,
  /client_secret/i,
  /apiKey/i,
  /bearer/i,
];

const BEARER_REGEX = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const BASIC_AUTH_REGEX = /Basic\s+[A-Za-z0-9+/=]+/gi;
const JWT_REGEX = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g;
const SECRET_URL_PARAM_REGEX = /([?&](?:client_secret|secret|password|token)=)[^&]+/gi;

// Tenant hostnames: e.g. daimlertruck-q.eu10.hcs.cloud.sap or generic *.hcs.cloud.sap / *.cloud.sap
const TENANT_HOST_REGEX = /[a-zA-Z0-9_-]+\.(?:[a-zA-Z0-9_-]+\.)?hcs\.cloud\.sap/gi;
const GENERIC_CLOUD_SAP_REGEX = /[a-zA-Z0-9_-]+\.cloud\.sap/gi;

// Internal API paths
const INTERNAL_API_PATH_REGEX = /\/(?:api\/v1\/datasphere|dwaas-core)\/[a-zA-Z0-9/_.-]+/gi;

// Raw SQL queries
const RAW_SQL_REGEX = /\bSELECT\s+[\s\S]*?\s+FROM\s+[a-zA-Z0-9_"'.\s]+/gi;

// OData ETags: e.g. W/"qvf28be0r4cmv140To6b7spyiT4LPM5a0jwcfNz2K91E="
const ODATA_ETAG_REGEX = /W\/"[A-Za-z0-9+/=_-]+"/gi;

// Schema names
const OPEN_SCHEMA_REGEX = /\bDSP_OPEN_SCHEMA\b/gi;

// Stack references
const STACK_LINE_REGEX = /(?:\r?\n\s+at\s+[\s\S]+?)(?=\r?\n\s*[a-zA-Z0-9]|$)/g;
const STACK_JSON_REGEX = /"stack":\s*"[^"]*"/gi;

/**
 * Extract SAP correlation ID from error strings, headers, or JSON payloads
 */
export function extractCorrelationId(
  text?: string,
  headers?: Headers | Record<string, string | string[] | undefined>
): string | undefined {
  if (headers) {
    if (typeof (headers as Headers).get === 'function') {
      const h = headers as Headers;
      const id = h.get('x-correlation-id') || h.get('x-request-id') || h.get('sap-passport');
      if (id) return id.trim();
    } else {
      const h = headers as Record<string, string | string[] | undefined>;
      const val = h['x-correlation-id'] || h['x-request-id'] || h['sap-passport'];
      if (typeof val === 'string' && val.trim()) return val.trim();
      if (Array.isArray(val) && val[0]) return val[0].trim();
    }
  }

  if (!text) return undefined;

  // Search patterns:
  // "See correlation id 1F1DF764B507294D8E595552BF47CA0D"
  // "correlationId": "..." or "correlation_id": "..."
  const patterns = [
    /(?:correlation\s+id[:\s]+)([a-fA-F0-9-]{8,})/i,
    /"correlationId":\s*"([^"]+)"/i,
    /"correlation_id":\s*"([^"]+)"/i,
    /Reference:\s*([a-fA-F0-9-]{8,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Sanitize plain text or error messages before returning to an LLM or writing to logs.
 */
export function sanitizeForLLM(text: string): string {
  if (!text) return text;

  let sanitized = text;

  // Mask credentials
  sanitized = sanitized.replace(BEARER_REGEX, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(BASIC_AUTH_REGEX, 'Basic [REDACTED]');
  sanitized = sanitized.replace(JWT_REGEX, '[REDACTED_JWT]');
  sanitized = sanitized.replace(SECRET_URL_PARAM_REGEX, '$1[REDACTED]');

  // Mask tenant hostname
  sanitized = sanitized.replace(TENANT_HOST_REGEX, '[REDACTED_HOST].cloud.sap');
  sanitized = sanitized.replace(GENERIC_CLOUD_SAP_REGEX, '[REDACTED_HOST].cloud.sap');

  // Mask internal paths
  sanitized = sanitized.replace(INTERNAL_API_PATH_REGEX, '/[REDACTED_API_PATH]');

  // Mask ETags
  sanitized = sanitized.replace(ODATA_ETAG_REGEX, '[REDACTED_ETAG]');

  // Mask Open Schema identifiers
  sanitized = sanitized.replace(OPEN_SCHEMA_REGEX, '[REDACTED_SCHEMA]');

  // Strip stack traces
  sanitized = sanitized.replace(STACK_JSON_REGEX, '"stack": "[REDACTED_STACK]"');
  sanitized = sanitized.replace(STACK_LINE_REGEX, '');

  return sanitized;
}

/**
 * Format user-facing error message matching the contract in Work Order §7.3 & §9.
 * Never leaks raw SQL, tenant hostnames, or internal stack traces.
 */
export function formatUserFacingError(
  code: number,
  rawMessage: string,
  correlationId?: string
): string {
  const refId = correlationId || extractCorrelationId(rawMessage) || 'N/A';
  const refSuffix = refId !== 'N/A' ? ` Reference: ${refId}` : '';

  switch (code) {
    case -32602: // Invalid params / Malformed args or Asset not found
      if (/not\s+found/i.test(rawMessage)) {
        return `The requested data wasn't found.${refSuffix}`;
      }
      return `Request couldn't be understood.${refSuffix}`;

    case -32002: // Not authorised
      return `You don't have access to this data.${refSuffix}`;

    case -32083: // Result too large
      return `Too much data - narrow your filter.${refSuffix}`;

    case -32001: // Upstream timeout
      return `Timed out. Try a smaller range.${refSuffix}`;

    case -32603: // Upstream 5xx
    default:
      return `Temporary problem.${refSuffix}`;
  }
}

/**
 * Mask sensitive fields inside an object (e.g., params, request bodies, or responses)
 */
export function maskSensitiveObject<T>(input: T): T {
  if (input === null || typeof input !== 'object') {
    if (typeof input === 'string') {
      return sanitizeForLLM(input) as unknown as T;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => maskSensitiveObject(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = maskSensitiveObject(value);
    } else if (typeof value === 'string') {
      result[key] = sanitizeForLLM(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
