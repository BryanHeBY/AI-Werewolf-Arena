/**
 * 负责按用户指定的假设角色与座位预览附加指令。输入游戏草稿及本地已保存目录，
 * 输出真实解析器组合的指令与选择来源；不发牌、不创建 Agent、不调用模型或保存文件。
 * 返回值逐字段构造，避免将包含认证的运行 profile 传回浏览器。
 */
import type { GameInstructionPreview, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import type { Role } from "@ai-werewolf-arena/game-contract";
import { parseRuntimeConfig } from "@ai-werewolf-arena/game-runtime/config/parse";
import { parseBoardDefinition } from "@ai-werewolf-arena/game-runtime/config/board";
import {
  resolveGameBoard,
  resolveGameSetup,
  resolvePlayerProfile,
} from "@ai-werewolf-arena/game-runtime/config/resolve";
import { validateRuntimeNativeConfig } from "@ai-werewolf-arena/game-runtime/config/validate";
import { ConfigDocuments, WorkbenchError } from "./config-documents";

export async function previewGameInstructions(
  documents: ConfigDocuments,
  game: JsonObject,
  seat: unknown,
  role?: unknown,
): Promise<GameInstructionPreview> {
  if (!game || typeof game !== "object" || Array.isArray(game))
    throw new WorkbenchError("invalid_document");
  if (typeof seat !== "number" || !Number.isSafeInteger(seat) || seat < 1)
    throw new WorkbenchError("invalid_preview_selection");
  const runtime = parseRuntimeConfig({
    backends: await documents.raw("backends", "backends"),
    agents: await documents.raw("agents", "agents"),
    game,
  });
  await validateRuntimeNativeConfig(runtime);
  const boardId = resolveGameBoard(runtime);
  const board = parseBoardDefinition(await documents.raw("boards", boardId), boardId);
  if (
    seat > board.config.boardSize ||
    (role !== undefined &&
      (typeof role !== "string" || !board.config.roleSetups.some((row) => row.role === role)))
  )
    throw new WorkbenchError("invalid_preview_selection");
  const setup = resolveGameSetup(runtime, {}, board);
  // 角色来自用户选择的板子成员，不由服务端随机分配；省略时只预览未应用角色层的情形。
  const assumedRole = role as Role | undefined;
  const selected = resolvePlayerProfile(setup, seat, assumedRole);
  const source = setup.players[String(seat)]?.profile
    ? "seat"
    : assumedRole && setup.roles[assumedRole]?.profile
      ? "role"
      : runtime.game.agent
        ? "game"
        : "runtime";
  return {
    agent: { name: selected.name, source },
    locale: setup.context.locale,
    customInstructions: selected.customInstructions ?? null,
    warnings: setup.warnings.map((warning) => ({
      code: warning.code,
      path: warning.path,
      severity: "warning",
    })),
  };
}
