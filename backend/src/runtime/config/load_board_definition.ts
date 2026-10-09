import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_ID_PATTERN,
  parseBoardDefinition,
  type ResolvedBoardDefinition,
} from "./board_definition";

export async function loadBoardDefinition(
  configDir: string,
  boardId: string,
): Promise<ResolvedBoardDefinition> {
  if (!CONFIG_ID_PATTERN.test(boardId)) throw new Error("board_config_id_invalid");
  const file = path.resolve(configDir, "boards", `${boardId}.json`);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error(`board_config_file_missing: ${boardId}`);
    throw error;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`board_config_json_invalid: ${boardId}`);
  }
  if (!raw || typeof raw !== "object" || !("version" in raw))
    throw new Error(`board_config_migration_required: ${boardId}`);
  return { ...parseBoardDefinition(raw, boardId), sourceFile: file };
}
