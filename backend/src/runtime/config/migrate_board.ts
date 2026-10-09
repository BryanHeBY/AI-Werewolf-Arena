/** Explicit conversion of legacy overrides. Normal loading never tries legacy fallbacks. */
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
  type BoardDefinition,
} from "./board_definition";
import { ActionWindow } from "../../core/domain/model";
import {
  parseBoardOverride,
  resolveBoardConfig,
  type BoardName,
} from "../scenarios/board_config_resolver";

export const MIGRATION_WARNING_CODES = [
  "legacy_defaults_resolved_explicitly",
  "legacy_single_win_condition_shadowed_by_effective_win_conditions",
  "legacy_empty_windows_used_default_pre_vote_window",
  "legacy_windows_with_disabled_hooks_removed_explicitly",
  "legacy_unused_witch_parameters_removed_explicitly",
  "legacy_unsupported_windows_removed_explicitly",
] as const;
export type MigrationWarningCode = (typeof MIGRATION_WARNING_CODES)[number];
export interface BoardMigration {
  definition: BoardDefinition;
  warnings: MigrationWarningCode[];
}

export function convertLegacyBoard(
  raw: unknown,
  boardId: string,
  legacyBase?: BoardName,
): BoardMigration {
  if (raw && typeof raw === "object" && "version" in raw) {
    return { definition: parseBoardDefinition(raw, boardId).definition, warnings: [] };
  }
  const base = legacyBase ?? boardId;
  if (base !== "six_player_mvp" && base !== "twelve_player_standard") {
    throw new Error("board_config_legacy_base_unknown");
  }
  const override = parseBoardOverride(raw, (legacyBase ?? boardId) as BoardName);
  if (!override) throw new Error("board_config_legacy_shape_invalid");
  const historical = { ...override };
  // Unversioned files retain their historical execution semantics during conversion.
  if (historical.selfDestruct?.enabledWindows.length === 0) delete historical.selfDestruct;
  const effective = resolveBoardConfig(base as BoardName, historical);
  const unsupported =
    effective.selfDestruct?.enabledWindows.filter((window) => window !== ActionWindow.OnPreVote) ??
    [];
  if (unsupported.length)
    effective.selfDestruct = {
      enabledWindows: effective.selfDestruct!.enabledWindows.filter(
        (window) => window === ActionWindow.OnPreVote,
      ),
    };
  const warnings: MigrationWarningCode[] = ["legacy_defaults_resolved_explicitly"];
  if (unsupported.length) warnings.push("legacy_unsupported_windows_removed_explicitly");
  if (override.winCondition && effective.winConditions?.length)
    warnings.push("legacy_single_win_condition_shadowed_by_effective_win_conditions");
  if (override.selfDestruct?.enabledWindows.length === 0 && effective.hooks.onPreVote)
    warnings.push("legacy_empty_windows_used_default_pre_vote_window");
  const windowHooks = {
    [ActionWindow.OnPreVote]: effective.hooks.onPreVote,
    [ActionWindow.OnDaybreak]: effective.hooks.onDaybreak,
    [ActionWindow.OnPreElection]: effective.hooks.onPreElection,
    [ActionWindow.OnPerSpeechGap]: effective.hooks.onPerSpeechGap,
  };
  if (
    [...unsupported, ...(effective.selfDestruct?.enabledWindows ?? [])].some(
      (window) => !windowHooks[window],
    )
  )
    warnings.push("legacy_windows_with_disabled_hooks_removed_explicitly");
  if (
    override.witch &&
    !effective.roleSetups.some((entry) => entry.role === "witch" && entry.count > 0)
  )
    warnings.push("legacy_unused_witch_parameters_removed_explicitly");
  return { definition: boardDefinitionFromConfig(boardId, effective), warnings };
}
