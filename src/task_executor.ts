import type { ProcessRunner, ProcessRunnerOptions, TaskExecution, TaskResult } from "./types.ts";
//import { TaskExecutionError } from "./errors.ts";

/**
 * Real process runner that executes deno task commands with real-time output streaming
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

      // Stream output to console while capturing it
      const stdoutChunks: Uint8Array[] = [];
      const stderrChunks: Uint8Array[] = [];

      // Create readers for stdout and stderr
      const stdoutReader = process.stdout.getReader();
      const stderrReader = process.stderr.getReader();

      // Stream stdout
      const stdoutPromise = this.streamOutput(stdoutReader, stdoutChunks, false);

      // Stream stderr
      const stderrPromise = this.streamOutput(stderrReader, stderrChunks, true);

      // Wait for process completion and streaming to finish
      const [{ code }, ,] = await Promise.all([
        process.status,
        stdoutPromise,
        stderrPromise,
      ]);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;

      // Combine captured chunks into strings
      const stdoutText = new TextDecoder().decode(this.combineChunks(stdoutChunks));
      const stderrText = new TextDecoder().decode(this.combineChunks(stderrChunks));

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

  /**
   * Stream output from a reader to console while capturing chunks
   */
  private async streamOutput(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    chunks: Uint8Array[],
    isStderr: boolean,
  ): Promise<void> {
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Capture the chunk for later processing
        chunks.push(value);

        // Stream to console in real-time
        const text = decoder.decode(value, { stream: true });
        if (text) {
          if (isStderr) {
            // Write stderr to stderr
            await Deno.stderr.write(new TextEncoder().encode(text));
          } else {
            // Write stdout to stdout
            await Deno.stdout.write(new TextEncoder().encode(text));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Combine chunks into a single Uint8Array
   */
  private combineChunks(chunks: Uint8Array[]): Uint8Array {
    if (chunks.length === 0) {
      return new Uint8Array(0);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined;
  }

  private mockExecution(
    command: string,
    args: string[],
    options: ProcessRunnerOptions,
  ): Promise<TaskResult> {
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
   * Get the process runner (for testing purposes)
   */
  getProcessRunner(): ProcessRunner {
    return this.processRunner;
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
