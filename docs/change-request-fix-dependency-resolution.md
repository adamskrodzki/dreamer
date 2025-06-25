# Change Request: Fix Dependency Resolution Logic

## Issue Summary

The current Dream CLI implementation incorrectly implements a "client impact testing" pattern instead of the intended simple dependency execution pattern. The CLI currently auto-discovers and executes tasks for projects that depend on the current project, rather than only executing the explicitly configured dependencies.

## Problem Description

### Current Incorrect Behavior

The CLI currently implements a complex resolution pattern that:

1. Executes the current project's configured dependencies
2. **Incorrectly** finds all "client" projects that depend on the current project
3. **Incorrectly** executes tasks for those client projects and their dependencies

This results in executing many more tasks than intended and violates the principle of explicit dependency configuration.

### Example of the Problem

Given a `dream.json` configuration like:

```json
{
  "workspace": {
    "./project-a": {
      "test": ["./project-b", "./project-c"]
    },
    "./project-d": {
      "test": ["./project-a"]
    },
    "./project-e": {
      "test": ["./project-a", "./project-f"]
    }
  }
}
```

**Current incorrect behavior** when running `dream test` from `./project-a`:

```
Execution plan: 6 tasks
 1.  → ./project-b test
 2.  → ./project-c test
 3.  → ./project-a test
 4.  → ./project-d test      ← INCORRECT: Auto-discovered client
 5.  → ./project-f test      ← INCORRECT: Dependency of client
 6.  → ./project-e test      ← INCORRECT: Auto-discovered client
```

**Desired correct behavior** when running `dream test` from `./project-a`:

```
Execution plan: 3 tasks
 1.  → ./project-b test
 2.  → ./project-c test
 3.  → ./project-a test
```

## Root Cause Analysis

The issue stems from the `resolveTestPattern()` method in `src/dependency_resolver.ts` which:

1. Correctly resolves the current project's dependencies
2. **Incorrectly** calls `getClients()` to find projects that depend on the current project
3. **Incorrectly** resolves dependencies for those client projects

This "client impact testing" approach contradicts the fundamental principle that dependency resolution should only follow explicitly configured dependencies.

## Desired Correct Behavior

### Core Principle

**Only execute explicitly configured dependencies, never auto-discover dependent projects.**

### Correct Logic Flow

When running `dream <task>` from any project:

1. Identify current project path
2. Find configured dependencies for the specified task in `dream.json`
3. Check if recursive resolution is enabled for this project/task combination
4. Apply task defaults (async, required, delay settings)
5. Execute dependencies in configured order, then execute current project task

### Task Name Agnostic

The resolution logic should work identically regardless of task name (`test`, `dev`, `build`, `deploy`, etc.). Task names are arbitrary - only the dependency configuration matters.

## Impact Analysis

### Files Affected

- **Core Logic**: `src/dependency_resolver.ts` - Main resolution logic
- **CLI Interface**: `src/main.ts` - Task execution coordination
- **Documentation**: `docs/functional-specification.md`, `docs/examples.md`
- **Tests**: Multiple test files across `tests/unit/`, `tests/integration/`, `tests/e2e/`

### Backward Compatibility

This is a **breaking change** that will alter execution behavior for all users. Projects currently relying on the incorrect "client impact testing" behavior will see fewer tasks executed after the fix.

## Required Changes

### 1. Documentation Updates

#### 1.1 Update Functional Specification

**File:** `docs/functional-specification.md`

**Changes needed:**

- Remove all references to "client impact testing" or "client resolution" patterns
- Clarify that dependency resolution only follows explicitly configured dependencies
- Update execution order descriptions to remove any mention of auto-discovering dependent projects
- Ensure examples show dependency-only resolution behavior
- Update help text and usage descriptions

**Key sections requiring updates:**

- Dependency resolution behavior explanations
- Execution order documentation
- Usage examples and patterns
- Any references to testing "clients" or "dependent projects"

#### 1.2 Update Examples Documentation

**File:** `docs/examples.md`

**Changes needed:**

- Review all examples to ensure they show correct dependency-only behavior
- Remove or correct any examples that demonstrate client impact testing
- Ensure comments and explanations match the corrected resolution logic
- Add examples that clearly demonstrate the difference between dependencies and dependents

#### 1.3 Review and Fix consistency of remaining documentation

**Files:** `docs/configuration-guide.md`, `docs/architecture.md`, `README.md`

**Changes needed:**

- Review all documentation to ensure it matches the corrected dependency resolution behavior
- Fix any incorrect descriptions or examples
- Update any references to "client impact testing" or "client resolution"

### 2. Test Updates

#### 2.1 Fix Existing Tests

**Files requiring updates:**

**`tests/unit/dependency_resolver.test.ts`:**

- Remove or fix tests for `resolveTestPattern()` that expect client resolution behavior
- Remove tests for `getClients()` method (will be deleted)
- Update tests to expect dependency-only resolution
- Add tests verifying no auto-discovery of dependent projects occurs

**`tests/e2e/dependency_resolution.test.ts`:**

- Update E2E tests that verify execution plans to expect fewer tasks
- Fix tests that currently expect client impact testing behavior
- Add comprehensive E2E tests for dependency-only resolution

**`tests/integration/dependency_resolution.test.ts`:**

- Update integration tests to match corrected execution plans
- Fix any tests that rely on client resolution behavior

#### 2.2 Make sure that current tests are correct

Multiple tests rely on examples/* folders. It may be the case that some tests rely on the incorrect behavior.
You need to analyze structure of related dream.json and related tests and adjust them if needed.

#### 2.3 Create New Comprehensive Tests

**Approach:** Create failing tests first to define correct behavior

**Test scenarios needed:**

- **Basic dependency resolution**: Project with 2-3 dependencies should resolve to exact number of tasks
- **No client resolution**: Verify that projects depending on current project are NOT included
- **Task name agnostic**: Same resolution logic works for `test`, `dev`, `build`, etc.
- **Empty dependencies**: Project with no dependencies should only execute itself
- **Complex configurations**: Multi-level dependency chains work correctly
- **Execution order**: Tasks execute in exact order specified in configuration

### 3. Code Changes

#### 3.1 Remove Client Resolution Logic

**File:** `src/dependency_resolver.ts`

**Primary changes:**

- **Delete** `getClients()` method entirely - this is the root cause of incorrect behavior
- **Simplify** `resolveTestPattern()` method to only resolve explicitly configured dependencies
- **Remove** the client resolution loop that auto-discovers dependent projects
- **Ensure** resolution logic is task-name agnostic

#### 3.2 Unify Resolution Methods

**Objective:** Eliminate the distinction between different task types in resolution logic

**Key changes:**

- `resolveTestPattern()` and `resolveDevPattern()` should use identical dependency resolution logic
- Only difference should be execution order preferences, not which projects get included
- Both methods should only process explicitly configured dependencies
- Remove any special-case logic for specific task names

#### 3.3 Verify Core Resolution Logic

**File:** `src/dependency_resolver.ts`

**Areas to verify:**

- `resolve()` method correctly processes only explicit dependencies
- `resolveNonRecursive()` method works correctly
- `resolveDependencies()` method (recursive) works correctly
- No method auto-discovers or includes non-configured projects

#### 3.4 Update CLI Interface

**File:** `src/main.ts`

**Changes needed:**

- Verify task resolution method selection logic is appropriate
- Update help text to reflect dependency-only behavior
- Ensure error messages are accurate for new behavior

## Implementation Plan

### Phase 1: Update Specification (Priority: High)

1. **Task 1.1: Update Functional Specification**
   - Identify and remove all client impact testing references throughout the document
   - Clarify dependency-only resolution behavior
   - Review and update execution order documentation for consistency
   - Identify and fix any examples or descriptions that contradict the corrected behavior

2. **Task 1.2: Update Examples Documentation**
   - Comprehensively review all examples for consistency with corrected behavior
   - Identify and update any incorrect comments, descriptions, or examples
   - Developer responsibility: Find and address any inconsistencies not explicitly listed

3. **Task 1.3: Review All Documentation for Consistency**
   - Systematically review remaining documentation files for inconsistencies
   - Developer responsibility: Identify any references to incorrect behavior patterns
   - Update any found inconsistencies to match the corrected dependency resolution logic

### Phase 2: Update Tests (Priority: High)

4. **Task 2.1: Create Failing Tests for Correct Behavior**
   - Create comprehensive tests that define the correct dependency-only behavior
   - Developer responsibility: Identify additional test scenarios beyond those explicitly listed
   - Ensure tests cover edge cases and various configuration patterns

5. **Task 2.2: Analyze and Fix Existing Tests**
   - Systematically analyze all existing tests for reliance on incorrect behavior
   - Developer responsibility: Identify which tests expect client resolution and need updating
   - Review example configurations used in tests for consistency with corrected behavior
   - Update or remove tests that contradict the corrected dependency resolution logic

### Phase 3: Update Code (Priority: High)

6. **Task 3.1: Remove Client Resolution Logic**
   - Identify and remove all client resolution code throughout the codebase
   - Developer responsibility: Find any additional client resolution logic beyond explicitly mentioned methods
   - Ensure resolution logic is truly task-name agnostic

7. **Task 3.2: Verify and Unify Resolution Methods**
   - Analyze all resolution methods for consistency with dependency-only behavior
   - Developer responsibility: Identify any remaining inconsistencies in resolution logic
   - Ensure all resolution methods follow the same core principles

### Phase 4: Validation (Priority: Medium)

8. **Task 4.1: Comprehensive Testing**
   - Run all test suites and identify any failures related to the changes
   - Developer responsibility: Investigate and fix any unexpected test failures
   - Verify that all tests now reflect the corrected behavior

9. **Task 4.2: Manual Validation**
   - Test with various configurations to verify corrected behavior
   - Developer responsibility: Identify and test additional scenarios beyond those explicitly listed
   - Verify no unintended regressions in functionality

## Success Criteria

- [ ] `dream test` from `./services/api` shows exactly 3 tasks
- [ ] No client resolution occurs in any scenario
- [ ] All tests pass with corrected behavior
- [ ] Documentation accurately reflects implementation
- [ ] No regression in other functionality

## Detailed Task Breakdown

### Task 1.1: Update Functional Specification

**File:** `docs/functional-specification.md`
**Description:** Comprehensively review and update functional specification to reflect dependency-only resolution

**Subtasks:**

- [ ] Systematically search for and remove all references to "client resolution", "client impact testing", or "testing clients"
- [ ] Review dependency resolution behavior sections and update to clarify only explicit dependencies are resolved
- [ ] Identify and update execution order documentation to remove any mentions of auto-discovered projects
- [ ] Clarify that task names are arbitrary and resolution logic is task-agnostic
- [ ] Review all examples throughout the document and update to show correct dependency-only behavior
- [ ] **Developer responsibility**: Identify any additional inconsistencies or contradictions not explicitly listed above
- [ ] **Developer responsibility**: Review help text descriptions and update any that contradict the corrected behavior

### Task 1.2: Update Examples Documentation

**File:** `docs/examples.md`
**Description:** Comprehensively review and update all examples for consistency with corrected behavior

**Subtasks:**

- [ ] Systematically review all examples to ensure they demonstrate dependency-only resolution
- [ ] Identify and remove or correct examples that show client impact testing behavior
- [ ] Add clear examples showing the difference between dependencies and dependents
- [ ] Review all example comments and descriptions to ensure they accurately describe the corrected behavior
- [ ] Verify examples work with arbitrary task names (not just `test`)
- [ ] **Developer responsibility**: Identify any additional examples or descriptions that contradict the corrected behavior
- [ ] **Developer responsibility**: Look for subtle inconsistencies in example explanations that may not be immediately obvious

### Task 2.1: Create Failing Tests for Correct Behavior

**File:** `tests/unit/dependency_resolver_corrected.test.ts` (new file)
**Description:** Create comprehensive tests that define the correct behavior before implementing changes

**Subtasks:**

- [ ] Test: Basic dependency resolution - project with N dependencies resolves to N+1 tasks
- [ ] Test: Task order matches configuration order exactly
- [ ] Test: No client resolution occurs - projects that depend on current project are NOT included
- [ ] Test: Task name agnostic - same logic works for `test`, `dev`, `build`, `custom-task`
- [ ] Test: Empty dependencies array results in only current project task
- [ ] Test: Complex dependency chains work correctly without auto-discovery
- [ ] **Developer responsibility**: Identify additional test scenarios that would help validate the corrected behavior
- [ ] **Developer responsibility**: Create tests for edge cases that may not be immediately obvious

### Task 2.2: Analyze and Fix Existing Tests

**Files:** `tests/unit/dependency_resolver.test.ts`, `tests/e2e/dependency_resolution.test.ts`, `tests/integration/dependency_resolution.test.ts`, and others
**Description:** Systematically analyze and update all existing tests to match corrected behavior

**Subtasks:**

- [ ] Identify and remove tests for `getClients()` method (will be deleted)
- [ ] Analyze `resolveTestPattern()` tests and update to expect dependency-only resolution
- [ ] Review E2E tests and identify those that expect incorrect client resolution behavior
- [ ] Analyze integration tests that verify execution plans and update to expect corrected task counts
- [ ] Identify and remove any tests that verify client impact testing behavior
- [ ] Update test assertions throughout the test suite to match corrected execution plans
- [ ] **Developer responsibility**: Systematically review ALL test files for dependencies on incorrect behavior
- [ ] **Developer responsibility**: Analyze example configurations used in tests and verify they support the corrected behavior
- [ ] **Developer responsibility**: Identify tests that may be indirectly affected by the behavior change

### Task 3.1: Remove Client Resolution Logic

**File:** `src/dependency_resolver.ts`
**Description:** Systematically identify and remove all client-finding and client resolution code

**Subtasks:**

- [ ] Delete `getClients()` method entirely
- [ ] Remove client resolution loop from `resolveTestPattern()` method
- [ ] Simplify `resolveTestPattern()` to only resolve current project and its dependencies
- [ ] Ensure `resolveTestPattern()` behaves identically to `resolve()` for non-recursive cases
- [ ] Update method documentation to reflect dependency-only behavior
- [ ] **Developer responsibility**: Search the entire codebase for any other references to client resolution logic
- [ ] **Developer responsibility**: Identify any helper methods or utilities that support client resolution and remove them
- [ ] **Developer responsibility**: Review all resolution-related methods for consistency with dependency-only behavior

### Task 3.2: Verify and Unify Resolution Methods

**File:** `src/dependency_resolver.ts`
**Description:** Comprehensively verify that all resolution methods work correctly with dependency-only behavior

**Subtasks:**

- [ ] Verify that resolution methods return correct task counts for various configurations
- [ ] Ensure execution order matches dependency configuration order in all cases
- [ ] Test with various configurations to ensure no regression in core functionality
- [ ] Verify recursive configuration is still respected for projects that have it configured
- [ ] Test edge cases (empty dependencies, missing projects, circular dependencies, etc.)
- [ ] **Developer responsibility**: Identify any resolution methods beyond those explicitly mentioned that may need updating
- [ ] **Developer responsibility**: Test with complex, real-world configurations to identify potential issues
- [ ] **Developer responsibility**: Verify that all resolution paths through the code follow the same dependency-only principles

### Task 4.1: Comprehensive Testing and Validation

**Description:** Systematically validate implementation with comprehensive testing and issue resolution

**Subtasks:**

- [ ] Run unit tests: `deno test tests/unit/` and analyze all failures
- [ ] Run integration tests: `deno test tests/integration/` and analyze all failures
- [ ] Run E2E tests: `deno test tests/e2e/` and analyze all failures
- [ ] Systematically fix any failing tests that depend on old behavior
- [ ] Ensure all new tests pass and validate correct behavior
- [ ] **Developer responsibility**: Investigate any unexpected test failures that may indicate additional inconsistencies
- [ ] **Developer responsibility**: Run tests with various configurations to identify edge cases
- [ ] **Developer responsibility**: Verify that test fixes don't introduce new inconsistencies

### Task 4.2: Manual Validation and Regression Testing

**Description:** Comprehensively verify correct behavior with real examples and identify any remaining issues

**Subtasks:**

- [ ] Test with various project configurations to verify dependency-only resolution
- [ ] Verify output shows correct number of tasks matching configuration exactly
- [ ] Test with different task names to ensure truly task-agnostic behavior
- [ ] Test with `--debug` flag to verify resolution logic is working as expected
- [ ] Test error scenarios (missing dependencies, circular deps, invalid configurations, etc.)
- [ ] Verify no regression in recursive behavior for projects that have it configured
- [ ] **Developer responsibility**: Test with complex, real-world configurations beyond the provided examples
- [ ] **Developer responsibility**: Identify and test additional scenarios that could reveal remaining inconsistencies
- [ ] **Developer responsibility**: Verify that the CLI behavior matches the updated documentation in all cases
- [ ] **Developer responsibility**: Test edge cases and unusual configurations that may not be covered by automated tests

## Success Criteria

- [ ] Dependency resolution only follows explicitly configured dependencies
- [ ] No auto-discovery of dependent projects occurs anywhere in the system
- [ ] Task names are treated as arbitrary (same logic for `test`, `dev`, `build`, etc.)
- [ ] All tests pass with corrected behavior and no inconsistencies remain
- [ ] Documentation accurately reflects implementation with no contradictions
- [ ] No regression in recursive behavior where explicitly configured
- [ ] **Developer verification**: All identified inconsistencies have been resolved
- [ ] **Developer verification**: System behavior matches documentation in all tested scenarios
- [ ] **Developer verification**: No subtle inconsistencies remain that could cause confusion

## Notes

- This change request focuses on **non-recursive** behavior first
- Recursive behavior will need separate analysis and changes later
- **Core principle**: Only execute explicitly configured dependencies, never auto-discover clients
- **Implementation order**: Specification → Tests → Code
- This is a **breaking change** that will alter execution behavior for all users
- **Developer responsibility**: The specific tasks listed are starting points - developers must identify and address additional inconsistencies as they are discovered during implementation
- **Quality expectation**: The final implementation should have no contradictions between documentation, tests, and code behavior
