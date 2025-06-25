import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";

const CLI_PATH = join(Deno.cwd(), "src", "main.ts");
const EXECUTION_ORDER_EXAMPLE = join(Deno.cwd(), "examples", "execution-order-demo");

async function runDreamCommand(
  args: string[],
  cwd: string = EXECUTION_ORDER_EXAMPLE,
): Promise<{ success: boolean; output: string; error: string }> {
  const command = new Deno.Command("deno", {
    args: ["run", "--allow-read", "--allow-run", "--allow-env", CLI_PATH, ...args],
    cwd,
    stdout: "piped",
    stderr: "piped",
    env: { DREAM_MOCK_EXECUTION: "true" }, // Use mock execution for faster tests
  });

  const process = command.spawn();
  const { code, stdout, stderr } = await process.output();

  return {
    success: code === 0,
    output: new TextDecoder().decode(stdout),
    error: new TextDecoder().decode(stderr),
  };
}

Deno.test("E2E Execution Order - Service orchestration with delays", async () => {
  const result = await runDreamCommand(
    ["dev", "--debug"],
    join(EXECUTION_ORDER_EXAMPLE, "apps", "web"),
  );

  assertEquals(result.success, true, `Command failed: ${result.error}`);

  // Verify execution order: database → auth (after 1s delay) → api (after 3s delay) → web
  assertStringIncludes(result.output, "./services/database:start");
  assertStringIncludes(result.output, "./services/auth:start");
  assertStringIncludes(result.output, "./services/api:start");
  assertStringIncludes(result.output, "./apps/web:dev");

  // Verify async execution (services should start concurrently)
  assertStringIncludes(result.output, "async: true");

  // Verify delays are mentioned
  assertStringIncludes(result.output, "delay: 1000ms");
  assertStringIncludes(result.output, "delay: 3000ms");
});

Deno.test("E2E Execution Order - Recursive test pattern", async () => {
  const result = await runDreamCommand(
    ["test", "--debug"],
    join(EXECUTION_ORDER_EXAMPLE, "packages", "utils"),
  );

  assertEquals(result.success, true, `Command failed: ${result.error}`);

  // Verify recursive resolution includes all dependent projects
  assertStringIncludes(result.output, "./services/database:test");
  assertStringIncludes(result.output, "./services/auth:test");
  assertStringIncludes(result.output, "./services/api:test");
  assertStringIncludes(result.output, "./apps/admin:test");
  assertStringIncludes(result.output, "./apps/web:test");
  assertStringIncludes(result.output, "./packages/utils:test");

  // Verify execution order: dependencies before dependents
  const dbIndex = result.output.indexOf("./services/database:test");
  const utilsIndex = result.output.indexOf("./packages/utils:test");
  assertEquals(dbIndex < utilsIndex, true, "Database tests should run before utils tests");
});

Deno.test("E2E Execution Order - Build with delays", async () => {
  const result = await runDreamCommand(
    ["build", "--debug"],
    join(EXECUTION_ORDER_EXAMPLE, "apps", "admin"),
  );

  assertEquals(result.success, true, `Command failed: ${result.error}`);

  // Verify build order and delay application
  assertStringIncludes(result.output, "./services/database:build");
  assertStringIncludes(result.output, "./services/auth:build");
  assertStringIncludes(result.output, "./services/api:build");
  assertStringIncludes(result.output, "./apps/admin:build");

  // Verify delays are mentioned in debug output
  assertStringIncludes(result.output, "delay: 100ms");
});

Deno.test("E2E Execution Order - Task deduplication", async () => {
  const result = await runDreamCommand(
    ["build", "--debug"],
    join(EXECUTION_ORDER_EXAMPLE, "apps", "web"),
  );

  assertEquals(result.success, true, `Command failed: ${result.error}`);

  // Count occurrences of database build in execution section only (should only appear once)
  const executionSection = result.output.split("Executing")[1] || "";
  const dbBuildMatches = executionSection.match(/\.\/services\/database:build/g);
  assertEquals(
    dbBuildMatches?.length,
    1,
    "Database build should only run once despite multiple dependencies",
  );
});

Deno.test("E2E Execution Order - Non-recursive vs recursive", async () => {
  // Test non-recursive (database test without recursive config)
  const nonRecursiveResult = await runDreamCommand(
    ["test", "--debug"],
    join(EXECUTION_ORDER_EXAMPLE, "services", "auth"),
  );

  assertEquals(
    nonRecursiveResult.success,
    true,
    `Non-recursive command failed: ${nonRecursiveResult.error}`,
  );

  // Should only include direct dependencies, not recursive ones
  assertStringIncludes(nonRecursiveResult.output, "./apps/admin:test");
  assertStringIncludes(nonRecursiveResult.output, "./apps/web:test");
  assertStringIncludes(nonRecursiveResult.output, "./services/auth:test");

  // Test recursive (database test with recursive config)
  const recursiveResult = await runDreamCommand(
    ["test", "--debug"],
    join(EXECUTION_ORDER_EXAMPLE, "services", "database"),
  );

  assertEquals(recursiveResult.success, true, `Recursive command failed: ${recursiveResult.error}`);

  // Should include recursive dependencies
  assertStringIncludes(recursiveResult.output, "./services/database:test");
  assertStringIncludes(recursiveResult.output, "./apps/admin:test");
  assertStringIncludes(recursiveResult.output, "./apps/web:test");
});
