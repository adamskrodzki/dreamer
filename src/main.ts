#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env

import { parseArgs } from "jsr:@std/cli@^1.0.0/parse-args";
import type { ParsedArgs } from "./types.ts";
import { ConfigManager } from "./config_manager.ts";
import { DependencyResolver } from "./dependency_resolver.ts";
import { DreamRunner } from "./dream_runner.ts";
import { CircularDependencyError, ConfigError, TaskExecutionError } from "./errors.ts";

const VERSION = "1.0.0";

function showHelp(): void {
  console.log(`Dream CLI v${VERSION}

Dependency-aware task execution for Deno monorepos.

USAGE:
    dream <task> [OPTIONS]

ARGUMENTS:
    <task>    Task name to execute (e.g., test, dev, build)

OPTIONS:
    -h, --help       Show this help message
    -v, --version    Show version information
    -d, --debug      Enable verbose debug output
    -i, --info       Show configuration discovery and workspace information

EXAMPLES:
    dream test       Test configured dependencies + current project
    dream dev        Start required services + current project dev
    dream build      Build configured dependencies + current project
    dream --help     Show this help message
    dream --version  Show version information

For more information, visit: https://github.com/JinxCodesAI/dreamer`);
}

function showVersion(): void {
  console.log(`Dream CLI v${VERSION}`);
}

async function showInfo(): Promise<number> {
  console.log(`Dream CLI v${VERSION} - Configuration Discovery Information\n`);

  try {
    const configManager = new ConfigManager();

    // Show current working directory
    console.log(`Current Working Directory: ${Deno.cwd()}`);

    // Try to find configuration
    try {
      const configPath = await configManager.findConfigFile();
      console.log(`✅ Configuration Found: ${configPath}`);

      // Load and validate configuration
      const config = await configManager.load();
      const workspaceRoot = configManager.getWorkspaceRoot();

      console.log(`✅ Workspace Root: ${workspaceRoot}`);
      console.log(
        `✅ Configuration Valid: ${Object.keys(config.workspace).length} projects configured`,
      );

      // Show workspace projects
      console.log(`\nWorkspace Projects:`);
      for (const [projectPath, projectConfig] of Object.entries(config.workspace)) {
        const tasks = Object.keys(projectConfig);
        console.log(`  ${projectPath} (tasks: ${tasks.join(", ")})`);
      }

      // Show task defaults if any
      if (config.tasks && Object.keys(config.tasks).length > 0) {
        console.log(`\nTask Defaults:`);
        for (const [taskName, defaults] of Object.entries(config.tasks)) {
          console.log(
            `  ${taskName}: async=${defaults.async}, required=${defaults.required}, delay=${defaults.delay}ms`,
          );
        }
      }

      return 0;
    } catch (error) {
      if (error instanceof ConfigError) {
        console.log(`❌ Configuration Error: ${error.message}`);

        // Show search path information
        console.log(`\nConfiguration Search Path:`);
        let currentDir = Deno.cwd();
        let level = 0;
        while (level < 10) { // Prevent infinite loop
          const separator = currentDir.includes("/") ? "/" : "\\";
          console.log(`  ${level === 0 ? "→" : " "} ${currentDir}${separator}dream.json`);

          const lastSeparator = Math.max(currentDir.lastIndexOf("/"), currentDir.lastIndexOf("\\"));
          if (lastSeparator === -1) break;

          const parentDir = currentDir.substring(0, lastSeparator);
          if (parentDir === currentDir) break;
          currentDir = parentDir;
          level++;
        }

        console.log(`\nTo fix this issue:`);
        console.log(`1. Create a dream.json file in your workspace root`);
        console.log(`2. Ensure it's in the same directory as your workspace deno.json`);
        console.log(`3. Use the examples in the documentation for reference`);

        return 1;
      }
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Unexpected Error: ${message}`);
    return 1;
  }
}

export function parseCliArgs(args: string[]): ParsedArgs {
  const parsed = parseArgs(args, {
    boolean: ["help", "version", "debug", "info"],
    string: [],
    alias: {
      h: "help",
      v: "version",
      d: "debug",
      i: "info",
    },
    stopEarly: false,
    unknown: (arg: string) => {
      if (arg.startsWith("-")) {
        console.error(`Unknown option: ${arg}`);
        console.error("Use --help to see available options");
        return false;
      }
      return true;
    },
  });

  const task = parsed._.length > 0 ? String(parsed._[0]) : undefined;

  return {
    task,
    help: parsed.help || false,
    version: parsed.version || false,
    debug: parsed.debug || false,
    info: parsed.info || false,
    _: parsed._.slice(1).map(String),
  };
}

export async function main(args: string[] = Deno.args): Promise<number> {
  try {
    const parsedArgs = parseCliArgs(args);

    // Handle help flag
    if (parsedArgs.help) {
      showHelp();
      return 0;
    }

    // Handle version flag
    if (parsedArgs.version) {
      showVersion();
      return 0;
    }

    // Handle info flag
    if (parsedArgs.info) {
      return await showInfo();
    }

    // Validate task argument
    if (!parsedArgs.task) {
      console.error("Error: Task name is required");
      console.error("Use --help to see usage information");
      return 1;
    }

    // Load configuration
    const configManager = new ConfigManager();
    let config;

    try {
      config = await configManager.load();

      if (parsedArgs.debug) {
        console.log("Debug: Configuration loaded successfully");
        console.log("Debug: Workspace root:", configManager.getWorkspaceRoot());
        console.log("Debug: Configuration:");
        console.log(JSON.stringify(config, null, 2));
      }
    } catch (error) {
      if (error instanceof ConfigError) {
        console.error(`Configuration Error: ${error.message}`);
        if (parsedArgs.debug) {
          console.error("Debug: Full error:", error);
        }
        return 1;
      }
      throw error; // Re-throw unexpected errors
    }

    // Determine current project path relative to workspace root
    const workspaceRoot = configManager.getWorkspaceRoot();
    const currentDir = Deno.cwd();

    let currentProjectPath = "./";
    if (workspaceRoot && currentDir.startsWith(workspaceRoot)) {
      const relativePath = currentDir.substring(workspaceRoot.length);
      if (relativePath.length > 0) {
        // Remove leading slash/backslash and normalize to forward slashes
        const normalizedPath = relativePath.replace(/^[\/\\]/, "").replace(/\\/g, "/");
        currentProjectPath = "./" + normalizedPath;
      }
    }

    // Create dependency resolver and resolve dependencies
    const resolver = new DependencyResolver(config);

    try {
      let executionPlan;

      // Use different resolution patterns based on task type
      if (parsedArgs.task === "test") {
        executionPlan = resolver.resolveTestPattern(currentProjectPath, parsedArgs.task);
      } else {
        executionPlan = resolver.resolveDevPattern(currentProjectPath, parsedArgs.task);
      }

      if (parsedArgs.debug) {
        console.log(`Debug: Current project path: ${currentProjectPath}`);
        console.log(`Debug: Resolved ${executionPlan.tasks.length} tasks:`);
        for (const task of executionPlan.tasks) {
          console.log(
            `  ${task.id} (async: ${task.async}, required: ${task.required}, delay: ${task.delay}ms)`,
          );
        }
      } else {
        console.log(`Executing task: ${parsedArgs.task}`);
        console.log(`Execution plan: ${executionPlan.tasks.length} tasks`);
        let index = 0;
        for (const task of executionPlan.tasks) {
          index++;
          console.log(` ${index}.  → ${task.projectPath} ${task.taskName}`);
        }
      }

      // Execute the tasks using DreamRunner
      const runner = DreamRunner.create(workspaceRoot || Deno.cwd());
      const summary = await runner.execute(executionPlan, parsedArgs.debug);

      // Return appropriate exit code based on execution results
      if (summary.failedTasks > 0) {
        return 1;
      }
      return 0;
    } catch (error) {
      if (error instanceof CircularDependencyError) {
        console.error(`Dependency Error: ${error.message}`);
        if (parsedArgs.debug) {
          console.error("Debug: Full error:", error);
        }
        return 1;
      } else if (error instanceof TaskExecutionError) {
        console.error(`Task Execution Error: ${error.message}`);
        if (parsedArgs.debug) {
          console.error("Debug: Full error:", error);
          console.error("Debug: Exit code:", error.exitCode);
          console.error("Debug: Stderr:", error.stderr);
        }
        return error.exitCode;
      }
      throw error; // Re-throw unexpected errors
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}

// Run main function if this file is executed directly
if (import.meta.main) {
  const exitCode = await main();
  Deno.exit(exitCode);
}
