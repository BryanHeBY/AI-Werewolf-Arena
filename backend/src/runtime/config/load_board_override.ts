/**
 * 负责旧程序接口的板子覆盖文件查找。输入为目录与两个旧板子标识，输出首个有效覆盖层或 null。
 * 文件读取仅对不存在继续，只有其它板子的汇总另按原规则跳过；坏 JSON／覆盖层报错。此入口不参与正常 CLI 的版本化板子加载。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { BoardName, BoardOverride, parseBoardOverride } from "../scenarios/board_config_resolver";

/** @deprecated 仅供迁移和旧程序接口兼容；正常 CLI 使用 loadBoardDefinition，不探测这些回退路径。 */
export async function loadBoardOverride(
  configDir: string,
  board: BoardName,
  log?: (text: string) => void,
): Promise<BoardOverride | null> {
  const root = path.resolve(configDir);
  const candidates = [
    path.join(root, "boards", `${board}.json`),
    path.join(root, `${board}.json`),
    path.join(root, "boards", "game-config.json"),
    path.join(root, "game-config.json"),
  ];

  for (const file of candidates) {
    let contents: string;
    try {
      contents = await fs.readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(contents);
    } catch (error) {
      throw new Error(`board_config_json_invalid: ${file}: ${String(error)}`);
    }
    const override = parseBoardOverride(raw, board);
    if (override) {
      log?.(`[board_config] using override file=${file}`);
      return override;
    }
    // 汇总文件只含其它板子且无 default 时才能继续探测；普通命名文件解析无效仍直接拒绝。
    if (file.endsWith("game-config.json") && isOtherBoardCollection(raw, board)) continue;
    throw new Error(`board_config_invalid_override: ${file}`);
  }
  return null;
}

function isOtherBoardCollection(value: unknown, board: BoardName): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const boards = (value as Record<string, unknown>).boards;
  return (
    !!boards &&
    typeof boards === "object" &&
    !Array.isArray(boards) &&
    !(board in boards) &&
    !("default" in value)
  );
}
