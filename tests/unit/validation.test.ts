import { describe, it, expect } from 'vitest';
import { validateInput, SpaceIdSchema, SQLQuerySchema } from '../../src/validation/schemas.js';

describe('Validation Schemas', () => {
  describe('SpaceIdSchema', () => {
    it('accepts valid space IDs', () => {
      expect(() => validateInput(SpaceIdSchema, 'SALES_SPACE')).not.toThrow();
      expect(() => validateInput(SpaceIdSchema, 'my-space-123')).not.toThrow();
      expect(() => validateInput(SpaceIdSchema, 'space_1')).not.toThrow();
    });

    it('rejects invalid space IDs', () => {
      expect(() => validateInput(SpaceIdSchema, '')).toThrow();
      expect(() => validateInput(SpaceIdSchema, 'space with spaces')).toThrow();
      expect(() => validateInput(SpaceIdSchema, 'space/with/slashes')).toThrow();
    });
  });

  describe('SQLQuerySchema', () => {
    it('accepts valid SELECT queries', () => {
      expect(() => validateInput(SQLQuerySchema, 'SELECT * FROM table1')).not.toThrow();
      expect(() => validateInput(SQLQuerySchema, 'SELECT col1, col2 FROM table1 WHERE id = 1')).not.toThrow();
    });

    it('rejects non-SELECT queries', () => {
      expect(() => validateInput(SQLQuerySchema, 'DROP TABLE table1')).toThrow();
      expect(() => validateInput(SQLQuerySchema, 'DELETE FROM table1')).toThrow();
      expect(() => validateInput(SQLQuerySchema, 'INSERT INTO table1 VALUES (1)')).toThrow();
    });

    it('rejects dangerous keywords', () => {
      expect(() => validateInput(SQLQuerySchema, 'SELECT * FROM table1; DROP TABLE table1')).toThrow();
    });
  });
});
