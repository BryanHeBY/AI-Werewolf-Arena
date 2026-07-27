import dotenv from "dotenv";
import * as path from "path";

// 同时兼容“在仓库根目录运行”和“在 backend 目录运行”两种启动方式。
const cwd = process.cwd();
const isRunningFromBackend = cwd.endsWith("/backend");
const rootDir = isRunningFromBackend ? path.resolve(cwd, "..") : path.resolve(cwd);
dotenv.config({ path: path.join(rootDir, ".env") });

/**
 * 预置板子名称。
 */
export type BoardPreset = "six_player_mvp" | "twelve_player_standard";

/**
 * 服务启动配置。
 */
export interface AppConfig {
  port: number;
  corsOrigin: string;
  defaultBoard: BoardPreset;
  maxDaysPerSession: number;
  cycleDelayMs: number;
}

/**
 * 从环境变量装配运行配置。
 */
export function loadConfig(): AppConfig {
  // 默认走 6 人 MVP，避免无配置时直接进入高复杂度板子。
  const defaultBoard =
    process.env.GAME_DEFAULT_BOARD === "twelve_player_standard"
      ? "twelve_player_standard"
      : "six_player_mvp";

  return {
    port: parseInt(process.env.PORT || "3344", 10),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
    defaultBoard,
    maxDaysPerSession: parseInt(process.env.GAME_MAX_DAYS || "20", 10),
    cycleDelayMs: parseInt(process.env.GAME_CYCLE_DELAY_MS || "80", 10),
  };
}

/**
 * 应用全局配置单例。
 */
export const appConfig = loadConfig();
