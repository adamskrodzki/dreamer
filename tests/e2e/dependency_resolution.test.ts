import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { runCliE2E as runCli } from "../utils/test_helpers.ts";

/**
 * End-to-End tests for dependency resolution using real example workspaces
 * Tests the complete dependency resolution workflow with actual CLI execution
 */

Deno.test("E2E Dependency - Simple Monorepo test pattern (corrected)", async () => {
  // Test from utils package - should only execute explicitly configured dependencies
  const result = await runCli(["test"], "examples/simple-monorepo/packages/utils", true);

  assertEquals(result.exitCode, 0, "Test command should succeed");
  assertStringIncludes(result.stdout, "Executing task: test");
  assertStringIncludes(result.stdout, "Execution plan: 4 tasks");

  // Should execute explicitly configured test targets: core, ui, web, then utils
  assertStringIncludes(result.stdout, "1.  → ./packages/core test");
  assertStringIncludes(result.stdout, "2.  → ./packages/ui test");
  assertStringIncludes(result.stdout, "3.  → ./apps/web test");
  assertStringIncludes(result.stdout, "4.  → ./packages/utils test");
});

Deno.test("E2E Dependency - Simple Monorepo dev pattern", async () => {
  // Test from web app - should start dependencies then web
  const result = await runCli(["dev"], "examples/simple-monorepo/apps/web", true);

  assertEquals(result.exitCode, 0, "Dev command should succeed");
  assertStringIncludes(result.stdout, "Executing task: dev");
  assertStringIncludes(result.stdout, "Execution plan: 4 tasks");

  // Should build utils first, then start dev servers (non-recursive order)
  assertStringIncludes(result.stdout, "1.  → ./packages/utils build");
  assertStringIncludes(result.stdout, "2.  → ./packages/core dev");
  assertStringIncludes(result.stdout, "3.  → ./packages/ui dev");
  assertStringIncludes(result.stdout, "4.  → ./apps/web dev");
});

Deno.test("E2E Dependency - Simple Monorepo with debug output", async () => {
  const result = await runCli(["test", "--debug"], "examples/simple-monorepo/packages/core", true);

  assertEquals(result.exitCode, 0, "Debug test command should succeed");
  assertStringIncludes(result.stdout, "Debug: Configuration loaded successfully");
  assertStringIncludes(result.stdout, "Debug: Current project path: ./packages/core");
  assertStringIncludes(result.stdout, "Debug: Resolved");
  assertStringIncludes(result.stdout, "tasks:");

  // Should show task details with properties
  assertStringIncludes(result.stdout, "async: false, required: true, delay: 0ms");
});

Deno.test("E2E Dependency - Microservices complex dependencies", async () => {
  // Test from web app - should start all required services
  const result = await runCli(["dev"], "examples/microservices/apps/web", true);

  assertEquals(result.exitCode, 0, "Microservices dev should succeed");
  assertStringIncludes(result.stdout, "Executing task: dev");
  assertStringIncludes(result.stdout, "Execution plan: 5 tasks");

  // Should start services in non-recursive order (as specified in web app dependencies)
  assertStringIncludes(result.stdout, "1.  → ./services/database start");
  assertStringIncludes(result.stdout, "2.  → ./services/auth dev");
  assertStringIncludes(result.stdout, "3.  → ./services/api dev");
  assertStringIncludes(result.stdout, "4.  → ./services/notifications dev");
  assertStringIncludes(result.stdout, "5.  → ./apps/web dev");
});

Deno.test("E2E Dependency - Microservices test pattern", async () => {
  // Test from database service - should test database + all its clients
  const result = await runCli(["test"], "examples/microservices/services/database", true);

  assertEquals(result.exitCode, 0, "Database test should succeed");
  assertStringIncludes(result.stdout, "Execution plan: 6 tasks");

  // Should test database dependencies first, then database itself (non-recursive order)
  assertStringIncludes(result.stdout, "1.  → ./services/auth test");
  assertStringIncludes(result.stdout, "2.  → ./services/api test");
  assertStringIncludes(result.stdout, "3.  → ./services/notifications test");
  assertStringIncludes(result.stdout, "4.  → ./apps/web test");
  assertStringIncludes(result.stdout, "5.  → ./apps/mobile test");
  assertStringIncludes(result.stdout, "6.  → ./services/database test");
});

Deno.test("E2E Dependency - Microservices from deep subdirectory", async () => {
  // Test from API service subdirectory
  const result = await runCli(["dev", "--debug"], "examples/microservices/services/api", true);

  assertEquals(result.exitCode, 0, "API dev should succeed from subdirectory");
  assertStringIncludes(result.stdout, "Debug: Current project path: ./services/api");
  assertStringIncludes(result.stdout, "Debug: Resolved 3 tasks:");

  // Should start database, then auth, then api (non-recursive order)
  assertStringIncludes(result.stdout, "./services/database:start");
  assertStringIncludes(result.stdout, "./services/auth:dev");
  assertStringIncludes(result.stdout, "./services/api:dev");
});

Deno.test("E2E Dependency - Different task types", async () => {
  // Test build task from simple monorepo
  const result = await runCli(["build"], "examples/simple-monorepo/packages/core", true);

  assertEquals(result.exitCode, 0, "Build command should succeed");
  assertStringIncludes(result.stdout, "Executing task: build");

  // Build should not use test pattern, just regular dependency resolution
  assertStringIncludes(result.stdout, "1.  → ./packages/core build");
});

Deno.test("E2E Dependency - No dependencies scenario", async () => {
  // Test from a project with no dependencies
  const result = await runCli(["test"], "examples/simple-monorepo/packages/utils", true);

  assertEquals(result.exitCode, 0, "No dependencies test should succeed");

  // Should still test the project + its clients
  assertStringIncludes(result.stdout, "Execution plan:");
  assertStringIncludes(result.stdout, "4.  → ./packages/utils test");
});

Deno.test("E2E Dependency - Task execution order verification", async () => {
  // Test complex dependency chain
  const result = await runCli(["dev"], "examples/microservices/apps/mobile", true);

  assertEquals(result.exitCode, 0, "Mobile dev should succeed");
  assertStringIncludes(result.stdout, "Execution plan: 4 tasks");

  // Verify execution order: database first, then auth, then api, then mobile (non-recursive order)
  assertStringIncludes(result.stdout, "1.  → ./services/database start");
  assertStringIncludes(result.stdout, "2.  → ./services/auth dev");
  assertStringIncludes(result.stdout, "3.  → ./services/api dev");
  assertStringIncludes(result.stdout, "4.  → ./apps/mobile dev");
});

Deno.test("E2E Dependency - Workspace root detection", async () => {
  // Test from workspace root
  const result = await runCli(["test", "--debug"], "examples/simple-monorepo", true);

  assertEquals(result.exitCode, 0, "Workspace root test should succeed");
  assertStringIncludes(result.stdout, "Debug: Current project path: ./");

  // Should execute test for the workspace root project
  assertStringIncludes(result.stdout, "Debug: Resolved");
});

Deno.test("E2E Dependency - Error handling for circular dependencies", async () => {
  // Create a temporary config with circular dependencies
  const tempDir = await Deno.makeTempDir();

  try {
    const circularConfig = {
      workspace: {
        "./packages/a": {
          test: ["./packages/b"],
        },
        "./packages/b": {
          test: ["./packages/a"],
        },
      },
      recursive: [
        {
          project: "./packages/a",
          tasks: ["test"],
        },
      ],
    };

    await Deno.writeTextFile(`${tempDir}/dream.json`, JSON.stringify(circularConfig, null, 2));
    await Deno.mkdir(`${tempDir}/packages/a`, { recursive: true });
    await Deno.writeTextFile(`${tempDir}/packages/a/deno.json`, JSON.stringify({ name: "a" }));

    const result = await runCli(["test"], `${tempDir}/packages/a`);

    assertEquals(result.exitCode, 1, "Circular dependency should cause failure");
    assertStringIncludes(result.stderr, "Dependency Error:");
    assertStringIncludes(result.stderr, "Circular dependency detected");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("E2E Dependency - Mixed dependency formats", async () => {
  // Test microservices which uses detailed dependency format
  const result = await runCli(["dev", "--debug"], "examples/microservices/services/auth", true);

  assertEquals(result.exitCode, 0, "Mixed format dependencies should work");
  assertStringIncludes(result.stdout, "Debug: Resolved 2 tasks:");

  // Should show database start task (detailed dependency) and auth dev
  assertStringIncludes(result.stdout, "./services/database:start");
  assertStringIncludes(result.stdout, "./services/auth:dev");

  // Verify task properties from detailed dependencies
  assertStringIncludes(result.stdout, "async: true, required: true, delay: 0ms");
});

Deno.test("E2E Dependency - Task defaults application", async () => {
  const result = await runCli(["dev", "--debug"], "examples/microservices/apps/web", true);

  assertEquals(result.exitCode, 0, "Task defaults should be applied");

  // Verify different task types have correct defaults
  assertStringIncludes(result.stdout, "start (async: true, required: true, delay: 0ms)");
  assertStringIncludes(result.stdout, "dev (async: true, required: false, delay: 1000ms)");
});

Deno.test("E2E Dependency - Database test order verification (non-recursive)", async () => {
  // Test from database service - should test in non-recursive order
  const result = await runCli(["test"], "examples/microservices/services/database", true);

  assertEquals(result.exitCode, 0, "Database test should succeed");
  assertStringIncludes(result.stdout, "Execution plan: 6 tasks");

  const lines = result.stdout.split('\n').filter(line => line.includes('→'));

  // Verify execution order based on non-recursive dependency resolution:
  // Database depends on: ["./services/auth", "./services/api", "./services/notifications", "./apps/web", "./apps/mobile"]
  // Non-recursive means dependencies run in the order specified, then the project itself

  assertEquals(lines.length >= 6, true, "Should have at least 6 execution steps");
  assertStringIncludes(lines[0], "1.  → ./services/auth test");
  assertStringIncludes(lines[1], "2.  → ./services/api test");
  assertStringIncludes(lines[2], "3.  → ./services/notifications test");
  assertStringIncludes(lines[3], "4.  → ./apps/web test");
  assertStringIncludes(lines[4], "5.  → ./apps/mobile test");
  assertStringIncludes(lines[5], "6.  → ./services/database test");
});

Deno.test("E2E Dependency - Web app test (no dependencies)", async () => {
  // Test from web app - has no test dependencies, should only test itself
  const result = await runCli(["test"], "examples/microservices/apps/web", true);

  assertEquals(result.exitCode, 0, "Web app test should succeed");
  assertStringIncludes(result.stdout, "Execution plan: 1 tasks");

  // Web app has no test dependencies, so should only test itself
  assertStringIncludes(result.stdout, "1.  → ./apps/web test");
});

Deno.test("E2E Dependency - Microservices current configuration comprehensive test", async () => {
  // Test all microservices projects with current configuration

  // 1. Web app - no test dependencies, should only test itself
  const webResult = await runCli(["test"], "examples/microservices/apps/web", true);
  assertEquals(webResult.exitCode, 0, "Web app test should succeed");
  assertStringIncludes(webResult.stdout, "Execution plan: 1 tasks");
  assertStringIncludes(webResult.stdout, "1.  → ./apps/web test");

  // 2. Mobile app - no test dependencies, should only test itself
  const mobileResult = await runCli(["test"], "examples/microservices/apps/mobile", true);
  assertEquals(mobileResult.exitCode, 0, "Mobile app test should succeed");
  assertStringIncludes(mobileResult.stdout, "Execution plan: 1 tasks");
  assertStringIncludes(mobileResult.stdout, "1.  → ./apps/mobile test");

  // 3. Database service - has test dependencies, should test dependencies + clients
  const dbResult = await runCli(["test"], "examples/microservices/services/database", true);
  assertEquals(dbResult.exitCode, 0, "Database test should succeed");
  assertStringIncludes(dbResult.stdout, "Execution plan: 6 tasks");
  assertStringIncludes(dbResult.stdout, "1.  → ./services/auth test");
  assertStringIncludes(dbResult.stdout, "2.  → ./services/api test");
  assertStringIncludes(dbResult.stdout, "3.  → ./services/notifications test");
  assertStringIncludes(dbResult.stdout, "4.  → ./apps/web test");
  assertStringIncludes(dbResult.stdout, "5.  → ./apps/mobile test");
  assertStringIncludes(dbResult.stdout, "6.  → ./services/database test");

  // 4. Auth service - has test dependencies, should test dependencies + clients (with recursive resolution)
  const authResult = await runCli(["test"], "examples/microservices/services/auth", true);
  assertEquals(authResult.exitCode, 0, "Auth test should succeed");
  // Auth is configured for recursive resolution, so it will resolve API's dependencies first
  assertStringIncludes(authResult.stdout, "Execution plan:");
  assertStringIncludes(authResult.stdout, "→ ./services/auth test");

  // 5. API service - has test dependencies, should test dependencies + clients
  const apiResult = await runCli(["test"], "examples/microservices/services/api", true);
  assertEquals(apiResult.exitCode, 0, "API test should succeed");
  assertStringIncludes(apiResult.stdout, "Execution plan:");
  assertStringIncludes(apiResult.stdout, "→ ./services/api test");

  // 6. Notifications service - has test dependencies, should test dependencies + clients
  const notifResult = await runCli(["test"], "examples/microservices/services/notifications", true);
  assertEquals(notifResult.exitCode, 0, "Notifications test should succeed");
  assertStringIncludes(notifResult.stdout, "Execution plan:");
  assertStringIncludes(notifResult.stdout, "→ ./services/notifications test");
});

Deno.test("E2E Task Execution - Real task execution with success", async () => {
  // Create a temporary workspace with real deno tasks
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

    // Create workspace with real deno.json files and tasks
    await Deno.mkdir(`${tempDir}/packages/utils`, { recursive: true });
    await Deno.mkdir(`${tempDir}/packages/core`, { recursive: true });

    await Deno.writeTextFile(`${tempDir}/dream.json`, JSON.stringify(config, null, 2));

    await Deno.writeTextFile(`${tempDir}/packages/utils/deno.json`, JSON.stringify({
      name: "utils",
      tasks: {
        test: "echo 'Utils tests passed'",
      },
    }));

    await Deno.writeTextFile(`${tempDir}/packages/core/deno.json`, JSON.stringify({
      name: "core",
      tasks: {
        test: "echo 'Core tests passed'",
      },
    }));

    // Run dream test from core package
    const result = await runCli(["test"], `${tempDir}/packages/core`);

    assertEquals(result.exitCode, 0, "Task execution should succeed");
    assertStringIncludes(result.stdout, "Execution plan: 2 tasks");
    assertStringIncludes(result.stdout, "1.  → ./packages/utils test");
    assertStringIncludes(result.stdout, "2.  → ./packages/core test");
    assertStringIncludes(result.stdout, "✅ ./packages/utils test");
    assertStringIncludes(result.stdout, "✅ ./packages/core test");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("E2E Task Execution - Real task execution with failure", async () => {
  // Create a temporary workspace with a failing task
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

    // Create workspace with real deno.json files and tasks
    await Deno.mkdir(`${tempDir}/packages/utils`, { recursive: true });
    await Deno.mkdir(`${tempDir}/packages/core`, { recursive: true });

    await Deno.writeTextFile(`${tempDir}/dream.json`, JSON.stringify(config, null, 2));

    await Deno.writeTextFile(`${tempDir}/packages/utils/deno.json`, JSON.stringify({
      name: "utils",
      tasks: {
        test: "exit 1", // This will fail
      },
    }));

    await Deno.writeTextFile(`${tempDir}/packages/core/deno.json`, JSON.stringify({
      name: "core",
      tasks: {
        test: "echo 'Core tests passed'",
      },
    }));

    // Run dream test from core package
    const result = await runCli(["test"], `${tempDir}/packages/core`);

    assertEquals(result.exitCode, 1, "Task execution should fail");
    assertStringIncludes(result.stdout, "Execution plan: 2 tasks");
    assertStringIncludes(result.stdout, "1.  → ./packages/utils test");
    assertStringIncludes(result.stdout, "2.  → ./packages/core test");
    assertStringIncludes(result.stdout, "❌ ./packages/utils test failed");
    // Core task should not execute (no success message for core)
    assertEquals(result.stdout.includes("✅ ./packages/core test"), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("E2E Task Execution - Debug output shows execution details", async () => {
  // Create a temporary workspace
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: [],
        },
      },
      tasks: {
        test: {
          async: false,
          required: true,
          delay: 100, // Add delay to test timing
        },
      },
    };

    await Deno.mkdir(`${tempDir}/packages/utils`, { recursive: true });

    await Deno.writeTextFile(`${tempDir}/dream.json`, JSON.stringify(config, null, 2));

    await Deno.writeTextFile(`${tempDir}/packages/utils/deno.json`, JSON.stringify({
      name: "utils",
      tasks: {
        test: "echo 'Test output'",
      },
    }));

    // Run dream test with debug flag
    const result = await runCli(["test", "--debug"], `${tempDir}/packages/utils`);

    assertEquals(result.exitCode, 0, "Debug execution should succeed");
    assertStringIncludes(result.stdout, "Executing 1 tasks:");
    assertStringIncludes(result.stdout, "[1/1] Starting: ./packages/utils:test");
    assertStringIncludes(result.stdout, "Waiting 100ms before execution");
    assertStringIncludes(result.stdout, "✅ ./packages/utils test");
    assertStringIncludes(result.stdout, "Test output");
    assertStringIncludes(result.stdout, "📊 Execution Summary:");
    assertStringIncludes(result.stdout, "Total tasks: 1");
    assertStringIncludes(result.stdout, "Successful: 1");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("E2E Dependency - Help shows dependency resolution info (corrected)", async () => {
  const result = await runCli(["--help"], "examples/simple-monorepo");

  assertEquals(result.exitCode, 0, "Help should work");
  assertStringIncludes(result.stdout, "dream test");
  assertStringIncludes(result.stdout, "Test configured dependencies + current project");
  assertStringIncludes(result.stdout, "dream dev");
  assertStringIncludes(result.stdout, "Start required services + current project dev");
});
