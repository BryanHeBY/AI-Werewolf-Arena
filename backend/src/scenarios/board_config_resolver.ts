import fs from "fs";
import path from "path";
import { BoardConfig, HookConfig } from "../domain/model";
import { getDefaultConfigNormalizerRegistry } from "../mechanisms";
import { sixPlayerMvpConfig } from "./six_player_mvp";
import { twelvePlayerStandardConfig } from "./twelve_player_standard";

export type BoardName = "six_player_mvp" | "twelve_player_standard";
export interface ResolveBoardConfigOptions {
  boardConfigName?: string;
}

type JsonObject = Record<string, unknown>;
type BoardOverride = Omit<
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
    revealOnDeath?: boolean;
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

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function mergeBoardOverride(
  base: BoardOverride,
  override: BoardOverride,
): BoardOverride {
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

function baseBoard(board: BoardName): BoardConfig {
  return board === "twelve_player_standard"
    ? cloneBoardConfig(twelvePlayerStandardConfig)
    : cloneBoardConfig(sixPlayerMvpConfig);
}

function isBoardOverrideShape(value: unknown): value is BoardOverride {
  if (!isJsonObject(value)) {
    return false;
  }
  const keys = Object.keys(value);
  const supported = new Set([
    "boardSize",
    "revealOnDeath",
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

function isStructuredBoardOverrideShape(value: unknown): value is StructuredBoardConfig {
  if (!isJsonObject(value)) {
    return false;
  }
  return ["board", "rules", "mechanisms", "roles"].some((key) => key in value);
}

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
    if (typeof raw.rules.revealOnDeath === "boolean") {
      out.revealOnDeath = raw.rules.revealOnDeath;
    }
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
          enabledWindows: raw.mechanisms.selfDestruct
            .enabledWindows as NonNullable<BoardConfig["selfDestruct"]>["enabledWindows"],
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
        canSelfHeal: raw.roles.witch.selfHeal as NonNullable<
          BoardConfig["witch"]
        >["canSelfHeal"],
      };
    }
  }

  return out;
}

function toBoardOverride(value: unknown): BoardOverride | null {
  if (isBoardOverrideShape(value)) {
    return value as BoardOverride;
  }
  if (isStructuredBoardOverrideShape(value)) {
    return parseStructuredBoardOverride(value);
  }
  return null;
}

function extractOverride(raw: unknown, board: BoardName): BoardOverride | null {
  const direct = toBoardOverride(raw);
  if (direct) {
    return direct;
  }
  if (!isJsonObject(raw)) {
    return null;
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

function readOverrideFromDir(
  board: BoardName,
  options?: ResolveBoardConfigOptions,
  log?: (text: string) => void,
): BoardOverride | null {
  const configDir = process.env.GAME_CONFIGS_DIR?.trim();
  if (!configDir) {
    return null;
  }
  const candidates: string[] = [];
  const boardsDir = path.resolve(configDir, "boards");
  const customName = options?.boardConfigName?.trim();
  if (customName) {
    candidates.push(path.resolve(boardsDir, `${customName}.json`));
    candidates.push(path.resolve(configDir, `${customName}.json`));
  }
  candidates.push(path.resolve(boardsDir, `${board}.json`));
  candidates.push(path.resolve(configDir, `${board}.json`));
  candidates.push(path.resolve(boardsDir, "game-config.json"));
  candidates.push(path.resolve(configDir, "game-config.json"));
  for (const file of candidates) {
    if (!fs.existsSync(file)) {
      continue;
    }
    try {
      const text = fs.readFileSync(file, "utf-8");
      const json = JSON.parse(text) as unknown;
      const override = extractOverride(json, board);
      if (override) {
        log?.(`[board_config] using override file=${file}`);
        return override;
      }
      log?.(`[board_config] skip invalid override shape file=${file}`);
    } catch (error) {
      log?.(`[board_config] read failed file=${file} err=${String(error)}`);
    }
  }
  return null;
}

export function resolveBoardConfig(
  board: BoardName,
  optionsOrLog?: ResolveBoardConfigOptions | ((text: string) => void),
  logMaybe?: (text: string) => void,
): BoardConfig {
  const options =
    typeof optionsOrLog === "function" || optionsOrLog === undefined
      ? undefined
      : optionsOrLog;
  const log = typeof optionsOrLog === "function" ? optionsOrLog : logMaybe;
  const base = baseBoard(board);
  const override = readOverrideFromDir(board, options, log);
  const merged = override ? mergeBoardConfig(base, override) : base;
  return getDefaultConfigNormalizerRegistry().normalize(merged);
}
