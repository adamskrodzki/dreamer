import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { runCli } from "../utils/test_helpers.ts";

/**
 * Integration tests for dependency resolution functionality
 * Tests the CLI's ability to resolve dependencies and create execution plans
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

Deno.test("Integration Dependency - simple linear dependencies", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: ["./packages/core"],
        },
        "./packages/core": {
          test: [],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({ name: "utils" }),
      "packages/core/deno.json": JSON.stringify({ name: "core" }),
    });

    const result = await runCli(["test"], `${tempDir}/packages/utils`);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Executing task: test");
    assertStringIncludes(result.stdout, "Execution plan: 2 tasks");
    assertStringIncludes(result.stdout, "→ ./packages/core test");
    assertStringIncludes(result.stdout, "→ ./packages/utils test");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Dependency - test pattern with clients", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: ["./packages/base"], // Give utils some dependencies so it will include clients
        },
        "./packages/base": {
          test: [],
        },
        "./packages/core": {
          test: ["./packages/utils"],
        },
        "./packages/ui": {
          test: ["./packages/utils"],
        },
        "./apps/web": {
          test: ["./packages/ui"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({ name: "utils" }),
      "packages/base/deno.json": JSON.stringify({ name: "base" }),
      "packages/core/deno.json": JSON.stringify({ name: "core" }),
      "packages/ui/deno.json": JSON.stringify({ name: "ui" }),
      "apps/web/deno.json": JSON.stringify({ name: "web" }),
    });

    // Test from utils package - should test utils + its clients (core, ui)
    const result = await runCli(["test"], `${tempDir}/packages/utils`);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Execution plan: 4 tasks");
    assertStringIncludes(result.stdout, "→ ./packages/base test");
    assertStringIncludes(result.stdout, "→ ./packages/utils test");
    assertStringIncludes(result.stdout, "→ ./packages/core test");
    assertStringIncludes(result.stdout, "→ ./packages/ui test");
    // Should NOT include web app (indirect client)
    assertEquals(result.stdout.includes("./apps/web"), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Dependency - dev pattern with detailed dependencies", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./apps/web": {
          dev: [
            {
              projectPath: "./services/database",
              task: "start",
              async: true,
              required: true,
              delay: 0,
            },
            {
              projectPath: "./services/api",
              task: "dev",
              async: true,
              required: true,
              delay: 2000,
            },
          ],
        },
        "./services/database": {
          start: [],
        },
        "./services/api": {
          dev: [],
        },
      },
      tasks: {
        dev: {
          async: true,
          required: false,
          delay: 1000,
        },
        start: {
          async: true,
          required: true,
          delay: 0,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "apps/web/deno.json": JSON.stringify({ name: "web" }),
      "services/database/deno.json": JSON.stringify({ name: "database" }),
      "services/api/deno.json": JSON.stringify({ name: "api" }),
    });

    const result = await runCli(["dev", "--debug"], `${tempDir}/apps/web`);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Debug: Resolved 3 tasks:");
    assertStringIncludes(result.stdout, "./services/database:start");
    assertStringIncludes(result.stdout, "./services/api:dev");
    assertStringIncludes(result.stdout, "./apps/web:dev");
    
    // Verify task properties are applied
    assertStringIncludes(result.stdout, "async: true, required: true, delay: 0ms");
    assertStringIncludes(result.stdout, "async: true, required: false, delay: 1000ms");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Dependency - circular dependency detection", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./packages/a": {
          test: ["./packages/b"],
        },
        "./packages/b": {
          test: ["./packages/c"],
        },
        "./packages/c": {
          test: ["./packages/a"],
        },
      },
      recursive: [
        {
          project: "./packages/a",
          tasks: ["test"],
        },
      ],
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/a/deno.json": JSON.stringify({ name: "a" }),
      "packages/b/deno.json": JSON.stringify({ name: "b" }),
      "packages/c/deno.json": JSON.stringify({ name: "c" }),
    });

    const result = await runCli(["test"], `${tempDir}/packages/a`);

    assertEquals(result.exitCode, 1);
    assertStringIncludes(result.stderr, "Dependency Error:");
    assertStringIncludes(result.stderr, "Circular dependency detected");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Dependency - diamond dependency deduplication (non-recursive)", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const config = {
      workspace: {
        "./apps/web": {
          test: ["./packages/ui", "./packages/core"],
        },
        "./packages/ui": {
          test: ["./packages/utils"],
        },
        "./packages/core": {
          test: ["./packages/utils"],
        },
        "./packages/utils": {
          test: [],
        },
      },
      // No recursive config - should use non-recursive resolution
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "apps/web/deno.json": JSON.stringify({ name: "web" }),
      "packages/ui/deno.json": JSON.stringify({ name: "ui" }),
      "packages/core/deno.json": JSON.stringify({ name: "core" }),
      "packages/utils/deno.json": JSON.stringify({ name: "utils" }),
    });

    const result = await runCli(["test"], `${tempDir}/apps/web`);

    assertEquals(result.exitCode, 0);
    // Non-recursive: ui, core, web (3 tasks, no nested resolution)
    assertStringIncludes(result.stdout, "Execution plan: 3 tasks");

    // Should have ui, core, and web
    assertStringIncludes(result.stdout, "→ ./packages/ui test");
    assertStringIncludes(result.stdout, "→ ./packages/core test");
    assertStringIncludes(result.stdout, "→ ./apps/web test");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Dependency - mixed dependency formats", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./apps/web": {
          test: [
            "./packages/utils", // Simple string
            {
              projectPath: "./services/api",
              task: "integration-test", // Different task name
            },
          ],
        },
        "./packages/utils": {
          test: [],
        },
        "./services/api": {
          "integration-test": [],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "apps/web/deno.json": JSON.stringify({ name: "web" }),
      "packages/utils/deno.json": JSON.stringify({ name: "utils" }),
      "services/api/deno.json": JSON.stringify({ name: "api" }),
    });

    const result = await runCli(["test"], `${tempDir}/apps/web`);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Execution plan: 3 tasks");
    assertStringIncludes(result.stdout, "→ ./packages/utils test");
    assertStringIncludes(result.stdout, "→ ./services/api integration-test");
    assertStringIncludes(result.stdout, "→ ./apps/web test");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Dependency - project not in configuration", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: ["./packages/missing"],
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({ name: "utils" }),
    });

    const result = await runCli(["test"], `${tempDir}/packages/utils`);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Execution plan: 2 tasks");
    assertStringIncludes(result.stdout, "→ ./packages/missing test");
    assertStringIncludes(result.stdout, "→ ./packages/utils test");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration Dependency - debug output shows execution plan details", async () => {
  const tempDir = await Deno.makeTempDir();
  
  try {
    const config = {
      workspace: {
        "./packages/utils": {
          test: ["./packages/core"],
        },
        "./packages/core": {
          test: [],
        },
      },
      tasks: {
        test: {
          async: false,
          required: true,
          delay: 100,
        },
      },
    };

    await createTestWorkspace(tempDir, {
      "dream.json": JSON.stringify(config, null, 2),
      "packages/utils/deno.json": JSON.stringify({ name: "utils" }),
      "packages/core/deno.json": JSON.stringify({ name: "core" }),
    });

    const result = await runCli(["test", "--debug"], `${tempDir}/packages/utils`);

    assertEquals(result.exitCode, 0);
    assertStringIncludes(result.stdout, "Debug: Current project path: ./packages/utils");
    assertStringIncludes(result.stdout, "Debug: Resolved 2 tasks:");
    assertStringIncludes(result.stdout, "./packages/core:test (async: false, required: true, delay: 100ms)");
    assertStringIncludes(result.stdout, "./packages/utils:test (async: false, required: true, delay: 100ms)");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
