/**
 * Atomic Structured JSON Logger
 * Meets Work Order §10 requirements:
 * - Single-line JSON output (no interleaved lines under concurrency)
 * - ISO-8601 timestamp on every log entry
 * - Correlation ID, outgoing URL, requestId, sessionId, durationMs tracking
 * - Safe serialization preventing <unserializable> on circular/large payloads
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  sessionId?: string;
  tool?: string;
  method?: string;
  path?: string;
  outgoingUrl?: string;
  correlationId?: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PENDING';
  statusCode?: number;
  durationMs?: number;
  message?: string;
  error?: string;
  data?: unknown;
}

/**
 * Safely serialize an object avoiding circular reference exceptions
 * and truncating oversized buffers/strings.
 */
export function safeSerialize(obj: unknown, maxBytes = 2048): string {
  const seen = new WeakSet();

  function serializer(key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    if (typeof value === 'string' && value.length > 500) {
      return value.slice(0, 500) + '...[truncated]';
    }
    return value;
  }

  try {
    const json = JSON.stringify(obj, serializer);
    if (json.length > maxBytes) {
      return json.slice(0, maxBytes) + '...[truncated]';
    }
    return json;
  } catch (err: any) {
    return JSON.stringify({ error: `Serialization failed: ${err?.message || 'unknown'}` });
  }
}

export class StructuredLogger {
  private outputStream: NodeJS.WritableStream;

  constructor(outputStream: NodeJS.WritableStream = process.stderr) {
    this.outputStream = outputStream;
  }

  log(entry: Partial<StructuredLogEntry> & { level: LogLevel }): void {
    const fullEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Serialize as single atomic line
    const line = safeSerialize(fullEntry) + '\n';
    this.outputStream.write(line);
  }

  info(message: string, meta: Partial<StructuredLogEntry> = {}): void {
    this.log({ level: 'INFO', message, ...meta });
  }

  warn(message: string, meta: Partial<StructuredLogEntry> = {}): void {
    this.log({ level: 'WARN', message, ...meta });
  }

  error(message: string, meta: Partial<StructuredLogEntry> = {}): void {
    this.log({ level: 'ERROR', message, ...meta });
  }

  debug(message: string, meta: Partial<StructuredLogEntry> = {}): void {
    this.log({ level: 'DEBUG', message, ...meta });
  }

  /**
   * Log an outgoing HTTP request before dispatch (Work Order §10 item 4)
   */
  logOutgoingRequest(meta: {
    requestId?: string;
    sessionId?: string;
    tool?: string;
    method: string;
    outgoingUrl: string;
  }): void {
    this.log({
      level: 'INFO',
      message: `Outgoing HTTP request: ${meta.method} ${meta.outgoingUrl}`,
      outcome: 'PENDING',
      ...meta,
    });
  }

  /**
   * Log completed outgoing HTTP request
   */
  logOutgoingResponse(meta: {
    requestId?: string;
    sessionId?: string;
    tool?: string;
    outgoingUrl: string;
    statusCode: number;
    durationMs: number;
    correlationId?: string;
    error?: string;
  }): void {
    const isSuccess = meta.statusCode >= 200 && meta.statusCode < 400;
    this.log({
      level: isSuccess ? 'INFO' : 'ERROR',
      message: `Outgoing HTTP response: ${meta.statusCode} (${meta.durationMs}ms)`,
      outcome: isSuccess ? 'SUCCESS' : 'FAILURE',
      ...meta,
    });
  }
}

export const logger = new StructuredLogger();
