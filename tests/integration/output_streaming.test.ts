import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { runCli } from "../utils/test_helpers.ts";
import { join } from "jsr:@std/path@^1.0.0";

Deno.test("Output Streaming - stdout is displayed in real-time", async () => {
  // Use relative path from project root
  const webAppDir = "examples/simple-monorepo/apps/web";

  const result = await runCli(
    ["test"],
    webAppDir,
    false, // Don't mock execution - we want real output
  );

  assertEquals(result.exitCode, 0);

  // Verify that actual command output is displayed
  assertStringIncludes(result.stdout, "Web app tests passed");

  // Verify execution plan is still shown
  assertStringIncludes(result.stdout, "Executing task: test");
  assertStringIncludes(result.stdout, "Execution plan: 1 tasks");

  // Verify completion status is shown
  assertStringIncludes(result.stdout, "✅ ./apps/web test");
});

Deno.test("Output Streaming - stderr is displayed for failing commands", async () => {
  // Create a temporary project with a failing task
  const tempDir = await Deno.makeTempDir({ prefix: "dream_test_" });

  try {
    // Create deno.json with a failing task
    const denoConfig = {
      name: "test-project",
      tasks: {
        "fail": "echo This will fail && deno eval 'Deno.exit(1)'",
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

    const result = await runCli(
      ["fail"],
      tempDir,
      false, // Don't mock execution
    );

    assertEquals(result.exitCode, 1);

    // Verify that stdout from failing command is displayed
    assertStringIncludes(result.stdout, "This will fail");

    // Verify failure status is shown
    assertStringIncludes(result.stdout, "❌ ./ fail failed (exit code 1)");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Output Streaming - multi-line output is preserved", async () => {
  // Create a temporary project with multi-line output
  const tempDir = await Deno.makeTempDir({ prefix: "dream_test_" });

  try {
    // Create deno.json with a multi-line output task
    const denoConfig = {
      name: "test-project",
      tasks: {
        "multiline": "echo Line 1 && echo Line 2 && echo Line 3",
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
          "multiline": [],
        },
      },
      tasks: {
        "multiline": {
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

    const result = await runCli(
      ["multiline"],
      tempDir,
      false, // Don't mock execution
    );

    assertEquals(result.exitCode, 0);

    // Verify all lines are displayed
    assertStringIncludes(result.stdout, "Line 1");
    assertStringIncludes(result.stdout, "Line 2");
    assertStringIncludes(result.stdout, "Line 3");

    // Verify completion status
    assertStringIncludes(result.stdout, "✅ ./ multiline");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Output Streaming - mixed stdout and stderr", async () => {
  // Create a temporary project with mixed output
  const tempDir = await Deno.makeTempDir({ prefix: "dream_test_" });

  try {
    // Create deno.json with a task that outputs to both stdout and stderr
    const denoConfig = {
      name: "test-project",
      tasks: {
        "mixed": "echo stdout message && deno eval 'console.error(\"stderr message\")'",
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
          "mixed": [],
        },
      },
      tasks: {
        "mixed": {
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

    const result = await runCli(
      ["mixed"],
      tempDir,
      false, // Don't mock execution
    );

    assertEquals(result.exitCode, 0);

    // Verify stdout message is displayed
    assertStringIncludes(result.stdout, "stdout message");

    // Verify stderr message is displayed (it should appear in stderr)
    assertStringIncludes(result.stderr, "stderr message");

    // Verify completion status
    assertStringIncludes(result.stdout, "✅ ./ mixed");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Output Streaming - output is captured for result processing", async () => {
  // This test verifies that even though we stream output, it's still captured
  // for result processing (this is important for programmatic use)

  const tempDir = await Deno.makeTempDir({ prefix: "dream_test_" });

  try {
    // Create deno.json with a task that has specific output
    const denoConfig = {
      name: "test-project",
      tasks: {
        "capture": "echo 'Captured output ready'",
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
          "capture": [],
        },
      },
      tasks: {
        "capture": {
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

    const result = await runCli(
      ["capture"],
      tempDir,
      false, // Don't mock execution
    );

    assertEquals(result.exitCode, 0);

    // Verify output is displayed during execution
    assertStringIncludes(result.stdout, "Captured output ready");

    // Verify completion status
    assertStringIncludes(result.stdout, "✅ ./ capture");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
