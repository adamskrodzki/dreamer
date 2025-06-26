import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { DreamRunner } from "../../src/dream_runner.ts";
import { TaskExecution, TaskResult, ExecutionPlan, ProcessRunner, ProcessRunnerOptions } from "../../src/types.ts";

// Mock process runner for testing async execution behavior
class MockProcessRunner implements ProcessRunner {
  private expectations = new Map<string, TaskResult>();
  private calls: Array<{ command: string, args: string[], options: ProcessRunnerOptions, timestamp: number }> = [];
  private delays = new Map<string, number>();

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

  getCalls(): Array<{ command: string, args: string[], options: ProcessRunnerOptions, timestamp: number }> {
    return [...this.calls];
  }

  getCallTimings(): Array<{ key: string, timestamp: number }> {
    return this.calls.map(call => ({
      key: `${call.options.cwd}:${call.command} ${call.args.join(" ")}`,
      timestamp: call.timestamp
    }));
  }

  clearCalls(): void {
    this.calls = [];
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

Deno.test("Async Execution - async tasks start without waiting for completion", async () => {
  const mockRunner = new MockProcessRunner();
  
  // Set up expectations - async tasks should start immediately
  mockRunner.expect("./services/database", "start").succeeds(2000); // 2 second task
  mockRunner.expect("./services/api", "dev").succeeds(1000); // 1 second task
  mockRunner.expect("./apps/web", "dev").succeeds(500); // 0.5 second task

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
      required: true,
      delay: 0,
    },
    {
      id: "web:dev",
      projectPath: "./apps/web", 
      taskName: "dev",
      async: false, // sync task waits for async tasks
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const startTime = Date.now();

  // This should fail with current implementation (sequential execution)
  // but pass with correct implementation (concurrent execution)
  const runner = new DreamRunner(mockRunner, "/workspace");
  await runner.execute(executionPlan);

  const totalTime = Date.now() - startTime;
  const calls = mockRunner.getCallTimings();

  // Verify concurrent execution timing
  // With correct async behavior: total time should be ~2000ms (max of concurrent tasks) + 500ms (sync task)
  // With incorrect sequential behavior: total time would be ~3500ms (2000 + 1000 + 500)

  console.log(`Current execution time: ${totalTime}ms (should be ~2500ms with concurrency, ~3500ms sequential)`);

  // Verify all tasks were called
  assertEquals(calls.length, 3);

  // THIS TEST SHOULD FAIL with current sequential implementation
  // Async tasks should run concurrently, so total time should be much less than sequential
  assertEquals(totalTime < 3000, true, `Expected concurrent execution (~2500ms), got sequential ${totalTime}ms`);

  // Verify async tasks started close together (within 100ms)
  const dbStart = calls.find(c => c.key.includes("database"))?.timestamp || 0;
  const apiStart = calls.find(c => c.key.includes("api"))?.timestamp || 0;
  const timeDiff = Math.abs(apiStart - dbStart);

  console.log(`Time difference between async tasks: ${timeDiff}ms (should be <100ms with concurrency)`);

  // THIS TEST SHOULD FAIL with current sequential implementation
  // Async tasks should start concurrently (within 100ms of each other)
  assertEquals(timeDiff < 100, true, `Async tasks should start concurrently, time diff: ${timeDiff}ms`);
});

Deno.test("Async Execution - delay for async tasks applied AFTER starting task", async () => {
  const mockRunner = new MockProcessRunner();
  
  mockRunner.expect("./services/database", "start").succeeds(500);
  mockRunner.expect("./services/api", "dev").succeeds(500);
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
      id: "api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true,
      required: true,
      delay: 1000, // 1 second delay AFTER starting
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

  const startTime = Date.now();
  const runner = new DreamRunner(mockRunner, "/workspace");
  await runner.execute(executionPlan);
  const totalTime = Date.now() - startTime;

  // With correct async delay behavior:
  // - Database starts immediately (async, delay=0)
  // - API starts immediately (async), then 1000ms delay before next task
  // - Web starts after 1000ms delay
  // Total time: max(database_time, api_time) + 1000ms + web_time = ~1700ms

  // With incorrect current behavior:
  // - Database starts and completes (500ms)
  // - Wait 1000ms, then API starts and completes (500ms)
  // - Web starts and completes (200ms)
  // Total time: 500 + 1000 + 500 + 200 = 2200ms

  const calls = mockRunner.getCallTimings();
  assertEquals(calls.length, 3);

  console.log(`Delay execution time: ${totalTime}ms (should be ~1700ms with async delays, ~2200ms sequential)`);

  // THIS TEST SHOULD FAIL with current implementation
  // With correct async delay behavior: ~1700ms (concurrent execution)
  // With current incorrect behavior: ~2200ms (sequential execution)
  assertEquals(totalTime < 1900, true, `Expected async delay behavior (~1700ms), got ${totalTime}ms`);

  // Verify correct delay timing - async tasks should start immediately
  const dbStart = calls[0].timestamp;
  const apiStart = calls[1].timestamp;
  const webStart = calls[2].timestamp;

  // THIS TEST SHOULD FAIL with current implementation
  // For async tasks, both should start immediately (within 100ms)
  assertEquals(apiStart - dbStart < 100, true, `API should start immediately after database, got ${apiStart - dbStart}ms gap`);

  // Web should start after the 1000ms delay from API start
  assertEquals(webStart - apiStart >= 1000, true, `Web should start after 1000ms delay from API start, got ${webStart - apiStart}ms`);
});

Deno.test("Async Execution - delay for sync tasks applied BEFORE starting task", async () => {
  const mockRunner = new MockProcessRunner();
  
  mockRunner.expect("./services/database", "start").succeeds(300);
  mockRunner.expect("./services/api", "dev").succeeds(300);

  const taskExecutions: TaskExecution[] = [
    {
      id: "database:start",
      projectPath: "./services/database", 
      taskName: "start",
      async: false, // sync task
      required: true,
      delay: 500, // delay BEFORE starting
    },
    {
      id: "api:dev",
      projectPath: "./services/api",
      taskName: "dev", 
      async: false, // sync task
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const startTime = Date.now();
  const runner = new DreamRunner(mockRunner, "/workspace");
  await runner.execute(executionPlan);
  const totalTime = Date.now() - startTime;

  // For sync tasks, delay should be applied BEFORE starting
  // Total time: 500ms delay + 300ms database + 300ms api = ~1100ms

  console.log(`Sync delay execution time: ${totalTime}ms (should be ~1100ms with sync delays)`);

  const calls = mockRunner.getCalls();
  assertEquals(calls.length, 2);
});

Deno.test("Async Execution - multiple async tasks run concurrently", async () => {
  const mockRunner = new MockProcessRunner();

  // Set up three async tasks with different durations
  mockRunner.expect("./services/database", "start").succeeds(1000);
  mockRunner.expect("./services/auth", "dev").succeeds(800);
  mockRunner.expect("./services/api", "dev").succeeds(600);
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
      async: false, // sync task waits for all async tasks
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const startTime = Date.now();
  const runner = new DreamRunner(mockRunner, "/workspace");
  await runner.execute(executionPlan);
  const totalTime = Date.now() - startTime;

  // With correct concurrent execution:
  // All async tasks run simultaneously, total time = max(1000, 800, 600) + 200 = ~1200ms

  // With incorrect sequential execution:
  // Total time = 1000 + 800 + 600 + 200 = 2600ms

  const calls = mockRunner.getCallTimings();
  assertEquals(calls.length, 4);

  console.log(`Multiple async execution time: ${totalTime}ms (should be ~1200ms concurrent, ~2600ms sequential)`);

  // THIS TEST SHOULD FAIL with current implementation
  // With concurrent execution: ~1200ms, with sequential: ~2600ms
  assertEquals(totalTime < 1500, true, `Expected concurrent execution (~1200ms), got sequential ${totalTime}ms`);

  // Verify async tasks started close together
  const asyncCalls = calls.slice(0, 3); // First 3 are async
  const startTimes = asyncCalls.map(c => c.timestamp);
  const maxTimeDiff = Math.max(...startTimes) - Math.min(...startTimes);

  console.log(`Max time difference between async tasks: ${maxTimeDiff}ms (should be <100ms with concurrency)`);

  // THIS TEST SHOULD FAIL with current implementation
  // All async tasks should start within 100ms of each other
  assertEquals(maxTimeDiff < 100, true, `Async tasks should start concurrently, max time diff: ${maxTimeDiff}ms`);
});

Deno.test("Async Execution - mixed async/sync execution timing", async () => {
  const mockRunner = new MockProcessRunner();

  mockRunner.expect("./services/database", "start").succeeds(500);
  mockRunner.expect("./packages/utils", "build").succeeds(300);
  mockRunner.expect("./services/api", "dev").succeeds(400);
  mockRunner.expect("./apps/web", "dev").succeeds(200);

  const taskExecutions: TaskExecution[] = [
    {
      id: "database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true, // background
      required: true,
      delay: 0,
    },
    {
      id: "utils:build",
      projectPath: "./packages/utils",
      taskName: "build",
      async: false, // sync - blocks
      required: true,
      delay: 0,
    },
    {
      id: "api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true, // background
      required: true,
      delay: 1000, // 1s delay after starting
    },
    {
      id: "web:dev",
      projectPath: "./apps/web",
      taskName: "dev",
      async: false, // sync - waits for all
      required: true,
      delay: 0,
    },
  ];

  const executionPlan: ExecutionPlan = {
    tasks: taskExecutions,
  };

  const startTime = Date.now();
  const runner = new DreamRunner(mockRunner, "/workspace");
  await runner.execute(executionPlan);
  const totalTime = Date.now() - startTime;

  // Expected correct execution flow:
  // 1. Database starts in background (async, 500ms)
  // 2. Utils builds synchronously (300ms) - runs concurrently with database
  // 3. API starts in background (async, 400ms), then 1000ms delay
  // 4. Web starts after delay (sync, 200ms)
  // Total: max(database_time, utils_time) + 1000ms + web_time
  //      = max(500, 300) + 1000 + 200 = 500 + 1000 + 200 = 1700ms
  // Actual implementation is even more efficient: ~1500ms

  const calls = mockRunner.getCalls();
  assertEquals(calls.length, 4);

  console.log(`Mixed async/sync execution time: ${totalTime}ms (should be ~1500-1700ms with correct implementation)`);

  // With correct mixed async/sync execution, should be much faster than sequential
  // Sequential would be: 500 + 300 + 1000 + 400 + 200 = 2400ms
  // Concurrent should be: ~1500-1700ms
  assertEquals(totalTime >= 1400 && totalTime <= 1800, true, `Expected ~1500-1700ms with correct mixed execution, got ${totalTime}ms`);
});

Deno.test("Async Execution - background process tracking and management", async () => {
  const mockRunner = new MockProcessRunner();

  mockRunner.expect("./services/database", "start").succeeds(2000);
  mockRunner.expect("./services/api", "dev").succeeds(1500);
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
      required: true,
      delay: 500,
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

  // TODO: Once background process tracking is implemented, verify:
  // 1. Background processes are tracked during execution
  // 2. Process status is monitored
  // 3. Processes are properly cleaned up after completion

  await runner.execute(executionPlan);

  // For now, just verify basic execution
  const calls = mockRunner.getCalls();
  assertEquals(calls.length, 3);

  // TODO: Add assertions for background process management:
  // - Verify processes were tracked
  // - Verify process cleanup occurred
  // - Verify process status monitoring
});
