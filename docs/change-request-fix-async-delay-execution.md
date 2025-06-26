# Change Request: Fix Async and Delay Task Execution

## Issue Summary

The current Dream CLI implementation has incorrect async and delay behavior that doesn't match the intended specification. The `async` parameter should control whether the runner waits for task completion before starting the next task, and `delay` should specify how long to wait AFTER starting an async task before starting the next task.

## Problem Description

### Current Incorrect Behavior

The CLI currently implements sequential execution for all tasks regardless of the `async` property:

1. **All tasks execute sequentially** using a `for` loop with `await`
2. **`async: true` has no effect** - tasks still wait for completion before starting next task
3. **Delay is applied BEFORE task execution** instead of after starting async tasks
4. **No concurrent execution** occurs even when `async: true` is specified
5. **No background process management** for async tasks

### Example of the Problem

Given this configuration:
```json
{
  "workspace": {
    "./services/api": {
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
      ]
    }
  }
}
```

**Current incorrect behavior** when running `dream dev` from `./services/api`:
```
1. Start database task and WAIT for completion
2. Apply 2000ms delay
3. Start auth task and WAIT for completion  
4. Start api task
Total time: database_time + 2000ms + auth_time + api_time
```

**Desired correct behavior** when running `dream dev` from `./services/api`:
```
1. Start database task (async=true, delay=0) - continues immediately
2. Start auth task (async=true, delay=2000) - continues after 2000ms
3. Wait 2000ms after starting auth
4. Start api task
Total time: max(database_time, auth_time + 2000ms) + api_time
Background: database and auth run concurrently
```

### Correct Async and Delay Semantics

**`async: true`**: 
- Task starts in background
- Runner does NOT wait for completion before starting next task
- Task continues running while subsequent tasks start

**`async: false`** (default):
- Task starts and runner waits for completion
- Next task only starts after current task finishes

**`delay` parameter**:
- For `async: true`: Wait this many milliseconds AFTER starting the task before starting next task
- For `async: false`: delay should be ignored - task allways blocks next task

**`required: true`**:
- If async task fails, terminate all subsequent tasks and running async tasks
- If sync task fails, stop execution immediately

## Root Cause Analysis

The issue stems from the `DreamRunner.execute()` method in `src/dream_runner.ts` which:

1. Uses a sequential `for` loop with `await` for all tasks
2. Ignores the `async` property completely
3. Applies delays before task execution instead of after for async tasks
4. Has no mechanism for background process management
5. Cannot handle concurrent task execution or failure propagation

## Desired Correct Behavior

### Core Principles

1. **`async: true` tasks run in background** without blocking subsequent tasks
2. **`delay` for async tasks** is applied AFTER starting the task
3. **`delay` for sync tasks** is applied BEFORE starting the task (current behavior)
4. **Required async task failures** terminate all running and pending tasks
5. **Process lifecycle management** for background async tasks

### Correct Execution Flow

For the example configuration above:
1. Start `./services/database:start` (async=true, delay=0)
2. Immediately start `./services/auth:dev` (async=true, delay=2000) 
3. Wait 2000ms (delay after starting auth)
4. Start `./services/api:dev` (sync, final task)
5. If database or auth fails, terminate all tasks

## Impact Analysis

### Files Affected

- **Core Logic**: `src/dream_runner.ts` - Main execution orchestration
- **Task Execution**: `src/task_executor.ts` - Process management
- **Documentation**: All specification and example files
- **Tests**: All async-related test files

### Backward Compatibility

This is a **breaking change** that will alter execution timing and behavior for configurations using `async: true`.

## Required Changes

### 1. Documentation Updates

#### 1.1 Update Functional Specification

**File:** `docs/functional-specification.md`

**Changes needed:**
- Correct async parameter description to reflect background execution
- Update delay parameter description to distinguish async vs sync behavior  
- Add process lifecycle management documentation
- Update execution examples to show correct timing
- Add failure propagation documentation for async tasks

#### 1.2 Update Architecture Documentation

**File:** `docs/architecture.md`

**Changes needed:**
- Update TaskExecutor interface to support background process management
- Add async task lifecycle management documentation
- Update execution flow diagrams
- Document process termination strategies

#### 1.3 Update Examples Documentation

**File:** `docs/examples.md`

**Changes needed:**
- Update all async examples to show correct execution timing
- Add timing diagrams for complex async scenarios
- Update service orchestration examples
- Add failure handling examples for async tasks

### 2. Test Updates

#### 2.1 Fix Existing Tests

**Files requiring updates:**

**`tests/unit/task_executor.test.ts`:**
- Fix async execution tests to verify actual concurrent behavior
- Add timing verification for async vs sync execution
- Update mock expectations for background process management

**`tests/unit/dream_runner.test.ts`:**
- Fix execution timing tests
- Add async task lifecycle tests
- Update delay behavior tests

**`tests/integration/task_execution.test.ts`:**
- Fix integration tests that verify execution timing
- Add real process async execution tests

#### 2.2 Add New Comprehensive Tests

**Test scenarios needed:**
- **Async timing verification**: Measure actual execution time vs expected
- **Background process management**: Verify tasks run concurrently
- **Delay behavior**: Verify delay timing for async vs sync tasks
- **Failure propagation**: Verify async task failures terminate other tasks
- **Process cleanup**: Verify background processes are properly terminated

### 3. Code Changes

#### 3.1 Implement Background Process Management

**File:** `src/dream_runner.ts`

**Primary changes:**
- Replace sequential `for` loop with async task management
- Implement background process tracking for `async: true` tasks
- Add process termination logic for failure scenarios
- Implement proper delay timing for async vs sync tasks

#### 3.2 Update Task Executor

**File:** `src/task_executor.ts`

**Changes needed:**
- Add background process management capabilities
- Implement process termination methods
- Add process status monitoring
- Update process lifecycle management

#### 3.3 Add Process Lifecycle Management

**New functionality needed:**
- Track running background processes
- Monitor process health and exit codes
- Implement graceful and forceful termination
- Handle process cleanup on failure

## Implementation Plan

### Phase 1: Update Specification (Priority: High)

1. **Task 1.1: Update Functional Specification**
   - Correct async and delay parameter descriptions
   - Add process lifecycle management documentation
   - Update execution timing examples
   - Add failure propagation documentation

2. **Task 1.2: Update Architecture Documentation**  
   - Update TaskExecutor interface design
   - Add background process management architecture
   - Document process termination strategies

3. **Task 1.3: Update Examples Documentation**
   - Correct all async execution examples
   - Add timing diagrams for complex scenarios
   - Update service orchestration patterns

### Phase 2: Create Failing Tests (Priority: High)

4. **Task 2.1: Create Async Execution Tests**
   - Test concurrent execution timing
   - Test background process management
   - Test delay behavior for async vs sync tasks

5. **Task 2.2: Create Failure Propagation Tests**
   - Test async task failure handling
   - Test process termination scenarios
   - Test cleanup behavior

### Phase 3: Update Existing Tests (Priority: High)

6. **Task 3.1: Fix Unit Tests**
   - Update async execution test expectations
   - Fix timing-based test assertions
   - Update mock process behavior

7. **Task 3.2: Fix Integration Tests**
   - Update real process execution tests
   - Fix timing verification tests
   - Add background process integration tests

### Phase 4: Implement Code Changes (Priority: High)

8. **Task 4.1: Implement Background Process Management**
   - Add async task tracking to DreamRunner
   - Implement process lifecycle management
   - Add failure propagation logic

9. **Task 4.2: Update Task Executor**
   - Add background process capabilities
   - Implement process termination methods
   - Update process monitoring

### Phase 5: Validation (Priority: Medium)

10. **Task 5.1: Comprehensive Testing**
    - Verify all tests pass with new behavior
    - Test complex async scenarios manually
    - Validate timing behavior

11. **Task 5.2: Performance and Reliability Testing**
    - Test with long-running async processes
    - Verify proper cleanup on failures
    - Test resource usage and cleanup

## Success Criteria

- [ ] `async: true` tasks run in background without blocking next task
- [ ] `delay` for async tasks applied AFTER starting task
- [ ] `delay` for sync tasks applied BEFORE starting task (unchanged)
- [ ] Required async task failures terminate all running tasks
- [ ] Background processes are properly cleaned up
- [ ] Execution timing matches expected concurrent behavior
- [ ] All tests pass with corrected behavior
- [ ] Documentation accurately reflects implementation

## Detailed Task Breakdown

### Task 1.1: Update Functional Specification

**File:** `docs/functional-specification.md`
**Description:** Correct async and delay parameter documentation to reflect actual intended behavior

**Subtasks:**

- [ ] Update `async` parameter description to clarify background execution behavior
- [ ] Correct `delay` parameter description to distinguish async vs sync timing
- [ ] Add process lifecycle management section
- [ ] Update execution order examples to show concurrent timing
- [ ] Add failure propagation documentation for async tasks
- [ ] Review and update all service orchestration examples
- [ ] **Developer responsibility**: Identify any additional async-related documentation that needs correction

### Task 1.2: Update Architecture Documentation

**File:** `docs/architecture.md`
**Description:** Update architecture documentation to reflect background process management

**Subtasks:**

- [ ] Update TaskExecutor interface to include background process methods
- [ ] Add process lifecycle management architecture section
- [ ] Update execution flow diagrams to show concurrent execution
- [ ] Document process termination strategies for failure scenarios
- [ ] Add background process tracking design
- [ ] **Developer responsibility**: Identify any additional architecture changes needed for async support

### Task 1.3: Update Examples Documentation

**File:** `docs/examples.md`
**Description:** Correct all examples to show proper async execution behavior

**Subtasks:**

- [ ] Update microservices orchestration examples with correct timing
- [ ] Add timing diagrams showing concurrent vs sequential execution
- [ ] Update service startup examples to show background execution
- [ ] Add failure handling examples for async tasks
- [ ] Review all async configuration examples for accuracy
- [ ] **Developer responsibility**: Identify any additional examples that demonstrate incorrect async behavior

### Task 2.1: Create Async Execution Tests

**File:** `tests/unit/async_execution.test.ts` (new file)
**Description:** Create comprehensive tests that verify correct async execution behavior

**Subtasks:**

- [ ] Test: Async tasks start without waiting for completion
- [ ] Test: Delay for async tasks applied AFTER starting task
- [ ] Test: Delay for sync tasks applied BEFORE starting task
- [ ] Test: Multiple async tasks run concurrently
- [ ] Test: Mixed async/sync execution timing
- [ ] Test: Background process tracking and management
- [ ] **Developer responsibility**: Create additional timing and concurrency tests

### Task 2.2: Create Failure Propagation Tests

**File:** `tests/unit/async_failure_handling.test.ts` (new file)
**Description:** Create tests that verify proper async task failure handling

**Subtasks:**

- [ ] Test: Required async task failure terminates all running tasks
- [ ] Test: Optional async task failure allows continuation
- [ ] Test: Process cleanup on failure scenarios
- [ ] Test: Graceful vs forceful termination
- [ ] Test: Multiple async task failures
- [ ] **Developer responsibility**: Create additional failure scenario tests

### Task 3.1: Fix Unit Tests

**Files:** `tests/unit/task_executor.test.ts`, `tests/unit/dream_runner.test.ts`
**Description:** Update existing unit tests to expect correct async behavior

**Subtasks:**

- [ ] Update "async task execution" test to verify actual concurrency
- [ ] Fix "mixed async and sync execution" test timing expectations
- [ ] Update "delay parameter effect" test for async vs sync behavior
- [ ] Fix mock process runner to support background execution
- [ ] Update test assertions to verify concurrent execution
- [ ] **Developer responsibility**: Identify and fix any additional unit tests affected by async changes

### Task 3.2: Fix Integration Tests

**Files:** `tests/integration/task_execution.test.ts`, `tests/integration/microservices_orchestration.test.ts`
**Description:** Update integration tests to verify real async execution behavior

**Subtasks:**

- [ ] Update integration tests to measure actual execution timing
- [ ] Fix microservices orchestration tests to verify concurrent startup
- [ ] Add real process background execution verification
- [ ] Update timing assertions for concurrent execution
- [ ] **Developer responsibility**: Identify and fix any additional integration tests affected by async changes

### Task 4.1: Implement Background Process Management

**File:** `src/dream_runner.ts`
**Description:** Implement core async execution logic with background process management

**Subtasks:**

- [ ] Replace sequential for loop with async task management
- [ ] Add background process tracking for async tasks
- [ ] Implement delay logic: AFTER starting for async, BEFORE starting for sync
- [ ] Add process termination logic for failure scenarios
- [ ] Implement graceful shutdown for background processes
- [ ] Add process status monitoring and health checks
- [ ] **Developer responsibility**: Implement additional process management features as needed

### Task 4.2: Update Task Executor

**File:** `src/task_executor.ts`
**Description:** Add background process capabilities to TaskExecutor

**Subtasks:**

- [ ] Add methods for background process management
- [ ] Implement process termination capabilities
- [ ] Add process status monitoring
- [ ] Update process lifecycle management
- [ ] Add cleanup methods for failed processes
- [ ] **Developer responsibility**: Implement additional executor features needed for async support

### Task 5.1: Comprehensive Testing

**Description:** Validate implementation with comprehensive testing

**Subtasks:**

- [ ] Run all unit tests and fix any failures
- [ ] Run all integration tests and verify timing behavior
- [ ] Test complex async scenarios manually
- [ ] Verify background process cleanup
- [ ] Test failure propagation scenarios
- [ ] **Developer responsibility**: Test additional scenarios and edge cases

### Task 5.2: Performance and Reliability Testing

**Description:** Ensure async implementation is robust and performant

**Subtasks:**

- [ ] Test with long-running async processes
- [ ] Verify proper resource cleanup on failures
- [ ] Test process termination under various conditions
- [ ] Measure performance impact of background process management
- [ ] Test edge cases and error conditions
- [ ] **Developer responsibility**: Identify and test additional reliability scenarios

## Notes

- This change request focuses on **correct async execution semantics**
- **Core principle**: `async: true` means background execution, `delay` timing differs for async vs sync
- **Implementation order**: Specification → Tests → Code
- This is a **breaking change** that will alter execution timing for async configurations
- **Developer responsibility**: The specific tasks listed are starting points - developers must identify and address additional issues as they are discovered during implementation
- **Quality expectation**: The final implementation should provide true concurrent execution for async tasks
