import type { ExecutionPlan, TaskResult, ProcessRunner } from "./types.ts";
import { TaskExecutor, DenoProcessRunner } from "./task_executor.ts";
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

    for (let i = 0; i < executionPlan.tasks.length; i++) {
      const taskExecution = executionPlan.tasks[i];
      
      if (debug) {
        console.log(`\n[${i + 1}/${executionPlan.tasks.length}] Starting: ${taskExecution.id}`);
        if (taskExecution.delay > 0) {
          if (Deno.env.get("DREAM_MOCK_EXECUTION") === "true") {
            console.log(`  Skipping ${taskExecution.delay}ms delay (mock execution mode)...`);
          } else {
            console.log(`  Waiting ${taskExecution.delay}ms before execution...`);
          }
        }
      }

      // Apply delay if specified (skip delays when mocking execution for tests)
      if (taskExecution.delay > 0 && Deno.env.get("DREAM_MOCK_EXECUTION") !== "true") {
        await this.delay(taskExecution.delay);
      }

      try {
        const result = await this.taskExecutor.executeTask(taskExecution);
        results.push(result);

        if (result.success) {
          successfulTasks++;
          // Output is now streamed in real-time by DenoProcessRunner
          // Just show completion status with timing
          console.log(`  ✅ ${taskExecution.projectPath} ${taskExecution.taskName} (${result.duration}ms)`);
        } else {
          failedTasks++;
          // Error output is now streamed in real-time by DenoProcessRunner
          // Just show failure status
          console.log(`  ❌ ${taskExecution.projectPath} ${taskExecution.taskName} failed (exit code ${result.exitCode})`);

          // If task is required and failed, stop execution
          if (taskExecution.required) {
            skippedTasks = executionPlan.tasks.length - i - 1;
            if (debug && skippedTasks > 0) {
              console.log(`\n⏭️  Skipping ${skippedTasks} remaining tasks due to required task failure`);
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
            console.log(`  ❌ ${taskExecution.projectPath} ${taskExecution.taskName} failed: ${error.message}`);
          }

          // Stop execution for required task failures
          skippedTasks = executionPlan.tasks.length - i - 1;
          if (debug && skippedTasks > 0) {
            console.log(`\n⏭️  Skipping ${skippedTasks} remaining tasks due to required task failure`);
          }
          break;
        } else {
          // Unexpected error - re-throw
          throw error;
        }
      }
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
   * Create a DreamRunner with the default Deno process runner
   */
  static create(workspaceRoot: string): DreamRunner {
    return new DreamRunner(new DenoProcessRunner(), workspaceRoot);
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
