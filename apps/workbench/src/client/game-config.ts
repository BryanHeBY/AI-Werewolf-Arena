/**
 * 负责游戏草稿的新建、有效缺省投影和不适用绑定清单；输入公开目录及原始 JSON，输出纯数据。
 * 不发牌、不推断角色、不默默删除配置；清理只在用户点击明确动作后执行，未知字段继续保留。
 */
import { GAME_CONFIG_DEFAULTS, NEW_GAME_CONFIG_DEFAULTS } from "@ai-werewolf-arena/game-contract";
import type { BoardCard, Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import type { Catalog } from "./types";
import { asObject, writePath } from "./config-edit";

export function createGameDraft(catalog: Catalog, boardId?: string): JsonObject {
  const boards = catalog.boards.filter((board) => board.source === "local" && board.supported);
  return {
    board: boards.find((board) => board.id === boardId)?.id ?? boards[0]?.id ?? "",
    agent: catalog.defaultAgent ?? catalog.agents[0]?.name ?? "",
    locale: "zh-CN",
    ...NEW_GAME_CONFIG_DEFAULTS,
  };
}

export function effectiveGameSettings(raw: JsonObject) {
  return Object.fromEntries(
    Object.entries(GAME_CONFIG_DEFAULTS).map(([field, fallback]) => [
      field,
      raw[field] ?? fallback,
    ]),
  ) as { [K in keyof typeof GAME_CONFIG_DEFAULTS]: Json };
}

export function inapplicableGameBindings(raw: JsonObject, board?: BoardCard) {
  if (!board) return { roles: [], players: [] } as { roles: string[]; players: string[] };
  const roles = new Set(board.roles.filter(({ count }) => count > 0).map(({ role }) => role));
  return {
    roles: Object.keys(asObject(raw.roles)).filter((role) => !roles.has(role)),
    players: Object.keys(asObject(raw.players)).filter(
      (seat) =>
        !/^[1-9]\d*$/.test(seat) ||
        !Number.isSafeInteger(Number(seat)) ||
        Number(seat) > board.size,
    ),
  };
}

/** 清理列出的不适用条目；同一草稿里的有效姓名、指令和未展示字段均不受影响。 */
export function removeInapplicableGameBindings(raw: JsonObject, board: BoardCard): JsonObject {
  const result = structuredClone(raw),
    invalid = inapplicableGameBindings(raw, board);
  for (const scope of ["roles", "players"] as const) {
    const rows = asObject(result[scope]);
    for (const key of invalid[scope]) delete rows[key];
    if (!Object.keys(rows).length) delete result[scope];
  }
  return result;
}

/** 显式恢复绑定字段继承时去掉已空的本行，避免空壳在以后更换板子时变成无效引用。 */
export function updateGameField(
  raw: JsonObject,
  field: string,
  value: Json | undefined,
): JsonObject {
  const result = writePath(raw, field, value),
    [scope, key] = field.split(".");
  if (value === undefined && (scope === "roles" || scope === "players") && key) {
    const rows = asObject(result[scope]);
    if (!Object.keys(asObject(rows[key])).length) delete rows[key];
    if (!Object.keys(rows).length) delete result[scope];
  }
  return result;
}
