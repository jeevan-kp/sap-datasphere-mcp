import type { ABAPAnalysis, ConversionConfig, ConversionResult } from '../../types/index.js';
import { spawn } from 'child_process';

interface PythonResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ABAPConverter {
  private parserUrl: string;
  private conversions: Map<string, ConversionResult> = new Map();

  constructor(parserConfig: { url: string; enabled: boolean }) {
    this.parserUrl = parserConfig.url;
  }

  private async callPython(endpoint: string, body: object): Promise<PythonResponse> {
    try {
      const response = await fetch(`${this.parserUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Python parser error: ${response.status} ${text}` };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to connect to ABAP parser: ${message}` };
    }
  }

  async analyze(fileContent: string, fileType: string): Promise<ABAPAnalysis> {
    const result = await this.callPython('/analyze', {
      content: fileContent,
      file_type: fileType,
    });

    if (!result.success) {
      return {
        type: 'UNKNOWN',
        name: '',
        sourceTables: [],
        joins: [],
        fields: [],
        filters: [],
        aggregations: [],
        annotations: [],
        complexity: 'low',
        warnings: [result.error || 'Analysis failed'],
      };
    }

    return result.data as ABAPAnalysis;
  }

  async convert(config: ConversionConfig): Promise<ConversionResult> {
    const result = await this.callPython('/convert', config);

    if (!result.success) {
      return {
        sql: '',
        jsonDefinition: {},
        cliCommand: '',
        warnings: [result.error || 'Conversion failed'],
        metadata: { sourceTables: [], outputFields: [], complexity: 'error', viewName: '', spaceId: '' },
      };
    }

    const conversion = result.data as ConversionResult;
    const conversionId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.conversions.set(conversionId, conversion);

    return {
      ...conversion,
      metadata: {
        ...conversion.metadata,
        conversionId,
      },
    } as ConversionResult & { metadata: { conversionId: string } };
  }

  async preview(conversionId: string): Promise<ConversionResult | null> {
    return this.conversions.get(conversionId) || null;
  }

  async deploy(conversionId: string): Promise<{ status: string; message: string }> {
    const conversion = this.conversions.get(conversionId);
    if (!conversion) {
      return { status: 'error', message: 'Conversion not found' };
    }

    return {
      status: 'success',
      message: `View ready for deployment: ${conversion.metadata.outputFields.join(', ')}`,
    };
  }

  async getHelp(topic: string): Promise<string> {
    const result = await this.callPython('/help', { topic });
    if (!result.success) {
      return `Help unavailable: ${result.error}`;
    }
    return JSON.stringify(result.data, null, 2);
  }
}
