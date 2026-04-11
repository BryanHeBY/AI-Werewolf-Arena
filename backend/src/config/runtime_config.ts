import { promises as fs } from "fs";
import * as path from "path";

export type ProviderType = "openai";

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseURL?: string;
  userAgent?: string;
}

export interface AgentProfileConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  forceJsonResponse?: boolean;
  reasoningEnabled?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
  personalityPrompt?: string;
}

export interface AgentConfig {
  default: AgentProfileConfig;
  roles?: Record<string, Partial<AgentProfileConfig>>;
  players?: Record<string, Partial<AgentProfileConfig>>;
}

export interface GameConfig {
  board?: "six_player_mvp" | "twelve_player_standard";
  maxDays?: number;
  maxRuntimeMs?: number;
  llmTimeoutMs?: number;
  trace?: boolean;
  printAllEvents?: boolean;
  printChat?: boolean;
  streamEvents?: boolean;
  color?: boolean;
  printLlmIo?: boolean;
  printThinking?: boolean;
  printPrivateEvents?: boolean;
  recordRootDir?: string;
  roleAgents?: Record<string, Partial<AgentProfileConfig>>;
  playerAgents?: Record<string, Partial<AgentProfileConfig>>;
}

export interface DebugSummaryConfig {
  llmTimeoutMs?: number;
  llmMaxAttempts?: number;
  agent?: {
    enabled?: boolean;
    profile?: Partial<AgentProfileConfig>;
    timeoutMs?: number;
    maxAttempts?: number;
    concurrency?: number;
    publicMaxItems?: number;
    maxItems?: number;
    playerMaxItems?: number;
  };
}

export interface RuntimeConfig {
  provider: ProviderConfig;
  agent: AgentConfig;
  game?: GameConfig;
  debugSummary?: DebugSummaryConfig;
}

let cachedConfig: RuntimeConfig | null = null;
let overrideConfig: RuntimeConfig | null = null;

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("/backend")) {
    return path.resolve(cwd, "..");
  }
  return path.resolve(cwd);
}

async function readJsonIfExists(filePath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readGameOverride(configRoot: string): Promise<GameConfig | null> {
  const name = process.env.GAME_CONFIG_NAME?.trim() || "default";
  if (!name) {
    return null;
  }
  const gamesDir = path.join(configRoot, "games");
  const overridePath = path.join(gamesDir, `${name}.json`);
  return readJsonIfExists(overridePath);
}

function resolveConfigRoot(): string {
  const root = resolveRepoRoot();
  const envConfig = process.env.GAME_CONFIGS_DIR?.trim();
  if (envConfig) {
    return path.isAbsolute(envConfig) ? envConfig : path.resolve(root, envConfig);
  }
  throw new Error("runtime_config_missing_configs_dir: set GAME_CONFIGS_DIR");
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (overrideConfig) {
    return overrideConfig;
  }
  if (cachedConfig) {
    return cachedConfig;
  }
  const configRoot = resolveConfigRoot();
  const runtimeDir = path.join(configRoot, "runtime");
  const combinedPath = path.join(configRoot, "runtime_config.json");

  const provider = await readJsonIfExists(path.join(runtimeDir, "provider.json"));
  const agent = await readJsonIfExists(path.join(runtimeDir, "agent.json"));
  const game = await readJsonIfExists(path.join(runtimeDir, "game.json"));
  const gameOverride = await readGameOverride(configRoot);
  const mergedGame = gameOverride ? { ...(game ?? {}), ...gameOverride } : game;
  const debugSummary = await readJsonIfExists(path.join(runtimeDir, "debug_summary.json"));

  if (provider || agent || mergedGame || debugSummary) {
    const merged: RuntimeConfig = {
      provider: provider ?? ({} as ProviderConfig),
      agent: agent ?? ({} as AgentConfig),
      ...(mergedGame ? { game: mergedGame } : {}),
      ...(debugSummary ? { debugSummary } : {}),
    };
    cachedConfig = merged;
    return merged;
  }

  const combined = await readJsonIfExists(combinedPath);
  if (!combined) {
    throw new Error(`runtime_config_not_found: ${combinedPath}`);
  }
  const combinedOverride = await readGameOverride(configRoot);
  if (combinedOverride) {
    combined.game = { ...(combined.game ?? {}), ...combinedOverride };
  }
  cachedConfig = combined as RuntimeConfig;
  return cachedConfig;
}

export function setRuntimeConfigOverride(config: RuntimeConfig | null): void {
  overrideConfig = config;
}

export function clearRuntimeConfigCache(): void {
  cachedConfig = null;
}
