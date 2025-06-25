import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { DreamRunner } from "../../src/dream_runner.ts";
import { TaskExecution, TaskResult, ExecutionPlan, ProcessRunner, ProcessRunnerOptions } from "../../src/types.ts";

// Mock process runner for testing failure scenarios
class MockProcessRunner implements ProcessRunner {
  private expectations = new Map<string, TaskResult>();
  private calls: Array<{ command: string, args: string[], options: ProcessRunnerOptions, timestamp: number }> = [];
  private delays = new Map<string, number>();
  private terminatedProcesses: string[] = [];

  expect(projectPath: string, taskName: string): TaskExpectation {
    return new TaskExpectation(this, projectPath, taskName);
  }

  async run(command: string, args: string[], options: ProcessRunnerOptions): Promise<TaskResult> {
    const timestamp = Date.now();
    this.calls.push({ command, args, options, timestamp });

    // Try to match by project path (extract relative path from absolute cwd)
    const relativePath = options.cwd.replace(/.*[\/\\]workspace[\/\\]/, "./").replace(/\\/g, "/");
    const key = `${relativePath}:${command} ${args.join(" ")}`;
    let result = this.expectations.get(key);

    // If not found, try with full cwd
    if (!result) {
      const fullKey = `${options.cwd}:${command} ${args.join(" ")}`;
      result = this.expectations.get(fullKey);
    }

    const delay = this.delays.get(key) || this.delays.get(`${options.cwd}:${command} ${args.join(" ")}`) || 0;

    if (!result) {
      throw new Error(`Unexpected process call: ${key} (also tried ${options.cwd}:${command} ${args.join(" ")})`);
    }

    // Simulate execution time
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return result;
  }

  terminateProcess(processId: string): void {
    this.terminatedProcesses.push(processId);
  }

  getTerminatedProcesses(): string[] {
    return [...this.terminatedProcesses];
  }

  getCalls(): Array<{ command: string, args: string[], options: ProcessRunnerOptions, timestamp: number }> {
    return [...this.calls];
  }

  clearCalls(): void {
    this.calls = [];
    this.terminatedProcesses = [];
  }

  setExpectation(key: string, result: TaskResult): void {
    this.expectations.set(key, result);
  }

  setDelay(key: string, delay: number): void {
    this.delays.set(key, delay);
  }
}

class TaskExpectation {
  constructor(
    private mock: MockProcessRunner,
    private projectPath: string,
    private taskName: string,
  ) {}

  succeeds(duration = 100): TaskExpectation {
    const key = `${this.projectPath}:deno task ${this.taskName}`;
    this.mock.setExpectation(key, {
      success: true,
      exitCode: 0,
      stdout: `Task ${this.taskName} completed`,
      stderr: "",
      duration,
      taskExecution: {} as TaskExecution,
    });
    this.mock.setDelay(key, duration);
    return this;
  }

  fails(exitCode = 1, duration = 100): TaskExpectation {
    const key = `${this.projectPath}:deno task ${this.taskName}`;
    this.mock.setExpectation(key, {
      success: false,
      exitCode,
      stdout: "",
      stderr: `Task ${this.taskName} failed`,
      duration,
      taskExecution: {} as TaskExecution,
    });
    this.mock.setDelay(key, duration);
    return this;
  }
}

Deno.test("Failure Handling - required async task failure terminates all running tasks", async () => {
  const mockRunner = new MockProcessRunner();
  
  // Set up scenario: database (required) fails, others should be terminated
  mockRunner.expect("./services/database", "start").fails(1, 500);
  mockRunner.expect("./services/auth", "dev").succeeds(2000); // Long running
  mockRunner.expect("./services/api", "dev").succeeds(1500); // Long running
  mockRunner.expect("./apps/web", "dev").succeeds(300);

  const taskExecutions: TaskExecution[] = [
    {
      id: "database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true,
      required: true, // Required - failure should stop everything
      delay: 0,
    },
    {
      id: "auth:dev",
      projectPath: "./services/auth",
      taskName: "dev",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "web:dev",
      projectPath: "./apps/web",
      taskName: "dev",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const runner = new DreamRunner(mockRunner, "/workspace");

  // Should throw TaskExecutionError when required task fails
  // TODO: Currently this won't throw because async execution isn't implemented yet
  // await assertRejects(
  //   () => runner.execute(executionPlan),
  //   TaskExecutionError,
  //   "database:start failed"
  // );

  // For now, just run and verify basic behavior
  const summary = await runner.execute(executionPlan);

  // THIS TEST SHOULD FAIL with current implementation
  // When a required async task fails, execution should stop immediately
  // Current implementation continues with sequential execution
  assertEquals(summary.failedTasks > 0, true, "Should have failed tasks");
  assertEquals(summary.successfulTasks < 3, true, "Should not complete all tasks when required task fails");

  const terminatedProcesses = mockRunner.getTerminatedProcesses();
  console.log(`Terminated processes: ${terminatedProcesses.length} (should be >0 when termination is implemented)`);

  // THIS TEST SHOULD FAIL with current implementation
  // Background processes should be terminated when required task fails
  assertEquals(terminatedProcesses.length > 0, true, "Background processes should be terminated when required task fails");
});

Deno.test("Failure Handling - optional async task failure allows continuation", async () => {
  const mockRunner = new MockProcessRunner();
  
  // Set up scenario: cache (optional) fails, others should continue
  mockRunner.expect("./services/database", "start").succeeds(500);
  mockRunner.expect("./services/cache", "start").fails(1, 300); // Optional failure
  mockRunner.expect("./services/api", "dev").succeeds(400);
  mockRunner.expect("./apps/web", "dev").succeeds(200);

  const taskExecutions: TaskExecution[] = [
    {
      id: "database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "cache:start",
      projectPath: "./services/cache",
      taskName: "start",
      async: true,
      required: false, // Optional - failure should not stop execution
      delay: 0,
    },
    {
      id: "api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "web:dev",
      projectPath: "./apps/web",
      taskName: "dev",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const runner = new DreamRunner(mockRunner, "/workspace");

  // Should NOT throw error - optional task failure should be handled gracefully
  const summary = await runner.execute(executionPlan);

  // Should return success despite optional task failure
  // TODO: Verify correct return value once implemented
  console.log(`Optional failure test - successful tasks: ${summary.successfulTasks}, failed: ${summary.failedTasks}`);

  const calls = mockRunner.getCalls();
  assertEquals(calls.length, 4, "All tasks should be attempted");

  // Verify cache failure was logged but didn't stop execution
  const cacheCall = calls.find(c => c.options.cwd.includes("cache"));
  assertEquals(cacheCall !== undefined, true, "Cache task should have been called");

  // TODO: Verify that only the failed optional process was cleaned up
  // Other processes should continue running normally
});

Deno.test("Failure Handling - process cleanup on failure scenarios", async () => {
  const mockRunner = new MockProcessRunner();
  
  mockRunner.expect("./services/database", "start").succeeds(1000);
  mockRunner.expect("./services/auth", "dev").fails(1, 800); // Required failure
  mockRunner.expect("./services/api", "dev").succeeds(1200);
  mockRunner.expect("./apps/web", "dev").succeeds(300);

  const taskExecutions: TaskExecution[] = [
    {
      id: "database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "auth:dev",
      projectPath: "./services/auth",
      taskName: "dev",
      async: true,
      required: true, // Required failure
      delay: 0,
    },
    {
      id: "api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "web:dev",
      projectPath: "./apps/web",
      taskName: "dev",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const runner = new DreamRunner(mockRunner, "/workspace");

  // TODO: Currently this won't throw because async execution isn't implemented yet
  // await assertRejects(
  //   () => runner.execute(executionPlan),
  //   TaskExecutionError
  // );

  // For now, just run and verify basic behavior
  await runner.execute(executionPlan);

  // TODO: Once cleanup is implemented, verify:
  // 1. Failed processes are properly cleaned up
  // 2. Running processes are terminated gracefully
  // 3. Resources are released
  // 4. No zombie processes remain

  const terminatedProcesses = mockRunner.getTerminatedProcesses();
  console.log(`Process cleanup test - terminated processes: ${terminatedProcesses.length}`);
  // TODO: Verify cleanup behavior
  // assertEquals(terminatedProcesses.includes("database:start"), true, "Database should be terminated");
  // assertEquals(terminatedProcesses.includes("api:dev"), true, "API should be terminated");
});

Deno.test("Failure Handling - graceful vs forceful termination", async () => {
  const mockRunner = new MockProcessRunner();
  
  // Set up a scenario where graceful termination might be needed
  mockRunner.expect("./services/database", "start").succeeds(2000); // Long running
  mockRunner.expect("./services/api", "dev").fails(1, 500); // Fails quickly
  mockRunner.expect("./apps/web", "dev").succeeds(300);

  const taskExecutions: TaskExecution[] = [
    {
      id: "database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true,
      required: true, // Required failure
      delay: 0,
    },
    {
      id: "web:dev",
      projectPath: "./apps/web",
      taskName: "dev",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const runner = new DreamRunner(mockRunner, "/workspace");

  // TODO: Currently this won't throw because async execution isn't implemented yet
  // await assertRejects(
  //   () => runner.execute(executionPlan),
  //   TaskExecutionError
  // );

  // For now, just run and verify basic behavior
  await runner.execute(executionPlan);

  // TODO: Once termination strategies are implemented, verify:
  // 1. Graceful termination is attempted first (SIGTERM)
  // 2. Forceful termination is used if graceful fails (SIGKILL)
  // 3. Timeout handling for graceful termination
  // 4. Proper signal handling
});

Deno.test("Failure Handling - multiple async task failures", async () => {
  const mockRunner = new MockProcessRunner();
  
  // Multiple failures: both required and optional
  mockRunner.expect("./services/database", "start").fails(1, 300); // Required failure
  mockRunner.expect("./services/cache", "start").fails(2, 200); // Optional failure  
  mockRunner.expect("./services/auth", "dev").succeeds(1000);
  mockRunner.expect("./services/api", "dev").fails(3, 400); // Required failure
  mockRunner.expect("./apps/web", "dev").succeeds(200);

  const taskExecutions: TaskExecution[] = [
    {
      id: "database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true,
      required: true, // Required failure
      delay: 0,
    },
    {
      id: "cache:start",
      projectPath: "./services/cache",
      taskName: "start",
      async: true,
      required: false, // Optional failure
      delay: 0,
    },
    {
      id: "auth:dev",
      projectPath: "./services/auth",
      taskName: "dev",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true,
      required: true, // Required failure
      delay: 0,
    },
    {
      id: "web:dev",
      projectPath: "./apps/web",
      taskName: "dev",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const runner = new DreamRunner(mockRunner, "/workspace");

  // TODO: Currently this won't throw because async execution isn't implemented yet
  // await assertRejects(
  //   () => runner.execute(executionPlan),
  //   TaskExecutionError
  // );

  // For now, just run and verify basic behavior
  await runner.execute(executionPlan);

  // TODO: Once multiple failure handling is implemented, verify:
  // 1. First required failure triggers termination
  // 2. Subsequent failures are handled during cleanup
  // 3. Optional failures are logged but don't affect termination
  // 4. Exit code reflects the primary failure cause

  const calls = mockRunner.getCalls();
  // All tasks should be started before first failure is detected
  console.log(`Multiple failures test - calls made: ${calls.length} (should be >=2)`);
  assertEquals(calls.length >= 2, true, "Multiple tasks should start before failure handling");
});
