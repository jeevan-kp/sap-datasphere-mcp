import { describe, it, expect } from 'vitest';
import { HanaClient } from '../../src/hana/client.js';

describe('HanaClient Schema Isolation Guard', () => {
  const mockConfig = {
    host: 'localhost',
    port: 443,
    user: 'FTDWH_100_INT#DBUSER',
    password: 'MockPassword123',
    schema: 'FTDWH_100_INT#DBUSER',
  };

  const client = new HanaClient(mockConfig);

  it('allows write operations targeted to the authorized open schema', async () => {
    // Calling executeQuery with an authorized schema should fail at validation before connecting
    const res = await client.executeQuery('CREATE TABLE "FTDWH_100_INT#DBUSER"."TEST_TABLE" (ID INT)');
    expect(res.error).not.toMatch(/Security Policy Violation/);
  });

  it('allows write operations targeting authorized schemas in the FTDWH space', async () => {
    const res = await client.executeQuery('CREATE TABLE "FTDWH_100_INT"."TEST_TABLE" (ID INT)');
    expect(res.error).not.toMatch(/Security Policy Violation/);
  });

  it('blocks write operations targeting unauthorized non-FTDWH schemas', async () => {
    const res = await client.executeQuery('DROP TABLE "OTHER_SCHEMA"."CRITICAL_TABLE"');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Security Policy Violation: Write operations are restricted strictly to authorized schemas/);
  });

  it('blocks INSERT operations targeting unauthorized non-FTDWH schemas', async () => {
    const res = await client.executeQuery('INSERT INTO OTHER_SCHEMA.INVENTORY VALUES (1, 2)');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Security Policy Violation: Write operations are restricted strictly to authorized schemas/);
  });

  it('allows read-only SELECT queries across accessible schemas', async () => {
    const res = await client.executeQuery('SELECT * FROM "SHARED_SCHEMA"."VIEWS"');
    expect(res.error).not.toMatch(/Security Policy Violation/);
  });
});
