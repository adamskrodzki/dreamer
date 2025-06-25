# Dream CLI - Examples

## Overview

This document provides practical examples of using Dream CLI in various monorepo scenarios. Each example includes the workspace structure, configuration, and common usage patterns.

## Example 1: Simple Package Monorepo

### Workspace Structure
```
my-workspace/
├── dream.json
├── packages/
│   ├── utils/
│   │   ├── deno.json
│   │   └── src/
│   ├── core/
│   │   ├── deno.json
│   │   └── src/
│   └── ui/
│       ├── deno.json
│       └── src/
└── apps/
    └── web/
        ├── deno.json
        └── src/
```

### Configuration (dream.json)
```json
{
  "workspace": {
    "./packages/utils": {
      "test": ["./packages/core", "./packages/ui", "./apps/web"],
      "build": []
    },
    "./packages/core": {
      "test": ["./packages/ui", "./apps/web"],
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
    "./packages/ui": {
      "test": ["./apps/web"],
      "build": [],
      "dev": [
        {
          "projectPath": "./packages/utils",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./packages/core",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 1000
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
        },
        {
          "projectPath": "./packages/core",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 1000
        },
        {
          "projectPath": "./packages/ui",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 2000
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

### Usage Examples
```bash
# Test utils and its configured test targets (core, ui, web)
cd packages/utils
dream test

# Test core and its configured test targets (ui, web)
cd packages/core
dream test

# Start development for web app (starts all required services)
cd apps/web
dream dev
```

### Execution Flow Examples

**When running `dream test` from `packages/utils`:**
1. `./packages/utils` test (self)
2. `./packages/core` test (configured target)
3. `./packages/ui` test (configured target)
4. `./apps/web` test (configured target)

**When running `dream dev` from `apps/web`:**
1. `./packages/utils` build (dependency)
2. `./packages/core` dev (dependency, 1s delay)
3. `./packages/ui` dev (dependency, 2s delay)
4. `./apps/web` dev (self)

## Example 2: Microservices Architecture

### Workspace Structure
```
microservices/
├── dream.json
├── services/
│   ├── database/
│   │   ├── deno.json
│   │   └── src/
│   ├── auth/
│   │   ├── deno.json
│   │   └── src/
│   ├── api/
│   │   ├── deno.json
│   │   └── src/
│   └── notifications/
│       ├── deno.json
│       └── src/
└── apps/
    ├── web/
    │   ├── deno.json
    │   └── src/
    └── mobile/
        ├── deno.json
        └── src/
```

### Configuration (dream.json)
```json
{
  "workspace": {
    "./services/database": {
      "test": ["./services/auth", "./services/api", "./services/notifications", "./apps/web", "./apps/mobile"],
      "dev": [],
      "build": []
    },
    "./services/auth": {
      "test": ["./services/api", "./apps/web"],
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
      "test": ["./apps/web", "./apps/mobile"],
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
    "./services/notifications": {
      "test": ["./apps/web"],
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
    "./apps/web": {
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
        },
        {
          "projectPath": "./services/notifications",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 2000
        }
      ],
      "build": []
    },
    "./apps/mobile": {
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

### Usage Examples
```bash
# Test database and all services that use it
cd services/database
dream test
# This tests: database -> auth -> api -> notifications -> web -> mobile

# Test API service and all apps that use it
cd services/api
dream test
# This tests: api -> web -> mobile

# Start the entire development environment from web app
cd apps/web
dream dev
# This starts: database -> auth (2s delay) -> api (4s delay) -> notifications (2s delay) -> web

# Test auth service with recursive dependency resolution
cd services/auth
dream test
# This tests: auth -> api -> web (recursive resolution enabled for auth:test)
```

### Development Workflow
**When running `dream test` from `services/database`:**
1. Tests database service (self)
2. Tests auth service (uses database)
3. Tests API service (uses database)
4. Tests notifications service (uses database)
5. Tests web app (uses database)
6. Tests mobile app (uses database)

**When running `dream dev` from `apps/web`:**
1. Database service starts (async, no delay)
2. Auth service starts (async, 2s delay)
3. API service starts (async, 4s delay)
4. Notifications service starts (async, 2s delay)
5. Web app starts (after all dependencies are running)

### Recursive Configuration Explanation
The `recursive` configuration enables deep dependency resolution for specific projects and tasks:

```json
"recursive": [
  {
    "project": "./services/auth",
    "tasks": ["test"]
  }
]
```

**Effect**: When running `dream test` from `./services/auth`:
- **Without recursive**: Tests auth → api → web (only immediate dependencies)
- **With recursive**: Tests auth → api → web, and if api has dependencies, those are tested too

This ensures comprehensive testing when changes to auth service could have cascading effects through the dependency chain.

## Example 3: Full-Stack Application with Build Pipeline

### Workspace Structure
```
fullstack-app/
├── dream.json
├── shared/
│   ├── types/
│   │   ├── deno.json
│   │   └── src/
│   └── utils/
│       ├── deno.json
│       └── src/
├── backend/
│   ├── database/
│   │   ├── deno.json
│   │   └── src/
│   ├── api/
│   │   ├── deno.json
│   │   └── src/
│   └── workers/
│       ├── deno.json
│       └── src/
└── frontend/
    ├── web/
    │   ├── deno.json
    │   └── src/
    └── admin/
        ├── deno.json
        └── src/
```

### Configuration (dream.json)
```json
{
  "workspace": {
    "./shared/types": {
      "test": [],
      "build": []
    },
    "./shared/utils": {
      "test": ["./shared/types"],
      "build": ["./shared/types"]
    },
    "./backend/database": {
      "test": ["./shared/types"],
      "dev": [],
      "build": ["./shared/types"]
    },
    "./backend/api": {
      "test": ["./shared/utils", "./backend/database"],
      "dev": [
        {
          "projectPath": "./shared/types",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./shared/utils",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./backend/database",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 3000
        }
      ],
      "build": ["./shared/utils", "./backend/database"]
    },
    "./backend/workers": {
      "test": ["./shared/utils", "./backend/database"],
      "dev": [
        {
          "projectPath": "./shared/types",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./shared/utils",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./backend/database",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 3000
        }
      ],
      "build": ["./shared/utils", "./backend/database"]
    },
    "./frontend/web": {
      "test": ["./shared/utils"],
      "dev": [
        {
          "projectPath": "./shared/types",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./shared/utils",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./backend/api",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 5000
        }
      ],
      "build": ["./shared/utils"]
    },
    "./frontend/admin": {
      "test": ["./shared/utils"],
      "dev": [
        {
          "projectPath": "./shared/types",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./shared/utils",
          "task": "build",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./backend/api",
          "task": "dev",
          "async": true,
          "required": true,
          "delay": 5000
        }
      ],
      "build": ["./shared/utils"]
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

### Usage Examples
```bash
# Full development environment
cd frontend/web
dream dev
# Builds shared packages, starts database, API, then web frontend

# Test everything that depends on shared utils
cd shared/utils
dream test

# Build production artifacts
cd frontend/web
dream build

# Start backend services only
cd backend/api
dream dev
```

## Example 4: Testing-Focused Configuration

### Configuration for Comprehensive Testing
```json
{
  "workspace": {
    "./packages/core": {
      "test": [],
      "unit-test": [],
      "integration-test": ["./packages/core"],
      "e2e-test": ["./packages/core", "./services/api"]
    },
    "./services/api": {
      "test": ["./packages/core"],
      "unit-test": [],
      "integration-test": ["./packages/core"],
      "e2e-test": ["./packages/core"]
    },
    "./apps/web": {
      "test": ["./services/api"],
      "unit-test": [],
      "integration-test": ["./services/api"],
      "e2e-test": ["./services/api"]
    }
  },
  "tasks": {
    "test": {
      "async": false,
      "required": true,
      "delay": 0
    },
    "unit-test": {
      "async": false,
      "required": true,
      "delay": 0
    },
    "integration-test": {
      "async": false,
      "required": true,
      "delay": 1000
    },
    "e2e-test": {
      "async": false,
      "required": false,
      "delay": 2000
    }
  }
}
```

### Testing Workflows
```bash
# Run all tests for web app
cd apps/web
dream test

# Run only unit tests
dream unit-test

# Run integration tests (with dependencies)
dream integration-test

# Run e2e tests (with full stack)
dream e2e-test
```

## Example 5: CI/CD Pipeline Configuration

### Configuration for Build Pipeline
```json
{
  "workspace": {
    "./packages/shared": {
      "lint": [],
      "test": [],
      "build": [],
      "package": ["./packages/shared"]
    },
    "./services/api": {
      "lint": [],
      "test": ["./packages/shared"],
      "build": ["./packages/shared"],
      "package": ["./services/api"],
      "deploy": ["./services/api"]
    },
    "./apps/web": {
      "lint": [],
      "test": ["./services/api"],
      "build": ["./services/api"],
      "package": ["./apps/web"],
      "deploy": ["./apps/web"]
    }
  },
  "tasks": {
    "lint": {
      "async": true,
      "required": true,
      "delay": 0
    },
    "test": {
      "async": false,
      "required": true,
      "delay": 0
    },
    "build": {
      "async": false,
      "required": true,
      "delay": 500
    },
    "package": {
      "async": false,
      "required": true,
      "delay": 1000
    },
    "deploy": {
      "async": false,
      "required": true,
      "delay": 2000
    }
  }
}
```

### CI/CD Workflows
```bash
# Full CI pipeline
dream lint    # Lint all code in parallel
dream test    # Run tests with dependencies
dream build   # Build with dependencies
dream package # Package artifacts
dream deploy  # Deploy to staging/production
```

## Common Patterns

### Pattern 1: Shared Library Dependencies
```json
{
  "workspace": {
    "./libs/common": {
      "test": [],
      "build": []
    },
    "./services/*": {
      "test": ["./libs/common"],
      "build": ["./libs/common"]
    }
  }
}
```

### Pattern 2: Service Mesh Startup
```json
{
  "workspace": {
    "./services/gateway": {
      "dev": [
        {
          "projectPath": "./services/auth",
          "task": "dev",
          "async": true,
          "delay": 3000
        },
        {
          "projectPath": "./services/users",
          "task": "dev",
          "async": true,
          "delay": 3000
        }
      ]
    }
  }
}
```

### Pattern 3: Database Migration Dependencies
```json
{
  "workspace": {
    "./database": {
      "migrate": [],
      "seed": ["./database"]
    },
    "./services/api": {
      "dev": [
        {
          "projectPath": "./database",
          "task": "migrate",
          "async": false,
          "required": true,
          "delay": 0
        },
        {
          "projectPath": "./database",
          "task": "seed",
          "async": false,
          "required": false,
          "delay": 1000
        }
      ]
    }
  }
}
```

## Understanding Dependencies vs Dependents

### Key Concept
Dream CLI should only execute **explicitly configured dependencies**, never auto-discover dependent projects.

### Configuration Patterns

**Pattern 1: Dependency-based Configuration**
Configure each project to list its dependencies:
```json
{
  "workspace": {
    "./utils": {
      "test": []  // No dependencies
    },
    "./api": {
      "test": ["./utils"]  // api depends on utils
    },
    "./web": {
      "test": ["./utils", "./api"]  // web depends on both
    }
  }
}
```

**Pattern 2: Client Impact Testing Configuration**
Configure shared libraries to list their clients for testing:
```json
{
  "workspace": {
    "./utils": {
      "test": ["./api", "./web"]  // Test clients when utils changes
    },
    "./api": {
      "test": ["./web"]  // Test web when api changes
    },
    "./web": {
      "test": []  // No clients to test
    }
  }
}
```

### Correct CLI Behavior
**Both patterns are valid configurations**, but the CLI should:
- Only execute the explicitly configured dependencies/targets
- Never auto-discover additional projects beyond what's configured
- Execute tasks in the order: configured dependencies → current project

### What Dream CLI Should NOT Do
- Auto-discover projects that depend on the current project
- Execute tasks for projects not explicitly listed in configuration
- Guess relationships between projects

## Best Practices from Examples

1. **Use async for long-running services**: Database, API servers
2. **Build shared libraries first**: Always build dependencies before dependents
3. **Stagger service startup**: Use delays to prevent resource conflicts
4. **Make dev dependencies optional**: Use `required: false` for development-only services
5. **Separate test types**: Unit, integration, e2e with different dependency chains
6. **Use consistent naming**: Standard task names across all projects
7. **Configure dependencies explicitly**: Never rely on auto-discovery of dependent projects
