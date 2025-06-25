import { assertEquals, assertExists } from "@std/assert";
import type {
  Dependency,
  DetailedDependency,
  DreamConfig,
  ExecutionPlan,
  ParsedArgs,
  ProjectConfig,
  RunnerOptions,
  TaskDefaults,
  TaskExecution,
  TaskResult,
} from "../../src/types.ts";

Deno.test("Types - DreamConfig interface", () => {
  const config: DreamConfig = {
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

  assertEquals(typeof config.workspace, "object");
  assertExists(config.workspace["./packages/auth"]);
  assertEquals(config.workspace["./packages/auth"].test.length, 2);
  assertEquals(config.tasks?.test.async, false);
});

Deno.test("Types - ProjectConfig interface", () => {
  const projectConfig: ProjectConfig = {
    test: ["./client1", "./client2"],
    dev: [
      {
        projectPath: "./service1",
        task: "start",
        async: true,
        delay: 1000,
      },
    ],
  };

  assertEquals(projectConfig.test.length, 2);
  assertEquals(projectConfig.dev.length, 1);
  assertEquals(typeof projectConfig.dev[0], "object");
});

Deno.test("Types - Dependency union type", () => {
  const stringDep: Dependency = "./packages/utils";
  const detailedDep: Dependency = {
    projectPath: "./services/api",
    task: "dev",
    async: true,
    required: true,
    delay: 2000,
  };

  assertEquals(typeof stringDep, "string");
  assertEquals(typeof detailedDep, "object");
  assertEquals((detailedDep as DetailedDependency).projectPath, "./services/api");
});

Deno.test("Types - DetailedDependency interface", () => {
  const dep: DetailedDependency = {
    projectPath: "./services/database",
    task: "start",
    async: true,
    required: false,
    delay: 500,
  };

  assertEquals(dep.projectPath, "./services/database");
  assertEquals(dep.task, "start");
  assertEquals(dep.async, true);
  assertEquals(dep.required, false);
  assertEquals(dep.delay, 500);
});

Deno.test("Types - TaskDefaults interface", () => {
  const defaults: TaskDefaults = {
    async: false,
    required: true,
    delay: 0,
  };

  assertEquals(defaults.async, false);
  assertEquals(defaults.required, true);
  assertEquals(defaults.delay, 0);
});

Deno.test("Types - ExecutionPlan interface", () => {
  const plan: ExecutionPlan = {
    tasks: [
      {
        id: "utils:test",
        projectPath: "./packages/utils",
        taskName: "test",
        async: false,
        required: true,
        delay: 0,
      },
    ],
  };

  assertEquals(plan.tasks.length, 1);
  assertEquals(plan.tasks[0].id, "utils:test");
});

Deno.test("Types - TaskExecution interface", () => {
  const task: TaskExecution = {
    id: "auth:build",
    projectPath: "./packages/auth",
    taskName: "build",
    async: true,
    required: false,
    delay: 1500,
  };

  assertEquals(task.id, "auth:build");
  assertEquals(task.projectPath, "./packages/auth");
  assertEquals(task.taskName, "build");
  assertEquals(task.async, true);
  assertEquals(task.required, false);
  assertEquals(task.delay, 1500);
});

Deno.test("Types - TaskResult interface", () => {
  const taskExecution: TaskExecution = {
    id: "./packages/utils:test",
    projectPath: "./packages/utils",
    taskName: "test",
    async: false,
    required: true,
    delay: 0,
  };

  const result: TaskResult = {
    success: true,
    exitCode: 0,
    stdout: "Task completed successfully",
    stderr: "",
    duration: 1234,
    taskExecution,
  };

  assertEquals(result.success, true);
  assertEquals(result.exitCode, 0);
  assertEquals(result.stdout, "Task completed successfully");
  assertEquals(result.stderr, "");
  assertEquals(result.duration, 1234);
  assertEquals(result.taskExecution, taskExecution);
});

Deno.test("Types - RunnerOptions interface", () => {
  const options: RunnerOptions = {
    debug: true,
    workspaceRoot: "/path/to/workspace",
  };

  assertEquals(options.debug, true);
  assertEquals(options.workspaceRoot, "/path/to/workspace");
});

Deno.test("Types - ParsedArgs interface", () => {
  const args: ParsedArgs = {
    task: "test",
    help: false,
    version: false,
    debug: true,
    _: ["extra", "args"],
  };

  assertEquals(args.task, "test");
  assertEquals(args.help, false);
  assertEquals(args.version, false);
  assertEquals(args.debug, true);
  assertEquals(args._.length, 2);
});
