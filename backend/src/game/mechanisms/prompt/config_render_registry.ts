/** Renders normalized board rules without holding mutable language state. */
import {
  BoardConfig,
  WinCondition,
  WitchSelfHealRule,
  Role,
  KnightDuelWindow,
} from "../../../core/domain/model";
import { term, text, type Locale } from "@ai-werewolf-arena/game-text";

export interface ConfigRenderRegistry {
  renderBoardConfigPrompt(config: BoardConfig, locale?: Locale): string;
}

export class DefaultConfigRenderRegistry implements ConfigRenderRegistry {
  renderBoardConfigPrompt(config: BoardConfig, locale: Locale = "zh-CN"): string {
    const winConditions = this.resolveWinConditions(config)
      .map((item) => term("rule", item, locale))
      .join("; ");
    const sheriffEnabled = config.enableSheriff === true;
    const windows = config.selfDestruct?.enabledWindows ?? [];
    const healRule = config.witch?.canSelfHeal ?? WitchSelfHealRule.Disabled;
    return [
      text(locale, "prompt.config.title"),
      text(locale, "prompt.config.win", { rules: winConditions }),
      text(locale, "prompt.config.sheriff", {
        rules: sheriffEnabled
          ? text(locale, "prompt.config.sheriff_enabled", {
              weight: config.sheriff?.voteWeight ?? 1.5,
            })
          : text(locale, "common.disabled"),
      }),
      ...(sheriffEnabled ? [text(locale, "prompt.config.sheriff_timing")] : []),
      text(locale, "prompt.config.blast", {
        rules: windows.length
          ? text(locale, "prompt.config.blast_enabled", {
              windows: windows.map((item) => term("stage", item, locale)).join(", "),
            })
          : text(locale, "common.disabled"),
      }),
      ...(config.witch
        ? [
            text(locale, "prompt.config.self_heal", {
              rules: text(
                locale,
                healRule === WitchSelfHealRule.Always
                  ? "prompt.config.self_heal_always"
                  : healRule === WitchSelfHealRule.FirstNightOnly
                    ? "prompt.config.self_heal_first"
                    : "prompt.config.self_heal_disabled",
              ),
            }),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.Guard && entry.count > 0)
        ? [
            text(
              locale,
              config.guard?.repeatPolicy === "netease_consecutive_nights_v1"
                ? "role.guard.repeat_actual_nights"
                : "role.guard.repeat_last_action",
            ),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.HiddenWolf && entry.count > 0)
        ? [
            text(
              locale,
              config.hiddenWolf?.campInspection === "netease_2020_good_v1"
                ? "role.hidden_wolf.camp_good_v1"
                : "role.hidden_wolf.camp_inheritance_v1",
            ),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.Seer && entry.count > 0)
        ? [
            text(
              locale,
              config.seer?.targetPolicy === "awa_fresh_others_v1"
                ? "role.seer.targets_fresh"
                : "role.seer.targets_alive",
            ),
            text(
              locale,
              config.seer?.actionPolicy !== "awa_optional_v1"
                ? "role.seer.action_required"
                : "role.seer.action_optional",
            ),
          ]
        : []),
      text(locale, "prompt.config.disclosure"),
      text(locale, "prompt.config.last_words"),
      ...(config.roleSetups.some((entry) => entry.role === Role.Knight && entry.count > 0)
        ? [
            text(locale, "prompt.config.knight_windows", {
              windows:
                (config.knight?.enabledWindows ?? [KnightDuelWindow.AfterSpeeches])
                  .map((window) => term("stage", window, locale))
                  .join(", ") || text(locale, "common.disabled"),
            }),
          ]
        : []),
      ...(sheriffEnabled ? [text(locale, "prompt.config.badge")] : []),
      text(locale, "prompt.config.ties", {
        exile: term("tie", config.tieBreaker?.exileVote ?? "min_id", locale),
        wolf: term("tie", config.tieBreaker?.wolfKillVote ?? "min_id", locale),
        sheriff: config.tieBreaker?.sheriffVote
          ? text(locale, "prompt.config.sheriff_tie", {
              tie: term("tie", config.tieBreaker.sheriffVote, locale),
            })
          : "",
      }),
    ].join("\n");
  }

  private resolveWinConditions(config: BoardConfig): WinCondition[] {
    if (config.winConditions?.length) return config.winConditions;
    return config.winCondition ? [config.winCondition] : [WinCondition.SlaughterCity];
  }
}

let defaultRegistry: ConfigRenderRegistry | null = null;
export function getDefaultConfigRenderRegistry(): ConfigRenderRegistry {
  return (defaultRegistry ??= new DefaultConfigRenderRegistry());
}
