# Dream CLI - Functional Specification

## Overview

Dream CLI is a Deno runtime-specific task dependency execution tool designed for monorepo workspaces. It enables developers to efficiently manage complex project dependencies by executing explicitly configured dependencies in the correct order while respecting execution requirements. The tool is task-agnostic - the same dependency resolution logic applies to any task name (test, dev, build, deploy, etc.).

## Core Objectives

### 1. Dependency-Aware Task Execution

**Problem**: When working on a project, you need to ensure its dependencies are properly set up and executed in the correct order.

**Solution**: Configure which dependency projects should be executed when running a task on the current project.

**Example**: When you run `dream test` in `./services/api`, automatically execute tests for `./packages/auth` and `./packages/utils` first to ensure dependencies are working correctly.

**Configuration Pattern**:

```json
{
  "workspace": {
    "./services/api": {
      "test": ["./packages/auth", "./packages/utils"]
    }
  }
}
```

### 2. Development Environment Orchestration (Service Dependency Startup)

**Problem**: When developing a project, you need to manually start all the services it depends on.

**Solution**: Configure which services should be started when you begin development.

**Example**: When you run `dream dev` from `./apps/web`, automatically start the database, auth service, and API service that the web app needs.

**Configuration Pattern**:

```json
{
  "workspace": {
    "./apps/web": {
      "dev": [
        { "projectPath": "./services/database", "task": "start", "async": true },
        { "projectPath": "./services/auth", "task": "dev", "async": true, "delay": 2000 },
        { "projectPath": "./services/api", "task": "dev", "async": true, "delay": 4000 }
      ]
    }
  }
}
```

### 3. Flexible Configuration

Provide a JSON-based configuration system that supports both simple and complex dependency definitions with fine-grained control over execution behavior.

## Architecture

### Core Components

1. **Configuration Discovery**: Automatically locates `dream.json` configuration files
2. **Dependency Resolution**: Builds execution chains based on project dependencies
3. **Task Execution Engine**: Executes tasks respecting async/sync, timing, and failure requirements
4. **Workspace Integration**: Works seamlessly with Deno workspaces and `deno.json` files

### Execution Model

- **Sequential Execution**: Tasks execute in dependency order by default
- **Async Support**: Tasks can run concurrently when marked as async
- **Failure Handling**: Required tasks stop execution on failure; optional tasks continue
- **Timing Control**: Configurable delays between task executions
- **Working Directory Isolation**: Each task runs in its project's directory

## Configuration Format

### File Location

- Configuration file: `dream.json`
- Located at workspace root
- Automatically discovered by traversing parent directories

### Schema Structure

```json
{
  "workspace": {
    "<project-path>": {
      "<task-name>": [<dependencies>]
    }
  },
  "tasks": {
    "<task-name>": {
      "async": boolean,
      "required": boolean,
      "delay": number
    }
  },
  "recursive": [
    {
      "project": "<project-path>",
      "tasks": ["<task-name>"]
    }
  ]
}
```

### Dependency Definition Formats

#### Simple Format (String) - For Dependency Execution

Use when you want to execute dependencies before the current project:

```json
{
  "workspace": {
    "./services/api": {
      "test": ["./packages/auth", "./packages/utils"]
    }
  }
}
```

**Meaning**: When testing `./services/api`, first test `./packages/auth` and `./packages/utils` (which are dependencies of the API service).

#### Detailed Format (Object) - For Development Dependencies

Use when you need to start services with specific configurations:

```json
{
  "workspace": {
    "./apps/web": {
      "dev": [
        {
          "projectPath": "./services/database",
          "task": "start",
          "async": true,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./services/api",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 3000
        }
      ]
    }
  }
}
```

**Meaning**: When running `dream dev` from `./apps/web`, start database immediately in background, start API service immediately in background, wait 3 seconds after starting API, then start web dev.

#### Mixed Format - Combining Both Patterns

```json
{
  "workspace": {
    "./services/api": {
      "test": ["./packages/shared", "./packages/utils"],
      "dev": [
        {
          "projectPath": "./services/database",
          "task": "start",
          "async": true,
          "required": true,
          "delay": 0
        }
      ]
    }
  }
}
```

**Meaning**:

- For testing: Test dependencies first, then test the current project
- For development: Start database service, then start API service development

### Configuration Properties

#### Workspace Section

- **Key**: Project path relative to workspace root
- **Value**: Object mapping task names to arrays of:
  - **For all tasks**: Dependency projects that should be executed before the current project
  - Task names are arbitrary - the same dependency resolution logic applies regardless of task name

#### Task Defaults Section

- **async**: Whether task runs in background without blocking subsequent tasks (default: false)
  - `true`: Task starts in background and runner continues immediately to next task without waiting for completion
  - `false`: Task runs synchronously, blocking subsequent tasks until completion
- **required**: Whether task failure stops execution (default: true)
  - `true`: If task fails (non-zero exit code), execution stops and remaining tasks are skipped
  - `false`: If task fails, execution continues with remaining tasks
- **delay**: Milliseconds to wait (default: 0)
  - **For async tasks**: Applied AFTER starting the task, before starting next task
  - **For sync tasks**: Applied BEFORE starting the task (unchanged behavior)
  - Useful for service startup orchestration (e.g., database before API)

#### Recursive Section (Optional)

- **Purpose**: Controls which projects/tasks use recursive dependency resolution
- **Default**: Non-recursive resolution for all projects/tasks
- **Structure**: Array of configuration objects

**Configuration Object Properties:**

- **project** (string, required): Relative path to project from workspace root
- **tasks** (string[], required): Array of task names that should use recursive resolution

**Example:**

```json
{
  "recursive": [
    {
      "project": "./packages/core",
      "tasks": ["test", "build"]
    },
    {
      "project": "./services/auth",
      "tasks": ["test"]
    }
  ]
}
```

**Behavior:**

- `./packages/core` uses recursive resolution for `test` and `build` tasks
- `./services/auth` uses recursive resolution for `test` task only
- All other projects/tasks use non-recursive resolution (default)

#### Dependency Properties (Detailed Format)

- **projectPath**: Target project path (required)
- **task**: Task name to execute (defaults to current task name)
- **async**: Override default async behavior
- **required**: Override default required behavior
- **delay**: Override default delay behavior

## Command Line Interface

### Basic Usage

```bash
dream <task>              # Execute task and its dependencies
dream --help              # Show help message
dream --version           # Show version information
dream --debug             # Enable debug output
```

### Examples

```bash
dream test                # Test configured dependencies + current project
dream dev                 # Start required services + current project dev
dream build               # Build configured dependencies + current project
dream e2e                 # Run e2e tests with configured setup
```

### Command Line Options

#### Positional Arguments

- `<task>`: Task name to execute (required)

#### Flags

- `--help, -h`: Display help information
- `--version, -v`: Display version information
- `--debug, -d`: Enable verbose debug output

### Exit Codes

- `0`: All tasks completed successfully
- `1`: One or more tasks failed or configuration error

## Execution Behavior

### Task Discovery Process

1. Start from current working directory
2. Traverse up directory tree to find `dream.json`
3. Load and validate configuration
4. Identify current project based on working directory
5. Build dependency chain for requested task

### Dependency Resolution

#### Resolution Modes

1. **Non-Recursive (Default)**: Only processes immediate dependencies listed in configuration
2. **Recursive**: Processes dependencies of dependencies (transitive dependencies) when enabled via `recursive` configuration

#### Resolution Behavior

1. **Explicit Dependencies Only**: Only processes dependencies explicitly configured in the `workspace` section
2. **No Auto-Discovery**: Never automatically discovers or includes projects that depend on the current project
3. **Configuration Check**: Determines if project/task should use recursive resolution based on `recursive` configuration array
4. **Dependency Processing**:
   - **Non-recursive**: Processes only direct dependencies listed in configuration
   - **Recursive**: Processes all transitive dependencies until leaf nodes are reached
5. **Deduplication**: Same task/project combinations execute only once regardless of resolution mode
6. **Execution Order**: All configured dependencies first (and their dependencies if recursive), then current project
7. **Circular Detection**: Circular dependencies are detected and reported in both modes

### Execution Order

1. **All Tasks**:
   - Execute configured dependencies first (in dependency order)
   - Then execute the current project's task
   - Task names are arbitrary - same logic applies to test, dev, build, deploy, etc.
2. **Async Handling**: Async dependencies run concurrently but respect delay settings
3. **Failure Propagation**: Required task failures stop dependent execution
4. **Task Deduplication**: Same task/project combination runs only once per execution
5. **Execution Order**: Dependencies execute before dependents (depth-first resolution)

### Task Execution Details

- **Working Directory**: Each task runs in its project's directory
- **Command**: Executes `deno task <task-name>` in project directory
- **Output**: Task output is displayed in real-time

### Process Lifecycle Management

#### Background Process Management

- **Process Tracking**: All async tasks are tracked as background processes
- **Process Monitoring**: Background processes are monitored for health and exit status
- **Concurrent Execution**: Multiple async tasks can run simultaneously without blocking each other

#### Process Termination

- **Graceful Shutdown**: Background processes receive termination signals for clean shutdown
- **Forceful Termination**: Processes that don't respond to graceful shutdown are forcefully terminated
- **Failure Propagation**: When a required async task fails, all running background processes are terminated

#### Process Cleanup

- **Automatic Cleanup**: Background processes are automatically cleaned up when execution completes
- **Failure Cleanup**: Failed processes are properly cleaned up to prevent resource leaks
- **Signal Handling**: Proper signal handling ensures processes can perform cleanup operations

### Execution Order and Parameter Effects

#### Execution Order Logic

1. **Dependency Resolution**: Dependencies are resolved depth-first
2. **Task Deduplication**: Each unique task/project combination executes only once
3. **Execution Sequence**: Dependencies execute before their dependents
4. **Recursive vs Non-Recursive**:
   - **Recursive**: Resolves dependencies of dependencies (full dependency tree)
   - **Non-Recursive**: Only resolves direct dependencies (one level deep)

#### Parameter Effects in Detail

**`async` Parameter:**

- **`false` (default)**: Tasks execute sequentially, each waiting for the previous to complete
- **`true`**: Tasks start in background without blocking subsequent tasks, allowing concurrent execution
- **Mixed execution**: Sync tasks block until complete, async tasks run concurrently in background

**`required` Parameter:**

- **`true` (default)**: Task failure (non-zero exit code) stops all subsequent execution
- **`false`**: Task failure is logged but execution continues with remaining tasks
- **Applies to**: Both sync and async tasks

**`delay` Parameter:**

- **For async tasks**: Applied AFTER starting the task, before starting next task
- **For sync tasks**: Applied BEFORE starting the task (after any previous task completes)
- **Units**: Milliseconds
- **Use case**: Service orchestration (e.g., wait for database to start before API)
- **Timing difference**: Critical distinction between async (delay after start) vs sync (delay before start)

#### Execution Examples

**Sequential Execution (all sync):**

```
Task A (sync, required) → Task B (sync, required) → Task C (sync, optional)
Total time: A_time + B_time + C_time
```

If Task B fails, Task C is skipped.

**Concurrent Execution (mixed async/sync):**

```
Task A (sync, required) → [Task B (async) + Task C (async)] → Task D (sync)
Total time: A_time + max(B_time, C_time) + D_time
Background: B and C run concurrently after A completes
```

Task A completes first, then B and C start concurrently in background, then D waits for both B and C to complete.

**Async with Delays (Correct Behavior):**

```
Task A (async, delay: 0ms) → immediately start Task B (async, delay: 2000ms) → wait 2000ms → Task C (sync)
Total time: max(A_time, B_time + 2000ms) + C_time
Background: A starts immediately, B starts immediately, wait 2000ms after B starts, then C waits for both
```

**Sync with Delays (Current Behavior):**

```
Task A (sync, delay: 1000ms) → wait 1000ms → Task B (sync, delay: 2000ms) → wait 2000ms → Task C (sync)
Total time: 1000ms + A_time + 2000ms + B_time + C_time
```

- **Error Handling**: Non-zero exit codes are treated as failures

### Async Task Failure Propagation

#### Required Async Task Failures

- **Immediate Termination**: When a required async task fails, all running background processes are immediately terminated
- **Pending Task Cancellation**: All pending tasks (not yet started) are cancelled and skipped
- **Cleanup Process**: Failed and terminated processes are properly cleaned up to prevent resource leaks
- **Exit Code Propagation**: The failure exit code is propagated to the main process

#### Optional Async Task Failures

- **Continued Execution**: When an optional async task fails, other tasks continue running normally
- **Failure Logging**: The failure is logged but does not affect other task execution
- **Background Cleanup**: Only the failed optional task is cleaned up, others continue running

#### Mixed Failure Scenarios

- **Multiple Failures**: If multiple async tasks fail simultaneously, the first required failure triggers termination
- **Sync Task Dependencies**: Sync tasks that depend on failed async tasks are skipped
- **Graceful vs Forceful**: Background processes are given time for graceful shutdown before forceful termination

## Error Handling

### Configuration Errors

- Missing `dream.json`: Clear error message with search path
- Invalid JSON: Syntax error details with line numbers
- Schema validation: Specific property validation errors
- Missing projects: Warning for referenced but non-existent projects

### Execution Errors

- **Task Not Found**: List available tasks for the project
- **Project Not Found**: Clear error with expected path
- **Permission Errors**: Helpful messages about required Deno permissions
- **Circular Dependencies**: Detailed cycle detection with path

### Recovery Strategies

- **Optional Tasks**: Continue execution when non-required tasks fail
- **Partial Success**: Report which tasks succeeded/failed
- **Debug Mode**: Verbose logging for troubleshooting

## Integration Requirements

### Deno Workspace Compatibility

- Works with standard Deno workspace structures
- Respects `deno.json` task definitions
- Compatible with Deno's module resolution
- Supports Deno's permission model

### File System Requirements

- **Permissions**: Requires `--allow-read` and `--allow-run`
- **Structure**: Projects must have `deno.json` files
- **Paths**: All paths are relative to workspace root

### Runtime Requirements

- **Deno Version**: Compatible with Deno 1.40+
- **Dependencies**: Uses only Deno standard library
- **Performance**: Efficient for large monorepos (100+ projects)

## Use Cases

### Use Case 1: Dependency-Aware Testing

**Scenario**: You want to test a service that depends on shared packages, ensuring all dependencies are tested first.

**Configuration**:

```json
{
  "workspace": {
    "./services/api-gateway": {
      "test": ["./packages/auth", "./packages/utils", "./packages/validation"]
    }
  }
}
```

**Usage**:

```bash
cd services/api-gateway
dream test
# Executes: auth tests → utils tests → validation tests → api-gateway tests
```

### Use Case 2: Development Environment Setup

**Scenario**: You want to develop a web application that requires a database, authentication service, and API service to be running.

**Configuration**:

```json
{
  "workspace": {
    "./apps/web": {
      "dev": [
        { "projectPath": "./services/database", "task": "start", "async": true, "delay": 0 },
        { "projectPath": "./services/auth", "task": "dev", "async": true, "delay": 3000 },
        { "projectPath": "./services/api", "task": "dev", "async": true, "delay": 5000 }
      ]
    }
  }
}
```

**Usage**:

```bash
cd apps/web
dream dev
# Correct Execution: database start (async) → auth dev starts immediately (async) → wait 3s → api dev starts (async) → wait 5s → web dev
# Total time: max(database_time, auth_time + 3000ms, api_time + 5000ms) + web_dev_time
# Background: database, auth, and api all run concurrently
```

### Use Case 3: Build Pipeline with Dependencies

**Scenario**: You want to build a service that requires its dependencies to be built first.

**Configuration**:

```json
{
  "workspace": {
    "./services/api": {
      "build": ["./packages/shared", "./packages/types", "./packages/config"]
    }
  }
}
```

**Usage**:

```bash
cd services/api
dream build
# Executes: shared build → types build → config build → api build
```

### Use Case 4: Continuous Integration

**Scenario**: Run comprehensive testing with detailed logging for CI/CD pipeline.

**Usage**:

```bash
# Test a service and its dependencies with debug output
cd services/api
dream test --debug
```
