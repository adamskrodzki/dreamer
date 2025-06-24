import type { TaskExecution, TaskResult, ProcessRunner, ProcessRunnerOptions } from "./types.ts";
import { TaskExecutionError } from "./errors.ts";

/**
 * Real process runner that executes deno task commands
 */
export class DenoProcessRunner implements ProcessRunner {
  async run(command: string, args: string[], options: ProcessRunnerOptions): Promise<TaskResult> {
    // Check if we should mock execution for testing
    if (Deno.env.get("DREAM_MOCK_EXECUTION") === "true") {
      return this.mockExecution(command, args, options);
    }

    const startTime = Date.now();

    const cmd = new Deno.Command(command, {
      args,
      cwd: options.cwd,
      env: options.env,
      stdout: "piped",
      stderr: "piped",
    });

    try {
      const process = cmd.spawn();

      // Handle timeout if specified
      let timeoutId: number | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          process.kill("SIGTERM");
        }, options.timeout);
      }

      const { code, stdout, stderr } = await process.output();

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;
      const stdoutText = new TextDecoder().decode(stdout);
      const stderrText = new TextDecoder().decode(stderr);

      return {
        success: code === 0,
        exitCode: code,
        stdout: stdoutText,
        stderr: stderrText,
        duration,
        taskExecution: {} as TaskExecution, // Will be set by TaskExecutor
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        exitCode: -1,
        stdout: "",
        stderr: errorMessage,
        duration,
        taskExecution: {} as TaskExecution,
      };
    }
  }

  private mockExecution(command: string, args: string[], options: ProcessRunnerOptions): Promise<TaskResult> {
    // Mock successful execution for testing
    return Promise.resolve({
      success: true,
      exitCode: 0,
      stdout: `Mock execution: ${command} ${args.join(" ")} in ${options.cwd}`,
      stderr: "",
      duration: 50,
      taskExecution: {} as TaskExecution,
    });
  }
}

/**
 * TaskExecutor handles the execution of individual tasks
 */
export class TaskExecutor {
  private processRunner: ProcessRunner;
  private workspaceRoot: string;

  constructor(processRunner: ProcessRunner, workspaceRoot: string) {
    this.processRunner = processRunner;
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Execute a single task
   */
  async executeTask(taskExecution: TaskExecution): Promise<TaskResult> {
    const { projectPath, taskName } = taskExecution;
    
    // Resolve the absolute path to the project
    const projectDir = this.resolveProjectPath(projectPath);
    
    // Execute deno task command
    const result = await this.processRunner.run("deno", ["task", taskName], {
      cwd: projectDir,
      timeout: 300000, // 5 minute timeout
    });

    // Set the task execution reference
    result.taskExecution = taskExecution;

    return result;
  }

  /**
   * Execute a single task and throw error if required task fails
   * This method is for backward compatibility with existing code
   */
  async executeTaskWithErrorHandling(taskExecution: TaskExecution): Promise<TaskResult> {
    const result = await this.executeTask(taskExecution);

    // Throw error if task failed and is required
    if (!result.success && taskExecution.required) {
      throw new TaskExecutionError(
        `Task ${taskExecution.id} failed with exit code ${result.exitCode}`,
        result.exitCode,
        result.stderr
      );
    }

    return result;
  }

  /**
   * Execute multiple tasks with async support
   */
  async executeTasks(taskExecutions: TaskExecution[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const asyncTasks: Promise<TaskResult>[] = [];

    for (const taskExecution of taskExecutions) {
      try {
        if (taskExecution.async) {
          // Start async task without waiting
          const asyncTask = this.executeTaskWithDelay(taskExecution);
          asyncTasks.push(asyncTask);
        } else {
          // Execute synchronously
          const result = await this.executeTaskWithDelay(taskExecution);
          results.push(result);

          // If a required task fails, stop execution
          if (!result.success && taskExecution.required) {
            break;
          }
        }
      } catch (error) {
        // Re-throw TaskExecutionError to preserve error details
        if (error instanceof TaskExecutionError) {
          throw error;
        }

        // Wrap unexpected errors
        throw new TaskExecutionError(
          `Unexpected error executing task ${taskExecution.id}: ${error}`,
          -1,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Wait for all async tasks to complete
    if (asyncTasks.length > 0) {
      const asyncResults = await Promise.allSettled(asyncTasks);

      for (const result of asyncResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          // Handle rejected async tasks
          const error = result.reason;
          if (error instanceof TaskExecutionError) {
            throw error;
          }
          throw new TaskExecutionError(
            `Async task failed: ${error}`,
            -1,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }

    return results;
  }

  /**
   * Execute a task with delay support
   */
  private async executeTaskWithDelay(taskExecution: TaskExecution): Promise<TaskResult> {
    // Apply delay if specified (skip delays when mocking execution for tests)
    if (taskExecution.delay > 0 && Deno.env.get("DREAM_MOCK_EXECUTION") !== "true") {
      await new Promise(resolve => setTimeout(resolve, taskExecution.delay));
    }

    return await this.executeTask(taskExecution);
  }

  /**
   * Resolve project path relative to workspace root
   */
  private resolveProjectPath(projectPath: string): string {
    // Remove leading "./" if present
    const normalizedPath = projectPath.startsWith("./") ? projectPath.slice(2) : projectPath;

    if (normalizedPath === "") {
      return this.workspaceRoot;
    }

    // Determine the correct separator based on workspace root
    const separator = this.workspaceRoot.includes("/") ? "/" : "\\";

    // Normalize the project path to use the same separator
    const normalizedProjectPath = normalizedPath.replace(/[\/\\]/g, separator);

    return `${this.workspaceRoot}${separator}${normalizedProjectPath}`;
  }
}

/**
 * Mock process runner for testing
 */
export class MockProcessRunner implements ProcessRunner {
  private mockResults: Map<string, TaskResult> = new Map();
  private callLog: Array<{ command: string; args: string[]; options: ProcessRunnerOptions }> = [];

  /**
   * Set a mock result for a specific command
   */
  setMockResult(command: string, args: string[], result: Partial<TaskResult>): void {
    const key = `${command} ${args.join(" ")}`;
    this.mockResults.set(key, {
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      duration: 100,
      taskExecution: {} as TaskExecution,
      ...result,
    });
  }

  /**
   * Get the call log for testing
   */
  getCallLog(): Array<{ command: string; args: string[]; options: ProcessRunnerOptions }> {
    return [...this.callLog];
  }

  /**
   * Clear call log and mock results
   */
  reset(): void {
    this.callLog = [];
    this.mockResults.clear();
  }

  run(command: string, args: string[], options: ProcessRunnerOptions): Promise<TaskResult> {
    this.callLog.push({ command, args, options });
    
    const key = `${command} ${args.join(" ")}`;
    const mockResult = this.mockResults.get(key);
    
    if (mockResult) {
      return Promise.resolve(mockResult);
    }

    // Default successful result
    return Promise.resolve({
      success: true,
      exitCode: 0,
      stdout: `Mock output for: ${command} ${args.join(" ")}`,
      stderr: "",
      duration: 100,
      taskExecution: {} as TaskExecution,
    });
  }
}
