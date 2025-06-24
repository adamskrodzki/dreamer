// Recursive resolution configuration
export interface RecursiveConfig {
  project: string;
  tasks: string[];
}

// Configuration types
export interface DreamConfig {
  workspace: Record<string, ProjectConfig>;
  tasks?: Record<string, TaskDefaults>;
  recursive?: RecursiveConfig[];
}

export interface ProjectConfig {
  [taskName: string]: Dependency[];
}

export type Dependency = string | DetailedDependency;

export interface DetailedDependency {
  projectPath: string;
  task?: string;
  async?: boolean;
  required?: boolean;
  delay?: number;
}

export interface TaskDefaults {
  async?: boolean;
  required?: boolean;
  delay?: number;
}

// Execution types
export interface ExecutionPlan {
  tasks: TaskExecution[];
}

export interface TaskExecution {
  id: string;
  projectPath: string;
  taskName: string;
  async: boolean;
  required: boolean;
  delay: number;
}

export interface TaskResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  taskExecution: TaskExecution;
}

// Process runner interface for dependency injection
export interface ProcessRunner {
  run(command: string, args: string[], options: ProcessRunnerOptions): Promise<TaskResult>;
}

// Process runner options
export interface ProcessRunnerOptions {
  cwd: string;
  env?: Record<string, string>;
  timeout?: number;
}

// Runner options
export interface RunnerOptions {
  debug?: boolean;
  workspaceRoot?: string;
}

// CLI argument types
export interface ParsedArgs {
  task?: string;
  help?: boolean;
  version?: boolean;
  debug?: boolean;
  info?: boolean;
  _: string[];
}
