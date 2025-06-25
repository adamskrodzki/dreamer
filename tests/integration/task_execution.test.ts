import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { DreamRunner } from "../../src/dream_runner.ts";
import { ConfigManager } from "../../src/config_manager.ts";
import { DependencyResolver } from "../../src/dependency_resolver.ts";
import { MockProcessRunner } from "../../src/task_executor.ts";

/**
 * Helper to create a test workspace with files
 */
async function createTestWorkspace(baseDir: string, files: Record<string, string>): Promise<void> {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = `${baseDir}/${filePath}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

    // Create directory if it doesn't exist
    try {
      await Deno.mkdir(dir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }

    await Deno.writeTextFile(fullPath, content);
  }
}

Deno.test("Integration Task Execution - simple monorepo with successful tasks", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: ["./packages/base"], // Give utils a dependency so it will include clients
        },
        "./packages/base": {
          test: [],
        },
        "./packages/core": {
          test: ["./packages/utils"],
        },
        "./apps/web": {
          test: ["./packages/core"],
        },
      },
      tasks: {
        test: {
          async: false,
          required: true,
          delay: 0,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/base/deno.json": JSON.stringify({
        name: "base",
        tasks: {
          test: "echo 'Base tests passed'",
        },
      }),
      "packages/utils/deno.json": JSON.stringify({
        name: "utils",
        tasks: {
          test: "echo 'Utils tests passed'",
        },
      }),
      "packages/core/deno.json": JSON.stringify({
        name: "core",
        tasks: {
          test: "echo 'Core tests passed'",
        },
      }),
      "apps/web/deno.json": JSON.stringify({
        name: "web",
        tasks: {
          test: "echo 'Web tests passed'",
        },
      }),
    });

    // Load configuration
    const configManager = new ConfigManager();
    const loadedConfig = await configManager.loadFromPath(`${tempDir}/dream.json`);

    // Resolve dependencies
    const resolver = new DependencyResolver(loadedConfig);
    const executionPlan = resolver.resolveTestPattern("./apps/web", "test");

    // Execute with real process runner
    const runner = DreamRunner.create(tempDir);
    const summary = await runner.execute(executionPlan);

    // Web app test pattern resolves: core (dependency) + web (current)
    // Utils is not included because it has dependencies (base), so only its clients are included
    assertEquals(summary.totalTasks, 2);
    assertEquals(summary.successfulTasks, 2);
    assertEquals(summary.failedTasks, 0);
    assertEquals(summary.skippedTasks, 0);

    // Verify all tasks completed successfully
    for (const result of summary.results) {
      assertEquals(result.success, true);
      assertEquals(result.exitCode, 0);
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Task Execution - task failure stops execution", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: [],
        },
        "./packages/core": {
          test: ["./packages/utils"],
        },
      },
      tasks: {
        test: {
          async: false,
          required: true,
          delay: 0,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({
        name: "utils",
        tasks: {
          test: "exit 1", // This will fail
        },
      }),
      "packages/core/deno.json": JSON.stringify({
        name: "core",
        tasks: {
          test: "echo 'Core tests passed'",
        },
      }),
    });

    // Load configuration
    const configManager = new ConfigManager();
    const loadedConfig = await configManager.loadFromPath(`${tempDir}/dream.json`);

    // Resolve dependencies
    const resolver = new DependencyResolver(loadedConfig);
    const executionPlan = resolver.resolveTestPattern("./packages/core", "test");

    // Execute with real process runner
    const runner = DreamRunner.create(tempDir);
    const summary = await runner.execute(executionPlan);

    assertEquals(summary.totalTasks, 2);
    assertEquals(summary.successfulTasks, 0);
    assertEquals(summary.failedTasks, 1);
    assertEquals(summary.skippedTasks, 1); // Core task skipped due to utils failure

    // Verify first task failed
    assertEquals(summary.results.length, 1);
    assertEquals(summary.results[0].success, false);
    assertEquals(summary.results[0].exitCode, 1);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Task Execution - optional task failure continues execution", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: [],
        },
        "./packages/core": {
          test: ["./packages/utils"],
        },
      },
      tasks: {
        test: {
          async: false,
          required: false, // Make tasks optional
          delay: 0,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({
        name: "utils",
        tasks: {
          test: "exit 1", // This will fail
        },
      }),
      "packages/core/deno.json": JSON.stringify({
        name: "core",
        tasks: {
          test: "echo 'Core tests passed'",
        },
      }),
    });

    // Load configuration
    const configManager = new ConfigManager();
    const loadedConfig = await configManager.loadFromPath(`${tempDir}/dream.json`);

    // Resolve dependencies
    const resolver = new DependencyResolver(loadedConfig);
    const executionPlan = resolver.resolveTestPattern("./packages/core", "test");

    // Execute with real process runner
    const runner = DreamRunner.create(tempDir);
    const summary = await runner.execute(executionPlan);

    assertEquals(summary.totalTasks, 2);
    assertEquals(summary.successfulTasks, 1); // Core succeeds
    assertEquals(summary.failedTasks, 1); // Utils fails
    assertEquals(summary.skippedTasks, 0); // No tasks skipped

    // Verify both tasks executed
    assertEquals(summary.results.length, 2);
    assertEquals(summary.results[0].success, false); // utils failed
    assertEquals(summary.results[1].success, true); // core succeeded
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Task Execution - with delays", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./services/database": {
          start: [],
        },
        "./services/api": {
          dev: [
            {
              projectPath: "./services/database",
              task: "start",
              async: true,
              required: true,
              delay: 100, // 100ms delay
            },
          ],
        },
      },
      tasks: {
        start: {
          async: true,
          required: true,
          delay: 0,
        },
        dev: {
          async: true,
          required: true,
          delay: 50,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "services/database/deno.json": JSON.stringify({
        name: "database",
        tasks: {
          start: "echo 'Database started'",
        },
      }),
      "services/api/deno.json": JSON.stringify({
        name: "api",
        tasks: {
          dev: "echo 'API dev server started'",
        },
      }),
    });

    // Load configuration
    const configManager = new ConfigManager();
    const loadedConfig = await configManager.loadFromPath(`${tempDir}/dream.json`);

    // Resolve dependencies
    const resolver = new DependencyResolver(loadedConfig);
    const executionPlan = resolver.resolveDevPattern("./services/api", "dev");

    // Execute with real process runner
    const startTime = Date.now();
    const runner = DreamRunner.create(tempDir);
    const summary = await runner.execute(executionPlan);
    const totalTime = Date.now() - startTime;

    assertEquals(summary.totalTasks, 2);
    assertEquals(summary.successfulTasks, 2);
    assertEquals(summary.failedTasks, 0);

    // Should take at least 150ms due to delays (100ms + 50ms)
    assertEquals(totalTime >= 150, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Task Execution - with mocked process runner", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: [],
        },
        "./packages/core": {
          test: ["./packages/utils"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({ name: "utils" }),
      "packages/core/deno.json": JSON.stringify({ name: "core" }),
    });

    // Load configuration
    const configManager = new ConfigManager();
    const loadedConfig = await configManager.loadFromPath(`${tempDir}/dream.json`);

    // Resolve dependencies
    const resolver = new DependencyResolver(loadedConfig);
    const executionPlan = resolver.resolveTestPattern("./packages/core", "test");

    // Execute with mocked process runner
    const mockRunner = new MockProcessRunner();
    mockRunner.setMockResult("deno", ["task", "test"], {
      success: true,
      exitCode: 0,
      stdout: "Mock test output",
      stderr: "",
      duration: 100,
    });

    const runner = new DreamRunner(mockRunner, tempDir);
    const summary = await runner.execute(executionPlan);

    assertEquals(summary.totalTasks, 2);
    assertEquals(summary.successfulTasks, 2);
    assertEquals(summary.failedTasks, 0);

    // Verify mock was called correctly
    const callLog = mockRunner.getCallLog();
    assertEquals(callLog.length, 2);
    assertEquals(callLog[0].command, "deno");
    assertEquals(callLog[0].args, ["task", "test"]);
    assertEquals(callLog[1].command, "deno");
    assertEquals(callLog[1].args, ["task", "test"]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Task Execution - debug output", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: [],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({
        name: "utils",
        tasks: {
          test: "echo 'Test output'",
        },
      }),
    });

    // Load configuration
    const configManager = new ConfigManager();
    const loadedConfig = await configManager.loadFromPath(`${tempDir}/dream.json`);

    // Resolve dependencies
    const resolver = new DependencyResolver(loadedConfig);
    const executionPlan = resolver.resolveTestPattern("./packages/utils", "test");

    // Capture console output
    const originalLog = console.log;
    let output = "";
    console.log = (...args: unknown[]) => {
      output += args.join(" ") + "\n";
    };

    try {
      const runner = DreamRunner.create(tempDir);
      const summary = await runner.execute(executionPlan, true); // debug = true

      assertEquals(summary.successfulTasks, 1);

      // Verify debug output
      assertStringIncludes(output, "Executing 1 tasks:");
      assertStringIncludes(output, "[1/1] Starting: ./packages/utils:test");
      assertStringIncludes(output, "✅ ./packages/utils test");
      assertStringIncludes(output, "📊 Execution Summary:");
      assertStringIncludes(output, "Total tasks: 1");
      assertStringIncludes(output, "Successful: 1");
    } finally {
      console.log = originalLog;
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
