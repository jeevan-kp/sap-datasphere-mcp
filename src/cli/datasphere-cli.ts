import { execSync } from 'child_process';

export interface CLIResult {
  success: boolean;
  output: string;
  error?: string;
}

export class DatasphereCLI {
  private host: string;

  constructor(host: string) {
    this.host = host;
  }

  private execute(command: string): CLIResult {
    try {
      const output = execSync(
        `datasphere ${command} -H ${this.host} --output json 2>&1`,
        { encoding: 'utf-8', timeout: 60000 }
      );
      return { success: true, output: output.trim() };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message || 'Unknown CLI error',
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
    technicalName: string,
    filePath: string
  ): Promise<CLIResult> {
    return this.execute(
      `objects ${objectType} create --space "${spaceId}" --technical-name "${technicalName}" --file-path "${filePath}"`
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
    technicalName: string,
    filePath: string
  ): Promise<CLIResult> {
    return this.execute(
      `objects ${objectType} update --space "${spaceId}" --technical-name "${technicalName}" --file-path "${filePath}"`
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

  async listConnections(): Promise<CLIResult> {
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
    // Official: datasphere tasks chains run --space <id> --object <technical_name> (p.74)
    if (spaceId && objectId) {
      return this.execute(`tasks chains run --space "${spaceId}" --object "${objectId}"`);
    }
    // Fallback for legacy single-id calls
    return this.execute(`tasks chains run --space "${spaceId}" --object "${objectId}"`);
  }

  async getTaskStatus(spaceId: string, logId: string): Promise<CLIResult> {
    // Official: datasphere tasks logs get --space <id> --log-id <id> (p.76)
    if (spaceId && logId) {
      return this.execute(`tasks logs get --space "${spaceId}" --log-id "${logId}"`);
    }
    return this.execute(`tasks logs get --space "${spaceId}" --log-id "${logId}"`);
  }

  async getTaskHistory(spaceId: string, objectId: string): Promise<CLIResult> {
    return this.execute(`tasks logs list --space "${spaceId}" --object "${objectId}"`);
  }

  async getTaskLogs(taskId: string): Promise<CLIResult> {
    return this.execute(`tasks logs get --log-id "${taskId}"`);
  }
}
