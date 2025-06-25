import type {
  Dependency,
  DetailedDependency,
  DreamConfig,
  ExecutionPlan,
  TaskExecution,
} from "./types.ts";
import { CircularDependencyError } from "./errors.ts";

export class DependencyResolver {
  private config: DreamConfig;

  constructor(config: DreamConfig) {
    this.config = config;
  }

  /**
   * Resolves dependencies for a given project and task, creating an execution plan
   */
  resolve(projectPath: string, taskName: string): ExecutionPlan {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const tasks: TaskExecution[] = [];

    // Check if this project/task should use recursive resolution
    const useRecursive = this.shouldUseRecursiveResolution(projectPath, taskName);

    if (useRecursive) {
      this.resolveDependencies(projectPath, taskName, visited, visiting, tasks);
    } else {
      this.resolveNonRecursive(projectPath, taskName, visited, tasks);
    }

    return { tasks };
  }

  private resolveDependencies(
    projectPath: string,
    taskName: string,
    visited: Set<string>,
    visiting: Set<string>,
    tasks: TaskExecution[],
  ): void {
    const taskId = `${projectPath}:${taskName}`;

    // Check for circular dependencies
    if (visiting.has(taskId)) {
      const cycle = Array.from(visiting).concat(taskId);
      throw new CircularDependencyError(cycle);
    }

    // Skip if already processed
    if (visited.has(taskId)) {
      return;
    }

    visiting.add(taskId);

    // Get project configuration
    const projectConfig = this.config.workspace[projectPath];
    if (!projectConfig) {
      // If project not in config, just add the task itself
      this.addTask(projectPath, taskName, tasks);
      visiting.delete(taskId);
      visited.add(taskId);
      return;
    }

    // Get dependencies for this task
    const dependencies = projectConfig[taskName] || [];

    // Process each dependency first (depth-first)
    // We need to preserve the order of dependencies as specified in the configuration
    for (const dependency of dependencies) {
      const { depProjectPath, depTaskName, dependencyOverrides } = this.parseDependency(
        dependency,
        taskName,
      );
      this.resolveDependenciesWithOverrides(
        depProjectPath,
        depTaskName,
        visited,
        visiting,
        tasks,
        dependencyOverrides,
      );
    }

    // Add the current task after its dependencies
    this.addTask(projectPath, taskName, tasks);

    visiting.delete(taskId);
    visited.add(taskId);
  }

  private resolveDependenciesWithOverrides(
    projectPath: string,
    taskName: string,
    visited: Set<string>,
    visiting: Set<string>,
    tasks: TaskExecution[],
    dependencyOverrides?: Partial<DetailedDependency>,
  ): void {
    const taskId = `${projectPath}:${taskName}`;

    // Check for circular dependencies
    if (visiting.has(taskId)) {
      const cycle = Array.from(visiting).concat(taskId);
      throw new CircularDependencyError(cycle);
    }

    // Skip if already processed
    if (visited.has(taskId)) {
      return;
    }

    visiting.add(taskId);

    // Get project configuration
    const projectConfig = this.config.workspace[projectPath];
    if (!projectConfig) {
      // If project not in config, just add the task itself with overrides
      this.addTask(projectPath, taskName, tasks, dependencyOverrides);
      visiting.delete(taskId);
      visited.add(taskId);
      return;
    }

    // Get dependencies for this task
    const dependencies = projectConfig[taskName] || [];

    // Process each dependency first (depth-first)
    for (const dependency of dependencies) {
      const { depProjectPath, depTaskName, dependencyOverrides: nestedOverrides } = this
        .parseDependency(dependency, taskName);
      this.resolveDependenciesWithOverrides(
        depProjectPath,
        depTaskName,
        visited,
        visiting,
        tasks,
        nestedOverrides,
      );
    }

    // Add the current task after its dependencies with the provided overrides
    this.addTask(projectPath, taskName, tasks, dependencyOverrides);

    visiting.delete(taskId);
    visited.add(taskId);
  }

  private parseDependency(dependency: Dependency, defaultTaskName: string): {
    depProjectPath: string;
    depTaskName: string;
    dependencyOverrides?: Partial<DetailedDependency>;
  } {
    if (typeof dependency === "string") {
      return {
        depProjectPath: dependency,
        depTaskName: defaultTaskName,
      };
    }

    const detailedDep = dependency as DetailedDependency;
    return {
      depProjectPath: detailedDep.projectPath,
      depTaskName: detailedDep.task || defaultTaskName,
      dependencyOverrides: {
        async: detailedDep.async,
        required: detailedDep.required,
        delay: detailedDep.delay,
      },
    };
  }

  private addTask(
    projectPath: string,
    taskName: string,
    tasks: TaskExecution[],
    dependencyOverrides?: Partial<DetailedDependency>,
  ): void {
    const taskId = `${projectPath}:${taskName}`;

    // Check if task already exists (deduplication)
    if (tasks.some((task) => task.id === taskId)) {
      return;
    }

    // Get task defaults
    const taskDefaults = this.config.tasks?.[taskName] || {};

    // Apply properties in order of precedence: dependency overrides > task defaults > built-in defaults
    const async = dependencyOverrides?.async ?? taskDefaults.async ?? false;
    const required = dependencyOverrides?.required ?? taskDefaults.required ?? true;
    const delay = dependencyOverrides?.delay ?? taskDefaults.delay ?? 0;

    const taskExecution: TaskExecution = {
      id: taskId,
      projectPath,
      taskName,
      async,
      required,
      delay,
    };

    tasks.push(taskExecution);
  }

  /**
   * Resolves dependencies for testing pattern: execute configured dependencies + current project
   * Uses the same dependency-only resolution logic as resolve()
   */
  resolveTestPattern(projectPath: string, taskName: string = "test"): ExecutionPlan {
    // resolveTestPattern now behaves identically to resolve()
    return this.resolve(projectPath, taskName);
  }

  /**
   * Resolves dependencies for development pattern: start dependencies + current project
   */
  resolveDevPattern(projectPath: string, taskName: string = "dev"): ExecutionPlan {
    // For dev pattern, we just resolve dependencies normally
    // Dependencies run first, then the current project
    return this.resolve(projectPath, taskName);
  }

  /**
   * Checks if a project/task should use recursive dependency resolution
   */
  private shouldUseRecursiveResolution(projectPath: string, taskName: string): boolean {
    const recursiveConfigs = this.config.recursive || [];

    for (const config of recursiveConfigs) {
      if (config.project === projectPath && config.tasks.includes(taskName)) {
        return true;
      }
    }

    // Default to non-recursive if not specified
    return false;
  }

  /**
   * Resolves dependencies non-recursively (only direct dependencies)
   */
  private resolveNonRecursive(
    projectPath: string,
    taskName: string,
    visited: Set<string>,
    tasks: TaskExecution[],
  ): void {
    // Get project configuration
    const projectConfig = this.config.workspace[projectPath];
    if (!projectConfig) {
      // If project not in config, just add the task itself
      this.addTask(projectPath, taskName, tasks);
      return;
    }

    // Get dependencies for this task
    const dependencies = projectConfig[taskName] || [];

    // Process each dependency in order (non-recursive)
    for (const dependency of dependencies) {
      const { depProjectPath, depTaskName, dependencyOverrides } = this.parseDependency(
        dependency,
        taskName,
      );
      const taskId = `${depProjectPath}:${depTaskName}`;

      // Only add if not already processed
      if (!visited.has(taskId)) {
        this.addTask(depProjectPath, depTaskName, tasks, dependencyOverrides);
        visited.add(taskId);
      }
    }

    // Add the current task after its dependencies
    const currentTaskId = `${projectPath}:${taskName}`;
    if (!visited.has(currentTaskId)) {
      this.addTask(projectPath, taskName, tasks);
      visited.add(currentTaskId);
    }
  }
}
