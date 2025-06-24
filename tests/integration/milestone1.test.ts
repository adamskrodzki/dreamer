import { assertEquals, assertStringIncludes } from "@std/assert";
import { runCli } from "../utils/test_helpers.ts";

/**
 * Integration tests for Milestone 1: Basic CLI Foundation
 *
 * Deliverable: Working CLI with --help, --version, basic error handling
 * Tests verify the CLI can be executed as a real process with proper exit codes
 */
Deno.test("Milestone 1 - CLI shows help with --help flag", async () => {
  const result = await runCli(["--help"]);

  assertEquals(result.exitCode, 0, "Help should exit with code 0");
  assertStringIncludes(result.stdout, "Dream CLI v1.0.0");
  assertStringIncludes(result.stdout, "USAGE:");
  assertStringIncludes(result.stdout, "dream <task> [OPTIONS]");
  assertStringIncludes(result.stdout, "OPTIONS:");
  assertStringIncludes(result.stdout, "-h, --help");
  assertStringIncludes(result.stdout, "-v, --version");
  assertStringIncludes(result.stdout, "-d, --debug");
  assertStringIncludes(result.stdout, "EXAMPLES:");
  assertEquals(result.stderr, "", "Help should not output to stderr");
});

Deno.test("Milestone 1 - CLI shows help with -h flag", async () => {
  const result = await runCli(["-h"]);

  assertEquals(result.exitCode, 0, "Help should exit with code 0");
  assertStringIncludes(result.stdout, "Dream CLI v1.0.0");
  assertStringIncludes(result.stdout, "USAGE:");
});

Deno.test("Milestone 1 - CLI shows version with --version flag", async () => {
  const result = await runCli(["--version"]);

  assertEquals(result.exitCode, 0, "Version should exit with code 0");
  assertStringIncludes(result.stdout, "Dream CLI v1.0.0");
  assertEquals(result.stderr, "", "Version should not output to stderr");
});

Deno.test("Milestone 1 - CLI shows version with -v flag", async () => {
  const result = await runCli(["-v"]);

  assertEquals(result.exitCode, 0, "Version should exit with code 0");
  assertStringIncludes(result.stdout, "Dream CLI v1.0.0");
});

Deno.test("Milestone 1 - CLI handles no arguments with error", async () => {
  const result = await runCli([]);

  assertEquals(result.exitCode, 1, "No arguments should exit with code 1");
  assertStringIncludes(result.stderr, "Task name is required");
  assertStringIncludes(result.stderr, "Use --help to see usage information");
});

Deno.test("Milestone 1 - CLI handles invalid flags with error", async () => {
  const result = await runCli(["--invalid-flag"]);

  assertEquals(result.exitCode, 1, "Invalid flag should exit with code 1");
  assertStringIncludes(result.stderr, "Unknown option: --invalid-flag");
  assertStringIncludes(result.stderr, "Use --help to see available options");
});

Deno.test("Milestone 1 - CLI accepts valid task name", async () => {
  const result = await runCli(["test"], "examples/simple-monorepo/packages/utils");

  assertEquals(result.exitCode, 0, "Valid task should exit with code 0");
  assertStringIncludes(result.stdout, "Executing task: test");
  assertStringIncludes(result.stdout, "✅"); // Should show successful execution (mocked)
});

Deno.test("Milestone 1 - CLI handles debug flag correctly", async () => {
  const result = await runCli(["test", "--debug"], "examples/simple-monorepo/packages/utils");

  assertEquals(result.exitCode, 0, "Debug flag should exit with code 0");
  assertStringIncludes(result.stdout, "Debug: Current project path:");
  assertStringIncludes(result.stdout, "Debug: Resolved");
});

Deno.test("Milestone 1 - CLI handles debug flag with short form", async () => {
  const result = await runCli(["build", "-d"], "examples/simple-monorepo/packages/utils");

  assertEquals(result.exitCode, 0, "Debug flag should exit with code 0");
  assertStringIncludes(result.stdout, "Debug: Current project path:");
  assertStringIncludes(result.stdout, "Debug: Resolved");
});

Deno.test("Milestone 1 - CLI handles multiple flags", async () => {
  const result = await runCli(["--help", "--debug"]);

  assertEquals(result.exitCode, 0, "Multiple flags should exit with code 0");
  assertStringIncludes(result.stdout, "Dream CLI v1.0.0");
  assertStringIncludes(result.stdout, "USAGE:");
  // Help takes precedence, so debug output should not appear
});

Deno.test("Milestone 1 - CLI handles task with special characters", async () => {
  const result = await runCli(["test:unit"], "examples/simple-monorepo/packages/utils");

  assertEquals(result.exitCode, 0, "Task with special chars should succeed (mocked)");
  assertStringIncludes(result.stdout, "Executing task: test:unit");
});

Deno.test("Milestone 1 - CLI handles numeric task names", async () => {
  const result = await runCli(["123"], "examples/simple-monorepo/packages/utils");

  assertEquals(result.exitCode, 0, "Numeric task should succeed (mocked)");
  assertStringIncludes(result.stdout, "Executing task: 123");
});

Deno.test("Milestone 1 - CLI preserves additional arguments", async () => {
  const result = await runCli(["test", "arg1", "arg2", "--debug"], "examples/simple-monorepo/packages/utils");

  assertEquals(result.exitCode, 0, "Additional args should exit with code 0");
  assertStringIncludes(result.stdout, "Debug: Current project path:");
  assertStringIncludes(result.stdout, "Debug: Resolved");
});

Deno.test("Milestone 1 - CLI exit codes are correct", async () => {
  // Success cases
  const helpResult = await runCli(["--help"]);
  const versionResult = await runCli(["--version"]);
  const taskResult = await runCli(["test"], "examples/simple-monorepo/packages/utils");

  assertEquals(helpResult.exitCode, 0);
  assertEquals(versionResult.exitCode, 0);
  assertEquals(taskResult.exitCode, 0);

  // Error cases
  const noArgsResult = await runCli([]);
  const invalidFlagResult = await runCli(["--invalid"]);

  assertEquals(noArgsResult.exitCode, 1);
  assertEquals(invalidFlagResult.exitCode, 1);
});
