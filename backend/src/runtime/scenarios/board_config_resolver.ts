/** 将已读取的板子覆盖配置合并为规范化的 BoardConfig。 */
import { z } from "zod";
import {
  ActionWindow,
  BoardConfig,
  HookConfig,
  Role,
  WinCondition,
  WitchSelfHealRule,
} from "../../core/domain/model";
import { getDefaultConfigNormalizerRegistry } from "../../game/mechanisms";
import { sixPlayerMvpConfig } from "./six_player_mvp";
import { twelvePlayerStandardConfig } from "./twelve_player_standard";

/** 已支持的板子标识。 */
export type BoardName = "six_player_mvp" | "twelve_player_standard";
type JsonObject = Record<string, unknown>;
export type BoardOverride = Omit<
  Partial<BoardConfig>,
  "hooks" | "sheriff" | "witch" | "tieBreaker" | "selfDestruct"
> & {
  hooks?: Partial<HookConfig>;
  sheriff?: NonNullable<BoardConfig["sheriff"]>;
  witch?: NonNullable<BoardConfig["witch"]>;
  tieBreaker?: NonNullable<BoardConfig["tieBreaker"]>;
  selfDestruct?: NonNullable<BoardConfig["selfDestruct"]>;
};

type StructuredBoardConfig = {
  board?: {
    size?: number;
    roleSetups?: unknown;
  };
  rules?: {
    winCondition?: unknown;
    winConditions?: unknown;
    hooks?: Partial<HookConfig>;
  };
  mechanisms?: {
    sheriff?: {
      enabled?: boolean;
      initialSeat?: number;
      voteWeight?: number;
      tieBreaker?: unknown;
    };
    selfDestruct?: {
      enabledWindows?: unknown;
    };
    tieBreaker?: {
      exileVote?: unknown;
      wolfKillVote?: unknown;
    };
  };
  roles?: {
    witch?: {
      selfHeal?: unknown;
    };
  };
};

const tieBreaker = z.enum(["min_id", "min_seat", "no_elimination", "no_kill"]);
const hooks = z.strictObject({
  onDaybreak: z.boolean().optional(),
  onPreElection: z.boolean().optional(),
  onPreVote: z.boolean().optional(),
  onPerSpeechGap: z.boolean().optional(),
});
const flatOverride = z.strictObject({
  boardSize: z.number().int().positive().optional(),
  enableSheriff: z.boolean().optional(),
  initialSheriffSeat: z.number().int().positive().optional(),
  winCondition: z.enum(WinCondition).optional(),
  winConditions: z.array(z.enum(WinCondition)).optional(),
  hooks: hooks.optional(),
  selfDestruct: z.strictObject({ enabledWindows: z.array(z.enum(ActionWindow)) }).optional(),
  sheriff: z.strictObject({ voteWeight: z.number().positive().optional() }).optional(),
  witch: z.strictObject({ canSelfHeal: z.enum(WitchSelfHealRule).optional() }).optional(),
  tieBreaker: z
    .strictObject({
      exileVote: tieBreaker.optional(),
      wolfKillVote: tieBreaker.optional(),
      sheriffVote: tieBreaker.optional(),
    })
    .optional(),
  roleSetups: z
    .array(z.strictObject({ role: z.enum(Role), count: z.number().int().nonnegative() }))
    .optional(),
});
const structuredOverride = z.strictObject({
  board: z
    .strictObject({
      size: z.number().int().positive().optional(),
      roleSetups: flatOverride.shape.roleSetups,
    })
    .optional(),
  rules: z
    .strictObject({
      winCondition: flatOverride.shape.winCondition,
      winConditions: flatOverride.shape.winConditions,
      hooks: hooks.optional(),
    })
    .optional(),
  mechanisms: z
    .strictObject({
      sheriff: z
        .strictObject({
          enabled: z.boolean().optional(),
          initialSeat: z.number().int().positive().optional(),
          voteWeight: z.number().positive().optional(),
          tieBreaker: tieBreaker.optional(),
        })
        .optional(),
      selfDestruct: z
        .strictObject({ enabledWindows: z.array(z.enum(ActionWindow)).optional() })
        .optional(),
      tieBreaker: z
        .strictObject({ exileVote: tieBreaker.optional(), wolfKillVote: tieBreaker.optional() })
        .optional(),
    })
    .optional(),
  roles: z
    .strictObject({
      witch: z.strictObject({ selfHeal: z.enum(WitchSelfHealRule).optional() }).optional(),
    })
    .optional(),
});

function validateOverride(schema: z.ZodType, value: unknown): void {
  const result = schema.safeParse(value);
  if (!result.success) {
    const field = result.error.issues[0]?.path.join(".") || "document";
    throw new Error(`board_config_invalid_override_field: ${field}`);
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 克隆基础板子配置，避免后续 merge 污染静态场景常量。 */
function cloneBoardConfig(config: BoardConfig): BoardConfig {
  return {
    ...config,
    roleSetups: config.roleSetups.map((item) => ({ ...item })),
    hooks: { ...config.hooks },
    ...(config.winConditions ? { winConditions: [...config.winConditions] } : {}),
    ...(config.selfDestruct
      ? {
          selfDestruct: {
            enabledWindows: [...config.selfDestruct.enabledWindows],
          },
        }
      : {}),
    ...(config.sheriff ? { sheriff: { ...config.sheriff } } : {}),
    ...(config.witch ? { witch: { ...config.witch } } : {}),
    ...(config.tieBreaker ? { tieBreaker: { ...config.tieBreaker } } : {}),
  };
}

/** 以 BoardConfig 语义合并覆盖项（保留数组/对象的显式拷贝）。 */
function mergeBoardConfig(base: BoardConfig, override: BoardOverride): BoardConfig {
  return {
    ...base,
    ...override,
    hooks: { ...base.hooks, ...(override.hooks ?? {}) },
    roleSetups: override.roleSetups
      ? override.roleSetups.map((item) => ({ ...item }))
      : base.roleSetups.map((item) => ({ ...item })),
    ...(override.winConditions ? { winConditions: [...override.winConditions] } : {}),
    ...(override.selfDestruct
      ? {
          selfDestruct: {
            enabledWindows: [...override.selfDestruct.enabledWindows],
          },
        }
      : base.selfDestruct
        ? {
            selfDestruct: {
              enabledWindows: [...base.selfDestruct.enabledWindows],
            },
          }
        : {}),
    sheriff: { ...(base.sheriff ?? {}), ...(override.sheriff ?? {}) },
    witch: { ...(base.witch ?? {}), ...(override.witch ?? {}) },
    tieBreaker: { ...(base.tieBreaker ?? {}), ...(override.tieBreaker ?? {}) },
  };
}

/** 以“覆盖层”语义合并 default + board 专属配置。 */
function mergeBoardOverride(base: BoardOverride, override: BoardOverride): BoardOverride {
  return {
    ...base,
    ...override,
    ...(base.hooks || override.hooks
      ? {
          hooks: {
            ...(base.hooks ?? {}),
            ...(override.hooks ?? {}),
          },
        }
      : {}),
    ...(base.sheriff || override.sheriff
      ? {
          sheriff: {
            ...(base.sheriff ?? {}),
            ...(override.sheriff ?? {}),
          },
        }
      : {}),
    ...(base.witch || override.witch
      ? {
          witch: {
            ...(base.witch ?? {}),
            ...(override.witch ?? {}),
          },
        }
      : {}),
    ...(base.tieBreaker || override.tieBreaker
      ? {
          tieBreaker: {
            ...(base.tieBreaker ?? {}),
            ...(override.tieBreaker ?? {}),
          },
        }
      : {}),
    ...(override.roleSetups
      ? {
          roleSetups: override.roleSetups.map((item) => ({ ...item })),
        }
      : base.roleSetups
        ? {
            roleSetups: base.roleSetups.map((item) => ({ ...item })),
          }
        : {}),
    ...(override.winConditions
      ? {
          winConditions: [...override.winConditions],
        }
      : base.winConditions
        ? {
            winConditions: [...base.winConditions],
          }
        : {}),
    ...(override.selfDestruct
      ? {
          selfDestruct: {
            enabledWindows: [...override.selfDestruct.enabledWindows],
          },
        }
      : base.selfDestruct
        ? {
            selfDestruct: {
              enabledWindows: [...base.selfDestruct.enabledWindows],
            },
          }
        : {}),
  };
}

/** 读取对应板子的内置默认配置。 */
function baseBoard(board: BoardName): BoardConfig {
  return board === "twelve_player_standard"
    ? cloneBoardConfig(twelvePlayerStandardConfig)
    : cloneBoardConfig(sixPlayerMvpConfig);
}

/** 判断对象是否为旧版平铺结构。 */
function isBoardOverrideShape(value: unknown): value is BoardOverride {
  if (!isJsonObject(value)) {
    return false;
  }
  const keys = Object.keys(value);
  const supported = new Set([
    "boardSize",
    "enableSheriff",
    "initialSheriffSeat",
    "winCondition",
    "winConditions",
    "hooks",
    "selfDestruct",
    "sheriff",
    "witch",
    "tieBreaker",
    "roleSetups",
  ]);
  return keys.some((key) => supported.has(key));
}

/** 判断对象是否为新版结构化配置。 */
function isStructuredBoardOverrideShape(value: unknown): value is StructuredBoardConfig {
  if (!isJsonObject(value)) {
    return false;
  }
  return ["board", "rules", "mechanisms", "roles"].some((key) => key in value);
}

/** 把新版 `board/rules/mechanisms/roles` 结构映射到 BoardConfig 覆盖层。 */
function parseStructuredBoardOverride(raw: StructuredBoardConfig): BoardOverride {
  const out: BoardOverride = {};

  if (isJsonObject(raw.board)) {
    if (typeof raw.board.size === "number") {
      out.boardSize = raw.board.size;
    }
    if (Array.isArray(raw.board.roleSetups)) {
      out.roleSetups = raw.board.roleSetups as BoardConfig["roleSetups"];
    }
  }

  if (isJsonObject(raw.rules)) {
    if (typeof raw.rules.winCondition === "string") {
      out.winCondition = raw.rules.winCondition as BoardConfig["winCondition"];
    }
    if (Array.isArray(raw.rules.winConditions)) {
      out.winConditions = raw.rules.winConditions as BoardConfig["winConditions"];
    }
    if (isJsonObject(raw.rules.hooks)) {
      out.hooks = {
        ...(typeof raw.rules.hooks.onDaybreak === "boolean"
          ? { onDaybreak: raw.rules.hooks.onDaybreak }
          : {}),
        ...(typeof raw.rules.hooks.onPreElection === "boolean"
          ? { onPreElection: raw.rules.hooks.onPreElection }
          : {}),
        ...(typeof raw.rules.hooks.onPreVote === "boolean"
          ? { onPreVote: raw.rules.hooks.onPreVote }
          : {}),
        ...(typeof raw.rules.hooks.onPerSpeechGap === "boolean"
          ? { onPerSpeechGap: raw.rules.hooks.onPerSpeechGap }
          : {}),
      } as HookConfig;
    }
  }

  if (isJsonObject(raw.mechanisms)) {
    if (isJsonObject(raw.mechanisms.sheriff)) {
      if (typeof raw.mechanisms.sheriff.enabled === "boolean") {
        out.enableSheriff = raw.mechanisms.sheriff.enabled;
      }
      if (typeof raw.mechanisms.sheriff.initialSeat === "number") {
        out.initialSheriffSeat = raw.mechanisms.sheriff.initialSeat;
      }
      if (typeof raw.mechanisms.sheriff.voteWeight === "number") {
        out.sheriff = {
          ...(out.sheriff ?? {}),
          voteWeight: raw.mechanisms.sheriff.voteWeight,
        };
      }
      if (typeof raw.mechanisms.sheriff.tieBreaker === "string") {
        // sheriff.tieBreaker 在新结构里归一到 tieBreaker.sheriffVote。
        out.tieBreaker = {
          ...(out.tieBreaker ?? {}),
          sheriffVote: raw.mechanisms.sheriff.tieBreaker as NonNullable<
            BoardConfig["tieBreaker"]
          >["sheriffVote"],
        };
      }
    }
    if (isJsonObject(raw.mechanisms.selfDestruct)) {
      if (Array.isArray(raw.mechanisms.selfDestruct.enabledWindows)) {
        out.selfDestruct = {
          enabledWindows: raw.mechanisms.selfDestruct.enabledWindows as NonNullable<
            BoardConfig["selfDestruct"]
          >["enabledWindows"],
        };
      }
    }
    if (isJsonObject(raw.mechanisms.tieBreaker)) {
      out.tieBreaker = {
        ...(out.tieBreaker ?? {}),
        ...(typeof raw.mechanisms.tieBreaker.exileVote === "string"
          ? {
              exileVote: raw.mechanisms.tieBreaker.exileVote as NonNullable<
                BoardConfig["tieBreaker"]
              >["exileVote"],
            }
          : {}),
        ...(typeof raw.mechanisms.tieBreaker.wolfKillVote === "string"
          ? {
              wolfKillVote: raw.mechanisms.tieBreaker.wolfKillVote as NonNullable<
                BoardConfig["tieBreaker"]
              >["wolfKillVote"],
            }
          : {}),
      };
    }
  }

  if (isJsonObject(raw.roles)) {
    if (isJsonObject(raw.roles.witch) && typeof raw.roles.witch.selfHeal === "string") {
      out.witch = {
        ...(out.witch ?? {}),
        canSelfHeal: raw.roles.witch.selfHeal as NonNullable<BoardConfig["witch"]>["canSelfHeal"],
      };
    }
  }

  return out;
}

/** 统一解析“单个配置块”成覆盖层（兼容新旧两种结构）。 */
function toBoardOverride(value: unknown): BoardOverride | null {
  if (isBoardOverrideShape(value)) {
    validateOverride(flatOverride, value);
    return value as BoardOverride;
  }
  if (isStructuredBoardOverrideShape(value)) {
    validateOverride(structuredOverride, value);
    return parseStructuredBoardOverride(value);
  }
  return null;
}

/** 从 json 根对象提取目标板子的覆盖配置（含 boards/default 合并）。 */
export function parseBoardOverride(raw: unknown, board: BoardName): BoardOverride | null {
  const direct = toBoardOverride(raw);
  if (direct) {
    return direct;
  }
  if (!isJsonObject(raw)) {
    return null;
  }

  if ("boards" in raw || "default" in raw) {
    validateOverride(
      z.strictObject({
        boards: z
          .record(
            z.string().regex(/^[a-z][a-z0-9_-]*$/),
            z.union([flatOverride, structuredOverride]),
          )
          .optional(),
        default: z.union([flatOverride, structuredOverride]).optional(),
      }),
      raw,
    );
  } else {
    const allowed = new Set([board, "six_player_mvp", "twelve_player_standard"]);
    for (const [key, value] of Object.entries(raw)) {
      if (!allowed.has(key)) throw new Error("board_config_invalid_override_field: document");
      validateOverride(z.union([flatOverride, structuredOverride]), value);
    }
  }

  const boardsEntry = isJsonObject(raw.boards) ? raw.boards[board] : undefined;
  const boardOverride = toBoardOverride(boardsEntry);
  if (boardOverride) {
    const defaultOverride = toBoardOverride(raw.default);
    if (!defaultOverride) {
      return boardOverride;
    }
    return mergeBoardOverride(defaultOverride, boardOverride);
  }

  const keyedBoardOverride = toBoardOverride(raw[board]);
  if (keyedBoardOverride) {
    return keyedBoardOverride;
  }
  return null;
}

/** 合并并规范化板子配置；文件查找由加载层负责。 */
export function resolveBoardConfig(
  board: BoardName,
  override: BoardOverride | null = null,
): BoardConfig {
  const base = baseBoard(board);
  const merged = override ? mergeBoardConfig(base, override) : base;
  return getDefaultConfigNormalizerRegistry().normalize(merged);
}
