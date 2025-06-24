import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { runCli } from "../utils/test_helpers.ts";

/**
 * Integration tests for configuration loading functionality
 * Tests the CLI's ability to discover, load, and validate dream.json files
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

Deno.test("Config Loading - loads valid configuration with debug output", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const validConfig = {
      workspace: {
        "./packages/auth": {
          test: ["./services/api", "./apps/web"],
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
      "dream.json": JSON.stringify(validConfig, null, 2),
    });

    const result = await runCli(["test", "--debug"], tempDir);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Debug: Configuration loaded successfully");
    assertStringIncludes(result.stdout, "Debug: Workspace root:");
    assertStringIncludes(result.stdout, "Debug: Configuration:");
    assertStringIncludes(result.stdout, "./packages/auth");
    assertStringIncludes(result.stdout, "./services/api");
    assertStringIncludes(result.stdout, "Debug: Current project path:");
    assertStringIncludes(result.stdout, "Debug: Resolved");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Config Loading - finds config in parent directory", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const validConfig = {
      workspace: {
        "./packages/utils": {
          test: ["./packages/auth"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(validConfig, null, 2),
      "packages/utils/deno.json": JSON.stringify({ tasks: { test: "echo test" } }),
    });

    // Run from subdirectory
    const result = await runCli(["test", "--debug"], `${tempDir}/packages/utils`);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Debug: Configuration loaded successfully");
    assertStringIncludes(result.stdout, "./packages/utils");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Config Loading - handles missing configuration file", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const result = await runCli(["test"], tempDir);

    assertEquals(result.exitCode, 1);
    assertStringIncludes(result.stderr, "Configuration Error:");
    assertStringIncludes(result.stderr, "No dream.json configuration file found");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Config Loading - handles invalid JSON", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    await createTestWorkspace(tempDir, {
      "dream.json": "{ invalid json syntax",
    });

    const result = await runCli(["test"], tempDir);

    assertEquals(result.exitCode, 1);
    assertStringIncludes(result.stderr, "Configuration Error:");
    assertStringIncludes(result.stderr, "Invalid JSON in configuration file");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Config Loading - handles invalid configuration schema", async () => {
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

    assertEquals(result.exitCode, 1);
    assertStringIncludes(result.stderr, "Configuration Error:");
    assertStringIncludes(result.stderr, "Configuration must have a 'workspace' section");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Config Loading - shows detailed error with debug flag", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    await createTestWorkspace(tempDir, {
      "dream.json": "{ invalid json",
    });

    const result = await runCli(["test", "--debug"], tempDir);

    assertEquals(result.exitCode, 1);
    assertStringIncludes(result.stderr, "Configuration Error:");
    assertStringIncludes(result.stderr, "Debug: Full error:");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Config Loading - loads complex configuration with detailed dependencies", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const complexConfig = {
      workspace: {
        "./apps/web": {
          dev: [
            {
              projectPath: "./services/database",
              task: "start",
              async: true,
              delay: 0,
            },
            {
              projectPath: "./services/auth",
              task: "dev",
              async: true,
              delay: 2000,
            },
          ],
        },
      },
      tasks: {
        dev: {
          async: true,
          required: true,
          delay: 1000,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(complexConfig, null, 2),
    });

    const result = await runCli(["dev", "--debug"], tempDir);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Debug: Configuration loaded successfully");
    assertStringIncludes(result.stdout, "./services/database");
    assertStringIncludes(result.stdout, "./services/auth");
    assertStringIncludes(result.stdout, "\"async\": true");
    assertStringIncludes(result.stdout, "\"delay\": 2000");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Config Loading - works without debug flag", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const validConfig = {
      workspace: {
        "./packages/auth": {
          test: ["./services/api"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(validConfig, null, 2),
    });

    const result = await runCli(["test"], tempDir);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Executing task: test");
    assertStringIncludes(result.stdout, "✅"); // Should show successful execution (mocked)
    // Should not contain debug output
    assertEquals(result.stdout.includes("Debug:"), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
