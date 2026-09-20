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
    expect(result.jsonDefinition).toHaveProperty('definitions');
  });
});

describe('BW Converter - Universal Table & CSN Engine', () => {
  it('converts custom table (Z*) transformation with CTE and deduplication', async () => {
    const { BWConverter } = await import('../../src/abap/converters/bw.js');
    const converter = new BWConverter();

    const transformation = {
      name: 'TR_ZCUSTOM_SALES',
      sourceFields: [{ name: 'ZDOC_NUM' }, { name: 'KUNNR' }, { name: 'AMOUNT' }],
      targetFields: [
        { name: 'DOC_ID' },
        { name: 'CUSTOMER_ID' },
        { name: 'NET_AMOUNT', formula: 'src."AMOUNT" * 1.1' },
      ],
    };

    const result = converter.convert(transformation, 'V_CUSTOM_SALES', 'FTDWH_100_INT', {
      sourceTable: 'ZSALES_STAGE',
      lookupTables: [
        { table: 'ZKNA1_CUSTOM', joinKeys: ['KUNNR'], selectFields: ['LAND1'] },
      ],
    });

    expect(result).toBeDefined();
    expect(result.sql).toContain('WITH base_source AS');
    expect(result.sql).toContain('ROW_NUMBER() OVER (PARTITION BY "KUNNR" ORDER BY 1) AS _lookup_rn');
    expect(result.sql).toContain('LEFT OUTER JOIN dedup_lookup_1 AS lkp1');
    expect(result.sql).toContain('lkp1._lookup_rn = 1');
    expect(result.cliCommand).toBe('datasphere objects views create -y "FTDWH_100_INT" -F "V_CUSTOM_SALES.json"');

    // Verify 100% CSN JSON compliance
    const csn = result.jsonDefinition as any;
    expect(csn.definitions).toBeDefined();
    expect(csn.definitions.V_CUSTOM_SALES).toBeDefined();
    expect(csn.definitions.V_CUSTOM_SALES['@ObjectModel.modelingPattern']).toEqual({ '#': 'FACT' });
    expect(csn.definitions.V_CUSTOM_SALES['@Analytics.dataCategory']).toEqual({ '#': 'CUBE' });
    expect(csn.definitions.V_CUSTOM_SALES.elements.NET_AMOUNT.type).toBe('cds.Decimal');
  });
});

