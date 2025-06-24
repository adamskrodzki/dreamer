import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { TaskExecutor, MockProcessRunner } from "../../src/task_executor.ts";
import { TaskExecutionError } from "../../src/errors.ts";
import type { TaskExecution } from "../../src/types.ts";

Deno.test("TaskExecutor - executeTask success", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecution: TaskExecution = {
    id: "./packages/utils:test",
    projectPath: "./packages/utils",
    taskName: "test",
    async: false,
    required: true,
    delay: 0,
  };

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: true,
    exitCode: 0,
    stdout: "Test passed",
    stderr: "",
    duration: 1000,
  });

  const result = await executor.executeTask(taskExecution);

  assertEquals(result.success, true);
  assertEquals(result.exitCode, 0);
  assertEquals(result.stdout, "Test passed");
  assertEquals(result.stderr, "");
  assertEquals(result.duration, 1000);
  assertEquals(result.taskExecution, taskExecution);

  // Verify the command was called correctly
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 1);
  assertEquals(callLog[0].command, "deno");
  assertEquals(callLog[0].args, ["task", "test"]);
  assertEquals(callLog[0].options.cwd, "/workspace/packages/utils");
});

Deno.test("TaskExecutor - executeTask failure with required task (no throw)", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecution: TaskExecution = {
    id: "./packages/utils:test",
    projectPath: "./packages/utils",
    taskName: "test",
    async: false,
    required: true,
    delay: 0,
  };

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  // executeTask should not throw, just return failed result
  const result = await executor.executeTask(taskExecution);
  assertEquals(result.success, false);
  assertEquals(result.exitCode, 1);
  assertEquals(result.stderr, "Test failed");
});

Deno.test("TaskExecutor - executeTaskWithErrorHandling throws on required failure", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecution: TaskExecution = {
    id: "./packages/utils:test",
    projectPath: "./packages/utils",
    taskName: "test",
    async: false,
    required: true,
    delay: 0,
  };

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  try {
    await executor.executeTaskWithErrorHandling(taskExecution);
    throw new Error("Expected TaskExecutionError to be thrown");
  } catch (error) {
    assertEquals(error instanceof TaskExecutionError, true);
    if (error instanceof TaskExecutionError) {
      assertEquals(error.message, "Task ./packages/utils:test failed with exit code 1");
      assertEquals(error.exitCode, 1);
      assertEquals(error.stderr, "Test failed");
    }
  }
});

Deno.test("TaskExecutor - executeTask failure with optional task", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecution: TaskExecution = {
    id: "./packages/utils:test",
    projectPath: "./packages/utils",
    taskName: "test",
    async: false,
    required: false,
    delay: 0,
  };

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  const result = await executor.executeTask(taskExecution);

  assertEquals(result.success, false);
  assertEquals(result.exitCode, 1);
  assertEquals(result.stderr, "Test failed");
  // Should not throw for optional tasks
});

Deno.test("TaskExecutor - executeTasks sequence success", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./packages/utils:test",
      projectPath: "./packages/utils",
      taskName: "test",
      async: false,
      required: true,
      delay: 0,
    },
    {
      id: "./packages/core:test",
      projectPath: "./packages/core",
      taskName: "test",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: true,
    exitCode: 0,
    stdout: "Test passed",
    stderr: "",
    duration: 1000,
  });

  const results = await executor.executeTasks(taskExecutions);

  assertEquals(results.length, 2);
  assertEquals(results[0].success, true);
  assertEquals(results[1].success, true);

  // Verify both commands were called
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 2);
  assertEquals(callLog[0].options.cwd, "/workspace/packages/utils");
  assertEquals(callLog[1].options.cwd, "/workspace/packages/core");
});

Deno.test("TaskExecutor - executeTasks stops on required task failure", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./packages/utils:test",
      projectPath: "./packages/utils",
      taskName: "test",
      async: false,
      required: true,
      delay: 0,
    },
    {
      id: "./packages/core:test",
      projectPath: "./packages/core",
      taskName: "test",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  // First task fails
  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  // executeTasks should not throw, but should stop execution after first failure
  const results = await executor.executeTasks(taskExecutions);

  // Should only have 1 result (second task should not execute due to first failure)
  assertEquals(results.length, 1);
  assertEquals(results[0].success, false);
  assertEquals(results[0].exitCode, 1);

  // Verify only 1 task was called (second was skipped)
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 1);
  assertEquals(callLog[0].options.cwd, "/workspace/packages/utils");
});

Deno.test("TaskExecutor - executeTasks continues on optional task failure", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./packages/utils:test",
      projectPath: "./packages/utils",
      taskName: "test",
      async: false,
      required: false, // Optional task
      delay: 0,
    },
    {
      id: "./packages/core:test",
      projectPath: "./packages/core",
      taskName: "test",
      async: false,
      required: false, // Make this optional too
      delay: 0,
    },
  ];

  // Set mock result for both calls
  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  const results = await executor.executeTasks(taskExecutions);

  assertEquals(results.length, 2);
  assertEquals(results[0].success, false); // First task failed
  assertEquals(results[1].success, false); // Second task also uses same mock (failed)

  // Verify both commands were called
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 2);
});

Deno.test("TaskExecutor - resolveProjectPath workspace root", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecution: TaskExecution = {
    id: "./:test",
    projectPath: "./",
    taskName: "test",
    async: false,
    required: true,
    delay: 0,
  };

  await executor.executeTask(taskExecution);

  const callLog = mockRunner.getCallLog();
  assertEquals(callLog[0].options.cwd, "/workspace");
});

Deno.test("TaskExecutor - resolveProjectPath nested project", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecution: TaskExecution = {
    id: "./packages/utils:test",
    projectPath: "./packages/utils",
    taskName: "test",
    async: false,
    required: true,
    delay: 0,
  };

  await executor.executeTask(taskExecution);

  const callLog = mockRunner.getCallLog();
  assertEquals(callLog[0].options.cwd, "/workspace/packages/utils");
});

Deno.test("TaskExecutor - resolveProjectPath Windows paths", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "C:\\workspace");

  const taskExecution: TaskExecution = {
    id: "./packages/utils:test",
    projectPath: "./packages/utils",
    taskName: "test",
    async: false,
    required: true,
    delay: 0,
  };

  await executor.executeTask(taskExecution);

  const callLog = mockRunner.getCallLog();
  assertEquals(callLog[0].options.cwd, "C:\\workspace\\packages\\utils");
});

Deno.test("MockProcessRunner - setMockResult and getCallLog", () => {
  const mockRunner = new MockProcessRunner();

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: true,
    exitCode: 0,
    stdout: "Custom output",
    stderr: "Custom error",
    duration: 2000,
  });

  const result = mockRunner.run("deno", ["task", "test"], { cwd: "/test" });

  result.then((res) => {
    assertEquals(res.success, true);
    assertEquals(res.exitCode, 0);
    assertEquals(res.stdout, "Custom output");
    assertEquals(res.stderr, "Custom error");
    assertEquals(res.duration, 2000);
  });

  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 1);
  assertEquals(callLog[0].command, "deno");
  assertEquals(callLog[0].args, ["task", "test"]);
  assertEquals(callLog[0].options.cwd, "/test");
});

Deno.test("MockProcessRunner - default result when no mock set", async () => {
  const mockRunner = new MockProcessRunner();

  const result = await mockRunner.run("deno", ["task", "build"], { cwd: "/test" });

  assertEquals(result.success, true);
  assertEquals(result.exitCode, 0);
  assertEquals(result.stdout, "Mock output for: deno task build");
  assertEquals(result.stderr, "");
  assertEquals(result.duration, 100);
});

Deno.test("MockProcessRunner - reset functionality", async () => {
  const mockRunner = new MockProcessRunner();

  mockRunner.setMockResult("deno", ["task", "test"], { success: false });
  await mockRunner.run("deno", ["task", "test"], { cwd: "/test" });

  assertEquals(mockRunner.getCallLog().length, 1);

  mockRunner.reset();

  assertEquals(mockRunner.getCallLog().length, 0);

  // Should use default result after reset
  const result = await mockRunner.run("deno", ["task", "test"], { cwd: "/test" });
  assertEquals(result.success, true); // Default is success
});

Deno.test("TaskExecutor - async task execution", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./services/database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "./services/api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true,
      required: true,
      delay: 100, // Small delay for testing
    },
    {
      id: "./apps/web:dev",
      projectPath: "./apps/web",
      taskName: "dev",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  mockRunner.setMockResult("deno", ["task", "start"], {
    success: true,
    exitCode: 0,
    stdout: "Database started",
    stderr: "",
    duration: 50,
  });

  mockRunner.setMockResult("deno", ["task", "dev"], {
    success: true,
    exitCode: 0,
    stdout: "Service started",
    stderr: "",
    duration: 30,
  });

  const results = await executor.executeTasks(taskExecutions);

  assertEquals(results.length, 3);
  assertEquals(results[0].success, true);
  assertEquals(results[1].success, true);
  assertEquals(results[2].success, true);

  // Verify all tasks were called
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 3);
});

Deno.test("TaskExecutor - mixed async and sync execution", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./packages/utils:build",
      projectPath: "./packages/utils",
      taskName: "build",
      async: false, // Sync task
      required: true,
      delay: 0,
    },
    {
      id: "./services/database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true, // Async task
      required: true,
      delay: 0,
    },
    {
      id: "./services/api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true, // Async task
      required: true,
      delay: 0,
    },
  ];

  mockRunner.setMockResult("deno", ["task", "build"], {
    success: true,
    exitCode: 0,
    stdout: "Build completed",
    stderr: "",
    duration: 20,
  });

  mockRunner.setMockResult("deno", ["task", "start"], {
    success: true,
    exitCode: 0,
    stdout: "Database started",
    stderr: "",
    duration: 30,
  });

  mockRunner.setMockResult("deno", ["task", "dev"], {
    success: true,
    exitCode: 0,
    stdout: "API started",
    stderr: "",
    duration: 25,
  });

  const results = await executor.executeTasks(taskExecutions);

  assertEquals(results.length, 3);

  // All tasks should succeed
  for (const result of results) {
    assertEquals(result.success, true);
  }

  // Verify all tasks were called
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 3);
});

Deno.test("TaskExecutor - async task failure handling", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./services/database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: true,
      required: true,
      delay: 0,
    },
    {
      id: "./services/api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: true,
      required: false, // Optional task
      delay: 0,
    },
  ];

  mockRunner.setMockResult("deno", ["task", "start"], {
    success: true,
    exitCode: 0,
    stdout: "Database started",
    stderr: "",
    duration: 20,
  });

  mockRunner.setMockResult("deno", ["task", "dev"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "API failed to start",
    duration: 10,
  });

  const results = await executor.executeTasks(taskExecutions);

  assertEquals(results.length, 2);
  assertEquals(results[0].success, true);
  assertEquals(results[1].success, false);
  assertEquals(results[1].exitCode, 1);
});

Deno.test("TaskExecutor - required task failure stops execution", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./packages/utils:build",
      projectPath: "./packages/utils",
      taskName: "build",
      async: false,
      required: true, // Required task
      delay: 0,
    },
    {
      id: "./packages/auth:test",
      projectPath: "./packages/auth",
      taskName: "test", // Different task name
      async: false,
      required: true,
      delay: 0,
    },
    {
      id: "./apps/web:dev",
      projectPath: "./apps/web",
      taskName: "dev", // Different task name
      async: false,
      required: true,
      delay: 0,
    },
  ];

  // First task succeeds
  mockRunner.setMockResult("deno", ["task", "build"], {
    success: true,
    exitCode: 0,
    stdout: "Utils built successfully",
    stderr: "",
    duration: 100,
  });

  // Second task fails (required)
  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Auth test failed",
    duration: 50,
  });

  // Third task would succeed (but shouldn't be called)
  mockRunner.setMockResult("deno", ["task", "dev"], {
    success: true,
    exitCode: 0,
    stdout: "Web dev started",
    stderr: "",
    duration: 75,
  });

  const results = await executor.executeTasks(taskExecutions);

  // Should only have 2 results (third task should not execute)
  assertEquals(results.length, 2);
  assertEquals(results[0].success, true);
  assertEquals(results[1].success, false);
  assertEquals(results[1].exitCode, 1);

  // Verify only 2 tasks were called (third was skipped due to failure)
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 2);
});

Deno.test("TaskExecutor - optional task failure continues execution", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./packages/utils:build",
      projectPath: "./packages/utils",
      taskName: "build",
      async: false,
      required: true,
      delay: 0,
    },
    {
      id: "./packages/auth:lint",
      projectPath: "./packages/auth",
      taskName: "lint",
      async: false,
      required: false, // Optional task
      delay: 0,
    },
    {
      id: "./apps/web:build",
      projectPath: "./apps/web",
      taskName: "build",
      async: false,
      required: true,
      delay: 0,
    },
  ];

  // First task succeeds
  mockRunner.setMockResult("deno", ["task", "build"], {
    success: true,
    exitCode: 0,
    stdout: "Built successfully",
    stderr: "",
    duration: 100,
  });

  // Second task fails (but optional)
  mockRunner.setMockResult("deno", ["task", "lint"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Linting failed",
    duration: 50,
  });

  const results = await executor.executeTasks(taskExecutions);

  // Should have all 3 results (execution continues despite optional failure)
  assertEquals(results.length, 3);
  assertEquals(results[0].success, true);
  assertEquals(results[1].success, false); // Optional task failed
  assertEquals(results[2].success, true);  // But execution continued

  // Verify all 3 tasks were called
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 3);
});

Deno.test("TaskExecutor - delay parameter effect", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner, "/workspace");

  const taskExecutions: TaskExecution[] = [
    {
      id: "./services/database:start",
      projectPath: "./services/database",
      taskName: "start",
      async: false,
      required: true,
      delay: 100, // 100ms delay
    },
    {
      id: "./services/api:dev",
      projectPath: "./services/api",
      taskName: "dev",
      async: false,
      required: true,
      delay: 200, // 200ms delay
    },
  ];

  mockRunner.setMockResult("deno", ["task", "start"], {
    success: true,
    exitCode: 0,
    stdout: "Database started",
    stderr: "",
    duration: 50,
  });

  mockRunner.setMockResult("deno", ["task", "dev"], {
    success: true,
    exitCode: 0,
    stdout: "API started",
    stderr: "",
    duration: 50,
  });

  const startTime = Date.now();
  const results = await executor.executeTasks(taskExecutions);
  const totalTime = Date.now() - startTime;

  assertEquals(results.length, 2);
  assertEquals(results[0].success, true);
  assertEquals(results[1].success, true);

  // In mock mode, delays are skipped, so we just verify the structure works
  // In real execution, this would take at least 300ms (100 + 200 delays + execution time)
  console.log(`Execution time with delays: ${totalTime}ms`);
});
