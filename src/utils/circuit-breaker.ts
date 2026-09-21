/**
 * Lightweight in-memory circuit breaker to prevent repeated cascading
 * calls to failing upstream SAP Datasphere endpoints.
 *
 * Requirements:
 * - Trips after 3 consecutive identical failures.
 * - Fails fast without issuing outgoing network requests while open.
 * - Resets on successful request or after cooldown period.
 */

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

interface FailureRecord {
  consecutiveFailures: number;
  lastFailureTime: number;
  lastCorrelationId?: string;
  isOpen: boolean;
}

export class CircuitBreaker {
  private records = new Map<string, FailureRecord>();
  private failureThreshold: number;
  private cooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30000; // 30 seconds cooldown
  }

  /**
   * Check whether a target is permitted to execute.
   * Throws an error if the circuit breaker is currently OPEN.
   */
  check(key: string): void {
    const record = this.records.get(key);
    if (!record) return;

    if (record.isOpen) {
      const now = Date.now();
      if (now - record.lastFailureTime < this.cooldownMs) {
        const remainingSec = Math.ceil((this.cooldownMs - (now - record.lastFailureTime)) / 1000);
        const refSuffix = record.lastCorrelationId ? ` Reference: ${record.lastCorrelationId}` : '';
        const error = new Error(
          `Circuit breaker open: 3 consecutive failures detected for target. Backoff active for ${remainingSec}s.${refSuffix}`
        );
        (error as any).code = -32603;
        (error as any).isCircuitBreaker = true;
        (error as any).correlationId = record.lastCorrelationId;
        throw error;
      }
      // Cooldown expired, transition to HALF-OPEN (allow single retry)
      record.isOpen = false;
      record.consecutiveFailures = this.failureThreshold - 1;
    }
  }

  /**
   * Record a successful execution. Resets failure count for the key.
   */
  recordSuccess(key: string): void {
    this.records.delete(key);
  }

  /**
   * Record a failed execution. Trips circuit breaker if threshold is reached.
   */
  recordFailure(key: string, correlationId?: string): void {
    const now = Date.now();
    const record = this.records.get(key) || {
      consecutiveFailures: 0,
      lastFailureTime: now,
      lastCorrelationId: correlationId,
      isOpen: false,
    };

    record.consecutiveFailures += 1;
    record.lastFailureTime = now;
    if (correlationId) {
      record.lastCorrelationId = correlationId;
    }

    if (record.consecutiveFailures >= this.failureThreshold) {
      record.isOpen = true;
    }

    this.records.set(key, record);
  }

  /**
   * Reset state manually (e.g. for testing)
   */
  reset(): void {
    this.records.clear();
  }

  /**
   * Check if a key is currently open
   */
  isOpen(key: string): boolean {
    const record = this.records.get(key);
    if (!record || !record.isOpen) return false;
    return Date.now() - record.lastFailureTime < this.cooldownMs;
  }
}

export const globalCircuitBreaker = new CircuitBreaker();
