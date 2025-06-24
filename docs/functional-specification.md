# Dream CLI - Functional Specification

## Overview

Dream CLI is a Deno runtime-specific task dependency execution tool designed for monorepo workspaces. It enables developers to efficiently manage complex project dependencies by automatically discovering and executing tasks in the correct order while respecting execution requirements.

## Core Objectives

### 1. Dependency-Aware Testing (Client Impact Testing)
**Problem**: When you change a shared library or service, you need to ensure it doesn't break projects that use it.

**Solution**: Configure which "client" projects should be tested when a project changes.

**Example**: When you modify `./packages/auth`, automatically test `./services/api` and `./apps/web` (which both use auth) to ensure your changes don't break them.

**Configuration Pattern**:
```json
{
  "workspace": {
    "./packages/auth": {
      "test": ["./services/api", "./apps/web"]
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
        {"projectPath": "./services/database", "task": "start", "async": true},
        {"projectPath": "./services/auth", "task": "dev", "async": true, "delay": 2000},
        {"projectPath": "./services/api", "task": "dev", "async": true, "delay": 4000}
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

#### Simple Format (String) - For Testing Clients
Use when you want to test projects that use the current project:
```json
{
  "workspace": {
    "./packages/auth": {
      "test": ["./services/api", "./apps/web"]
    }
  }
}
```
**Meaning**: When testing `./packages/auth`, also test `./services/api` and `./apps/web` (which are clients of auth).

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
**Meaning**: When running `dream dev` from `./apps/web`, start database immediately, then start API service after 3 seconds.

#### Mixed Format - Combining Both Patterns
```json
{
  "workspace": {
    "./packages/shared": {
      "test": ["./services/api", "./apps/web"],
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
- For testing: Test shared package, then test its clients (api, web)
- For development: Start database service, then start shared package development

### Configuration Properties

#### Workspace Section
- **Key**: Project path relative to workspace root
- **Value**: Object mapping task names to arrays of:
  - **For `test` tasks**: Client projects that should be tested when this project changes
  - **For `dev` tasks**: Service dependencies that should be started for development
  - **For other tasks**: Projects that should execute the same task

#### Task Defaults Section
- **async**: Whether task runs concurrently (default: false)
  - `true`: Task starts immediately without waiting for completion
  - `false`: Task runs synchronously, blocking subsequent tasks until completion
- **required**: Whether task failure stops execution (default: true)
  - `true`: If task fails (non-zero exit code), execution stops and remaining tasks are skipped
  - `false`: If task fails, execution continues with remaining tasks
- **delay**: Milliseconds to wait before starting task (default: 0)
  - Applied before task execution begins
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
dream test                # Test current project + all its clients
dream dev                 # Start required services + current project dev
dream build               # Build current project + configured dependencies
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
1. **Configuration Check**: Determines if project/task should use recursive resolution based on `recursive` configuration array
2. **Dependency Processing**:
   - **Non-recursive**: Processes only direct dependencies
   - **Recursive**: Processes all transitive dependencies until leaf nodes are reached
3. **Deduplication**: Same task/project combinations execute only once regardless of resolution mode
4. **Execution Order**:
   - **For testing**: Current project first, then all configured clients (and their dependencies if recursive)
   - **For development**: All configured services first (and their dependencies if recursive), then current project
5. **Circular Detection**: Circular dependencies are detected and reported in both modes

### Execution Order
1. **Testing Tasks**:
   - Execute task on current project first
   - Then execute same task on all configured client projects
2. **Development Tasks**:
   - Start all configured service dependencies first (with delays)
   - Then start current project's development task
3. **Async Handling**: Async dependencies run concurrently but respect delay settings
4. **Failure Propagation**: Required task failures stop dependent execution
5. **Task Deduplication**: Same task/project combination runs only once per execution
6. **Execution Order**: Dependencies execute before dependents (depth-first resolution)

### Task Execution Details
- **Working Directory**: Each task runs in its project's directory
- **Command**: Executes `deno task <task-name>` in project directory
- **Output**: Task output is displayed in real-time

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
- **`true`**: Tasks start immediately without waiting, allowing concurrent execution
- **Mixed execution**: Sync tasks block until complete, async tasks run in parallel

**`required` Parameter:**
- **`true` (default)**: Task failure (non-zero exit code) stops all subsequent execution
- **`false`**: Task failure is logged but execution continues with remaining tasks
- **Applies to**: Both sync and async tasks

**`delay` Parameter:**
- **Applied**: Before task execution begins (after any previous task completes)
- **Units**: Milliseconds
- **Use case**: Service orchestration (e.g., wait for database to start before API)
- **Async interaction**: Delays are applied even for async tasks before they start

#### Execution Examples

**Sequential Execution (all sync):**
```
Task A (sync, required) → Task B (sync, required) → Task C (sync, optional)
```
If Task B fails, Task C is skipped.

**Concurrent Execution (mixed async/sync):**
```
Task A (sync, required) → [Task B (async) + Task C (async)] → Task D (sync)
```
Task A completes first, then B and C run concurrently, then D waits for both B and C.

**With Delays:**
```
Task A (delay: 0ms) → wait 1000ms → Task B (delay: 1000ms) → wait 2000ms → Task C (delay: 2000ms)
```
- **Error Handling**: Non-zero exit codes are treated as failures

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

### Use Case 1: Client Impact Testing
**Scenario**: You modify a shared authentication package and want to ensure it doesn't break any services or apps that use it.

**Configuration**:
```json
{
  "workspace": {
    "./packages/auth": {
      "test": ["./services/user-service", "./services/api-gateway", "./apps/web", "./apps/mobile"]
    }
  }
}
```

**Usage**:
```bash
cd packages/auth
dream test
# Executes: auth tests → user-service tests → api-gateway tests → web tests → mobile tests
```

### Use Case 2: Development Environment Setup
**Scenario**: You want to develop a web application that requires a database, authentication service, and API service to be running.

**Configuration**:
```json
{
  "workspace": {
    "./apps/web": {
      "dev": [
        {"projectPath": "./services/database", "task": "start", "async": true, "delay": 0},
        {"projectPath": "./services/auth", "task": "dev", "async": true, "delay": 3000},
        {"projectPath": "./services/api", "task": "dev", "async": true, "delay": 5000}
      ]
    }
  }
}
```

**Usage**:
```bash
cd apps/web
dream dev
# Executes: database start → auth dev (3s delay) → api dev (5s delay) → web dev
```

### Use Case 3: Service Dependency Testing
**Scenario**: You modify a database service and want to test all services that connect to it.

**Configuration**:
```json
{
  "workspace": {
    "./services/database": {
      "test": ["./services/user-service", "./services/order-service", "./services/analytics"]
    }
  }
}
```

**Usage**:
```bash
cd services/database
dream test
# Executes: database tests → user-service tests → order-service tests → analytics tests
```

### Use Case 4: Continuous Integration
**Scenario**: Run comprehensive testing with detailed logging for CI/CD pipeline.

**Usage**:
```bash
# Test a core package and all its clients with debug output
cd packages/core
dream test --debug
```
