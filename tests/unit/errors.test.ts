import { assertEquals, assertInstanceOf } from "@std/assert";
import {
  CircularDependencyError,
  ConfigError,
  DreamError,
  ProjectNotFoundError,
  TaskExecutionError,
  TaskNotFoundError,
} from "../../src/errors.ts";

Deno.test("Errors - DreamError base class", () => {
  const error = new DreamError("Test error message", "TEST_CODE");

  assertEquals(error.message, "Test error message");
  assertEquals(error.code, "TEST_CODE");
  assertEquals(error.name, "DreamError");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, DreamError);
});

Deno.test("Errors - ConfigError", () => {
  const error = new ConfigError("Invalid configuration");

  assertEquals(error.message, "Invalid configuration");
  assertEquals(error.code, "CONFIG_ERROR");
  assertEquals(error.name, "ConfigError");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, DreamError);
  assertInstanceOf(error, ConfigError);
});

Deno.test("Errors - CircularDependencyError", () => {
  const cycle = ["./packages/a", "./packages/b", "./packages/c", "./packages/a"];
  const error = new CircularDependencyError(cycle);

  assertEquals(
    error.message,
    "Circular dependency detected: ./packages/a -> ./packages/b -> ./packages/c -> ./packages/a",
  );
  assertEquals(error.code, "CIRCULAR_DEPENDENCY");
  assertEquals(error.name, "CircularDependencyError");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, DreamError);
  assertInstanceOf(error, CircularDependencyError);
});

Deno.test("Errors - CircularDependencyError with single item cycle", () => {
  const cycle = ["./packages/self"];
  const error = new CircularDependencyError(cycle);

  assertEquals(error.message, "Circular dependency detected: ./packages/self");
  assertEquals(error.code, "CIRCULAR_DEPENDENCY");
});

Deno.test("Errors - TaskExecutionError", () => {
  const error = new TaskExecutionError("Task auth:test failed with exit code 1", 1, "Test failed");

  assertEquals(error.message, "Task auth:test failed with exit code 1");
  assertEquals(error.exitCode, 1);
  assertEquals(error.stderr, "Test failed");
  assertEquals(error.code, "TASK_EXECUTION_ERROR");
  assertEquals(error.name, "TaskExecutionError");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, DreamError);
  assertInstanceOf(error, TaskExecutionError);
});

Deno.test("Errors - TaskExecutionError with different exit codes", () => {
  const error127 = new TaskExecutionError(
    "Task build:compile failed with exit code 127",
    127,
    "Build failed",
  );
  const error2 = new TaskExecutionError(
    "Task test:unit failed with exit code 2",
    2,
    "Tests failed",
  );

  assertEquals(error127.message, "Task build:compile failed with exit code 127");
  assertEquals(error127.code, "TASK_EXECUTION_ERROR");
  assertEquals(error127.exitCode, 127);
  assertEquals(error127.stderr, "Build failed");

  assertEquals(error2.message, "Task test:unit failed with exit code 2");
  assertEquals(error2.exitCode, 2);
  assertEquals(error2.stderr, "Tests failed");
  assertEquals(error2.code, "TASK_EXECUTION_ERROR");
});

Deno.test("Errors - ProjectNotFoundError", () => {
  const error = new ProjectNotFoundError("./packages/missing");

  assertEquals(error.message, "Project not found: ./packages/missing");
  assertEquals(error.code, "PROJECT_NOT_FOUND");
  assertEquals(error.name, "ProjectNotFoundError");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, DreamError);
  assertInstanceOf(error, ProjectNotFoundError);
});

Deno.test("Errors - TaskNotFoundError", () => {
  const error = new TaskNotFoundError("missing-task", "./packages/auth");

  assertEquals(error.message, 'Task "missing-task" not found in project ./packages/auth');
  assertEquals(error.code, "TASK_NOT_FOUND");
  assertEquals(error.name, "TaskNotFoundError");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, DreamError);
  assertInstanceOf(error, TaskNotFoundError);
});

Deno.test("Errors - Error inheritance chain", () => {
  const configError = new ConfigError("Config test");
  const circularError = new CircularDependencyError(["a", "b", "a"]);
  const taskError = new TaskExecutionError(
    "Task task:id failed with exit code 1",
    1,
    "Error message",
  );
  const projectError = new ProjectNotFoundError("./missing");
  const taskNotFoundError = new TaskNotFoundError("task", "./project");

  // All should be instances of base Error
  assertInstanceOf(configError, Error);
  assertInstanceOf(circularError, Error);
  assertInstanceOf(taskError, Error);
  assertInstanceOf(projectError, Error);
  assertInstanceOf(taskNotFoundError, Error);

  // All should be instances of DreamError
  assertInstanceOf(configError, DreamError);
  assertInstanceOf(circularError, DreamError);
  assertInstanceOf(taskError, DreamError);
  assertInstanceOf(projectError, DreamError);
  assertInstanceOf(taskNotFoundError, DreamError);

  // Each should have unique error codes
  const codes = [
    configError.code,
    circularError.code,
    taskError.code,
    projectError.code,
    taskNotFoundError.code,
  ];
  const uniqueCodes = new Set(codes);
  assertEquals(uniqueCodes.size, codes.length, "All error codes should be unique");
});
