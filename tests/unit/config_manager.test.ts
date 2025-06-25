import { assertEquals, assertRejects } from "@std/assert";
import { normalize } from "@std/path";
import { ConfigManager } from "../../src/config_manager.ts";
import { ConfigError } from "../../src/errors.ts";

Deno.test("ConfigManager - validate valid minimal config", () => {
  const manager = new ConfigManager();
  const validConfig = {
    workspace: {
      "./packages/auth": {
        test: ["./services/api"],
      },
    },
  };

  const result = manager.validate(validConfig);
  assertEquals(result.workspace["./packages/auth"].test.length, 1);
  assertEquals(result.workspace["./packages/auth"].test[0], "./services/api");
});

Deno.test("ConfigManager - validate config with detailed dependencies", () => {
  const manager = new ConfigManager();
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
  };

  const result = manager.validate(validConfig);
  const dep = result.workspace["./apps/web"].dev[0] as {
    projectPath: string;
    task: string;
    async: boolean;
    required: boolean;
    delay: number;
  };
  assertEquals(dep.projectPath, "./services/database");
  assertEquals(dep.task, "start");
  assertEquals(dep.async, true);
  assertEquals(dep.required, true);
  assertEquals(dep.delay, 1000);
});

Deno.test("ConfigManager - validate config with task defaults", () => {
  const manager = new ConfigManager();
  const validConfig = {
    workspace: {
      "./packages/auth": {
        test: ["./services/api"],
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

  const result = manager.validate(validConfig);
  assertEquals(result.tasks?.test.async, false);
  assertEquals(result.tasks?.test.required, true);
  assertEquals(result.tasks?.test.delay, 0);
});

Deno.test("ConfigManager - validate mixed dependency formats", () => {
  const manager = new ConfigManager();
  const validConfig = {
    workspace: {
      "./packages/shared": {
        test: ["./services/api", "./apps/web"],
        dev: [
          {
            projectPath: "./services/database",
            task: "start",
            async: true,
          },
        ],
      },
    },
  };

  const result = manager.validate(validConfig);
  assertEquals(result.workspace["./packages/shared"].test.length, 2);
  assertEquals(result.workspace["./packages/shared"].test[0], "./services/api");
  assertEquals(result.workspace["./packages/shared"].test[1], "./apps/web");
  assertEquals(result.workspace["./packages/shared"].dev.length, 1);
});

function assertValidationThrows(manager: ConfigManager, config: unknown, expectedMessage: string) {
  try {
    manager.validate(config);
    throw new Error("Expected validation to throw");
  } catch (error) {
    assertEquals(error instanceof ConfigError, true);
    if (error instanceof ConfigError) {
      assertEquals(
        error.message.includes(expectedMessage),
        true,
        `Expected error message to include "${expectedMessage}", got: "${error.message}"`,
      );
    }
  }
}

Deno.test("ConfigManager - reject null config", () => {
  const manager = new ConfigManager();
  assertValidationThrows(manager, null, "Configuration must be a valid JSON object");
});

Deno.test("ConfigManager - reject config without workspace", () => {
  const manager = new ConfigManager();
  const invalidConfig = { tasks: {} };
  assertValidationThrows(manager, invalidConfig, "Configuration must have a 'workspace' section");
});

Deno.test("ConfigManager - reject invalid project config", () => {
  const manager = new ConfigManager();
  const invalidConfig = {
    workspace: {
      "./packages/auth": "invalid",
    },
  };
  assertValidationThrows(manager, invalidConfig, "Invalid project configuration");
});

Deno.test("ConfigManager - reject non-array dependencies", () => {
  const manager = new ConfigManager();
  const invalidConfig = {
    workspace: {
      "./packages/auth": {
        test: "not-an-array",
      },
    },
  };
  assertValidationThrows(
    manager,
    invalidConfig,
    "Dependencies for ./packages/auth.test must be an array",
  );
});

Deno.test("ConfigManager - reject empty dependency string", () => {
  const manager = new ConfigManager();
  const invalidConfig = {
    workspace: {
      "./packages/auth": {
        test: [""],
      },
    },
  };
  assertValidationThrows(manager, invalidConfig, "Empty dependency string");
});

Deno.test("ConfigManager - reject dependency without projectPath", () => {
  const manager = new ConfigManager();
  const invalidConfig = {
    workspace: {
      "./packages/auth": {
        test: [{ task: "build" }],
      },
    },
  };
  assertValidationThrows(manager, invalidConfig, "must have a 'projectPath' string");
});

Deno.test("ConfigManager - reject invalid dependency types", () => {
  const manager = new ConfigManager();
  const invalidConfig = {
    workspace: {
      "./packages/auth": {
        test: [123],
      },
    },
  };
  assertValidationThrows(manager, invalidConfig, "must be a string or object");
});

Deno.test("ConfigManager - reject invalid task defaults", () => {
  const manager = new ConfigManager();
  const invalidConfig = {
    workspace: {
      "./packages/auth": {
        test: ["./services/api"],
      },
    },
    tasks: {
      test: {
        async: "not-boolean",
      },
    },
  };
  assertValidationThrows(manager, invalidConfig, "must be a boolean");
});

Deno.test("ConfigManager - reject negative delay", () => {
  const manager = new ConfigManager();
  const invalidConfig = {
    workspace: {
      "./packages/auth": {
        test: [
          {
            projectPath: "./services/api",
            delay: -100,
          },
        ],
      },
    },
  };
  assertValidationThrows(manager, invalidConfig, "must be a non-negative number");
});

// File system operation tests
Deno.test("ConfigManager - findConfigFile in current directory", async () => {
  const tempDir = await Deno.makeTempDir();
  const configPath = normalize(`${tempDir}/dream.json`);

  try {
    await Deno.writeTextFile(configPath, "{}");

    const manager = new ConfigManager(tempDir);
    const foundPath = await manager.findConfigFile();

    assertEquals(normalize(foundPath), configPath);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ConfigManager - findConfigFile in parent directory", async () => {
  const tempDir = await Deno.makeTempDir();
  const subDir = normalize(`${tempDir}/subdir`);
  const configPath = normalize(`${tempDir}/dream.json`);

  try {
    await Deno.mkdir(subDir);
    await Deno.writeTextFile(configPath, "{}");

    const manager = new ConfigManager(subDir);
    const foundPath = await manager.findConfigFile();

    assertEquals(normalize(foundPath), configPath);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ConfigManager - findConfigFile throws when not found", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const manager = new ConfigManager(tempDir);

    await assertRejects(
      () => manager.findConfigFile(),
      ConfigError,
      "No dream.json configuration file found",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ConfigManager - load valid config file", async () => {
  const tempDir = await Deno.makeTempDir();
  const configPath = `${tempDir}/dream.json`;
  const validConfig = {
    workspace: {
      "./packages/auth": {
        test: ["./services/api"],
      },
    },
  };

  try {
    await Deno.writeTextFile(configPath, JSON.stringify(validConfig));

    const manager = new ConfigManager(tempDir);
    const config = await manager.load();

    assertEquals(config.workspace["./packages/auth"].test[0], "./services/api");
    assertEquals(manager.getWorkspaceRoot(), tempDir);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ConfigManager - load throws on invalid JSON", async () => {
  const tempDir = await Deno.makeTempDir();
  const configPath = `${tempDir}/dream.json`;

  try {
    await Deno.writeTextFile(configPath, "{ invalid json");

    const manager = new ConfigManager(tempDir);

    await assertRejects(
      () => manager.load(),
      ConfigError,
      "Invalid JSON in configuration file",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ConfigManager - load throws on missing file", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const manager = new ConfigManager(tempDir);

    await assertRejects(
      () => manager.load(),
      ConfigError,
      "No dream.json configuration file found",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
