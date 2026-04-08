import dotenv from "dotenv";
import * as path from "path";

// 同时兼容“在仓库根目录运行”和“在 backend 目录运行”两种启动方式。
const cwd = process.cwd();
const isRunningFromBackend = cwd.endsWith("/backend");
const rootDir = isRunningFromBackend ? path.resolve(cwd, "..") : path.resolve(cwd);
dotenv.config({ path: path.join(rootDir, ".env") });

export type BoardPreset = "six_player_mvp" | "twelve_player_standard";

export interface AppConfig {
  port: number;
  corsOrigin: string;
  defaultBoard: BoardPreset;
  maxDaysPerSession: number;
  cycleDelayMs: number;
  v3EngineEnabled: boolean;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function loadConfig(): AppConfig {
  // 默认走 6 人 MVP，避免无配置时直接进入高复杂度板子。
  const defaultBoard =
    process.env.V3_DEFAULT_BOARD === "twelve_player_standard"
      ? "twelve_player_standard"
      : "six_player_mvp";

  return {
    port: parseInt(process.env.PORT || "3344", 10),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
    defaultBoard,
    maxDaysPerSession: parseInt(process.env.V3_MAX_DAYS || "20", 10),
    cycleDelayMs: parseInt(process.env.V3_CYCLE_DELAY_MS || "80", 10),
    v3EngineEnabled: parseBooleanFlag(process.env.V3_ENGINE_ENABLED, true),
  };
}

export const appConfig = loadConfig();
