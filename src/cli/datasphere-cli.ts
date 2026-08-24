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
    return this.execute('spaces read');
  }

  async getSpace(spaceId: string): Promise<CLIResult> {
    return this.execute(`spaces read --name "${spaceId}"`);
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
    return this.execute(`objects ${objectType} read --space "${spaceId}"`);
  }

  async listConnections(): Promise<CLIResult> {
    return this.execute('spaces connections read');
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
    return this.execute('dbusers list');
  }

  async createUser(filePath: string): Promise<CLIResult> {
    return this.execute(`dbusers create --file-path "${filePath}"`);
  }

  async updateUser(filePath: string): Promise<CLIResult> {
    return this.execute(`dbusers update --file-path "${filePath}"`);
  }

  async deleteUser(name: string): Promise<CLIResult> {
    return this.execute(`dbusers delete --name "${name}"`);
  }

  async runTaskChain(taskChainId: string): Promise<CLIResult> {
    return this.execute(`tasks run --name "${taskChainId}"`);
  }

  async getTaskStatus(taskId: string): Promise<CLIResult> {
    return this.execute(`tasks status --name "${taskId}"`);
  }

  async getTaskLogs(taskId: string): Promise<CLIResult> {
    return this.execute(`tasks logs --name "${taskId}"`);
  }
}
