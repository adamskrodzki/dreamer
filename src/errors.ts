export class DreamError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "DreamError";
  }
}

export class ConfigError extends DreamError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class CircularDependencyError extends DreamError {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(" -> ")}`, "CIRCULAR_DEPENDENCY");
    this.name = "CircularDependencyError";
  }
}

export class TaskExecutionError extends DreamError {
  public readonly exitCode: number;
  public readonly stderr: string;

  constructor(message: string, exitCode: number, stderr: string) {
    super(message, "TASK_EXECUTION_ERROR");
    this.name = "TaskExecutionError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export class ProjectNotFoundError extends DreamError {
  constructor(projectPath: string) {
    super(`Project not found: ${projectPath}`, "PROJECT_NOT_FOUND");
    this.name = "ProjectNotFoundError";
  }
}

export class TaskNotFoundError extends DreamError {
  constructor(taskName: string, projectPath: string) {
    super(`Task "${taskName}" not found in project ${projectPath}`, "TASK_NOT_FOUND");
    this.name = "TaskNotFoundError";
  }
}
