import { assertEquals, assertStringIncludes } from "@std/assert";
import { runCliE2E } from "../utils/test_helpers.ts";
import { join } from "@std/path";

const SIMPLE_MONOREPO_EXAMPLE = join(Deno.cwd(), "examples", "simple-monorepo");

/**
 * Run a deno task command directly for comparison
 */
async function runDenoTask(
  task: string,
  cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const command = new Deno.Command("deno", {
    args: ["task", task],
    stdout: "piped",
    stderr: "piped",
    cwd,
  });

  const process = command.spawn();
  const { code, stdout, stderr } = await process.output();

  return {
    exitCode: code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

Deno.test("E2E Output Comparison - dream test vs deno task test", async () => {
  const webAppDir = join(SIMPLE_MONOREPO_EXAMPLE, "apps", "web");

  // Run dream test
  const dreamResult = await runCliE2E(
    ["test"],
    webAppDir,
    false, // Don't mock execution
  );

  // Run deno task test
  const denoResult = await runDenoTask("test", webAppDir);

  // Both should succeed
  assertEquals(dreamResult.exitCode, 0);
  assertEquals(denoResult.exitCode, 0);

  // The core command output should be the same
  assertStringIncludes(dreamResult.stdout, "Web app tests passed");
  assertStringIncludes(denoResult.stdout, "Web app tests passed");

  // Check if task description appears in either stdout or stderr for both
  const dreamHasTaskDesc = dreamResult.stdout.includes("Task test echo") ||
    dreamResult.stderr.includes("Task test echo");
  const denoHasTaskDesc = denoResult.stdout.includes("Task test echo") ||
    denoResult.stderr.includes("Task test echo");

  // Both should have the same task description behavior
  assertEquals(dreamHasTaskDesc, denoHasTaskDesc);

  // Dream output should include execution plan (this is expected difference)
  assertStringIncludes(dreamResult.stdout, "Executing task: test");
  assertStringIncludes(dreamResult.stdout, "Execution plan: 1 tasks");

  // Dream output should include completion status (this is expected difference)
  assertStringIncludes(dreamResult.stdout, "✅ ./apps/web test");
});

Deno.test("E2E Output Comparison - warnings are preserved", async () => {
  // Create a temporary project with warnings
  const tempDir = await Deno.makeTempDir({ prefix: "dream_e2e_" });

  try {
    // Create deno.json that will generate warnings
    const denoConfig = {
      name: "test-project-with-warnings",
      tasks: {
        "warn": "echo 'Task with warnings'",
      },
    };

    await Deno.writeTextFile(
      join(tempDir, "deno.json"),
      JSON.stringify(denoConfig, null, 2),
    );

    // Create dream.json
    const dreamConfig = {
      workspace: {
        ".": {
          "warn": [],
        },
      },
      tasks: {
        "warn": {
          "async": false,
          "required": true,
          "delay": 0,
        },
      },
    };

    await Deno.writeTextFile(
      join(tempDir, "dream.json"),
      JSON.stringify(dreamConfig, null, 2),
    );

    // Run dream warn
    const dreamResult = await runCliE2E(
      ["warn"],
      tempDir,
      false,
    );

    // Run deno task warn
    const denoResult = await runDenoTask("warn", tempDir);

    // Both should succeed
    assertEquals(dreamResult.exitCode, 0);
    assertEquals(denoResult.exitCode, 0);

    // Both should show the same warnings
    const exportWarning = '"exports" field should be specified';

    // Check if warnings appear in either stdout or stderr for both
    const dreamHasWarning = dreamResult.stdout.includes(exportWarning) ||
      dreamResult.stderr.includes(exportWarning);
    const denoHasWarning = denoResult.stdout.includes(exportWarning) ||
      denoResult.stderr.includes(exportWarning);

    // Both should have the same warning behavior
    assertEquals(dreamHasWarning, denoHasWarning);

    // Both should show the task output
    assertStringIncludes(dreamResult.stdout, "Task with warnings");
    assertStringIncludes(denoResult.stdout, "Task with warnings");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("E2E Output Comparison - failing commands", async () => {
  // Create a temporary project with a failing task
  const tempDir = await Deno.makeTempDir({ prefix: "dream_e2e_fail_" });

  try {
    // Create deno.json with a failing task
    const denoConfig = {
      name: "test-project-fail",
      tasks: {
        "fail": "echo 'About to fail' && deno eval 'Deno.exit(1)'",
      },
    };

    await Deno.writeTextFile(
      join(tempDir, "deno.json"),
      JSON.stringify(denoConfig, null, 2),
    );

    // Create dream.json
    const dreamConfig = {
      workspace: {
        ".": {
          "fail": [],
        },
      },
      tasks: {
        "fail": {
          "async": false,
          "required": true,
          "delay": 0,
        },
      },
    };

    await Deno.writeTextFile(
      join(tempDir, "dream.json"),
      JSON.stringify(dreamConfig, null, 2),
    );

    // Run dream fail
    const dreamResult = await runCliE2E(
      ["fail"],
      tempDir,
      false,
    );

    // Run deno task fail
    const denoResult = await runDenoTask("fail", tempDir);

    // Both should fail with same exit code
    assertEquals(dreamResult.exitCode, 1);
    assertEquals(denoResult.exitCode, 1);

    // Both should show the output before failure
    assertStringIncludes(dreamResult.stdout, "About to fail");
    assertStringIncludes(denoResult.stdout, "About to fail");

    // Dream should show failure status (this is expected difference)
    assertStringIncludes(dreamResult.stdout, "❌ ./ fail failed (exit code 1)");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("E2E Output Comparison - multi-line output preservation", async () => {
  // Create a temporary project with multi-line output
  const tempDir = await Deno.makeTempDir({ prefix: "dream_e2e_multiline_" });

  try {
    // Create deno.json with multi-line output
    const denoConfig = {
      name: "test-multiline",
      tasks: {
        "lines": "echo 'First line' && echo 'Second line' && echo 'Third line'",
      },
    };

    await Deno.writeTextFile(
      join(tempDir, "deno.json"),
      JSON.stringify(denoConfig, null, 2),
    );

    // Create dream.json
    const dreamConfig = {
      workspace: {
        ".": {
          "lines": [],
        },
      },
      tasks: {
        "lines": {
          "async": false,
          "required": true,
          "delay": 0,
        },
      },
    };

    await Deno.writeTextFile(
      join(tempDir, "dream.json"),
      JSON.stringify(dreamConfig, null, 2),
    );

    // Run dream lines
    const dreamResult = await runCliE2E(
      ["lines"],
      tempDir,
      false,
    );

    // Run deno task lines
    const denoResult = await runDenoTask("lines", tempDir);

    // Both should succeed
    assertEquals(dreamResult.exitCode, 0);
    assertEquals(denoResult.exitCode, 0);

    // Both should preserve all lines
    const lines = ["First line", "Second line", "Third line"];

    for (const line of lines) {
      assertStringIncludes(dreamResult.stdout, line);
      assertStringIncludes(denoResult.stdout, line);
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
