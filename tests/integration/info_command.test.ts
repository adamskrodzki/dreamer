import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { runCli } from "../utils/test_helpers.ts";

/**
 * Integration tests for the --info command functionality
 * Tests the CLI's ability to show configuration discovery and workspace information
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

Deno.test("Integration Info - shows configuration discovery information", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/auth": {
          test: ["./services/api"],
          build: [],
        },
        "./services/api": {
          test: [],
          dev: [
            {
              projectPath: "./packages/auth",
              task: "build",
              async: false,
              required: true,
              delay: 0,
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
          required: false,
          delay: 1000,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
    });

    const result = await runCli(["--info"], tempDir);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Dream CLI v1.0.0 - Configuration Discovery Information");
    assertStringIncludes(result.stdout, "Current Working Directory:");
    assertStringIncludes(result.stdout, "✅ Configuration Found:");
    assertStringIncludes(result.stdout, "✅ Workspace Root:");
    assertStringIncludes(result.stdout, "✅ Configuration Valid: 2 projects configured");
    
    // Verify workspace projects
    assertStringIncludes(result.stdout, "Workspace Projects:");
    assertStringIncludes(result.stdout, "./packages/auth (tasks: test, build)");
    assertStringIncludes(result.stdout, "./services/api (tasks: test, dev)");
    
    // Verify task defaults
    assertStringIncludes(result.stdout, "Task Defaults:");
    assertStringIncludes(result.stdout, "test: async=false, required=true, delay=0ms");
    assertStringIncludes(result.stdout, "dev: async=true, required=false, delay=1000ms");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Info - handles missing configuration gracefully", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const result = await runCli(["--info"], tempDir);

    assertEquals(result.exitCode, 1);
    assertStringIncludes(result.stdout, "❌ Configuration Error:");
    assertStringIncludes(result.stdout, "No dream.json configuration file found");
    assertStringIncludes(result.stdout, "Configuration Search Path:");
    assertStringIncludes(result.stdout, "To fix this issue:");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Info - shows configuration from parent directory", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: ["./apps/web"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({ name: "utils" }),
    });

    // Run from subdirectory
    const result = await runCli(["--info"], `${tempDir}/packages/utils`);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "✅ Configuration Found:");
    assertStringIncludes(result.stdout, "dream.json");
    assertStringIncludes(result.stdout, "✅ Configuration Valid: 1 projects configured");
    assertStringIncludes(result.stdout, "./packages/utils");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Info - handles invalid JSON configuration", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    await createTestWorkspace(tempDir, {
      "dream.json": "{ invalid json syntax",
    });

    const result = await runCli(["--info"], tempDir);

    assertEquals(result.exitCode, 1);
    assertStringIncludes(result.stdout, "❌ Configuration Error:");
    assertStringIncludes(result.stdout, "Invalid JSON in configuration file");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Info - handles invalid configuration schema", async () => {
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

    const result = await runCli(["--info"], tempDir);

    assertEquals(result.exitCode, 1);
    assertStringIncludes(result.stdout, "❌ Configuration Error:");
    assertStringIncludes(result.stdout, "Configuration must have a 'workspace' section");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Info - shows complex configuration details", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const complexConfig = {
      workspace: {
        "./services/database": {
          test: ["./services/auth", "./services/api"],
          start: [],
        },
        "./services/auth": {
          test: ["./services/api"],
          dev: [
            {
              projectPath: "./services/database",
              task: "start",
              async: true,
              required: true,
              delay: 0,
            },
          ],
        },
        "./services/api": {
          test: [],
          dev: [
            {
              projectPath: "./services/database",
              task: "start",
              async: true,
              required: true,
              delay: 0,
            },
            {
              projectPath: "./services/auth",
              task: "dev",
              async: true,
              required: true,
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
          required: false,
          delay: 1000,
        },
        start: {
          async: true,
          required: true,
          delay: 500,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(complexConfig, null, 2),
    });

    const result = await runCli(["--info"], tempDir);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "✅ Configuration Valid: 3 projects configured");
    
    // Verify all services are listed with their tasks
    assertStringIncludes(result.stdout, "./services/database (tasks: test, start)");
    assertStringIncludes(result.stdout, "./services/auth (tasks: test, dev)");
    assertStringIncludes(result.stdout, "./services/api (tasks: test, dev)");
    
    // Verify all task defaults are shown
    assertStringIncludes(result.stdout, "test: async=false, required=true, delay=0ms");
    assertStringIncludes(result.stdout, "dev: async=true, required=false, delay=1000ms");
    assertStringIncludes(result.stdout, "start: async=true, required=true, delay=500ms");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Info - works with configuration without task defaults", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const configWithoutDefaults = {
      workspace: {
        "./packages/utils": {
          test: [],
          build: [],
        },
      },
      // No tasks section
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(configWithoutDefaults, null, 2),
    });

    const result = await runCli(["--info"], tempDir);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "✅ Configuration Valid: 1 projects configured");
    assertStringIncludes(result.stdout, "./packages/utils (tasks: test, build)");
    
    // Should not show task defaults section
    assertEquals(result.stdout.includes("Task Defaults:"), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
