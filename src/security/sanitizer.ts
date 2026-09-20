/**
 * Security Sanitizer
 * Ensures no real credentials (tokens, client secrets, passwords, auth headers)
 * are leaked in MCP tool outputs, logs, or error responses sent to LLMs.
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

/**
 * Sanitize plain text or error messages before returning to an LLM or writing to logs.
 */
export function sanitizeForLLM(text: string): string {
  if (!text) return text;

  let sanitized = text;

  // Mask Bearer tokens
  sanitized = sanitized.replace(BEARER_REGEX, 'Bearer [REDACTED]');

  // Mask Basic Auth strings
  sanitized = sanitized.replace(BASIC_AUTH_REGEX, 'Basic [REDACTED]');

  // Mask JWT tokens
  sanitized = sanitized.replace(JWT_REGEX, '[REDACTED_JWT]');

  // Mask URL query param secrets
  sanitized = sanitized.replace(SECRET_URL_PARAM_REGEX, '$1[REDACTED]');

  return sanitized;
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
