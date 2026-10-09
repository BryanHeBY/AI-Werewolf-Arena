/** The single public board format. Unknown fields and unregistered roles fail closed. */
import { z } from "zod";
import { ROLE_IDS, RULESET, isRoleId } from "@ai-werewolf-arena/game-catalog";
import { ActionWindow, Camp, Role, WinCondition, type BoardConfig } from "../../core/domain/model";
import { getDefaultRoleCatalog } from "../../game/mechanisms/roles/catalog";
import { boardConfigSchema } from "../../core/domain/board_schema";

export const CONFIG_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;
export const MAX_BOARD_PLAYERS = 128;
export const boardIdSchema = z.string().regex(CONFIG_ID_PATTERN);
const safePositive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const hooks = z.strictObject({
  onDaybreak: z.boolean(),
  onPreElection: z.boolean(),
  onPreVote: z.boolean(),
  onPerSpeechGap: z.boolean(),
});
const schema = z.strictObject({
  version: z.literal(2),
  id: boardIdSchema,
  ruleset: z.strictObject({ id: z.literal(RULESET.id), version: z.literal(RULESET.version) }),
  board: z.strictObject({
    size: safePositive.max(MAX_BOARD_PLAYERS),
    roleSetups: z
      .array(
        z.strictObject({
          role: z.enum(ROLE_IDS as [string, ...string[]]),
          count: safePositive.max(MAX_BOARD_PLAYERS),
        }),
      )
      .min(1),
  }),
  rules: z.strictObject({ winConditions: z.array(z.enum(WinCondition)).min(1), hooks }),
  mechanisms: z.strictObject({
    sheriff: z.strictObject({
      enabled: z.boolean(),
      initialSeat: safePositive.optional(),
      voteWeight: z.number().finite().positive().default(1.5),
      tieBreaker: z.enum(["min_id", "min_seat", "no_elimination"]).default("min_seat"),
    }),
    selfDestruct: z.strictObject({ enabledWindows: z.array(z.enum(ActionWindow)) }),
    tieBreaker: z.strictObject({
      exileVote: z.enum(["min_id", "no_elimination"]),
      wolfKillVote: z.enum(["min_id", "no_kill"]),
    }),
  }),
  roles: z.record(z.string(), z.unknown()).default({}),
});

export type BoardDefinition = z.infer<typeof schema>;
export interface ResolvedBoardDefinition {
  definition: BoardDefinition;
  config: BoardConfig;
  sourceFile?: string;
  fieldSources: Readonly<Record<string, "explicit" | "default">>;
}

export class BoardConfigurationError extends Error {
  constructor(
    readonly code: string,
    readonly fieldPath: string,
  ) {
    super(`${code}: ${fieldPath}`);
  }
}
function fail(code: string, path: string): never {
  throw new BoardConfigurationError(code, path);
}

export function parseBoardDefinition(raw: unknown, expectedId?: string): ResolvedBoardDefinition {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const key = issue.code === "unrecognized_keys" ? issue.keys[0] : undefined;
    fail(
      "board_config_invalid_field",
      [...issue.path, ...(key ? [key] : [])].join(".") || "document",
    );
  }
  const definition = result.data;
  if (expectedId !== undefined && definition.id !== expectedId)
    fail("board_config_id_mismatch", "id");
  const catalog = getDefaultRoleCatalog();
  const seen = new Set<string>();
  let total = 0;
  for (const [index, entry] of definition.board.roleSetups.entries()) {
    if (!isRoleId(entry.role) || !catalog.get(entry.role as Role))
      fail("board_config_role_not_implemented", `board.roleSetups.${index}.role`);
    if (seen.has(entry.role)) fail("board_config_duplicate_role", `board.roleSetups.${index}.role`);
    const maximum = catalog.require(entry.role as Role).maxCount;
    if (maximum !== undefined && entry.count > maximum)
      fail("board_config_invalid_field", `board.roleSetups.${index}.count`);
    seen.add(entry.role);
    total += entry.count;
  }
  if (total !== definition.board.size) fail("board_config_role_count_mismatch", "board.roleSetups");
  const profiles = definition.board.roleSetups.map((entry) => catalog.require(entry.role as Role));
  for (const profile of profiles) {
    if (
      profile.supportedBoardRoles &&
      definition.board.roleSetups.some(
        (entry) => !profile.supportedBoardRoles!.includes(entry.role as Role),
      )
    ) {
      fail("board_config_role_combination_not_supported", "board.roleSetups");
    }
  }
  if (
    !profiles.some((item) => item.camp === Camp.Wolf) ||
    !profiles.some((item) => item.camp === Camp.Good)
  ) {
    fail("board_config_requires_good_and_wolf", "board.roleSetups");
  }
  if (new Set(definition.rules.winConditions).size !== definition.rules.winConditions.length)
    fail("board_config_duplicate_win_condition", "rules.winConditions");
  const sheriff = definition.mechanisms.sheriff;
  if (sheriff.initialSeat && sheriff.initialSeat > total)
    fail("board_config_seat_out_of_range", "mechanisms.sheriff.initialSeat");
  if (
    !sheriff.enabled &&
    (sheriff.initialSeat || sheriff.voteWeight !== 1.5 || sheriff.tieBreaker !== "min_seat")
  ) {
    fail("board_config_disabled_mechanism_parameters", "mechanisms.sheriff");
  }
  const windows = definition.mechanisms.selfDestruct.enabledWindows;
  if (new Set(windows).size !== windows.length)
    fail("board_config_duplicate_window", "mechanisms.selfDestruct.enabledWindows");
  const windowHooks = {
    [ActionWindow.OnPreVote]: "onPreVote",
    [ActionWindow.OnDaybreak]: "onDaybreak",
    [ActionWindow.OnPreElection]: "onPreElection",
    [ActionWindow.OnPerSpeechGap]: "onPerSpeechGap",
  } as const;
  for (const window of windows)
    if (!definition.rules.hooks[windowHooks[window]])
      fail("board_config_window_hook_disabled", `rules.hooks.${windowHooks[window]}`);
  if (definition.rules.winConditions.includes(WinCondition.SlaughterSide)) {
    if (
      !profiles.some((item) => item.goodSide === "god") ||
      !profiles.some((item) => item.goodSide === "villager")
    ) {
      fail("board_config_slaughter_side_requires_both_sides", "rules.winConditions");
    }
  }
  let config: BoardConfig = {
    boardSize: total,
    roleSetups: definition.board.roleSetups.map((entry) => ({
      role: entry.role as Role,
      count: entry.count,
    })),
    winConditions: [...definition.rules.winConditions],
    hooks: { ...definition.rules.hooks },
    enableSheriff: sheriff.enabled,
    ...(sheriff.initialSeat ? { initialSheriffSeat: sheriff.initialSeat } : {}),
    ...(sheriff.enabled ? { sheriff: { voteWeight: sheriff.voteWeight } } : {}),
    selfDestruct: { enabledWindows: [...windows] },
    tieBreaker: {
      ...definition.mechanisms.tieBreaker,
      ...(sheriff.enabled ? { sheriffVote: sheriff.tieBreaker } : {}),
    },
  };
  for (const [id, value] of Object.entries(definition.roles)) {
    if (!seen.has(id)) fail("board_config_role_parameters_without_role", `roles.${id}`);
    const contribution = catalog.require(id as Role).configuration;
    if (!contribution) fail("board_config_role_parameters_not_supported", `roles.${id}`);
    const parsed = contribution.schema.safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const unknown = issue.code === "unrecognized_keys" ? issue.keys[0] : undefined;
      fail(
        "board_config_invalid_field",
        ["roles", id, ...issue.path, ...(unknown ? [unknown] : [])].join("."),
      );
    }
    definition.roles[id] = parsed.data;
    config = contribution.apply(config, parsed.data);
  }
  for (const id of seen) {
    const contribution = catalog.require(id as Role).configuration;
    if (contribution && !(id in definition.roles)) {
      const defaults = contribution.schema.parse(contribution.defaults);
      definition.roles[id] = defaults;
      config = contribution.apply(config, defaults);
    }
  }
  const fieldSources: Record<string, "explicit" | "default"> = {};
  const recordSources = (value: unknown, original: unknown, prefix: string) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, entry] of Object.entries(value)) {
        const prior =
          original && typeof original === "object"
            ? (original as Record<string, unknown>)[key]
            : undefined;
        recordSources(entry, prior, prefix ? `${prefix}.${key}` : key);
      }
    } else fieldSources[prefix] = original === undefined ? "default" : "explicit";
  };
  recordSources(definition, raw, "");
  return { definition, config, fieldSources };
}

/** Public boards contain parameters for present roles only; Tape retains the complete internal board. */
export function boardDefinitionFromConfig(id: string, config: BoardConfig): BoardDefinition {
  const valid = boardConfigSchema.safeParse(config);
  if (!valid.success) {
    const issue = valid.error.issues[0];
    const key = issue.code === "unrecognized_keys" ? issue.keys[0] : undefined;
    fail("board_config_invalid_field", ["config", ...issue.path, ...(key ? [key] : [])].join("."));
  }
  const catalog = getDefaultRoleCatalog();
  const roles: Record<string, unknown> = {};
  for (const entry of config.roleSetups.filter((entry) => entry.count > 0)) {
    const contribution = catalog.require(entry.role).configuration;
    if (contribution) roles[entry.role] = contribution.serialize(config);
  }
  const conditions = config.winConditions?.length
    ? config.winConditions
    : [config.winCondition ?? WinCondition.SlaughterCity];
  return parseBoardDefinition({
    version: 2,
    id,
    ruleset: RULESET,
    board: {
      size: config.boardSize,
      roleSetups: config.roleSetups.filter((entry) => entry.count > 0),
    },
    rules: { winConditions: conditions, hooks: config.hooks },
    mechanisms: {
      sheriff: {
        enabled: config.enableSheriff,
        ...(config.enableSheriff
          ? {
              ...(config.initialSheriffSeat !== undefined
                ? { initialSeat: config.initialSheriffSeat }
                : {}),
              voteWeight: config.sheriff?.voteWeight ?? 1.5,
              tieBreaker: config.tieBreaker?.sheriffVote ?? "min_seat",
            }
          : {}),
      },
      selfDestruct: {
        enabledWindows: (config.selfDestruct?.enabledWindows ?? [ActionWindow.OnPreVote]).filter(
          (window) =>
            ({
              [ActionWindow.OnPreVote]: config.hooks.onPreVote,
              [ActionWindow.OnDaybreak]: config.hooks.onDaybreak,
              [ActionWindow.OnPreElection]: config.hooks.onPreElection,
              [ActionWindow.OnPerSpeechGap]: config.hooks.onPerSpeechGap,
            })[window],
        ),
      },
      tieBreaker: {
        exileVote: config.tieBreaker?.exileVote ?? "min_id",
        wolfKillVote: config.tieBreaker?.wolfKillVote ?? "min_id",
      },
    },
    roles,
  }).definition;
}
