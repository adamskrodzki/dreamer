import { assertEquals, assertStringIncludes } from "@std/assert";
import { parseCliArgs, main } from "../../src/main.ts";

Deno.test("CLI - parseCliArgs with task only", () => {
  const result = parseCliArgs(["test"]);

  assertEquals(result.task, "test");
  assertEquals(result.help, false);
  assertEquals(result.version, false);
  assertEquals(result.debug, false);
  assertEquals(result._.length, 0);
});

Deno.test("CLI - parseCliArgs with help flag", () => {
  const result1 = parseCliArgs(["--help"]);
  const result2 = parseCliArgs(["-h"]);

  assertEquals(result1.help, true);
  assertEquals(result1.task, undefined);
  assertEquals(result2.help, true);
  assertEquals(result2.task, undefined);
});

Deno.test("CLI - parseCliArgs with version flag", () => {
  const result1 = parseCliArgs(["--version"]);
  const result2 = parseCliArgs(["-v"]);

  assertEquals(result1.version, true);
  assertEquals(result1.task, undefined);
  assertEquals(result2.version, true);
  assertEquals(result2.task, undefined);
});

Deno.test("CLI - parseCliArgs with debug flag", () => {
  const result1 = parseCliArgs(["test", "--debug"]);
  const result2 = parseCliArgs(["build", "-d"]);

  assertEquals(result1.task, "test");
  assertEquals(result1.debug, true);
  assertEquals(result2.task, "build");
  assertEquals(result2.debug, true);
});

Deno.test("CLI - parseCliArgs with info flag", () => {
  const result1 = parseCliArgs(["--info"]);
  const result2 = parseCliArgs(["-i"]);

  assertEquals(result1.info, true);
  assertEquals(result1.task, undefined);
  assertEquals(result2.info, true);
  assertEquals(result2.task, undefined);
});

Deno.test("CLI - parseCliArgs with info and other flags", () => {
  const result = parseCliArgs(["--info", "--debug"]);

  assertEquals(result.info, true);
  assertEquals(result.debug, true);
  assertEquals(result.task, undefined);
});

Deno.test("CLI - parseCliArgs with multiple flags", () => {
  const result = parseCliArgs(["test", "--debug", "--help"]);

  assertEquals(result.task, "test");
  assertEquals(result.debug, true);
  assertEquals(result.help, true);
  assertEquals(result.version, false);
});

Deno.test("CLI - parseCliArgs with additional arguments", () => {
  const result = parseCliArgs(["test", "arg1", "arg2", "--debug"]);

  assertEquals(result.task, "test");
  assertEquals(result.debug, true);
  assertEquals(result._.length, 2);
  assertEquals(result._[0], "arg1");
  assertEquals(result._[1], "arg2");
});

Deno.test("CLI - parseCliArgs with no arguments", () => {
  const result = parseCliArgs([]);

  assertEquals(result.task, undefined);
  assertEquals(result.help, false);
  assertEquals(result.version, false);
  assertEquals(result.debug, false);
  assertEquals(result._.length, 0);
});

Deno.test("CLI - parseCliArgs with numeric task name", () => {
  const result = parseCliArgs(["123"]);

  assertEquals(result.task, "123");
});

Deno.test("CLI - parseCliArgs with special characters in task", () => {
  const result = parseCliArgs(["test:unit"]);

  assertEquals(result.task, "test:unit");
});

// Integration tests for main function
Deno.test("CLI - main function with help flag", async () => {
  // Capture console output
  const originalLog = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.join(" ") + "\n";
  };

  try {
    const exitCode = await main(["--help"]);
    assertEquals(exitCode, 0);
    assertStringIncludes(output, "Dream CLI");
    assertStringIncludes(output, "USAGE:");
    assertStringIncludes(output, "OPTIONS:");
  } finally {
    console.log = originalLog;
  }
});

Deno.test("CLI - main function with version flag", async () => {
  const originalLog = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.join(" ") + "\n";
  };

  try {
    const exitCode = await main(["--version"]);
    assertEquals(exitCode, 0);
    assertStringIncludes(output, "Dream CLI v1.0.0");
  } finally {
    console.log = originalLog;
  }
});

Deno.test("CLI - main function with no arguments", async () => {
  const originalError = console.error;
  let errorOutput = "";
  console.error = (...args: unknown[]) => {
    errorOutput += args.join(" ") + "\n";
  };

  try {
    const exitCode = await main([]);
    assertEquals(exitCode, 1);
    assertStringIncludes(errorOutput, "Task name is required");
  } finally {
    console.error = originalError;
  }
});

// Note: Main function tests that execute real tasks are moved to integration tests
// These unit tests focus on the CLI parsing and basic functionality

Deno.test("CLI - main function with info flag", async () => {
  const originalLog = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.join(" ") + "\n";
  };

  try {
    const exitCode = await main(["--info"]);
    assertEquals(exitCode, 0);
    assertStringIncludes(output, "Configuration Discovery");
    assertStringIncludes(output, "Workspace Root:");
  } finally {
    console.log = originalLog;
  }
});

Deno.test("CLI - main function with help flag", async () => {
  const originalLog = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.join(" ") + "\n";
  };

  try {
    const exitCode = await main(["--help"]);
    assertEquals(exitCode, 0);
    assertStringIncludes(output, "Dream CLI");
    assertStringIncludes(output, "USAGE:");
  } finally {
    console.log = originalLog;
  }
});
