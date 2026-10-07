/** Explicit conversion of legacy overrides. Normal loading never tries legacy fallbacks. */
import { boardDefinitionFromConfig, parseBoardDefinition, type BoardDefinition } from "./board_definition";
import { ActionWindow } from "../../core/domain/model";
import { parseBoardOverride, resolveBoardConfig, type BoardName } from "../scenarios/board_config_resolver";

export interface BoardMigration { definition: BoardDefinition; warnings: string[] }

export function convertLegacyBoard(raw: unknown, boardId: string, legacyBase?: BoardName): BoardMigration {
  if (raw && typeof raw === "object" && "version" in raw) {
    return { definition: parseBoardDefinition(raw, boardId).definition, warnings: [] };
  }
  const base = legacyBase ?? boardId;
  if (base !== "six_player_mvp" && base !== "twelve_player_standard") {
    throw new Error("board_config_legacy_base_unknown");
  }
  const override = parseBoardOverride(raw, (legacyBase ?? boardId) as BoardName);
  if (!override) throw new Error("board_config_legacy_shape_invalid");
  const effective = resolveBoardConfig(base as BoardName, override);
  const warnings = ["legacy_defaults_resolved_explicitly"];
  if (override.winCondition && effective.winConditions?.length) warnings.push("legacy_single_win_condition_shadowed_by_effective_win_conditions");
  if (override.selfDestruct?.enabledWindows.length === 0 && effective.hooks.onPreVote) warnings.push("legacy_empty_windows_used_default_pre_vote_window");
  const windowHooks = { [ActionWindow.OnPreVote]: effective.hooks.onPreVote, [ActionWindow.OnDaybreak]: effective.hooks.onDaybreak,
    [ActionWindow.OnPreElection]: effective.hooks.onPreElection, [ActionWindow.OnPerSpeechGap]: effective.hooks.onPerSpeechGap };
  if (effective.selfDestruct?.enabledWindows.some(window => !windowHooks[window])) warnings.push("legacy_windows_with_disabled_hooks_removed_explicitly");
  if (override.witch && !effective.roleSetups.some(entry => entry.role === "witch" && entry.count > 0)) warnings.push("legacy_unused_witch_parameters_removed_explicitly");
  return { definition: boardDefinitionFromConfig(boardId, effective), warnings };
}
