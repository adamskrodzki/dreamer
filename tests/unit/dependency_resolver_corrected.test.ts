import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { DependencyResolver } from "../../src/dependency_resolver.ts";
import type { DreamConfig } from "../../src/types.ts";

/**
 * Tests for corrected dependency resolution behavior
 * These tests define the CORRECT behavior that should be implemented
 */

Deno.test("CORRECTED: Basic dependency resolution - project with N dependencies resolves to N+1 tasks", () => {
  const config: DreamConfig = {
    workspace: {
      "./project-a": {
        test: ["./project-b", "./project-c"]
      },
      "./project-b": {
        test: []
      },
      "./project-c": {
        test: []
      },
      "./project-d": {
        test: ["./project-a"]
      },
      "./project-e": {
        test: ["./project-a", "./project-f"]
      },
      "./project-f": {
        test: []
      }
    }
  };

  const resolver = new DependencyResolver(config);
  
  // When running from project-a, should only execute its configured dependencies
  const plan = resolver.resolve("./project-a", "test");
  
  // Should be exactly 3 tasks: project-b, project-c, project-a
  assertEquals(plan.tasks.length, 3, "Should execute exactly N+1 tasks (dependencies + current project)");
  
  // Verify exact execution order
  assertEquals(plan.tasks[0].id, "./project-b:test", "First dependency should execute first");
  assertEquals(plan.tasks[1].id, "./project-c:test", "Second dependency should execute second");
  assertEquals(plan.tasks[2].id, "./project-a:test", "Current project should execute last");
  
  // Verify NO auto-discovery of dependent projects
  const taskIds = plan.tasks.map(t => t.id);
  assertEquals(taskIds.includes("./project-d:test"), false, "Should NOT auto-discover project-d (depends on project-a)");
  assertEquals(taskIds.includes("./project-e:test"), false, "Should NOT auto-discover project-e (depends on project-a)");
  assertEquals(taskIds.includes("./project-f:test"), false, "Should NOT auto-discover project-f (dependency of project-e)");
});

Deno.test("CORRECTED: Task order matches configuration order exactly", () => {
  const config: DreamConfig = {
    workspace: {
      "./main": {
        test: ["./dep-c", "./dep-a", "./dep-b"] // Specific order
      },
      "./dep-a": { test: [] },
      "./dep-b": { test: [] },
      "./dep-c": { test: [] }
    }
  };

  const resolver = new DependencyResolver(config);
  const plan = resolver.resolve("./main", "test");
  
  assertEquals(plan.tasks.length, 4);
  // Order should match configuration exactly
  assertEquals(plan.tasks[0].id, "./dep-c:test", "First configured dependency");
  assertEquals(plan.tasks[1].id, "./dep-a:test", "Second configured dependency");
  assertEquals(plan.tasks[2].id, "./dep-b:test", "Third configured dependency");
  assertEquals(plan.tasks[3].id, "./main:test", "Current project last");
});

Deno.test("CORRECTED: No client resolution occurs", () => {
  const config: DreamConfig = {
    workspace: {
      "./shared-lib": {
        test: [] // No dependencies configured
      },
      "./service-a": {
        test: ["./shared-lib"] // service-a depends on shared-lib
      },
      "./service-b": {
        test: ["./shared-lib"] // service-b depends on shared-lib
      },
      "./app": {
        test: ["./service-a", "./service-b"] // app depends on both services
      }
    }
  };

  const resolver = new DependencyResolver(config);
  
  // When running from shared-lib, should NOT execute its dependents
  const plan = resolver.resolve("./shared-lib", "test");
  
  assertEquals(plan.tasks.length, 1, "Should only execute the current project");
  assertEquals(plan.tasks[0].id, "./shared-lib:test", "Should only execute shared-lib itself");
  
  // Verify NO auto-discovery of projects that depend on shared-lib
  const taskIds = plan.tasks.map(t => t.id);
  assertEquals(taskIds.includes("./service-a:test"), false, "Should NOT execute service-a");
  assertEquals(taskIds.includes("./service-b:test"), false, "Should NOT execute service-b");
  assertEquals(taskIds.includes("./app:test"), false, "Should NOT execute app");
});

Deno.test("CORRECTED: Task name agnostic behavior", () => {
  const config: DreamConfig = {
    workspace: {
      "./main": {
        test: ["./dep-a", "./dep-b"],
        build: ["./dep-a", "./dep-b"],
        deploy: ["./dep-a", "./dep-b"],
        "custom-task": ["./dep-a", "./dep-b"]
      },
      "./dep-a": {
        test: [],
        build: [],
        deploy: [],
        "custom-task": []
      },
      "./dep-b": {
        test: [],
        build: [],
        deploy: [],
        "custom-task": []
      }
    }
  };

  const resolver = new DependencyResolver(config);
  
  // All task names should use identical resolution logic
  const testPlan = resolver.resolve("./main", "test");
  const buildPlan = resolver.resolve("./main", "build");
  const deployPlan = resolver.resolve("./main", "deploy");
  const customPlan = resolver.resolve("./main", "custom-task");
  
  // All should have same structure: 3 tasks in same order
  assertEquals(testPlan.tasks.length, 3);
  assertEquals(buildPlan.tasks.length, 3);
  assertEquals(deployPlan.tasks.length, 3);
  assertEquals(customPlan.tasks.length, 3);
  
  // Verify same execution order for all task types
  assertEquals(testPlan.tasks[0].id, "./dep-a:test");
  assertEquals(buildPlan.tasks[0].id, "./dep-a:build");
  assertEquals(deployPlan.tasks[0].id, "./dep-a:deploy");
  assertEquals(customPlan.tasks[0].id, "./dep-a:custom-task");
  
  assertEquals(testPlan.tasks[2].id, "./main:test");
  assertEquals(buildPlan.tasks[2].id, "./main:build");
  assertEquals(deployPlan.tasks[2].id, "./main:deploy");
  assertEquals(customPlan.tasks[2].id, "./main:custom-task");
});

Deno.test("CORRECTED: Empty dependencies behavior", () => {
  const config: DreamConfig = {
    workspace: {
      "./standalone": {
        test: [] // No dependencies
      },
      "./other-project": {
        test: ["./standalone"] // other-project depends on standalone
      }
    }
  };

  const resolver = new DependencyResolver(config);
  
  // Project with empty dependencies should only execute itself
  const plan = resolver.resolve("./standalone", "test");
  
  assertEquals(plan.tasks.length, 1, "Should execute only current project");
  assertEquals(plan.tasks[0].id, "./standalone:test", "Should execute standalone project");
  
  // Should NOT auto-discover other-project
  const taskIds = plan.tasks.map(t => t.id);
  assertEquals(taskIds.includes("./other-project:test"), false, "Should NOT execute dependent projects");
});

Deno.test("CORRECTED: Complex dependency chains work without auto-discovery", () => {
  const config: DreamConfig = {
    workspace: {
      "./utils": {
        test: []
      },
      "./core": {
        test: ["./utils"]
      },
      "./api": {
        test: ["./core", "./utils"]
      },
      "./web": {
        test: ["./api", "./core", "./utils"]
      },
      // These projects depend on utils but should NOT be auto-discovered
      "./mobile": {
        test: ["./api", "./utils"]
      },
      "./admin": {
        test: ["./api"]
      }
    }
  };

  const resolver = new DependencyResolver(config);
  
  // Test from utils - should only execute utils
  const utilsPlan = resolver.resolve("./utils", "test");
  assertEquals(utilsPlan.tasks.length, 1);
  assertEquals(utilsPlan.tasks[0].id, "./utils:test");
  
  // Test from core - should execute utils, then core
  const corePlan = resolver.resolve("./core", "test");
  assertEquals(corePlan.tasks.length, 2);
  assertEquals(corePlan.tasks[0].id, "./utils:test");
  assertEquals(corePlan.tasks[1].id, "./core:test");
  
  // Test from web - should execute all its dependencies, then web
  const webPlan = resolver.resolve("./web", "test");
  assertEquals(webPlan.tasks.length, 4);
  assertEquals(webPlan.tasks[0].id, "./api:test");
  assertEquals(webPlan.tasks[1].id, "./core:test");
  assertEquals(webPlan.tasks[2].id, "./utils:test");
  assertEquals(webPlan.tasks[3].id, "./web:test");
  
  // Verify NO auto-discovery of mobile or admin
  const webTaskIds = webPlan.tasks.map(t => t.id);
  assertEquals(webTaskIds.includes("./mobile:test"), false, "Should NOT auto-discover mobile");
  assertEquals(webTaskIds.includes("./admin:test"), false, "Should NOT auto-discover admin");
});

// Tests for the problematic resolveTestPattern method
Deno.test("CORRECTED: resolveTestPattern should behave like resolve() - no client auto-discovery", () => {
  const config: DreamConfig = {
    workspace: {
      "./project-a": {
        test: ["./project-b", "./project-c"]
      },
      "./project-b": {
        test: []
      },
      "./project-c": {
        test: []
      },
      "./project-d": {
        test: ["./project-a"]
      },
      "./project-e": {
        test: ["./project-a", "./project-f"]
      },
      "./project-f": {
        test: []
      }
    }
  };

  const resolver = new DependencyResolver(config);

  // resolveTestPattern should behave exactly like resolve()
  const testPatternPlan = resolver.resolveTestPattern("./project-a", "test");
  const regularPlan = resolver.resolve("./project-a", "test");

  // Should have same number of tasks
  assertEquals(testPatternPlan.tasks.length, regularPlan.tasks.length,
    "resolveTestPattern should execute same number of tasks as resolve()");

  // Should have same task IDs in same order
  const testPatternIds = testPatternPlan.tasks.map(t => t.id);
  const regularIds = regularPlan.tasks.map(t => t.id);
  assertEquals(testPatternIds, regularIds,
    "resolveTestPattern should execute same tasks in same order as resolve()");

  // Specifically verify NO auto-discovery of dependent projects
  assertEquals(testPatternIds.includes("./project-d:test"), false,
    "resolveTestPattern should NOT auto-discover project-d");
  assertEquals(testPatternIds.includes("./project-e:test"), false,
    "resolveTestPattern should NOT auto-discover project-e");
  assertEquals(testPatternIds.includes("./project-f:test"), false,
    "resolveTestPattern should NOT auto-discover project-f");
});

Deno.test("CORRECTED: resolveTestPattern with empty dependencies should only execute current project", () => {
  const config: DreamConfig = {
    workspace: {
      "./shared-lib": {
        test: [] // No dependencies
      },
      "./service-a": {
        test: ["./shared-lib"]
      },
      "./service-b": {
        test: ["./shared-lib"]
      }
    }
  };

  const resolver = new DependencyResolver(config);

  // When project has no dependencies, resolveTestPattern should NOT include clients
  const plan = resolver.resolveTestPattern("./shared-lib", "test");

  assertEquals(plan.tasks.length, 1, "Should only execute current project when no dependencies");
  assertEquals(plan.tasks[0].id, "./shared-lib:test", "Should execute shared-lib only");

  // Should NOT auto-discover dependent projects
  const taskIds = plan.tasks.map(t => t.id);
  assertEquals(taskIds.includes("./service-a:test"), false, "Should NOT execute service-a");
  assertEquals(taskIds.includes("./service-b:test"), false, "Should NOT execute service-b");
});
