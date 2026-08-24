import { describe, it, expect } from 'vitest';
import { ABAPLexer } from '../../src/abap/lexer.js';
import { ABAPParser } from '../../src/abap/parser.js';

describe('ABAP Lexer', () => {
  it('tokenizes CDS view keywords', () => {
    const lexer = new ABAPLexer();
    expect(lexer).toBeDefined();
  });
});

describe('ABAP Parser', () => {
  it('detects CDS view file type', () => {
    const parser = new ABAPParser();
    const content = `@AccessControl.authorizationCheck: #CHECK
define view ZI_SALES as select from vbak
{
  key vbeln as SalesOrder,
  erdat as CreationDate
}`;

    const result = parser.parse(content);
    expect(result).toBeDefined();
  });
});

describe('CDS Converter', () => {
  it('generates SQL from CDS view', async () => {
    const { ABAPParser } = await import('../../src/abap/parser.js');
    const { CDSConverter } = await import('../../src/abap/converters/cds.js');

    const parser = new ABAPParser();
    const converter = new CDSConverter();

    const content = `define view ZI_TEST as select from vbak
{
  key vbeln as SalesOrder,
  erdat as CreationDate
}`;

    const parsed = parser.parse(content);
    expect(parsed.cdsView).toBeDefined();
    const result = converter.convert(parsed.cdsView!, 'V_TEST', 'TEST_SPACE');

    expect(result).toBeDefined();
    expect(result.sql).toContain('CREATE VIEW');
  });
});
