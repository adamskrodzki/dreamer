# Dream CLI

Dependency-aware task execution for Deno monorepos.

## Overview

Dream CLI enables developers to efficiently manage complex project dependencies by executing explicitly configured dependencies in the correct order while respecting execution requirements.

## Core Features

- **Dependency-Aware Testing**: Test configured dependencies + current project
- **Service Orchestration**: Start service dependencies with delays and async support
- **Flexible Configuration**: Support both simple strings and detailed dependency objects
- **Deno-Native**: Built specifically for Deno with proper permission handling

## Quick Start

```bash
# Install from JSR
deno install -A jsr:@dream/cli

# Or use directly
deno run -A jsr:@dream/cli test

# Show help
dream --help
```

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
        {"projectPath": "./services/database", "task": "start", "async": true},
        {"projectPath": "./services/api", "task": "dev", "async": true, "delay": 2000}
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

## Usage

```bash
dream test    # Test configured dependencies + current project
dream dev     # Start required services + current project dev
dream build   # Build configured dependencies + current project
```

## Development

```bash
# Clone repository
git clone https://github.com/JinxCodesAI/dreamer.git
cd dreamer

# Run tests
deno task test

# Install locally
deno task install
```

## License

MIT License - see LICENSE file for details.
