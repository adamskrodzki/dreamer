# Dream CLI

**Dependency-aware task execution for Deno monorepos**

Dream CLI solves two critical problems in monorepo development:

1. **Dependency-Aware Testing** - Automatically test projects that depend on your changes to ensure nothing breaks
2. **Development Environment Orchestration** - Automatically start all required services when developing a project

## Why Dream CLI?

### The Problem

In complex monorepos, making changes to one project can break others. Traditional approaches require:

- Manually remembering which projects depend on your changes
- Manually starting multiple services in the correct order for development
- Running tests across multiple projects to ensure changes don't break clients

### The Solution

Dream CLI uses explicit configuration to automatically:

- Execute tests on projects that import/depend on your changes
- Start service dependencies in the correct order with proper timing
- Handle both simple dependency chains and complex service orchestration

## Core Features

- **🔗 Dependency-Aware Testing**: Test your project + all projects that depend on it
- **🚀 Service Orchestration**: Start service dependencies with delays and async support
- **⚙️ Flexible Configuration**: Support both simple strings and detailed dependency objects
- **🦕 Deno-Native**: Built specifically for Deno with proper permission handling
- **🔄 Recursive Resolution**: Optional deep dependency resolution for complex dependency trees
- **⚡ Async Execution**: Run tasks concurrently where possible for faster execution

## Quick Start

```bash
# Install from JSR
deno install --allow-read --allow-run --allow-env --name=dream --global jsr:@jinxcodesai/dreamer-cli

# Show help and available commands
dream --help
```

## How It Works

### 1. Dependency-Aware Testing

When you modify a shared package, Dream CLI automatically tests all projects that depend on it:

```bash
# Working in ./packages/auth
dream test
# Executes: auth tests → api tests → web app tests
```

This ensures your changes don't break client projects.

### 2. Development Environment Orchestration

When you start development, Dream CLI automatically starts all required services:

```bash
# Working in ./apps/web
dream dev
# Executes: database start → auth service (2s delay) → api service (4s delay) → web dev
```

This eliminates manual service startup and ensures proper initialization order.

## Configuration

Create a `dream.json` file in your workspace root:

```json
{
  "workspace": {
    "./packages/auth": {
      "test": ["./services/api", "./apps/web"]
    },
    "./apps/web": {
      "dev": [
        { "projectPath": "./services/database", "task": "start", "async": true },
        { "projectPath": "./services/api", "task": "dev", "async": true, "delay": 2000 }
      ]
    }
  },
  "recursive": [
    {
      "project": "./packages/auth",
      "tasks": ["test"]
    }
  ]
}
```

### Configuration Formats

**Simple Format** - For dependency testing:

```json
{
  "workspace": {
    "./packages/utils": {
      "test": ["./services/api", "./apps/web"]
    }
  }
}
```

**Detailed Format** - For service orchestration:

```json
{
  "workspace": {
    "./apps/web": {
      "dev": [
        {
          "projectPath": "./services/database",
          "task": "start",
          "async": true,
          "delay": 0
        },
        {
          "projectPath": "./services/api",
          "task": "dev",
          "async": true,
          "delay": 3000
        }
      ]
    }
  }
}
```

## Usage

```bash
# Test your project and all projects that depend on it
dream test

# Start all required services, then start your project
dream dev

# Build dependencies, then build your project
dream build

# Any task name works - Dream CLI is task-agnostic
dream deploy
dream e2e
dream lint
```

## Advanced Features

### Recursive Dependency Resolution

Enable deep dependency resolution for complex dependency trees:

```json
{
  "recursive": [
    {
      "project": "./packages/core",
      "tasks": ["test"]
    }
  ]
}
```

When enabled, Dream CLI will recursively resolve dependencies of dependencies.

### Task Configuration

Control execution behavior with detailed task configuration:

```json
{
  "tasks": {
    "dev": {
      "async": true, // Run concurrently
      "required": false, // Continue on failure
      "delay": 1000 // Wait 1s before starting
    }
  }
}
```

### Command Line Options

```bash
dream test --debug    # Enable verbose debug output
dream --version       # Show version information
dream --help          # Show help message
```

## Real-World Examples

### Microservices Architecture

```json
{
  "workspace": {
    "./apps/frontend": {
      "dev": [
        { "projectPath": "./services/database", "task": "start", "async": true },
        { "projectPath": "./services/auth", "task": "dev", "async": true, "delay": 2000 },
        { "projectPath": "./services/api", "task": "dev", "async": true, "delay": 4000 }
      ]
    },
    "./services/auth": {
      "test": ["./services/api", "./apps/frontend"]
    }
  }
}
```

### Package Library

```json
{
  "workspace": {
    "./packages/utils": {
      "test": ["./packages/core", "./packages/ui", "./apps/web"]
    },
    "./packages/core": {
      "test": ["./packages/ui", "./apps/web"]
    }
  }
}
```

## Key Benefits

- **🎯 Targeted Testing**: Only test what's affected by your changes
- **⚡ Fast Development**: Automatic service orchestration eliminates manual setup
- **🔒 Reliability**: Explicit configuration prevents missing dependencies
- **📈 Scalability**: Works efficiently with large monorepos (100+ projects)
- **🛠️ Flexibility**: Task-agnostic - works with any task name (test, build, deploy, etc.)

## Development

```bash
# Clone repository
git clone https://github.com/JinxCodesAI/dreamer.git
cd dreamer

# Run tests
deno task test

# Install locally for development
deno task install
```

## Requirements

- **Deno 1.40+**: Dream CLI is built specifically for Deno
- **Permissions**: Requires `--allow-read`, `--allow-run`, and `--allow-env` permissions
- **Structure**: Projects must have `deno.json` files with defined tasks

## License

MIT License - see LICENSE file for details.
