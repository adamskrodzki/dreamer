import type { ExecutionPlan, ProcessRunner, TaskResult, BackgroundProcess, TaskExecution, ProcessRunnerWithTermination } from "./types.ts";
import { DenoProcessRunner, TaskExecutor } from "./task_executor.ts";
import { TaskExecutionError } from "./errors.ts";

/**
 * Execution summary for reporting results
 */
export interface ExecutionSummary {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  skippedTasks: number;
  totalDuration: number;
  results: TaskResult[];
}

/**
 * DreamRunner orchestrates the execution of task execution plans
 */
export class DreamRunner {
  private taskExecutor: TaskExecutor;
  private backgroundProcesses: Map<string, BackgroundProcess> = new Map();
  private terminatedProcessIds: Set<string> = new Set();

  constructor(processRunner: ProcessRunner, workspaceRoot: string) {
    this.taskExecutor = new TaskExecutor(processRunner, workspaceRoot);
  }

  /**
   * Execute an execution plan with proper orchestration
   */
  async execute(executionPlan: ExecutionPlan, debug: boolean = false): Promise<ExecutionSummary> {
    const startTime = Date.now();
    const results: TaskResult[] = [];
    let successfulTasks = 0;
    let failedTasks = 0;
    let skippedTasks = 0;

    if (debug) {
      console.log(`\nExecuting ${executionPlan.tasks.length} tasks:`);
    }

    try {
      // Execute tasks with async/sync handling
      for (let i = 0; i < executionPlan.tasks.length; i++) {
        const taskExecution = executionPlan.tasks[i];

        if (debug) {
          console.log(`\n[${i + 1}/${executionPlan.tasks.length}] Starting: ${taskExecution.id}`);
        }

        // Check for background process failures before starting new tasks
        const failedRequiredBgProcess = await this.checkForRequiredBackgroundFailures();
        if (failedRequiredBgProcess) {
          // A required background process has failed, stop execution
          this.terminateAllBackgroundProcesses();
          skippedTasks = executionPlan.tasks.length - i;
          if (debug && skippedTasks > 0) {
            console.log(
              `\n⏭️  Skipping ${skippedTasks} remaining tasks due to required background task failure`,
            );
          }
          break;
        }

        try {
          const result = await this.executeTaskWithAsyncHandling(taskExecution, debug);
          results.push(result);

          if (result.success) {
            successfulTasks++;
            // Only show console output for sync tasks (async tasks will be shown later)
            if (!taskExecution.async) {
              console.log(
                `  ✅ ${taskExecution.projectPath} ${taskExecution.taskName} (${result.duration}ms)`,
              );
            }
          } else {
            failedTasks++;
            console.log(
              `  ❌ ${taskExecution.projectPath} ${taskExecution.taskName} failed (exit code ${result.exitCode})`,
            );

            // If task is required and failed, terminate all background processes and stop
            if (taskExecution.required) {
              this.terminateAllBackgroundProcesses();
              skippedTasks = executionPlan.tasks.length - i - 1;
              if (debug && skippedTasks > 0) {
                console.log(
                  `\n⏭️  Skipping ${skippedTasks} remaining tasks due to required task failure`,
                );
              }
              break;
            }
          }
        } catch (error) {
          failedTasks++;

          if (error instanceof TaskExecutionError) {
            const errorResult: TaskResult = {
              success: false,
              exitCode: error.exitCode,
              stdout: "",
              stderr: error.stderr,
              duration: 0,
              taskExecution,
            };
            results.push(errorResult);

            if (debug) {
              console.log(`  ❌ Failed: ${error.message}`);
              if (error.stderr.trim()) {
                console.log(`  Error: ${error.stderr.trim()}`);
              }
            } else {
              console.log(
                `  ❌ ${taskExecution.projectPath} ${taskExecution.taskName} failed: ${error.message}`,
              );
            }

            // Terminate all background processes and stop execution for required task failures
            this.terminateAllBackgroundProcesses();
            skippedTasks = executionPlan.tasks.length - i - 1;
            if (debug && skippedTasks > 0) {
              console.log(
                `\n⏭️  Skipping ${skippedTasks} remaining tasks due to required task failure`,
              );
            }
            break;
          } else {
            // Unexpected error - terminate background processes and re-throw
            this.terminateAllBackgroundProcesses();
            throw error;
          }
        }
      }

      // Wait for all remaining background processes to complete
      await this.waitForAllBackgroundProcesses();

      // Collect results from background processes and update placeholders
      for (const bgProcess of this.backgroundProcesses.values()) {
        // Check if this process was terminated
        if (this.terminatedProcessIds.has(bgProcess.taskExecution.id)) {
          // Remove placeholder for terminated processes and adjust counters
          const placeholderIndex = results.findIndex(r =>
            r.taskExecution.id === bgProcess.taskExecution.id && r.duration === 0
          );
          if (placeholderIndex >= 0) {
            results.splice(placeholderIndex, 1); // Remove the placeholder
            successfulTasks--; // Adjust counter (placeholder was counted as successful)
            skippedTasks++; // Count as skipped instead
          }
        } else if (bgProcess.result) {
          // Find and replace the placeholder result
          const placeholderIndex = results.findIndex(r =>
            r.taskExecution.id === bgProcess.taskExecution.id && r.duration === 0
          );
          if (placeholderIndex >= 0) {
            // Replace placeholder with actual result
            results[placeholderIndex] = bgProcess.result;

            // Update console output with actual timing
            if (bgProcess.result.success) {
              console.log(
                `  ✅ ${bgProcess.taskExecution.projectPath} ${bgProcess.taskExecution.taskName} (${bgProcess.result.duration}ms)`,
              );
            } else {
              console.log(
                `  ❌ ${bgProcess.taskExecution.projectPath} ${bgProcess.taskExecution.taskName} failed (exit code ${bgProcess.result.exitCode})`,
              );

              // Adjust counters: placeholder was counted as successful, now it's failed
              successfulTasks--;
              failedTasks++;

              // If this was a required task that failed, we should have already terminated
              if (bgProcess.taskExecution.required) {
                // This should trigger termination of other processes
                this.terminateAllBackgroundProcesses();
              }
            }
          } else {
            // Add result if not found (shouldn't happen)
            results.push(bgProcess.result);
            if (bgProcess.result.success) {
              successfulTasks++;
            } else {
              failedTasks++;
            }
          }
        }
      }

    } finally {
      // Ensure all background processes are cleaned up
      this.terminateAllBackgroundProcesses();
    }

    const totalDuration = Date.now() - startTime;

    if (debug) {
      console.log(`\n📊 Execution Summary:`);
      console.log(`  Total tasks: ${executionPlan.tasks.length}`);
      console.log(`  Successful: ${successfulTasks}`);
      console.log(`  Failed: ${failedTasks}`);
      console.log(`  Skipped: ${skippedTasks}`);
      console.log(`  Total duration: ${totalDuration}ms`);
    }

    return {
      totalTasks: executionPlan.tasks.length,
      successfulTasks,
      failedTasks,
      skippedTasks,
      totalDuration,
      results,
    };
  }

  /**
   * Execute a task with proper async/sync handling
   */
  private async executeTaskWithAsyncHandling(taskExecution: TaskExecution, debug: boolean): Promise<TaskResult> {
    if (taskExecution.async) {
      // For async tasks: start immediately, then apply delay before next task
      this.startBackgroundProcess(taskExecution);

      // Apply delay after starting async task (if specified)
      if (taskExecution.delay > 0 && Deno.env.get("DREAM_MOCK_EXECUTION") !== "true") {
        if (debug) {
          console.log(`  Waiting ${taskExecution.delay}ms after starting async task...`);
        }
        await this.delay(taskExecution.delay);
      }

      // Return a placeholder result - actual result will be collected later
      return {
        success: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
        duration: 0,
        taskExecution,
      };
    } else {
      // For sync tasks: apply delay before starting, then wait for completion
      if (taskExecution.delay > 0 && Deno.env.get("DREAM_MOCK_EXECUTION") !== "true") {
        if (debug) {
          console.log(`  Waiting ${taskExecution.delay}ms before starting sync task...`);
        }
        await this.delay(taskExecution.delay);
      }

      return await this.taskExecutor.executeTask(taskExecution);
    }
  }

  /**
   * Start a background process for an async task
   */
  private startBackgroundProcess(taskExecution: TaskExecution): BackgroundProcess {
    const processId = `${taskExecution.projectPath}:${taskExecution.taskName}`;
    const startTime = Date.now();

    const promise = this.taskExecutor.executeTask(taskExecution);

    const bgProcess: BackgroundProcess = {
      id: processId,
      taskExecution,
      startTime,
      status: 'starting',
      promise,
    };

    this.backgroundProcesses.set(processId, bgProcess);

    // Update status when promise resolves
    promise.then(result => {
      bgProcess.result = result;
      bgProcess.status = result.success ? 'completed' : 'failed';

      // If this is a required task that failed, terminate all other processes immediately
      if (!result.success && bgProcess.taskExecution.required) {
        this.terminateAllBackgroundProcesses();
      }
    }).catch(() => {
      bgProcess.status = 'failed';
      // If this was a required task, terminate all processes
      if (bgProcess.taskExecution.required) {
        this.terminateAllBackgroundProcesses();
      }
    });

    bgProcess.status = 'running';
    return bgProcess;
  }

  /**
   * Check if any required background processes have failed
   */
  private async checkForRequiredBackgroundFailures(): Promise<boolean> {
    for (const bgProcess of this.backgroundProcesses.values()) {
      if (bgProcess.taskExecution.required && bgProcess.status === 'failed') {
        return true;
      }

      // Check if the promise has resolved with a failure
      if (bgProcess.taskExecution.required) {
        try {
          const result = await Promise.race([
            bgProcess.promise,
            new Promise<TaskResult | null>(resolve => setTimeout(() => resolve(null), 0)) // Non-blocking check
          ]);

          if (result && !result.success) {
            bgProcess.status = 'failed';
            bgProcess.result = result;
            return true;
          }
        } catch {
          // Promise rejected, mark as failed
          bgProcess.status = 'failed';
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Wait for all background processes to complete
   */
  private async waitForAllBackgroundProcesses(): Promise<void> {
    const promises = Array.from(this.backgroundProcesses.values()).map(bg => bg.promise);
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /**
   * Terminate all background processes
   */
  private terminateAllBackgroundProcesses(): void {
    for (const bgProcess of this.backgroundProcesses.values()) {
      if (bgProcess.status === 'running' || bgProcess.status === 'starting') {
        bgProcess.status = 'terminated';
        this.terminatedProcessIds.add(bgProcess.taskExecution.id);

        // Call mock termination method if available (for testing)
        const processRunner = this.taskExecutor.getProcessRunner() as ProcessRunnerWithTermination;
        if (processRunner && typeof processRunner.terminateProcess === 'function') {
          processRunner.terminateProcess(bgProcess.taskExecution.id);
        }

        // TODO: Implement actual process termination for real processes
      }
    }
    // Don't clear immediately - we need to process them in the results collection
    // this.backgroundProcesses.clear();
  }

  /**
   * Create a DreamRunner with the default Deno process runner
   */
  static create(workspaceRoot: string): DreamRunner {
    return new DreamRunner(new DenoProcessRunner(), workspaceRoot);
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
