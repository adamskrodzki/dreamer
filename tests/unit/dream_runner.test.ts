import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { DreamRunner } from "../../src/dream_runner.ts";
import { MockProcessRunner } from "../../src/task_executor.ts";
import type { ExecutionPlan } from "../../src/types.ts";

Deno.test("DreamRunner - execute successful plan", async () => {
  const mockRunner = new MockProcessRunner();
  const runner = new DreamRunner(mockRunner, "/workspace");

  const executionPlan: ExecutionPlan = {
    tasks: [
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
    ],
  };

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: true,
    exitCode: 0,
    stdout: "Test passed",
    stderr: "",
    duration: 1000,
  });

  const summary = await runner.execute(executionPlan);

  assertEquals(summary.totalTasks, 2);
  assertEquals(summary.successfulTasks, 2);
  assertEquals(summary.failedTasks, 0);
  assertEquals(summary.skippedTasks, 0);
  assertEquals(summary.results.length, 2);
  assertEquals(summary.results[0].success, true);
  assertEquals(summary.results[1].success, true);
});

Deno.test("DreamRunner - execute with task failure stops on required", async () => {
  const mockRunner = new MockProcessRunner();
  const runner = new DreamRunner(mockRunner, "/workspace");

  const executionPlan: ExecutionPlan = {
    tasks: [
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
    ],
  };

  // First task fails
  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  const summary = await runner.execute(executionPlan);

  assertEquals(summary.totalTasks, 2);
  assertEquals(summary.successfulTasks, 0);
  assertEquals(summary.failedTasks, 1);
  assertEquals(summary.skippedTasks, 1); // Second task skipped
  assertEquals(summary.results.length, 1);
  assertEquals(summary.results[0].success, false);

  // Verify only first task was executed
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 1);
});

Deno.test("DreamRunner - execute continues on optional task failure", async () => {
  const mockRunner = new MockProcessRunner();
  const runner = new DreamRunner(mockRunner, "/workspace");

  const executionPlan: ExecutionPlan = {
    tasks: [
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
        required: true,
        delay: 0,
      },
    ],
  };

  // Both tasks use same command, so both will fail with this mock
  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  const summary = await runner.execute(executionPlan);

  assertEquals(summary.totalTasks, 2);
  assertEquals(summary.successfulTasks, 0); // Both tasks fail due to same mock
  assertEquals(summary.failedTasks, 2);
  assertEquals(summary.skippedTasks, 0);
  assertEquals(summary.results.length, 2);
  assertEquals(summary.results[0].success, false); // First task failed
  assertEquals(summary.results[1].success, false); // Second task also failed due to same mock

  // Verify both tasks were executed
  const callLog = mockRunner.getCallLog();
  assertEquals(callLog.length, 2);
});

Deno.test("DreamRunner - execute with delays", async () => {
  const mockRunner = new MockProcessRunner();
  const runner = new DreamRunner(mockRunner, "/workspace");

  const executionPlan: ExecutionPlan = {
    tasks: [
      {
        id: "./packages/utils:test",
        projectPath: "./packages/utils",
        taskName: "test",
        async: false,
        required: true,
        delay: 100, // 100ms delay
      },
    ],
  };

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: true,
    exitCode: 0,
    stdout: "Test passed",
    stderr: "",
    duration: 50,
  });

  const startTime = Date.now();
  const summary = await runner.execute(executionPlan);
  const totalTime = Date.now() - startTime;

  assertEquals(summary.successfulTasks, 1);
  // Should take at least 100ms due to delay
  assertEquals(totalTime >= 100, true);
});

Deno.test("DreamRunner - execute with debug output", async () => {
  const mockRunner = new MockProcessRunner();
  const runner = new DreamRunner(mockRunner, "/workspace");

  const executionPlan: ExecutionPlan = {
    tasks: [
      {
        id: "./packages/utils:test",
        projectPath: "./packages/utils",
        taskName: "test",
        async: false,
        required: true,
        delay: 0,
      },
    ],
  };

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: true,
    exitCode: 0,
    stdout: "Test passed",
    stderr: "",
    duration: 1000,
  });

  // Capture console output
  const originalLog = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.join(" ") + "\n";
  };

  try {
    const summary = await runner.execute(executionPlan, true); // debug = true

    assertEquals(summary.successfulTasks, 1);
    
    // Verify debug output
    assertEquals(output.includes("Executing 1 tasks:"), true);
    assertEquals(output.includes("[1/1] Starting: ./packages/utils:test"), true);
    assertEquals(output.includes("✅ Completed successfully"), true);
    assertEquals(output.includes("📊 Execution Summary:"), true);
  } finally {
    console.log = originalLog;
  }
});

Deno.test("DreamRunner - execute with debug output and failure", async () => {
  const mockRunner = new MockProcessRunner();
  const runner = new DreamRunner(mockRunner, "/workspace");

  const executionPlan: ExecutionPlan = {
    tasks: [
      {
        id: "./packages/utils:test",
        projectPath: "./packages/utils",
        taskName: "test",
        async: false,
        required: true,
        delay: 0,
      },
    ],
  };

  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  // Capture console output
  const originalLog = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.join(" ") + "\n";
  };

  try {
    const summary = await runner.execute(executionPlan, true); // debug = true

    assertEquals(summary.failedTasks, 1);
    
    // Verify debug output for failure
    assertEquals(output.includes("❌ Failed with exit code 1"), true);
    assertEquals(output.includes("Error: Test failed"), true);
  } finally {
    console.log = originalLog;
  }
});

Deno.test("DreamRunner - create static method", () => {
  const runner = DreamRunner.create("/workspace");
  
  // Should create a DreamRunner instance
  assertEquals(runner instanceof DreamRunner, true);
});

Deno.test("DreamRunner - execute empty plan", async () => {
  const mockRunner = new MockProcessRunner();
  const runner = new DreamRunner(mockRunner, "/workspace");

  const executionPlan: ExecutionPlan = {
    tasks: [],
  };

  const summary = await runner.execute(executionPlan);

  assertEquals(summary.totalTasks, 0);
  assertEquals(summary.successfulTasks, 0);
  assertEquals(summary.failedTasks, 0);
  assertEquals(summary.skippedTasks, 0);
  assertEquals(summary.results.length, 0);
});

Deno.test("DreamRunner - execute with mixed success and failure", async () => {
  const mockRunner = new MockProcessRunner();
  const runner = new DreamRunner(mockRunner, "/workspace");

  const executionPlan: ExecutionPlan = {
    tasks: [
      {
        id: "./packages/utils:test",
        projectPath: "./packages/utils",
        taskName: "test",
        async: false,
        required: false, // Optional
        delay: 0,
      },
      {
        id: "./packages/core:build",
        projectPath: "./packages/core",
        taskName: "build",
        async: false,
        required: false, // Optional
        delay: 0,
      },
    ],
  };

  // Set different results for different commands
  mockRunner.setMockResult("deno", ["task", "test"], {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "Test failed",
    duration: 500,
  });

  mockRunner.setMockResult("deno", ["task", "build"], {
    success: true,
    exitCode: 0,
    stdout: "Build successful",
    stderr: "",
    duration: 1000,
  });

  const summary = await runner.execute(executionPlan);

  assertEquals(summary.totalTasks, 2);
  assertEquals(summary.successfulTasks, 1);
  assertEquals(summary.failedTasks, 1);
  assertEquals(summary.skippedTasks, 0);
  assertEquals(summary.results.length, 2);
  assertEquals(summary.results[0].success, false); // test failed
  assertEquals(summary.results[1].success, true);  // build succeeded
});
