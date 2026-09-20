import { describe, it, expect } from 'vitest';
import { sanitizeForLLM, maskSensitiveObject } from '../../src/security/sanitizer.js';

describe('Security Sanitizer', () => {
  it('redacts Bearer tokens from text', () => {
    const raw = 'Request failed with Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.xyz.abc123';
    const clean = sanitizeForLLM(raw);
    expect(clean).not.toContain('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(clean).toContain('Bearer [REDACTED]');
  });

  it('redacts Basic auth strings from text', () => {
    const raw = 'Error authenticating with Basic c29tZS1jbGllbnQtaWQ6c29tZS1jbGllbnQtc2VjcmV0';
    const clean = sanitizeForLLM(raw);
    expect(clean).not.toContain('c29tZS1jbGllbnQtaWQ6c29tZS1jbGllbnQtc2VjcmV0');
    expect(clean).toContain('Basic [REDACTED]');
  });

  it('redacts query param secrets from URLs', () => {
    const raw = 'Failed to fetch https://oauth.sap.com/token?client_secret=mySecret123&grant_type=client_credentials';
    const clean = sanitizeForLLM(raw);
    expect(clean).not.toContain('mySecret123');
    expect(clean).toContain('client_secret=[REDACTED]');
  });

  it('masks sensitive object properties in parameters and log bodies', () => {
    const payload = {
      username: 'testuser',
      password: 'supersecretpassword123',
      nested: {
        clientSecret: 'secret-val',
        space: 'SPACE_A',
      },
      tokens: ['token1', 'token2'],
    };

    const masked = maskSensitiveObject(payload);
    expect(masked.password).toBe('[REDACTED]');
    expect(masked.nested.clientSecret).toBe('[REDACTED]');
    expect(masked.username).toBe('testuser');
    expect(masked.nested.space).toBe('SPACE_A');
  });

  it('handles null, undefined, and primitive values safely', () => {
    expect(sanitizeForLLM('')).toBe('');
    expect(maskSensitiveObject(null as any)).toBeNull();
    expect(maskSensitiveObject(undefined as any)).toBeUndefined();
    expect(maskSensitiveObject(123 as any)).toBe(123);
  });
});
