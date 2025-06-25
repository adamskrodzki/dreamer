# Execution Order Demo

This example demonstrates Dream CLI's execution order logic and parameter effects.

## Project Structure

```
execution-order-demo/
├── services/
│   ├── database/     # Database service (foundational)
│   ├── auth/         # Auth service (depends on database)
│   └── api/          # API service (depends on database + auth)
├── apps/
│   ├── admin/        # Admin app (depends on all services)
│   └── web/          # Web app (depends on all services)
└── packages/
    ├── utils/        # Utility package (tested by all projects)
    └── ui/           # UI package (tested by apps only)
```

## Key Features Demonstrated

### 1. Async Service Orchestration

```bash
# Start web app with service dependencies
cd apps/web
deno run --allow-read --allow-run --allow-env ../../src/main.ts dev --debug
```

**Expected behavior:**

- Database starts immediately (delay: 0ms)
- Auth starts after 1000ms delay
- API starts after 3000ms delay
- All services run concurrently (async: true)
- Web app starts after all services are ready

### 2. Recursive vs Non-Recursive Testing

```bash
# Recursive test (utils package tests all dependents)
cd packages/utils
deno run --allow-read --allow-run --allow-env ../../src/main.ts test --debug

# Non-recursive test (auth service tests only direct clients)
cd services/auth
deno run --allow-read --allow-run --allow-env ../../src/main.ts test --debug
```

### 3. Task Deduplication

```bash
# Build admin app (database should only build once despite multiple paths)
cd apps/admin
deno run --allow-read --allow-run --allow-env ../../src/main.ts build --debug
```

### 4. Required vs Optional Tasks

All tasks in this example are `required: true`, meaning any failure stops execution.

### 5. Execution Order Verification

```bash
# View execution plan without running
cd apps/web
deno run --allow-read --allow-run --allow-env ../../src/main.ts --info dev
```

## Parameter Effects

### `async` Parameter

- **Services** (`start` tasks): `async: true` - Run concurrently
- **Apps** (`dev` tasks): `async: false` - Wait for services first
- **Tests/Builds**: `async: false` - Sequential execution

### `required` Parameter

- **All tasks**: `required: true` - Any failure stops execution
- Demonstrates fail-fast behavior for critical dependencies

### `delay` Parameter

- **Database**: `delay: 0` - Start immediately
- **Auth**: `delay: 1000ms` - Wait 1 second after database
- **API**: `delay: 3000ms` - Wait 3 seconds after database
- **Build tasks**: `delay: 100ms` - Small delay for demonstration

## Test Scenarios

Run the comprehensive test suite:

```bash
deno test tests/e2e/execution_order_comprehensive.test.ts --allow-read --allow-run --allow-env
```

This verifies:

- ✅ Service orchestration with proper delays
- ✅ Recursive dependency resolution
- ✅ Task deduplication
- ✅ Execution order preservation
- ✅ Async vs sync execution patterns
