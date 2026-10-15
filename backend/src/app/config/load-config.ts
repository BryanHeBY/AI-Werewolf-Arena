/**
 * 从指定配置目录顺序读取 providers、agents、具名 game 与可选审计文件，输出已校验 RuntimeConfig。
 * 本模块拥有文件读取和 JSON 错误转换；配置解析由 parseRuntimeConfig 执行，Agent／会话资源由运行装配持有。
 * 必填文件缺失和其它 I/O 失败直接传播；仅审计文件缺失可省略，不自动探测旧目录、加载 .env 或缓存配置。
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { RuntimeConfig } from "./contracts";
import { parseRuntimeConfig } from "./parse-config";

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
    // JSON 引擎错误可能夹带 provider 密钥值；这里只保留文件类别，避免原内容进入报错。
    throw new Error(`runtime_config_json_invalid: ${label}`);
  }
}

/** 只有缺失文件才省略；坏 JSON、权限问题等失败仍中断配置加载。 */
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
  // 所有相对路径以本次显式目录解析；顺序等待各文件，保持原错误先后次序。
  const configRoot = path.resolve(options.configDir);
  const runtimeDir = path.join(configRoot, "runtime");
  return parseRuntimeConfig({
    providers: await readJsonFile(path.join(runtimeDir, "providers.json"), "providers"),
    agents: await readJsonFile(path.join(runtimeDir, "agents.json"), "agents"),
    game: await readJsonFile(
      path.join(configRoot, "games", `${options.gameName}.json`),
      `games.${options.gameName}`,
    ),
    debugSummary: await readOptionalJsonFile(
      path.join(runtimeDir, "debug_summary.json"),
      "debugSummary",
    ),
    environment: options.environment,
  });
}
