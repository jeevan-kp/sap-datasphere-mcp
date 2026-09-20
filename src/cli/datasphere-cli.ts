import { execSync } from 'child_process';
import path from 'node:path';
import { sanitizeForLLM } from '../security/sanitizer.js';

export interface CLIResult {
  success: boolean;
  output: string;
  error?: string;
}

import { TokenManager } from '../auth/token-manager.js';

export class DatasphereCLI {
  private host: string;
  private tokenManager?: TokenManager;

  constructor(host: string, tokenManager?: TokenManager) {
    this.host = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    this.tokenManager = tokenManager;
  }

  private async execute(command: string): Promise<CLIResult> {
    try {
      const localBin = path.resolve(process.cwd(), 'node_modules', '.bin');
      const env = {
        ...process.env,
        PATH: `${localBin}${path.delimiter}${process.env.PATH || ''}`,
      };

      let tokenArg = '';
      if (this.tokenManager) {
        try {
          const token = await this.tokenManager.getToken();
          if (token) {
            tokenArg = ` --access-token "${token}"`;
          }
        } catch {
          // If token acquisition fails, proceed without tokenArg
        }
      }

      const output = execSync(
        `datasphere ${command} -H ${this.host}${tokenArg} --output json 2>&1`,
        { encoding: 'utf-8', timeout: 60000, env }
      );
      return { success: true, output: sanitizeForLLM(output.trim()) };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      const rawError = error.stderr || error.message || 'Unknown CLI error';
      return {
        success: false,
        output: sanitizeForLLM(error.stdout || ''),
        error: sanitizeForLLM(rawError),
      };
    }
  }

  async listSpaces(): Promise<CLIResult> {
    return this.execute('spaces list');
  }

  async getSpace(spaceId: string): Promise<CLIResult> {
    return this.execute(`spaces read --space "${spaceId}"`);
  }

  async createObject(
    objectType: string,
    spaceId: string,
    _technicalName: string,
    filePath: string
  ): Promise<CLIResult> {
    return this.execute(
      `objects ${objectType} create --space "${spaceId}" --file-path "${filePath}"`
    );
  }

  async readObject(
    objectType: string,
    spaceId: string,
    technicalName: string
  ): Promise<CLIResult> {
    return this.execute(
      `objects ${objectType} read --space "${spaceId}" --technical-name "${technicalName}"`
    );
  }

  async updateObject(
    objectType: string,
    spaceId: string,
    _technicalName: string,
    filePath: string
  ): Promise<CLIResult> {
    return this.execute(
      `objects ${objectType} update --space "${spaceId}" --file-path "${filePath}"`
    );
  }

  async deleteObject(
    objectType: string,
    spaceId: string,
    technicalName: string
  ): Promise<CLIResult> {
    return this.execute(
      `objects ${objectType} delete --space "${spaceId}" --technical-name "${technicalName}"`
    );
  }

  async deployObject(
    objectType: string,
    spaceId: string,
    technicalName: string
  ): Promise<CLIResult> {
    return this.execute(
      `objects ${objectType} deploy --space "${spaceId}" --technical-name "${technicalName}"`
    );
  }

  async listObjects(objectType: string, spaceId: string): Promise<CLIResult> {
    return this.execute(`objects ${objectType} list --space "${spaceId}"`);
  }

  async listConnections(spaceId?: string): Promise<CLIResult> {
    if (spaceId) {
      return this.execute(`spaces connections list --space "${spaceId}"`);
    }
    return this.execute('spaces connections list');
  }

  async createConnection(
    spaceId: string,
    filePath: string
  ): Promise<CLIResult> {
    return this.execute(
      `spaces connections create --space "${spaceId}" --file-path "${filePath}"`
    );
  }

  async listUsers(): Promise<CLIResult> {
    // Generic list (no space required) — kept for lean profile
    return this.execute('users list');
  }

  async createUser(filePath: string): Promise<CLIResult> {
    return this.execute(`users create --file-path "${filePath}"`);
  }

  // Mario-exact DB user tools (space-aware)
  async listDatabaseUsers(spaceId: string): Promise<CLIResult> {
    return this.execute(`dbusers list --space "${spaceId}"`);
  }

  async createDatabaseUser(spaceId: string, databaseUserId: string, filePath: string): Promise<CLIResult> {
    return this.execute(`dbusers create --space "${spaceId}" --databaseuser "${databaseUserId}" --file-path "${filePath}"`);
  }

  async updateDatabaseUser(spaceId: string, databaseUserId: string, filePath: string): Promise<CLIResult> {
    return this.execute(`dbusers update --space "${spaceId}" --databaseuser "${databaseUserId}" --file-path "${filePath}"`);
  }

  async deleteDatabaseUser(spaceId: string, databaseUserId: string): Promise<CLIResult> {
    return this.execute(`dbusers delete --space "${spaceId}" --databaseuser "${databaseUserId}" --force`);
  }

  async resetDatabaseUserPassword(spaceId: string, databaseUserId: string): Promise<CLIResult> {
    return this.execute(`dbusers password reset --space "${spaceId}" --databaseuser "${databaseUserId}"`);
  }

  async updateUser(filePath: string): Promise<CLIResult> {
    return this.execute(`users update --file-path "${filePath}"`);
  }

  async deleteUser(name: string): Promise<CLIResult> {
    return this.execute(`users delete --users "${name}" --force`);
  }

  async runTaskChain(spaceId: string, objectId: string): Promise<CLIResult> {
    if (spaceId) {
      return this.execute(`tasks chains run --space "${spaceId}" --object "${objectId}"`);
    }
    return this.execute(`tasks chains run --object "${objectId}"`);
  }

  async getTaskStatus(spaceId: string, logId: string): Promise<CLIResult> {
    if (spaceId) {
      return this.execute(`tasks logs get --space "${spaceId}" --log-id "${logId}"`);
    }
    return this.execute(`tasks logs get --log-id "${logId}"`);
  }

  async getTaskHistory(spaceId: string, objectId: string): Promise<CLIResult> {
    return this.execute(`tasks logs list --space "${spaceId}" --objectname "${objectId}"`);
  }

  async getTaskLogs(taskId: string): Promise<CLIResult> {
    return this.execute(`tasks logs get --log-id "${taskId}"`);
  }
}
