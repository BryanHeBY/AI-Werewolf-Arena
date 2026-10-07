import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { RuntimeConfig } from "./contracts";
import { parseRuntimeConfig } from "./parse_config";

export interface RuntimeConfigLoadOptions {
  configDir: string;
  gameName: string;
  environment?: NodeJS.ProcessEnv;
}

async function readJsonFile(filePath: string, label: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error(`runtime_config_file_missing: ${label} -> ${filePath}`);
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // JSON engine diagnostics can quote values from a providers file.
    throw new Error(`runtime_config_json_invalid: ${label}`);
  }
}

async function readOptionalJsonFile(filePath: string, label: string): Promise<unknown | undefined> {
  try {
    return await readJsonFile(filePath, label);
  } catch (error) {
    if ((error as Error).message.startsWith("runtime_config_file_missing:")) return undefined;
    throw error;
  }
}

export async function loadRuntimeConfig(options: RuntimeConfigLoadOptions): Promise<RuntimeConfig> {
  if (!options.configDir.trim()) throw new Error("runtime_config_missing_configs_dir");
  if (!/^[a-z][a-z0-9_-]*$/.test(options.gameName)) {
    throw new Error(`runtime_config_game_name_invalid: ${options.gameName}`);
  }
  const configRoot = path.resolve(options.configDir);
  const runtimeDir = path.join(configRoot, "runtime");
  return parseRuntimeConfig({
    providers: await readJsonFile(path.join(runtimeDir, "providers.json"), "providers"),
    agents: await readJsonFile(path.join(runtimeDir, "agents.json"), "agents"),
    game: await readJsonFile(path.join(configRoot, "games", `${options.gameName}.json`), `games.${options.gameName}`),
    debugSummary: await readOptionalJsonFile(path.join(runtimeDir, "debug_summary.json"), "debugSummary"),
    environment: options.environment,
  });
}
