import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { runCli } from "../utils/test_helpers.ts";

/**
 * Integration tests for Milestone 2: Configuration Discovery
 *
 * Deliverable: CLI can find dream.json, validate it, show config with --debug flag
 * Tests verify the complete configuration discovery and loading workflow
 */

async function createTestWorkspace(baseDir: string, files: Record<string, string>): Promise<void> {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = `${baseDir}/${filePath}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    
    try {
      await Deno.mkdir(dir, { recursive: true });
    } catch {
      // Directory might already exist
    }
    
    await Deno.writeTextFile(fullPath, content);
  }
}

Deno.test("Milestone 2 - CLI finds dream.json in current directory", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/auth": {
          test: ["./services/api"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
    });

    const result = await runCli(["test", "--debug"], tempDir);

    assertEquals(result.exitCode, 0, "CLI should successfully find and load config");
    assertStringIncludes(result.stdout, "Debug: Configuration loaded successfully");
    assertStringIncludes(result.stdout, "Debug: Workspace root:");
    assertStringIncludes(result.stdout, "./packages/auth");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Milestone 2 - CLI finds dream.json in parent directory", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/utils": {
          build: ["./packages/shared"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/README.md": "# Utils Package",
      "packages/shared/README.md": "# Shared Package",
    });

    // Run from subdirectory - should find config in parent
    const result = await runCli(["build", "--debug"], `${tempDir}/packages/utils`);

    assertEquals(result.exitCode, 0, "CLI should find config in parent directory");
    assertStringIncludes(result.stdout, "Debug: Configuration loaded successfully");
    assertStringIncludes(result.stdout, "./packages/utils");
    assertStringIncludes(result.stdout, "./packages/shared");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Milestone 2 - CLI validates configuration schema", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const validConfig = {
      workspace: {
        "./apps/web": {
          dev: [
            {
              projectPath: "./services/database",
              task: "start",
              async: true,
              required: true,
              delay: 1000,
            },
          ],
        },
      },
      tasks: {
        dev: {
          async: true,
          required: true,
          delay: 500,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(validConfig, null, 2),
    });

    const result = await runCli(["dev", "--debug"], tempDir);

    assertEquals(result.exitCode, 0, "CLI should validate complex configuration");
    assertStringIncludes(result.stdout, "Debug: Configuration loaded successfully");
    assertStringIncludes(result.stdout, "./services/database");
    assertStringIncludes(result.stdout, "\"async\": true");
    assertStringIncludes(result.stdout, "\"delay\": 1000");
    assertStringIncludes(result.stdout, "\"required\": true");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Milestone 2 - CLI shows helpful errors for invalid config", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const invalidConfig = {
      // Missing workspace section
      tasks: {
        test: { async: false },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(invalidConfig, null, 2),
    });

    const result = await runCli(["test"], tempDir);

    assertEquals(result.exitCode, 1, "CLI should exit with error for invalid config");
    assertStringIncludes(result.stderr, "Configuration Error:");
    assertStringIncludes(result.stderr, "Configuration must have a 'workspace' section");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Milestone 2 - CLI shows helpful errors for malformed JSON", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    await createTestWorkspace(tempDir, {
      "dream.json": "{ invalid json syntax }",
    });

    const result = await runCli(["test"], tempDir);

    assertEquals(result.exitCode, 1, "CLI should exit with error for malformed JSON");
    assertStringIncludes(result.stderr, "Configuration Error:");
    assertStringIncludes(result.stderr, "Invalid JSON in configuration file");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Milestone 2 - CLI shows helpful errors when no config found", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const result = await runCli(["test"], tempDir);

    assertEquals(result.exitCode, 1, "CLI should exit with error when no config found");
    assertStringIncludes(result.stderr, "Configuration Error:");
    assertStringIncludes(result.stderr, "No dream.json configuration file found");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Milestone 2 - CLI debug flag shows detailed configuration", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/auth": {
          test: ["./services/api", "./apps/web"],
          build: ["./packages/shared"],
        },
        "./apps/web": {
          dev: [
            {
              projectPath: "./services/database",
              task: "start",
              async: true,
              delay: 2000,
            },
          ],
        },
      },
      tasks: {
        test: {
          async: false,
          required: true,
          delay: 0,
        },
        dev: {
          async: true,
          required: true,
          delay: 1000,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
    });

    const result = await runCli(["test", "--debug"], tempDir);

    assertEquals(result.exitCode, 0, "CLI should successfully show debug output");
    
    // Verify debug output contains all expected sections
    assertStringIncludes(result.stdout, "Debug: Configuration loaded successfully");
    assertStringIncludes(result.stdout, "Debug: Workspace root:");
    assertStringIncludes(result.stdout, "Debug: Configuration:");
    
    // Verify configuration content is displayed
    assertStringIncludes(result.stdout, "./packages/auth");
    assertStringIncludes(result.stdout, "./apps/web");
    assertStringIncludes(result.stdout, "./services/api");
    assertStringIncludes(result.stdout, "./services/database");
    assertStringIncludes(result.stdout, "\"async\": true");
    assertStringIncludes(result.stdout, "\"delay\": 2000");
    
    // Verify task execution debug info
    assertStringIncludes(result.stdout, "Debug: Current project path:");
    assertStringIncludes(result.stdout, "Debug: Resolved");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Milestone 2 - CLI works without debug flag (no debug output)", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/auth": {
          test: ["./services/api"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
    });

    const result = await runCli(["test"], tempDir);

    assertEquals(result.exitCode, 0, "CLI should work without debug flag");
    assertStringIncludes(result.stdout, "Executing task: test");
    assertStringIncludes(result.stdout, "✅"); // Should show successful execution (mocked)

    // Should NOT contain debug output
    assertEquals(result.stdout.includes("Debug:"), false, "Should not show debug output without --debug flag");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
