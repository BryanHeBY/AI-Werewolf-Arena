/**
 * 输入为配置目录与板子 id；读取 boards 下的具名版本化板子，输出解析配置及 sourceFile 追踪路径。
 * 文件 I/O 和 JSON 错误由本入口转换，字段／支持范围交给 parseBoardDefinition；不创建对局或修改角色状态。
 * 未版本化文件明确要求迁移，不自动回退旧路径；缺失文件与坏 JSON 各保稳定错误码，其它读取失败保原错误。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_ID_PATTERN,
  parseBoardDefinition,
  type ResolvedBoardDefinition,
} from "./board-definition";

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
  // 先要求版本标记，再完整解析；sourceFile 只说明来源，不替代板子版本或引擎构建指纹。
  if (!raw || typeof raw !== "object" || !("version" in raw))
    throw new Error(`board_config_migration_required: ${boardId}`);
  return { ...parseBoardDefinition(raw, boardId), sourceFile: file };
}
