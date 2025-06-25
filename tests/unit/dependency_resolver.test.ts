import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.0";
import { DependencyResolver } from "../../src/dependency_resolver.ts";
import { CircularDependencyError } from "../../src/errors.ts";
import type { DreamConfig } from "../../src/types.ts";

Deno.test("DependencyResolver - simple linear dependencies", () => {
  const config: DreamConfig = {
    workspace: {
      "./packages/utils": {
        test: ["./packages/core"],
      },
      "./packages/core": {
        test: [],
      },
    },
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./packages/utils", "test");

  assertEquals(plan.tasks.length, 2);
  assertEquals(plan.tasks[0].id, "./packages/core:test");
  assertEquals(plan.tasks[1].id, "./packages/utils:test");
});

Deno.test("DependencyResolver - no dependencies", () => {
  const config: DreamConfig = {
    workspace: {
      "./packages/utils": {
        test: [],
      },
    },
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./packages/utils", "test");

  assertEquals(plan.tasks.length, 1);
  assertEquals(plan.tasks[0].id, "./packages/utils:test");
  assertEquals(plan.tasks[0].projectPath, "./packages/utils");
  assertEquals(plan.tasks[0].taskName, "test");
});

Deno.test("DependencyResolver - multiple dependencies", () => {
  const config: DreamConfig = {
    workspace: {
      "./apps/web": {
        test: ["./packages/utils", "./packages/core", "./services/api"],
      },
      "./packages/utils": {
        test: [],
      },
      "./packages/core": {
        test: [],
      },
      "./services/api": {
        test: [],
      },
    },
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./apps/web", "test");

  assertEquals(plan.tasks.length, 4);
  // Dependencies should come first
  assertEquals(plan.tasks[0].id, "./packages/utils:test");
  assertEquals(plan.tasks[1].id, "./packages/core:test");
  assertEquals(plan.tasks[2].id, "./services/api:test");
  // Main task comes last
  assertEquals(plan.tasks[3].id, "./apps/web:test");
});

Deno.test("DependencyResolver - nested dependencies (recursive)", () => {
  const config: DreamConfig = {
    workspace: {
      "./apps/web": {
        test: ["./packages/ui"],
      },
      "./packages/ui": {
        test: ["./packages/core"],
      },
      "./packages/core": {
        test: ["./packages/utils"],
      },
      "./packages/utils": {
        test: [],
      },
    },
    recursive: [
      {
        project: "./apps/web",
        tasks: ["test"],
      },
    ],
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./apps/web", "test");

  assertEquals(plan.tasks.length, 4);
  // Should be in dependency order: utils -> core -> ui -> web
  assertEquals(plan.tasks[0].id, "./packages/utils:test");
  assertEquals(plan.tasks[1].id, "./packages/core:test");
  assertEquals(plan.tasks[2].id, "./packages/ui:test");
  assertEquals(plan.tasks[3].id, "./apps/web:test");
});

Deno.test("DependencyResolver - diamond dependency pattern (recursive)", () => {
  const config: DreamConfig = {
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
    recursive: [
      {
        project: "./apps/web",
        tasks: ["test"],
      },
    ],
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./apps/web", "test");

  assertEquals(plan.tasks.length, 4);
  // utils should only appear once (deduplication)
  const taskIds = plan.tasks.map(t => t.id);
  assertEquals(taskIds.filter(id => id === "./packages/utils:test").length, 1);

  // utils should come first
  assertEquals(plan.tasks[0].id, "./packages/utils:test");
  // web should come last
  assertEquals(plan.tasks[3].id, "./apps/web:test");
});

Deno.test("DependencyResolver - circular dependency detection (recursive)", () => {
  const config: DreamConfig = {
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

  const resolver = new DependencyResolver(config);

  assertThrows(
    () => resolver.resolve("./packages/a", "test"),
    CircularDependencyError,
    "Circular dependency detected"
  );
});

Deno.test("DependencyResolver - self-referencing circular dependency (recursive)", () => {
  const config: DreamConfig = {
    workspace: {
      "./packages/self": {
        test: ["./packages/self"],
      },
    },
    recursive: [
      {
        project: "./packages/self",
        tasks: ["test"],
      },
    ],
  };

  const resolver = new DependencyResolver(config);

  assertThrows(
    () => resolver.resolve("./packages/self", "test"),
    CircularDependencyError,
    "Circular dependency detected"
  );
});

Deno.test("DependencyResolver - detailed dependency format", () => {
  const config: DreamConfig = {
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
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./apps/web", "dev");

  assertEquals(plan.tasks.length, 3);
  assertEquals(plan.tasks[0].id, "./services/database:start");
  assertEquals(plan.tasks[1].id, "./services/api:dev");
  assertEquals(plan.tasks[2].id, "./apps/web:dev");

  // Verify detailed dependency properties are applied
  assertEquals(plan.tasks[0].async, true);
  assertEquals(plan.tasks[0].required, true);
  assertEquals(plan.tasks[0].delay, 0);

  assertEquals(plan.tasks[1].async, true);
  assertEquals(plan.tasks[1].required, true);
  assertEquals(plan.tasks[1].delay, 2000);

  // The main task should use defaults (not specified in detailed dependencies)
  assertEquals(plan.tasks[2].async, false);
  assertEquals(plan.tasks[2].required, true);
  assertEquals(plan.tasks[2].delay, 0);
});

Deno.test("DependencyResolver - detailed dependency properties comprehensive", () => {
  const config: DreamConfig = {
    workspace: {
      "./apps/web": {
        dev: [
          {
            projectPath: "./services/database",
            task: "start",
            async: true,
            required: false,
            delay: 1000,
          },
          {
            projectPath: "./services/auth",
            task: "dev",
            async: false,
            required: true,
            delay: 2000,
          },
          {
            projectPath: "./services/api",
            // Only projectPath specified, other properties should use defaults
          },
        ],
      },
      "./services/database": { start: [] },
      "./services/auth": { dev: [] },
      "./services/api": { dev: [] },
    },
    tasks: {
      dev: {
        async: true,
        required: false,
        delay: 500,
      },
    },
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./apps/web", "dev");

  assertEquals(plan.tasks.length, 4);

  // Database task with explicit properties
  const dbTask = plan.tasks.find(t => t.id === "./services/database:start")!;
  assertEquals(dbTask.async, true);
  assertEquals(dbTask.required, false);
  assertEquals(dbTask.delay, 1000);

  // Auth task with explicit properties
  const authTask = plan.tasks.find(t => t.id === "./services/auth:dev")!;
  assertEquals(authTask.async, false);
  assertEquals(authTask.required, true);
  assertEquals(authTask.delay, 2000);

  // API task with only projectPath specified, should use task defaults
  const apiTask = plan.tasks.find(t => t.id === "./services/api:dev")!;
  assertEquals(apiTask.async, true); // from task defaults
  assertEquals(apiTask.required, false); // from task defaults
  assertEquals(apiTask.delay, 500); // from task defaults

  // Main web task should use task defaults
  const webTask = plan.tasks.find(t => t.id === "./apps/web:dev")!;
  assertEquals(webTask.async, true); // from task defaults
  assertEquals(webTask.required, false); // from task defaults
  assertEquals(webTask.delay, 500); // from task defaults
});

Deno.test("DependencyResolver - detailed dependency properties with recursive resolution", () => {
  const config: DreamConfig = {
    workspace: {
      "./apps/web": {
        test: [
          {
            projectPath: "./packages/auth",
            task: "test",
            async: true,
            required: false,
            delay: 1000,
          },
        ],
      },
      "./packages/auth": {
        test: [
          {
            projectPath: "./packages/utils",
            task: "test",
            async: false,
            required: true,
            delay: 500,
          },
        ],
      },
      "./packages/utils": {
        test: [],
      },
    },
    recursive: [
      {
        project: "./apps/web",
        tasks: ["test"],
      },
    ],
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./apps/web", "test");

  assertEquals(plan.tasks.length, 3);

  // Utils task (deepest dependency)
  const utilsTask = plan.tasks.find(t => t.id === "./packages/utils:test")!;
  assertEquals(utilsTask.async, false);
  assertEquals(utilsTask.required, true);
  assertEquals(utilsTask.delay, 500);

  // Auth task (intermediate dependency)
  const authTask = plan.tasks.find(t => t.id === "./packages/auth:test")!;
  assertEquals(authTask.async, true);
  assertEquals(authTask.required, false);
  assertEquals(authTask.delay, 1000);

  // Web task (main task)
  const webTask = plan.tasks.find(t => t.id === "./apps/web:test")!;
  assertEquals(webTask.async, false); // default
  assertEquals(webTask.required, true); // default
  assertEquals(webTask.delay, 0); // default
});

Deno.test("DependencyResolver - mixed dependency formats", () => {
  const config: DreamConfig = {
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

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./apps/web", "test");

  assertEquals(plan.tasks.length, 3);
  assertEquals(plan.tasks[0].id, "./packages/utils:test");
  assertEquals(plan.tasks[1].id, "./services/api:integration-test");
  assertEquals(plan.tasks[2].id, "./apps/web:test");
});

Deno.test("DependencyResolver - task defaults applied", () => {
  const config: DreamConfig = {
    workspace: {
      "./packages/utils": {
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

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./packages/utils", "test");

  assertEquals(plan.tasks.length, 1);
  assertEquals(plan.tasks[0].async, false);
  assertEquals(plan.tasks[0].required, true);
  assertEquals(plan.tasks[0].delay, 100);
});

Deno.test("DependencyResolver - project not in config", () => {
  const config: DreamConfig = {
    workspace: {
      "./packages/utils": {
        test: ["./packages/missing"],
      },
    },
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./packages/utils", "test");

  assertEquals(plan.tasks.length, 2);
  assertEquals(plan.tasks[0].id, "./packages/missing:test");
  assertEquals(plan.tasks[1].id, "./packages/utils:test");
});

// NOTE: getClients() method will be removed as part of dependency resolution fix

Deno.test("DependencyResolver - resolveTestPattern (corrected behavior)", () => {
  const config: DreamConfig = {
    workspace: {
      "./packages/utils": {
        test: ["./packages/base"], // utils depends on base
      },
      "./packages/base": {
        test: [],
      },
      "./packages/core": {
        test: ["./packages/utils"], // core depends on utils
      },
      "./packages/ui": {
        test: ["./packages/utils"], // ui depends on utils
      },
      "./apps/web": {
        test: ["./packages/ui"], // web depends on ui
      },
    },
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolveTestPattern("./packages/utils", "test");

  // Should only test utils and its configured dependencies (base), NOT its clients
  assertEquals(plan.tasks.length, 2, "Should only execute configured dependencies + current project");
  const taskIds = plan.tasks.map(t => t.id);
  assertEquals(taskIds.includes("./packages/base:test"), true, "Should include configured dependency");
  assertEquals(taskIds.includes("./packages/utils:test"), true, "Should include current project");
  assertEquals(taskIds.includes("./packages/core:test"), false, "Should NOT auto-discover core (client)");
  assertEquals(taskIds.includes("./packages/ui:test"), false, "Should NOT auto-discover ui (client)");
  assertEquals(taskIds.includes("./apps/web:test"), false, "Should NOT auto-discover web (indirect client)");
});

Deno.test("DependencyResolver - resolveDevPattern (non-recursive)", () => {
  const config: DreamConfig = {
    workspace: {
      "./apps/web": {
        dev: ["./services/api", "./services/database"],
      },
      "./services/api": {
        dev: ["./services/database"],
      },
      "./services/database": {
        dev: [],
      },
    },
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolveDevPattern("./apps/web", "dev");

  assertEquals(plan.tasks.length, 3);
  // Non-recursive: dependencies in order, then main project
  assertEquals(plan.tasks[0].id, "./services/api:dev");
  assertEquals(plan.tasks[1].id, "./services/database:dev");
  assertEquals(plan.tasks[2].id, "./apps/web:dev");
});

Deno.test("DependencyResolver - recursive dependency order preservation", () => {
  const config: DreamConfig = {
    workspace: {
      "./services/database": {
        test: ["./services/auth", "./services/api", "./services/notifications", "./apps/web", "./apps/mobile"],
      },
      "./services/auth": {
        test: ["./services/api", "./apps/web"],
      },
      "./services/api": {
        test: ["./apps/web", "./apps/mobile"],
      },
      "./services/notifications": {
        test: ["./apps/web"],
      },
      "./apps/web": {
        test: [],
      },
      "./apps/mobile": {
        test: [],
      },
    },
    recursive: [
      {
        project: "./services/database",
        tasks: ["test"],
      },
    ],
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./services/database", "test");

  assertEquals(plan.tasks.length, 6);

  // Expected order based on recursive depth-first resolution:
  const expectedOrder = [
    "./apps/web:test",      // From auth -> api -> web
    "./apps/mobile:test",   // From auth -> api -> mobile
    "./services/api:test",  // From auth -> api (after its deps)
    "./services/auth:test", // From database -> auth (after its deps)
    "./services/notifications:test", // From database -> notifications (after its deps)
    "./services/database:test", // Finally database itself
  ];

  for (let i = 0; i < expectedOrder.length; i++) {
    assertEquals(plan.tasks[i].id, expectedOrder[i], `Task ${i} should be ${expectedOrder[i]} but was ${plan.tasks[i].id}`);
  }
});

Deno.test("DependencyResolver - non-recursive dependency order", () => {
  const config: DreamConfig = {
    workspace: {
      "./services/database": {
        test: ["./services/auth", "./services/api", "./services/notifications", "./apps/web", "./apps/mobile"],
      },
      "./services/auth": {
        test: ["./services/api", "./apps/web"],
      },
      "./services/api": {
        test: ["./apps/web", "./apps/mobile"],
      },
      "./services/notifications": {
        test: ["./apps/web"],
      },
      "./apps/web": {
        test: [],
      },
      "./apps/mobile": {
        test: [],
      },
    },
    // No recursive config - should default to non-recursive
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./services/database", "test");

  assertEquals(plan.tasks.length, 6);

  // Expected order based on non-recursive resolution (direct dependencies in order):
  const expectedOrder = [
    "./services/auth:test",        // First dependency
    "./services/api:test",         // Second dependency
    "./services/notifications:test", // Third dependency
    "./apps/web:test",             // Fourth dependency
    "./apps/mobile:test",          // Fifth dependency
    "./services/database:test",    // Finally database itself
  ];

  for (let i = 0; i < expectedOrder.length; i++) {
    assertEquals(plan.tasks[i].id, expectedOrder[i], `Task ${i} should be ${expectedOrder[i]} but was ${plan.tasks[i].id}`);
  }
});

Deno.test("DependencyResolver - mixed recursive and non-recursive", () => {
  const config: DreamConfig = {
    workspace: {
      "./services/database": {
        test: ["./services/auth"],
      },
      "./services/auth": {
        test: ["./apps/web"],
      },
      "./apps/web": {
        test: [],
      },
    },
    recursive: [
      {
        project: "./services/auth",
        tasks: ["test"],
      },
    ],
  };

  const resolver = new DependencyResolver(config);

  // Test non-recursive project
  const databasePlan = resolver.resolve("./services/database", "test");
  assertEquals(databasePlan.tasks.length, 2);
  assertEquals(databasePlan.tasks[0].id, "./services/auth:test");
  assertEquals(databasePlan.tasks[1].id, "./services/database:test");

  // Test recursive project
  const authPlan = resolver.resolve("./services/auth", "test");
  assertEquals(authPlan.tasks.length, 2);
  assertEquals(authPlan.tasks[0].id, "./apps/web:test");
  assertEquals(authPlan.tasks[1].id, "./services/auth:test");
});
