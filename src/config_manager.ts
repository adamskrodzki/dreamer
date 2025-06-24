import { join, dirname } from "jsr:@std/path@^1.0.0";
import { exists } from "jsr:@std/fs@^1.0.0";
import type { DreamConfig, Dependency, DetailedDependency } from "./types.ts";
import { ConfigError } from "./errors.ts";

export class ConfigManager {
  private workspaceRoot?: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async load(): Promise<DreamConfig> {
    const configPath = await this.findConfigFile();
    
    try {
      const content = await Deno.readTextFile(configPath);
      const rawConfig = JSON.parse(content);
      const config = this.validate(rawConfig);
      
      // Store the workspace root for later use
      this.workspaceRoot = dirname(configPath);
      
      return config;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new ConfigError(`Configuration file not found: ${configPath}`);
      }
      if (error instanceof SyntaxError) {
        throw new ConfigError(`Invalid JSON in configuration file: ${error.message}`);
      }
      if (error instanceof ConfigError) {
        throw error;
      }
      throw new ConfigError(`Failed to load configuration: ${error}`);
    }
  }

  /**
   * Load and validate configuration from a specific path
   */
  async loadFromPath(configPath: string): Promise<DreamConfig> {
    try {
      const content = await Deno.readTextFile(configPath);
      const rawConfig = JSON.parse(content);
      const config = this.validate(rawConfig);

      // Store the workspace root for later use
      this.workspaceRoot = dirname(configPath);

      return config;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new ConfigError(`Configuration file not found: ${configPath}`);
      }
      if (error instanceof SyntaxError) {
        throw new ConfigError(`Invalid JSON in configuration file: ${error.message}`);
      }
      if (error instanceof ConfigError) {
        throw error;
      }
      throw new ConfigError(`Failed to load configuration: ${error}`);
    }
  }

  async findConfigFile(): Promise<string> {
    let currentDir = this.workspaceRoot || Deno.cwd();
    
    while (true) {
      const configPath = join(currentDir, "dream.json");
      
      if (await exists(configPath)) {
        return configPath;
      }
      
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached root directory
        throw new ConfigError(
          "No dream.json configuration file found in current directory or any parent directory"
        );
      }
      
      currentDir = parentDir;
    }
  }

  validate(rawConfig: unknown): DreamConfig {
    if (!rawConfig || typeof rawConfig !== "object") {
      throw new ConfigError("Configuration must be a valid JSON object");
    }

    const config = rawConfig as Record<string, unknown>;

    // Validate workspace section
    if (!config.workspace || typeof config.workspace !== "object") {
      throw new ConfigError("Configuration must have a 'workspace' section");
    }

    const workspace = config.workspace as Record<string, unknown>;
    const validatedWorkspace: Record<string, Record<string, Dependency[]>> = {};

    for (const [projectPath, projectConfig] of Object.entries(workspace)) {
      if (!projectConfig || typeof projectConfig !== "object") {
        throw new ConfigError(`Invalid project configuration for ${projectPath}`);
      }

      const tasks = projectConfig as Record<string, unknown>;
      const validatedTasks: Record<string, Dependency[]> = {};

      for (const [taskName, dependencies] of Object.entries(tasks)) {
        if (!Array.isArray(dependencies)) {
          throw new ConfigError(
            `Dependencies for ${projectPath}.${taskName} must be an array`
          );
        }

        validatedTasks[taskName] = dependencies.map((dep, index) => 
          this.validateDependency(dep, `${projectPath}.${taskName}[${index}]`)
        );
      }

      validatedWorkspace[projectPath] = validatedTasks;
    }

    // Validate optional tasks section
    let validatedTasks: Record<string, { async?: boolean; required?: boolean; delay?: number }> | undefined;
    
    if (config.tasks) {
      if (typeof config.tasks !== "object") {
        throw new ConfigError("'tasks' section must be an object");
      }

      validatedTasks = {};
      const tasks = config.tasks as Record<string, unknown>;

      for (const [taskName, taskDefaults] of Object.entries(tasks)) {
        if (!taskDefaults || typeof taskDefaults !== "object") {
          throw new ConfigError(`Invalid task defaults for ${taskName}`);
        }

        const defaults = taskDefaults as Record<string, unknown>;
        const validatedDefaults: { async?: boolean; required?: boolean; delay?: number } = {};

        if (defaults.async !== undefined) {
          if (typeof defaults.async !== "boolean") {
            throw new ConfigError(`Task ${taskName}.async must be a boolean`);
          }
          validatedDefaults.async = defaults.async;
        }

        if (defaults.required !== undefined) {
          if (typeof defaults.required !== "boolean") {
            throw new ConfigError(`Task ${taskName}.required must be a boolean`);
          }
          validatedDefaults.required = defaults.required;
        }

        if (defaults.delay !== undefined) {
          if (typeof defaults.delay !== "number" || defaults.delay < 0) {
            throw new ConfigError(`Task ${taskName}.delay must be a non-negative number`);
          }
          validatedDefaults.delay = defaults.delay;
        }

        validatedTasks[taskName] = validatedDefaults;
      }
    }

    // Validate optional recursive section
    let validatedRecursive: { project: string; tasks: string[] }[] | undefined;

    if (config.recursive) {
      if (!Array.isArray(config.recursive)) {
        throw new ConfigError("'recursive' section must be an array");
      }

      validatedRecursive = [];
      for (const [index, recursiveConfig] of config.recursive.entries()) {
        if (!recursiveConfig || typeof recursiveConfig !== "object") {
          throw new ConfigError(`Invalid recursive config at index ${index}`);
        }

        const recConfig = recursiveConfig as Record<string, unknown>;

        if (!recConfig.project || typeof recConfig.project !== "string") {
          throw new ConfigError(`Recursive config at index ${index} must have a 'project' string`);
        }

        if (!recConfig.tasks || !Array.isArray(recConfig.tasks)) {
          throw new ConfigError(`Recursive config at index ${index} must have a 'tasks' array`);
        }

        const tasks = recConfig.tasks as unknown[];
        for (const [taskIndex, task] of tasks.entries()) {
          if (typeof task !== "string") {
            throw new ConfigError(`Recursive config at index ${index}, task at index ${taskIndex} must be a string`);
          }
        }

        validatedRecursive.push({
          project: recConfig.project,
          tasks: recConfig.tasks as string[],
        });
      }
    }

    return {
      workspace: validatedWorkspace,
      tasks: validatedTasks,
      recursive: validatedRecursive,
    };
  }

  private validateDependency(dep: unknown, context: string): Dependency {
    if (typeof dep === "string") {
      if (dep.trim() === "") {
        throw new ConfigError(`Empty dependency string in ${context}`);
      }
      return dep;
    }

    if (!dep || typeof dep !== "object") {
      throw new ConfigError(`Dependency in ${context} must be a string or object`);
    }

    const depObj = dep as Record<string, unknown>;

    if (!depObj.projectPath || typeof depObj.projectPath !== "string") {
      throw new ConfigError(`Dependency in ${context} must have a 'projectPath' string`);
    }

    if (depObj.projectPath.trim() === "") {
      throw new ConfigError(`Empty projectPath in dependency ${context}`);
    }

    const validatedDep: DetailedDependency = {
      projectPath: depObj.projectPath,
    };

    if (depObj.task !== undefined) {
      if (typeof depObj.task !== "string") {
        throw new ConfigError(`Dependency task in ${context} must be a string`);
      }
      validatedDep.task = depObj.task;
    }

    if (depObj.async !== undefined) {
      if (typeof depObj.async !== "boolean") {
        throw new ConfigError(`Dependency async in ${context} must be a boolean`);
      }
      validatedDep.async = depObj.async;
    }

    if (depObj.required !== undefined) {
      if (typeof depObj.required !== "boolean") {
        throw new ConfigError(`Dependency required in ${context} must be a boolean`);
      }
      validatedDep.required = depObj.required;
    }

    if (depObj.delay !== undefined) {
      if (typeof depObj.delay !== "number" || depObj.delay < 0) {
        throw new ConfigError(`Dependency delay in ${context} must be a non-negative number`);
      }
      validatedDep.delay = depObj.delay;
    }

    return validatedDep;
  }

  getWorkspaceRoot(): string | undefined {
    return this.workspaceRoot;
  }
}
