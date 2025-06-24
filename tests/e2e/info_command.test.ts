import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { runCliInfoE2E as runCliInfo } from "../utils/test_helpers.ts";

/**
 * End-to-End tests for the --info command
 * Tests the complete --info functionality using real example workspaces
 */

Deno.test("E2E Info - Simple Monorepo from workspace root", async () => {
  const workspaceRoot = "examples/simple-monorepo";
  const result = await runCliInfo(workspaceRoot);

  assertEquals(result.exitCode, 0, "Info command should succeed");
  
  // Verify basic info output
  assertStringIncludes(result.stdout, "Dream CLI v1.0.0 - Configuration Discovery Information");
  assertStringIncludes(result.stdout, "Current Working Directory:");
  assertStringIncludes(result.stdout, "✅ Configuration Found:");
  assertStringIncludes(result.stdout, "✅ Workspace Root:");
  assertStringIncludes(result.stdout, "✅ Configuration Valid: 4 projects configured");
  
  // Verify workspace projects are listed
  assertStringIncludes(result.stdout, "Workspace Projects:");
  assertStringIncludes(result.stdout, "./packages/utils (tasks: test, build)");
  assertStringIncludes(result.stdout, "./packages/core (tasks: test, build, dev)");
  assertStringIncludes(result.stdout, "./packages/ui (tasks: test, build, dev)");
  assertStringIncludes(result.stdout, "./apps/web (tasks: test, build, dev)");
  
  // Verify task defaults are shown
  assertStringIncludes(result.stdout, "Task Defaults:");
  assertStringIncludes(result.stdout, "test: async=false, required=true, delay=0ms");
  assertStringIncludes(result.stdout, "build: async=false, required=true, delay=0ms");
  assertStringIncludes(result.stdout, "dev: async=false, required=true, delay=0ms");
  
  // Should not have stderr output
  assertEquals(result.stderr, "");
});

Deno.test("E2E Info - Simple Monorepo from subdirectory", async () => {
  const subDirectory = "examples/simple-monorepo/packages/utils";
  const result = await runCliInfo(subDirectory);

  assertEquals(result.exitCode, 0, "Info command should succeed from subdirectory");
  
  // Verify it found the config in parent directory
  assertStringIncludes(result.stdout, "✅ Configuration Found:");
  assertStringIncludes(result.stdout, "dream.json");
  assertStringIncludes(result.stdout, "✅ Workspace Root:");
  assertStringIncludes(result.stdout, "simple-monorepo");
  
  // Verify current working directory shows subdirectory
  assertStringIncludes(result.stdout, "packages/utils");
  
  // Verify all projects are still listed
  assertStringIncludes(result.stdout, "✅ Configuration Valid: 4 projects configured");
  assertStringIncludes(result.stdout, "./packages/utils");
  assertStringIncludes(result.stdout, "./packages/core");
  assertStringIncludes(result.stdout, "./packages/ui");
  assertStringIncludes(result.stdout, "./apps/web");
});

Deno.test("E2E Info - Microservices workspace", async () => {
  const workspaceRoot = "examples/microservices";
  const result = await runCliInfo(workspaceRoot);

  assertEquals(result.exitCode, 0, "Info command should succeed for microservices");
  
  // Verify microservices configuration
  assertStringIncludes(result.stdout, "✅ Configuration Valid: 6 projects configured");
  
  // Verify all services are listed
  assertStringIncludes(result.stdout, "./services/database");
  assertStringIncludes(result.stdout, "./services/auth");
  assertStringIncludes(result.stdout, "./services/api");
  assertStringIncludes(result.stdout, "./services/notifications");
  assertStringIncludes(result.stdout, "./apps/web");
  assertStringIncludes(result.stdout, "./apps/mobile");
  
  // Verify task defaults include start task
  assertStringIncludes(result.stdout, "start: async=true, required=true, delay=0ms");
  assertStringIncludes(result.stdout, "dev: async=true, required=false, delay=1000ms");
});

Deno.test("E2E Info - Microservices from deep subdirectory", async () => {
  const deepSubDirectory = "examples/microservices/services/api";
  const result = await runCliInfo(deepSubDirectory);

  assertEquals(result.exitCode, 0, "Info command should succeed from deep subdirectory");
  
  // Verify it found the config in workspace root
  assertStringIncludes(result.stdout, "✅ Configuration Found:");
  assertStringIncludes(result.stdout, "dream.json");
  
  // Verify current working directory shows deep path
  assertStringIncludes(result.stdout, "services/api");
  
  // Verify all projects are found
  assertStringIncludes(result.stdout, "✅ Configuration Valid: 6 projects configured");
});

Deno.test("E2E Info - Missing configuration error", async () => {
  // Create a temporary directory outside the project to test missing config
  const tempDir = await Deno.makeTempDir();

  try {
    const result = await runCliInfo(tempDir);

    assertEquals(result.exitCode, 1, "Info command should fail when no config found");

    // Verify error message
    assertStringIncludes(result.stdout, "❌ Configuration Error:");
    assertStringIncludes(result.stdout, "No dream.json configuration file found");

    // Verify search path is shown
    assertStringIncludes(result.stdout, "Configuration Search Path:");
    assertStringIncludes(result.stdout, "dream.json");

    // Verify helpful instructions
    assertStringIncludes(result.stdout, "To fix this issue:");
    assertStringIncludes(result.stdout, "1. Create a dream.json file in your workspace root");
    assertStringIncludes(result.stdout, "2. Ensure it's in the same directory as your workspace deno.json");
    assertStringIncludes(result.stdout, "3. Use the examples in the documentation for reference");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("E2E Info - Mislocated config discovery", async () => {
  const subDirWithMislocatedConfig = "examples/mislocated-config/packages/auth";
  const result = await runCliInfo(subDirWithMislocatedConfig);

  // This should find the mislocated config in packages/ directory
  assertEquals(result.exitCode, 0, "Should find mislocated config");
  
  // Verify it found the config in packages directory
  assertStringIncludes(result.stdout, "✅ Configuration Found:");
  assertStringIncludes(result.stdout, "dream.json");
  
  // Verify workspace root is packages directory (not ideal but working)
  assertStringIncludes(result.stdout, "✅ Workspace Root:");
  assertStringIncludes(result.stdout, "packages");
});

Deno.test("E2E Info - Configuration validation", async () => {
  const workspaceRoot = "examples/simple-monorepo";
  const result = await runCliInfo(workspaceRoot);

  assertEquals(result.exitCode, 0, "Info command should succeed");
  
  // Verify detailed project task information
  assertStringIncludes(result.stdout, "./packages/utils (tasks: test, build)");
  assertStringIncludes(result.stdout, "./packages/core (tasks: test, build, dev)");
  assertStringIncludes(result.stdout, "./packages/ui (tasks: test, build, dev)");
  assertStringIncludes(result.stdout, "./apps/web (tasks: test, build, dev)");
  
  // Verify task defaults are properly formatted
  assertStringIncludes(result.stdout, "test: async=false, required=true, delay=0ms");
  assertStringIncludes(result.stdout, "build: async=false, required=true, delay=0ms");
  assertStringIncludes(result.stdout, "dev: async=false, required=true, delay=0ms");
});

Deno.test("E2E Info - Help flag shows info option", async () => {
  const command = new Deno.Command("dream", {
    args: ["--help"],
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();
  const { code, stdout } = await process.output();
  const output = new TextDecoder().decode(stdout);

  assertEquals(code, 0, "Help command should succeed");
  assertStringIncludes(output, "-i, --info");
  assertStringIncludes(output, "Show configuration discovery and workspace information");
});

Deno.test("E2E Info - Short flag -i works", async () => {
  // Use the helper but with -i flag instead of --info
  const command = new Deno.Command("dream", {
    args: ["-i"],
    stdout: "piped",
    stderr: "piped",
    cwd: "examples/simple-monorepo",
  });

  const process = command.spawn();
  const { code, stdout } = await process.output();
  const output = new TextDecoder().decode(stdout);

  assertEquals(code, 0, "Short -i flag should work");
  assertStringIncludes(output, "Dream CLI v1.0.0 - Configuration Discovery Information");
  assertStringIncludes(output, "✅ Configuration Found:");
});

Deno.test("E2E Info - Complex microservices configuration details", async () => {
  const workspaceRoot = "examples/microservices";
  const result = await runCliInfo(workspaceRoot);

  assertEquals(result.exitCode, 0, "Info command should succeed");
  
  // Verify complex task configurations are shown
  assertStringIncludes(result.stdout, "./services/database (tasks: test, dev, build, start)");
  assertStringIncludes(result.stdout, "./services/auth (tasks: test, dev, build)");
  assertStringIncludes(result.stdout, "./services/api (tasks: test, dev, build)");
  assertStringIncludes(result.stdout, "./services/notifications (tasks: test, dev, build)");
  assertStringIncludes(result.stdout, "./apps/web (tasks: test, dev, build)");
  assertStringIncludes(result.stdout, "./apps/mobile (tasks: test, dev, build)");
  
  // Verify task defaults include all task types
  assertStringIncludes(result.stdout, "test: async=false, required=true, delay=0ms");
  assertStringIncludes(result.stdout, "dev: async=true, required=false, delay=1000ms");
  assertStringIncludes(result.stdout, "build: async=false, required=true, delay=500ms");
  assertStringIncludes(result.stdout, "start: async=true, required=true, delay=0ms");
});
