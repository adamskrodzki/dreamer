# Dream CLI - Simplified Architecture v2

## Overview

Dream CLI is a simple, focused tool for dependency-aware task execution in Deno monorepos. This architecture emphasizes simplicity, testability, and clear separation of concerns without over-engineering.

## Core Principles

1. **Simplicity First**: Minimal abstractions, clear code flow
2. **Single Responsibility**: Each module has one clear purpose
3. **Easy Testing**: Simple mocking and clear interfaces
4. **Practical Design**: Solve real problems without unnecessary complexity

## Architecture Overview

### Sequential Execution Flow (Current Incorrect Behavior)
```
┌─────────────────────────────────────────┐
│                CLI Entry                │
│            (src/main.ts)                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Dream Runner                 │
│         (src/dream_runner.ts)           │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐ ┌─────────────┐ ┌─────────────┐
│ Config  │ │ Dependency  │ │   Task      │
│Manager  │ │ Resolver    │ │ Executor    │
└─────────┘ └─────────────┘ └─────────────┘
```

### Concurrent Execution Flow (Correct Target Behavior)
```
┌─────────────────────────────────────────┐
│                CLI Entry                │
│            (src/main.ts)                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Dream Runner                 │
│         (src/dream_runner.ts)           │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐ ┌─────────────┐ ┌─────────────┐
│ Config  │ │ Dependency  │ │   Task      │
│Manager  │ │ Resolver    │ │ Executor    │
└─────────┘ └─────────────┘ └──────┬──────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │   Process    │ │   Process    │ │   Failure    │
            │   Tracker    │ │ Terminator   │ │ Propagator   │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     Background Process      │
                    │        Management           │
                    │   (Concurrent Execution)    │
                    └─────────────────────────────┘
```

## Process Lifecycle Management Architecture

### Background Process Management

The Dream CLI implements a sophisticated background process management system to handle async task execution:

#### Process Tracking System

```typescript
export class ProcessTracker {
  private backgroundProcesses: Map<string, BackgroundProcess> = new Map();
  private processGroups: Map<string, BackgroundProcess[]> = new Map();
  private processMetrics: Map<string, ProcessMetrics> = new Map();

  trackProcess(process: BackgroundProcess): void {
    // 1. Add process to main tracking map
    // 2. Add to appropriate process group
    // 3. Initialize metrics tracking
    // 4. Start health monitoring
  }

  getRunningProcesses(): BackgroundProcess[] {
    // Return all processes with status 'running'
  }

  getProcessById(id: string): BackgroundProcess | undefined {
    // Retrieve specific process by ID
  }

  updateProcessStatus(id: string, status: ProcessStatus): void {
    // Update process status and metrics
  }

  terminateProcessGroup(groupId: string): Promise<void> {
    // Terminate all processes in a group (e.g., when required task fails)
  }

  getProcessMetrics(id: string): ProcessMetrics | undefined {
    // Get performance and health metrics for a process
  }

  cleanupCompletedProcesses(): void {
    // Remove completed/failed processes from tracking
  }
}

export interface ProcessMetrics {
  startTime: number;
  lastHealthCheck: number;
  memoryUsage?: number;
  cpuUsage?: number;
  exitCode?: number;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
}

export type ProcessStatus = 'starting' | 'running' | 'completed' | 'failed' | 'terminated' | 'cleanup';
```

#### Background Process Monitoring Design

```typescript
export class ProcessMonitor {
  private healthCheckInterval = 1000; // 1 second
  private healthCheckTimeouts = new Map<string, number>();

  async startMonitoring(process: BackgroundProcess): Promise<void> {
    // 1. Set up periodic health checks
    // 2. Monitor process exit events
    // 3. Track resource usage
    // 4. Update process metrics
  }

  async performHealthCheck(process: BackgroundProcess): Promise<boolean> {
    // 1. Check if process is still running
    // 2. Verify process responsiveness (if applicable)
    // 3. Check resource usage thresholds
    // 4. Update health status
  }

  async stopMonitoring(processId: string): Promise<void> {
    // 1. Clear health check intervals
    // 2. Remove from monitoring maps
    // 3. Final metrics collection
  }

  private async checkProcessAlive(process: BackgroundProcess): Promise<boolean> {
    // Platform-specific process existence check
  }

  private async collectResourceMetrics(process: BackgroundProcess): Promise<ProcessMetrics> {
    // Collect CPU, memory, and other resource usage metrics
  }
}
```

#### Process Lifecycle States

1. **Starting**: Process is being initialized
2. **Running**: Process is actively executing
3. **Completed**: Process finished successfully
4. **Failed**: Process exited with error
5. **Terminated**: Process was forcefully stopped
6. **Cleanup**: Process resources are being cleaned up

#### Termination Strategies

```typescript
export class ProcessTerminator {
  async gracefulTermination(process: BackgroundProcess, timeoutMs = 5000): Promise<boolean> {
    // 1. Send SIGTERM signal to process
    // 2. Wait up to timeoutMs for graceful shutdown
    // 3. Return true if process exits gracefully, false if timeout
  }

  async forcefulTermination(process: BackgroundProcess): Promise<void> {
    // 1. Send SIGKILL signal for immediate termination
    // 2. Wait for process to be killed
    // 3. Clean up process resources
  }

  async terminateWithCleanup(process: BackgroundProcess): Promise<void> {
    // 1. Attempt graceful termination first
    // 2. If graceful fails, use forceful termination
    // 3. Clean up all associated resources (files, ports, etc.)
    // 4. Update process status to 'terminated'
  }

  async terminateProcessGroup(processes: BackgroundProcess[]): Promise<void> {
    // 1. Send SIGTERM to all processes simultaneously
    // 2. Wait for graceful shutdown with timeout
    // 3. Send SIGKILL to any remaining processes
    // 4. Clean up all resources
  }
}
```

#### Failure Scenario Termination Patterns

**Required Async Task Failure:**
```
1. Detect required async task failure
2. Mark all pending tasks as cancelled
3. Send SIGTERM to all running background processes
4. Wait 5 seconds for graceful shutdown
5. Send SIGKILL to any remaining processes
6. Clean up all resources
7. Exit with failure code
```

**Multiple Simultaneous Failures:**
```
1. Detect first required task failure
2. Immediately cancel all pending tasks
3. Terminate all background processes (graceful → forceful)
4. Ignore subsequent failures during cleanup
5. Report first failure as primary cause
```

**Cleanup Timeout Handling:**
```
1. Set maximum cleanup time (30 seconds)
2. If cleanup exceeds timeout, log warning
3. Proceed with forceful termination
4. Exit with appropriate error code
```

#### Failure Propagation Architecture

```typescript
export class FailurePropagator {
  async handleRequiredTaskFailure(failedProcess: BackgroundProcess): Promise<void> {
    // 1. Mark all pending tasks as cancelled
    // 2. Terminate all running background processes
    // 3. Clean up resources
    // 4. Propagate exit code
  }

  async handleOptionalTaskFailure(failedProcess: BackgroundProcess): Promise<void> {
    // 1. Log failure
    // 2. Clean up only the failed process
    // 3. Continue with other tasks
  }
}
```

## Module Structure

### 1. CLI Entry (`src/main.ts`)

**Purpose**: Parse arguments and delegate to DreamRunner

```typescript
export async function main(args: string[]): Promise<number> {
  const { task, debug } = parseArgs(args);
  const runner = new DreamRunner({ debug });
  return await runner.execute(task);
}
```

### 2. Dream Runner (`src/dream_runner.ts`)

**Purpose**: Main orchestrator - coordinates all operations

```typescript
export class DreamRunner {
  constructor(private options: RunnerOptions) {}

  async execute(taskName: string): Promise<number> {
    const config = await this.configManager.load();
    const currentProject = this.getCurrentProject();
    const plan = this.dependencyResolver.resolve(config, currentProject, taskName);
    return await this.taskExecutor.execute(plan);
  }
}
```

### 3. Config Manager (`src/config_manager.ts`)

**Purpose**: Load and validate dream.json configuration

```typescript
export interface DreamConfig {
  workspace: Record<string, Record<string, Dependency[]>>;
  tasks?: Record<string, TaskDefaults>;
  recursive?: RecursiveConfig[];
}

export interface RecursiveConfig {
  project: string;
  tasks: string[];
}

export interface Dependency {
  projectPath: string;
  task?: string;
  async?: boolean;
  required?: boolean;
  delay?: number;
}

export class ConfigManager {
  async load(): Promise<DreamConfig> {
    const configPath = await this.findConfigFile();
    const content = await Deno.readTextFile(configPath);
    return this.validate(JSON.parse(content));
  }
}
```

### 4. Dependency Resolver (`src/dependency_resolver.ts`)

**Purpose**: Build execution plan from configuration

```typescript
export interface ExecutionPlan {
  tasks: TaskExecution[];
}

export interface TaskExecution {
  id: string;
  projectPath: string;
  taskName: string;
  async: boolean;
  required: boolean;
  delay: number;
}

export class DependencyResolver {
  resolve(config: DreamConfig, currentProject: string, taskName: string): ExecutionPlan {
    // Build dependency graph and create execution order
  }
}
```

### 5. Task Executor (`src/task_executor.ts`)

**Purpose**: Execute tasks according to the plan with async/sync orchestration and background process management

```typescript
export class TaskExecutor {
  async executeTasks(taskExecutions: TaskExecution[]): Promise<TaskResult[]> {
    // Execute tasks with proper async/sync handling, delays, and error propagation
    // - Sync tasks execute sequentially
    // - Async tasks execute concurrently in background
    // - Required task failures stop execution and terminate background processes
    // - Optional task failures continue execution
  }

  async executeTask(taskExecution: TaskExecution): Promise<TaskResult> {
    // Execute single task without throwing on failure
  }

  async executeTaskWithErrorHandling(taskExecution: TaskExecution): Promise<TaskResult> {
    // Execute single task and throw TaskExecutionError on required task failure
  }

  // Background Process Management Methods
  async startBackgroundTask(taskExecution: TaskExecution): Promise<BackgroundProcess> {
    // Start task in background and return process handle for tracking
  }

  async terminateBackgroundProcesses(processes: BackgroundProcess[]): Promise<void> {
    // Gracefully terminate background processes, then forcefully if needed
  }

  async waitForBackgroundProcesses(processes: BackgroundProcess[]): Promise<TaskResult[]> {
    // Wait for all background processes to complete and return results
  }

  private async executeTaskWithDelay(taskExecution: TaskExecution): Promise<TaskResult> {
    // Apply delay timing: BEFORE for sync tasks, AFTER for async tasks
  }

  private async monitorProcessHealth(process: BackgroundProcess): Promise<void> {
    // Monitor background process health and status
  }

  private async cleanupFailedProcesses(processes: BackgroundProcess[]): Promise<void> {
    // Clean up resources from failed background processes
  }
}

export interface BackgroundProcess {
  id: string;
  process: Deno.ChildProcess;
  taskExecution: TaskExecution;
  startTime: number;
  status: 'running' | 'completed' | 'failed' | 'terminated';
  result?: TaskResult;
}
```

## Concrete Interfaces

### Core Types (`src/types.ts`)

```typescript
// Configuration types
export interface DreamConfig {
  workspace: Record<string, ProjectConfig>;
  tasks?: Record<string, TaskDefaults>;
}

export interface ProjectConfig {
  [taskName: string]: Dependency[];
}

export type Dependency = string | DetailedDependency;

export interface DetailedDependency {
  projectPath: string;
  task?: string;
  async?: boolean;
  required?: boolean;
  delay?: number;
}

export interface TaskDefaults {
  async?: boolean;
  required?: boolean;
  delay?: number;
}

// Execution types
export interface ExecutionPlan {
  tasks: TaskExecution[];
}

export interface TaskExecution {
  id: string;
  projectPath: string;
  taskName: string;
  async: boolean;
  required: boolean;
  delay: number;
}

export interface TaskResult {
  success: boolean;
  exitCode: number;
  output: string;
  error?: string;
  duration: number;
}

// Runner options
export interface RunnerOptions {
  debug?: boolean;
  workspaceRoot?: string;
}
```

### Error Types (`src/errors.ts`)

```typescript
export class DreamError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export class ConfigError extends DreamError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
  }
}

export class CircularDependencyError extends DreamError {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(" -> ")}`, "CIRCULAR_DEPENDENCY");
  }
}

export class TaskExecutionError extends DreamError {
  constructor(taskId: string, exitCode: number) {
    super(`Task ${taskId} failed with exit code ${exitCode}`, "TASK_EXECUTION_ERROR");
  }
}
```

## Testing Strategy

### Test Structure

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── config_manager.test.ts
│   ├── dependency_resolver.test.ts
│   ├── task_executor.test.ts
│   └── dream_runner.test.ts
├── integration/             # Integration tests
│   ├── simple_workspace.test.ts
│   ├── async_dependencies.test.ts
│   └── error_scenarios.test.ts
├── e2e/                     # End-to-end tests with real processes
│   ├── microservices.test.ts
│   └── build_pipeline.test.ts
└── fixtures/                # Test workspaces and configurations
    ├── simple/
    ├── microservices/
    └── error_cases/
```

### Testing Approach

#### 1. Unit Tests - Mock Everything External

```typescript
// tests/unit/task_executor.test.ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { TaskExecutor } from "../src/task_executor.ts";

class MockProcessRunner {
  private expectations: Map<string, TaskResult> = new Map();

  expect(taskId: string, result: TaskResult) {
    this.expectations.set(taskId, result);
  }

  async run(command: string[], cwd: string): Promise<TaskResult> {
    const taskId = `${cwd}:${command.join(" ")}`;
    return this.expectations.get(taskId) ||
      { success: false, exitCode: 1, output: "", duration: 0 };
  }
}

Deno.test("TaskExecutor - executes tasks in correct order", async () => {
  const mockRunner = new MockProcessRunner();
  const executor = new TaskExecutor(mockRunner);

  mockRunner.expect("./packages/utils:deno task build", {
    success: true,
    exitCode: 0,
    output: "Built utils",
    duration: 100,
  });
  mockRunner.expect("./packages/auth:deno task build", {
    success: true,
    exitCode: 0,
    output: "Built auth",
    duration: 150,
  });

  const plan: ExecutionPlan = {
    tasks: [
      {
        id: "utils:build",
        projectPath: "./packages/utils",
        taskName: "build",
        async: false,
        required: true,
        delay: 0,
      },
      {
        id: "auth:build",
        projectPath: "./packages/auth",
        taskName: "build",
        async: false,
        required: true,
        delay: 0,
      },
    ],
  };

  const result = await executor.execute(plan);
  assertEquals(result, 0);
});
```

#### 2. Integration Tests - Test Component Interactions

```typescript
// tests/integration/simple_workspace.test.ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { DreamRunner } from "../src/dream_runner.ts";

Deno.test("Integration - simple linear dependencies", async () => {
  const tempDir = await Deno.makeTempDir();

  // Create test workspace
  await createTestWorkspace(tempDir, {
    "dream.json": {
      workspace: {
        "./packages/utils": { test: ["./packages/auth"] },
        "./packages/auth": { test: [] },
      },
    },
    "packages/utils/deno.json": { tasks: { test: "echo 'Testing utils'" } },
    "packages/auth/deno.json": { tasks: { test: "echo 'Testing auth'" } },
  });

  const runner = new DreamRunner({ workspaceRoot: tempDir });

  // Change to utils directory and run test
  const originalCwd = Deno.cwd();
  Deno.chdir(`${tempDir}/packages/utils`);

  try {
    const result = await runner.execute("test");
    assertEquals(result, 0);
  } finally {
    Deno.chdir(originalCwd);
    await Deno.remove(tempDir, { recursive: true });
  }
});
```

#### 3. E2E Tests - Real Deno Processes

```typescript
// tests/e2e/microservices.test.ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

class E2ETestManager {
  private processes: Deno.ChildProcess[] = [];
  private ports: number[] = [];

  async startService(projectPath: string, taskName: string): Promise<ServiceHandle> {
    const port = await this.allocatePort();
    const process = new Deno.Command("deno", {
      args: ["task", taskName],
      cwd: projectPath,
      env: { PORT: port.toString() },
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    this.processes.push(process);
    this.ports.push(port);

    return new ServiceHandle(process, port);
  }

  async cleanup() {
    // Kill all processes
    for (const process of this.processes) {
      process.kill();
      await process.status;
    }
    this.processes = [];
    this.ports = [];
  }

  private async allocatePort(): Promise<number> {
    // Find available port starting from 8000
    for (let port = 8000; port < 9000; port++) {
      if (!this.ports.includes(port)) {
        try {
          const listener = Deno.listen({ port });
          listener.close();
          return port;
        } catch {
          continue;
        }
      }
    }
    throw new Error("No available ports");
  }
}

class ServiceHandle {
  constructor(
    private process: Deno.ChildProcess,
    public port: number,
  ) {}

  async waitForReady(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const response = await fetch(`http://localhost:${this.port}/health`);
        if (response.ok) return;
      } catch {
        // Service not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Service on port ${this.port} not ready within ${timeoutMs}ms`);
  }
}

Deno.test("E2E - microservices startup orchestration", async () => {
  const testManager = new E2ETestManager();
  const tempDir = await createMicroservicesWorkspace();

  try {
    // Start database service
    const database = await testManager.startService(`${tempDir}/services/database`, "start");
    await database.waitForReady();

    // Start auth service (depends on database)
    const auth = await testManager.startService(`${tempDir}/services/auth`, "dev");
    await auth.waitForReady();

    // Start API service (depends on database and auth)
    const api = await testManager.startService(`${tempDir}/services/api`, "dev");
    await api.waitForReady();

    // Verify all services are running
    const dbHealth = await fetch(`http://localhost:${database.port}/health`);
    const authHealth = await fetch(`http://localhost:${auth.port}/health`);
    const apiHealth = await fetch(`http://localhost:${api.port}/health`);

    assertEquals(dbHealth.status, 200);
    assertEquals(authHealth.status, 200);
    assertEquals(apiHealth.status, 200);
  } finally {
    await testManager.cleanup();
    await Deno.remove(tempDir, { recursive: true });
  }
});
```

### Test Scenarios

#### Scenario 1: Simple Package Dependencies

**Workspace**: `tests/fixtures/simple/`

```
simple/
├── dream.json
├── packages/
│   ├── utils/deno.json
│   ├── auth/deno.json
│   └── api/deno.json
└── apps/
    └── web/deno.json
```

**Configuration**:

```json
{
  "workspace": {
    "./packages/utils": {
      "test": ["./packages/auth", "./packages/api", "./apps/web"]
    },
    "./packages/auth": {
      "test": ["./packages/api", "./apps/web"],
      "dev": ["./packages/utils"]
    }
  }
}
```

**Test Cases**:

- Client impact testing: `utils` change tests all dependents
- Development setup: `auth` dev starts `utils` first
- Error propagation: Failed `utils` test stops dependent tests
- Task deduplication: Same task/project runs only once

#### Scenario 2: Async Service Dependencies

**Workspace**: `tests/fixtures/microservices/`

**Configuration**:

```json
{
  "workspace": {
    "./apps/web": {
      "dev": [
        { "projectPath": "./services/database", "task": "start", "async": true, "delay": 0 },
        { "projectPath": "./services/auth", "task": "dev", "async": true, "delay": 2000 },
        { "projectPath": "./services/api", "task": "dev", "async": true, "delay": 4000 }
      ]
    }
  }
}
```

**Test Cases**:

- Async execution: Services start concurrently with delays
- Health checks: Wait for service readiness before dependents
- Graceful shutdown: Clean process termination
- Port management: Avoid port conflicts in tests

#### Scenario 3: Error Handling

**Workspace**: `tests/fixtures/error_cases/`

**Test Cases**:

- Missing `dream.json`: Clear error message
- Invalid JSON: Syntax error with line numbers
- Circular dependencies: Detect and report cycles
- Missing projects: Warning for non-existent paths
- Task failures: Proper exit codes and error messages
- Permission errors: Helpful Deno permission messages

### Mock Strategies

#### 1. Process Runner Mock

```typescript
export class MockProcessRunner {
  private expectations = new Map<string, TaskResult>();
  private calls: ProcessCall[] = [];

  expect(projectPath: string, taskName: string): TaskExpectation {
    return new TaskExpectation(this, projectPath, taskName);
  }

  async run(args: string[], cwd: string): Promise<TaskResult> {
    const call = { args, cwd, timestamp: Date.now() };
    this.calls.push(call);

    const key = `${cwd}:${args.join(" ")}`;
    const result = this.expectations.get(key);

    if (!result) {
      throw new Error(`Unexpected process call: ${key}`);
    }

    // Simulate execution time
    if (result.duration > 0) {
      await new Promise((resolve) => setTimeout(resolve, result.duration));
    }

    return result;
  }

  getCalls(): ProcessCall[] {
    return [...this.calls];
  }

  verify(): void {
    // Verify all expectations were met
    for (const [key, expectation] of this.expectations) {
      if (!expectation.called) {
        throw new Error(`Expected process call not made: ${key}`);
      }
    }
  }
}

class TaskExpectation {
  constructor(
    private mock: MockProcessRunner,
    private projectPath: string,
    private taskName: string,
  ) {}

  succeeds(output = "", duration = 0): TaskExpectation {
    const key = `${this.projectPath}:deno task ${this.taskName}`;
    this.mock.expectations.set(key, {
      success: true,
      exitCode: 0,
      output,
      duration,
    });
    return this;
  }

  fails(exitCode = 1, error = "", duration = 0): TaskExpectation {
    const key = `${this.projectPath}:deno task ${this.taskName}`;
    this.mock.expectations.set(key, {
      success: false,
      exitCode,
      output: "",
      error,
      duration,
    });
    return this;
  }
}
```

#### 2. File System Mock

```typescript
export class MockFileSystem {
  private files = new Map<string, string>();

  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  async readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Deno.errors.NotFound(`File not found: ${path}`);
    }
    return content;
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}
```

### Test Utilities

#### Workspace Builder

```typescript
export class TestWorkspaceBuilder {
  private config: any = { workspace: {} };
  private files = new Map<string, any>();

  withProject(path: string, options: ProjectOptions): TestWorkspaceBuilder {
    // Add project configuration
    this.config.workspace[path] = options.dependencies || {};

    // Add deno.json
    this.files.set(`${path}/deno.json`, {
      tasks: options.tasks || {},
    });

    return this;
  }

  async build(tempDir: string): Promise<TestWorkspace> {
    // Write dream.json
    await Deno.writeTextFile(
      `${tempDir}/dream.json`,
      JSON.stringify(this.config, null, 2),
    );

    // Write all project files
    for (const [filePath, content] of this.files) {
      const fullPath = `${tempDir}/${filePath}`;
      await Deno.mkdir(dirname(fullPath), { recursive: true });
      await Deno.writeTextFile(fullPath, JSON.stringify(content, null, 2));
    }

    return new TestWorkspace(tempDir);
  }
}

interface ProjectOptions {
  tasks?: Record<string, string>;
  dependencies?: Record<string, any>;
}

export class TestWorkspace {
  constructor(public path: string) {}

  async cleanup(): Promise<void> {
    await Deno.remove(this.path, { recursive: true });
  }
}
```

## Implementation Plan

### Phase 1: Core Implementation

1. **CLI Entry** (`src/main.ts`) - Argument parsing and error handling
2. **Types** (`src/types.ts`) - All interfaces and type definitions
3. **Config Manager** (`src/config_manager.ts`) - Load and validate configuration
4. **Dependency Resolver** (`src/dependency_resolver.ts`) - Build execution plans
5. **Task Executor** (`src/task_executor.ts`) - Execute tasks with proper async handling

### Phase 2: Testing Infrastructure

1. **Mock Classes** - Process runner, file system mocks
2. **Test Utilities** - Workspace builder, assertion helpers
3. **Unit Tests** - Test each module in isolation
4. **Integration Tests** - Test component interactions

### Phase 3: E2E Testing

1. **E2E Test Manager** - Process lifecycle management
2. **Test Scenarios** - Real workspace testing
3. **Performance Tests** - Large workspace handling

### Phase 4: Polish

1. **Error Handling** - Comprehensive error messages
2. **Logging** - Debug output and progress reporting
3. **Documentation** - Usage examples and API docs
4. **JSR Publishing** - Package for distribution

This simplified architecture focuses on solving the actual problem without unnecessary abstractions, while maintaining good testability and clear separation of concerns.

## Technology Stack & Project Setup

### Deno Configuration

#### Project Structure

```
dreamer/
├── deno.json                 # Deno configuration
├── jsr.json                  # JSR publishing configuration
├── src/
│   ├── main.ts              # CLI entry point
│   ├── dream_runner.ts      # Main orchestrator
│   ├── config_manager.ts    # Configuration handling
│   ├── dependency_resolver.ts # Dependency resolution
│   ├── task_executor.ts     # Task execution
│   ├── types.ts             # Type definitions
│   └── errors.ts            # Error classes
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── README.md
└── LICENSE
```

#### `deno.json` Configuration

```json
{
  "name": "@dream/cli",
  "version": "1.0.0",
  "exports": {
    ".": "./src/main.ts",
    "./lib": "./src/dream_runner.ts"
  },
  "tasks": {
    "dev": "deno run --allow-read --allow-run --allow-env --watch src/main.ts",
    "test": "deno test --allow-read --allow-run --allow-env --allow-write",
    "test:unit": "deno test tests/unit/ --allow-read --allow-run",
    "test:integration": "deno test tests/integration/ --allow-read --allow-run --allow-env --allow-write",
    "test:e2e": "deno test tests/e2e/ --allow-read --allow-run --allow-env --allow-write --allow-net",
    "lint": "deno lint src/ tests/",
    "fmt": "deno fmt src/ tests/",
    "check": "deno check src/main.ts",
    "build": "deno compile --allow-read --allow-run --allow-env --output=dream src/main.ts",
    "install": "deno install --allow-read --allow-run --allow-env --name=dream src/main.ts"
  },
  "lint": {
    "rules": {
      "tags": ["recommended"]
    }
  },
  "fmt": {
    "useTabs": false,
    "lineWidth": 100,
    "indentWidth": 2,
    "semiColons": true,
    "singleQuote": false,
    "proseWrap": "preserve"
  },
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "imports": {
    "@std/path": "jsr:@std/path@^1.0.0",
    "@std/fs": "jsr:@std/fs@^1.0.0",
    "@std/testing": "jsr:@std/testing@^1.0.0",
    "@std/assert": "jsr:@std/assert@^1.0.0",
    "@std/cli": "jsr:@std/cli@^1.0.0"
  }
}
```

#### `jsr.json` Configuration for Publishing

```json
{
  "name": "@dream/cli",
  "version": "1.0.0",
  "description": "Dependency-aware task execution for Deno monorepos",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/dreamer.git"
  },
  "exports": {
    ".": "./src/main.ts",
    "./lib": "./src/dream_runner.ts",
    "./types": "./src/types.ts"
  },
  "publish": {
    "exclude": [
      "tests/",
      "docs/",
      ".github/",
      "*.test.ts",
      "fixtures/"
    ],
    "include": [
      "src/",
      "README.md",
      "LICENSE",
      "deno.json"
    ]
  }
}
```

### Deno-Specific Implementation Details

#### Process Execution with Deno

```typescript
// src/task_executor.ts - Deno process handling
export class TaskExecutor {
  async execute(plan: ExecutionPlan): Promise<number> {
    const results: TaskResult[] = [];

    for (const task of plan.tasks) {
      if (task.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, task.delay));
      }

      if (task.async) {
        // Start async task without waiting
        this.runTaskAsync(task).then((result) => results.push(result));
      } else {
        // Run synchronously
        const result = await this.runTask(task);
        results.push(result);

        if (!result.success && task.required) {
          return result.exitCode;
        }
      }
    }

    // Wait for all async tasks to complete
    // Implementation details...

    return results.every((r) => r.success) ? 0 : 1;
  }

  private async runTask(task: TaskExecution): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const command = new Deno.Command("deno", {
        args: ["task", task.taskName],
        cwd: task.projectPath,
        stdout: "piped",
        stderr: "piped",
        env: Deno.env.toObject(), // Pass through environment variables
      });

      const process = command.spawn();
      const { code, stdout, stderr } = await process.output();

      const output = new TextDecoder().decode(stdout);
      const error = new TextDecoder().decode(stderr);

      return {
        success: code === 0,
        exitCode: code,
        output,
        error: error || undefined,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
}
```

#### File System Operations with Deno

```typescript
// src/config_manager.ts - Deno file system usage
import { dirname, join } from "@std/path";
import { exists } from "@std/fs";

export class ConfigManager {
  async load(): Promise<DreamConfig> {
    const configPath = await this.findConfigFile();

    try {
      const content = await Deno.readTextFile(configPath);
      const config = JSON.parse(content);
      return this.validate(config);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new ConfigError(`Configuration file not found: ${configPath}`);
      }
      if (error instanceof SyntaxError) {
        throw new ConfigError(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  private async findConfigFile(): Promise<string> {
    let currentDir = Deno.cwd();

    while (true) {
      const configPath = join(currentDir, "dream.json");

      if (await exists(configPath)) {
        return configPath;
      }

      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached root directory
        throw new ConfigError(
          "No dream.json configuration file found in current directory or any parent directory",
        );
      }

      currentDir = parentDir;
    }
  }
}
```

### Installation & Usage

#### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/dreamer.git
cd dreamer

# Install dependencies (Deno handles this automatically)
deno task check

# Run tests
deno task test

# Install locally for development
deno task install

# Use the CLI
dream test
```

#### Publishing to JSR

```bash
# Ensure all tests pass
deno task test

# Check formatting and linting
deno task fmt --check
deno task lint

# Type check
deno task check

# Publish to JSR (requires authentication)
deno publish
```

#### Installation from JSR

```bash
# Install globally
deno install -A jsr:@dream/cli

# Or use directly
deno run -A jsr:@dream/cli test

# Use in a project
import { DreamRunner } from "jsr:@dream/cli/lib";
```

### Required Deno Permissions

The CLI requires these permissions:

- `--allow-read`: Read configuration files and project structures
- `--allow-run`: Execute `deno task` commands in project directories
- `--allow-env`: Access environment variables for child processes

Optional permissions:

- `--allow-write`: For E2E tests that create temporary files
- `--allow-net`: For E2E tests with network services
