# Dream CLI - Configuration Guide

## Overview

This guide provides detailed information on configuring Dream CLI for your Deno workspace. The configuration is defined in a `dream.json` file located at your workspace root.

## Configuration File Structure

### Basic Structure

```json
{
  "workspace": {
    // Project configurations
  },
  "tasks": {
    // Task default configurations
  },
  "recursive": [
    // Recursive dependency resolution configuration
  ]
}
```

## Workspace Configuration

### Project Definition

Each project in your workspace is defined by its relative path from the workspace root. The configuration defines what should run when you execute a task from that project:

```json
{
  "workspace": {
    "./packages/database": {
      "test": ["./services/api", "./apps/web"],
      "build": [],
      "dev": []
    },
    "./services/api": {
      "test": ["./apps/web"],
      "build": [],
      "dev": ["./packages/database"]
    }
    ..........
  }
}
```

**Key Concept**: When you run `dream test` from `./packages/database`, it will:

1. Run tests on `./packages/database` itself
2. Run tests on `./services/api` (which uses database)
3. Run tests on `./apps/web` (which also uses database)

This ensures changes to the database don't break its clients.

### Task Dependencies

#### Simple Dependencies (String Array)

The simplest way to define what should be tested when a project changes:

```json
{
  "workspace": {
    "./packages/auth": {
      "test": ["./services/api", "./apps/web"],
      "build": []
    }
  }
}
```

**Meaning**: When you run `dream test` from `./packages/auth`:

1. Tests `./packages/auth` first
2. Then tests `./services/api` (which imports auth)
3. Then tests `./apps/web` (which also uses auth)

This ensures auth changes don't break its clients.

#### Detailed Dependencies (Object Array)

For development environments, use the detailed object format to start required services:

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

**Meaning**: When you run `dream dev` from `./apps/web`:

1. Starts database service (async, no delay)
2. Starts API service (async, 3s delay to let DB initialize)
3. Starts web app development server

This automatically sets up the entire development environment.

#### Mixed Dependencies

You can mix simple and detailed formats. For testing, you might want to test clients, but for dev you need to start services:

```json
{
  "workspace": {
    "./packages/auth": {
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

- `dream test` from auth → tests auth, then its clients (api, web)
- `dream dev` from auth → starts database, then auth dev server

## Task Default Configuration

### Global Task Defaults

Define default behavior for tasks across all projects:

```json
{
  "tasks": {
    "test": {
      "async": false,
      "required": true,
      "delay": 0
    },
    "dev": {
      "async": true,
      "required": false,
      "delay": 1000
    },
    "build": {
      "async": false,
      "required": true,
      "delay": 500
    }
  }
}
```

### Task Properties

#### async (boolean)

- **Default**: `false`
- **Description**: Whether the task runs concurrently with other async tasks
- **Example**: `"async": true`

**Behavior**:

- `true`: Task starts and continues running while other tasks execute
- `false`: Task must complete before next task starts

#### required (boolean)

- **Default**: `true`
- **Description**: Whether task failure stops the entire execution chain
- **Example**: `"required": false`

**Behavior**:

- `true`: Task failure stops execution of dependent tasks
- `false`: Task failure is logged but execution continues

#### delay (number)

- **Default**: `0`
- **Description**: Milliseconds to wait after task starts, before next task starts
- **Example**: `"delay": 2000`

**Use Cases**:

- Stagger service startups to avoid resource conflicts
- Allow time for services to initialize before dependents start
- Rate limiting to prevent overwhelming system resources

## Recursive Dependency Resolution

### Overview

By default, Dream CLI uses **non-recursive** dependency resolution, which only processes the immediate dependencies listed in a project's configuration. The `recursive` configuration section allows you to enable **recursive dependency resolution** for specific projects and tasks.

### Configuration Structure

```json
{
  "recursive": [
    {
      "project": "./path/to/project",
      "tasks": ["task1", "task2"]
    }
  ]
}
```

### Recursive vs Non-Recursive Behavior

#### Non-Recursive (Default)

- Only processes immediate dependencies listed in the configuration
- Faster execution for simple dependency chains
- Recommended for most use cases

#### Recursive

- Processes dependencies of dependencies (transitive dependencies)
- Continues until all nested dependencies are resolved
- Useful for complex dependency trees where changes can have far-reaching effects

### Example: Deep Dependency Chain

Consider this project structure:

```
./apps/web → ./packages/ui → ./packages/core → ./packages/utils
```

**Configuration:**

```json
{
  "workspace": {
    "./apps/web": {
      "test": ["./packages/ui"]
    },
    "./packages/ui": {
      "test": ["./packages/core"]
    },
    "./packages/core": {
      "test": ["./packages/utils"]
    },
    "./packages/utils": {
      "test": []
    }
  },
  "recursive": [
    {
      "project": "./apps/web",
      "tasks": ["test"]
    }
  ]
}
```

**Execution Behavior:**

**Without recursive** (`dream test` from `./apps/web`):

1. `./apps/web:test`
2. `./packages/ui:test`

**With recursive** (`dream test` from `./apps/web`):

1. `./apps/web:test`
2. `./packages/ui:test`
3. `./packages/core:test` (dependency of ui)
4. `./packages/utils:test` (dependency of core)

### When to Use Recursive Resolution

#### Use Recursive When:

- You have deep dependency chains (A → B → C → D)
- Changes to low-level packages can break multiple layers of dependents
- You need comprehensive testing across the entire dependency tree
- Working with complex monorepo architectures

#### Use Non-Recursive When:

- You have simple, flat dependency structures
- Performance is critical and you want minimal execution overhead
- Dependencies are well-isolated and changes rarely propagate deeply
- You prefer explicit control over what gets executed

### Configuration Properties

#### project (string, required)

- **Description**: Relative path to the project from workspace root
- **Example**: `"./services/auth"`
- **Note**: Must match exactly with project paths in the workspace configuration

#### tasks (string[], required)

- **Description**: Array of task names that should use recursive resolution for this project
- **Example**: `["test", "build"]`
- **Note**: Task names must exist in the project's deno.json or be valid Deno tasks

### Practical Examples

#### Example 1: Library with Deep Dependencies

```json
{
  "workspace": {
    "./packages/utils": {
      "test": ["./packages/core", "./packages/ui", "./apps/web"]
    },
    "./packages/core": {
      "test": ["./packages/ui", "./apps/web"]
    },
    "./packages/ui": {
      "test": ["./apps/web"]
    },
    "./apps/web": {
      "test": []
    }
  },
  "recursive": [
    {
      "project": "./packages/utils",
      "tasks": ["test"]
    }
  ]
}
```

**Result**: When testing `./packages/utils`, it will recursively test all its dependents and their dependents, ensuring changes don't break the entire application stack.

#### Example 2: Mixed Recursive Configuration

```json
{
  "workspace": {
    "./services/auth": {
      "test": ["./services/api", "./apps/web"],
      "build": ["./services/api"]
    },
    "./services/api": {
      "test": ["./apps/web"],
      "build": []
    },
    "./apps/web": {
      "test": [],
      "build": []
    }
  },
  "recursive": [
    {
      "project": "./services/auth",
      "tasks": ["test"]
    }
  ]
}
```

**Result**:

- `dream test` from auth → recursive testing (auth → api → web)
- `dream build` from auth → non-recursive building (auth → api only)

### Best Practices

#### Performance Considerations

1. **Selective Usage**: Only enable recursive resolution where truly needed
2. **Task-Specific**: Enable recursion per task type (e.g., only for testing, not building)
3. **Monitor Execution Time**: Recursive resolution can significantly increase execution time

#### Configuration Management

1. **Document Decisions**: Comment why specific projects use recursive resolution
2. **Regular Review**: Periodically assess if recursive configuration is still needed
3. **Team Alignment**: Ensure team understands which projects use recursive resolution

#### Common Patterns

1. **Core Libraries**: Enable recursive testing for foundational packages
2. **API Services**: Use recursive testing for services that many clients depend on
3. **Build Tasks**: Generally avoid recursive resolution for build tasks unless necessary

## Configuration Examples

### Simple Monorepo

```json
{
  "workspace": {
    "./packages/utils": {
      "test": ["./packages/core", "./apps/web"],
      "build": []
    },
    "./packages/core": {
      "test": ["./apps/web"],
      "build": [],
      "dev": [
        {
          "projectPath": "./packages/utils",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        }
      ]
    },
    "./apps/web": {
      "test": [],
      "build": [],
      "dev": [
        {
          "projectPath": "./packages/utils",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        }
      ]
    }
  },
  "tasks": {
    "test": {
      "async": false,
      "required": true,
      "delay": 0
    },
    "build": {
      "async": false,
      "required": true,
      "delay": 0
    },
    "dev": {
      "async": false,
      "required": true,
      "delay": 0
    }
  }
}
```

**Usage Examples**:

- `dream test` from `./packages/utils` → tests utils, then core, then web (all clients)
- `dream dev` from `./apps/web` → builds utils, starts core dev server, then web dev server

### Microservices Architecture

```json
{
  "workspace": {
    "./services/database": {
      "test": ["./services/auth", "./services/api", "./apps/frontend"],
      "dev": [],
      "build": []
    },
    "./services/auth": {
      "test": ["./services/api", "./apps/frontend"],
      "dev": [
        {
          "projectPath": "./services/database",
          "task": "start",
          "async": true,
          "required": true,
          "delay": 0
        }
      ],
      "build": []
    },
    "./services/api": {
      "test": ["./apps/frontend"],
      "dev": [
        {
          "projectPath": "./services/database",
          "task": "start",
          "async": true,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./services/auth",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 2000
        }
      ],
      "build": []
    },
    "./apps/frontend": {
      "test": [],
      "dev": [
        {
          "projectPath": "./services/database",
          "task": "start",
          "async": true,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./services/auth",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 2000
        },
        {
          "projectPath": "./services/api",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 4000
        }
      ],
      "build": []
    }
  },
  "tasks": {
    "test": {
      "async": false,
      "required": true,
      "delay": 0
    },
    "dev": {
      "async": true,
      "required": false,
      "delay": 1000
    },
    "build": {
      "async": false,
      "required": true,
      "delay": 500
    }
  },
  "recursive": [
    {
      "project": "./services/auth",
      "tasks": ["test"]
    }
  ]
}
```

**Usage Examples**:

- `dream test` from `./services/database` → tests database, then auth, api, and frontend (all clients)
- `dream dev` from `./apps/frontend` → starts database, then auth (2s delay), then api (4s delay), then frontend

### Complex Dependencies with Cross-Task References

```json
{
  "workspace": {
    "./packages/shared": {
      "test": [],
      "build": []
    },
    "./services/backend": {
      "test": ["./packages/shared"],
      "dev": [
        {
          "projectPath": "./packages/shared",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        }
      ],
      "build": ["./packages/shared"]
    },
    "./apps/client": {
      "test": ["./services/backend"],
      "dev": [
        {
          "projectPath": "./packages/shared",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./services/backend",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 3000
        }
      ],
      "build": ["./services/backend"]
    }
  },
  "tasks": {
    "test": {
      "async": false,
      "required": true,
      "delay": 0
    },
    "dev": {
      "async": true,
      "required": false,
      "delay": 1000
    },
    "build": {
      "async": false,
      "required": true,
      "delay": 500
    }
  }
}
```

## Best Practices

### Dependency Design

1. **Keep dependencies minimal**: Only include necessary dependencies
2. **Use async for services**: Mark long-running services as async
3. **Set appropriate delays**: Allow time for services to start up
4. **Make dev tasks optional**: Use `required: false` for development dependencies

### Task Organization

1. **Consistent naming**: Use standard task names across projects (test, build, dev)
2. **Logical grouping**: Group related projects in similar directory structures
3. **Clear hierarchy**: Organize dependencies from low-level to high-level

### Performance Optimization

1. **Parallel execution**: Use async tasks where possible
2. **Minimal delays**: Only add delays when necessary
3. **Required vs optional**: Mark non-critical tasks as optional

### Maintenance

1. **Regular review**: Periodically review and update dependencies
2. **Documentation**: Comment complex dependency relationships
3. **Validation**: Test configuration changes thoroughly

## Troubleshooting

### Common Issues

#### Circular Dependencies

```
Error: Circular dependency detected: ./app/web -> ./services/api -> ./app/web
```

**Solution**: Review dependency chain and remove circular references

#### Missing Projects

```
Warning: Referenced project ./packages/missing not found
```

**Solution**: Ensure all referenced projects exist and have deno.json files

#### Task Not Found

```
Error: Task 'deploy' not found in ./services/api
Available tasks: test, build, dev
```

**Solution**: Verify task exists in project's deno.json or use correct task name

### Debug Mode

Use `--debug` flag to see detailed execution information:

```bash
dream test --debug
```

This shows:

- Configuration loading details
- Dependency resolution process
- Execution chain order
- Task execution details
