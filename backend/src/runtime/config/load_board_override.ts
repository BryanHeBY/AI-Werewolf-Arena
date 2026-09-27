import { promises as fs } from "node:fs";
import path from "node:path";
import { BoardName, BoardOverride, parseBoardOverride } from "../scenarios/board_config_resolver";

/** Read the first applicable board override. A present but invalid file is an error. */
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
    if (file.endsWith("game-config.json") && isOtherBoardCollection(raw, board)) continue;
    throw new Error(`board_config_invalid_override: ${file}`);
  }
  return null;
}

function isOtherBoardCollection(value: unknown, board: BoardName): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const boards = (value as Record<string, unknown>).boards;
  return !!boards && typeof boards === "object" && !Array.isArray(boards)
    && !(board in boards) && !("default" in value);
}
