/**
 * Shared test utilities for Dream CLI tests
 * 
 * This module provides common test helper functions to ensure consistency
 * across all test files and avoid code duplication.
 */

/**
 * Standard runCli function for integration tests
 * 
 * @param args - CLI arguments to pass to the dream command
 * @param cwd - Working directory relative to project root (optional)
 * @param mockExecution - Whether to enable execution mocking (default: true)
 * @returns Promise with exit code, stdout, and stderr
 */
export async function runCli(
  args: string[], 
  cwd?: string, 
  mockExecution: boolean = true
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const projectRoot = Deno.cwd();
  const workingDir = cwd ? `${projectRoot}/${cwd}` : projectRoot;
  const mainPath = `${projectRoot}/src/main.ts`;

  const command = new Deno.Command("deno", {
    args: ["run", "--allow-read", "--allow-run", "--allow-env", mainPath, ...args],
    stdout: "piped",
    stderr: "piped",
    cwd: workingDir,
    env: {
      ...Deno.env.toObject(),
      DREAM_MOCK_EXECUTION: mockExecution ? "true" : "false",
    },
  });

  const process = command.spawn();
  const { code, stdout, stderr } = await process.output();

  return {
    exitCode: code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

/**
 * E2E runCli function for end-to-end tests using the installed dream command
 * 
 * @param args - CLI arguments to pass to the dream command
 * @param cwd - Working directory for the command
 * @param mockExecution - Whether to enable execution mocking (default: false for E2E)
 * @returns Promise with exit code, stdout, and stderr
 */
export async function runCliE2E(
  args: string[], 
  cwd: string, 
  mockExecution: boolean = false
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const command = new Deno.Command("dream", {
    args,
    stdout: "piped",
    stderr: "piped",
    cwd,
    env: {
      ...Deno.env.toObject(),
      DREAM_MOCK_EXECUTION: mockExecution ? "true" : "false",
    },
  });

  const process = command.spawn();
  const { code, stdout, stderr } = await process.output();

  return {
    exitCode: code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

/**
 * Specialized runCli function for --info command testing
 * 
 * @param cwd - Working directory for the command
 * @returns Promise with exit code, stdout, and stderr
 */
export async function runCliInfo(cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return runCli(["--info"], cwd, false); // Info command doesn't need mocking
}

/**
 * Specialized E2E runCli function for --info command testing
 * 
 * @param cwd - Working directory for the command
 * @returns Promise with exit code, stdout, and stderr
 */
export async function runCliInfoE2E(cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const command = new Deno.Command("dream", {
    args: ["--info"],
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
