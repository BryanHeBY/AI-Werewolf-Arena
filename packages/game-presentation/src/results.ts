/**
 * 负责双端查验结果与胜负结果的展示映射。输入是公开的查验、胜利主张和检查点数据及每次调用的语言；输出保留原文案、合并顺序和玩家列表。资源、真实阵营和判胜仍由领域负责，展示函数不授予权限或修改输入。
 */
import { type PlayerText } from "./players";
import {
  type Locale,
  type InspectionResult,
  type GameOutcome,
  type VictoryClaim,
  type VictoryPoint,
} from "@ai-werewolf-arena/game-contract";
import { text as defaultText, term, roleName } from "@ai-werewolf-arena/game-text";

export function inspectionLabel(
  result: InspectionResult,
  locale: Locale = "zh-CN",
  text: PlayerText = defaultText,
): string {
  if (result.kind === "camp") return term("camp", result.camp, locale);
  if (result.kind === "role") return roleName(result.role, locale);
  return text(locale, "inspection.combined", {
    role: roleName(result.role, locale),
    camp: term("camp", result.camp, locale),
  });
}

export function victoryClaimLabel(
  claim: VictoryClaim,
  locale: Locale = "zh-CN",
  text: PlayerText = defaultText,
): string {
  if (claim.kind === "faction")
    return text(locale, "victory.faction", { faction: term("camp_team", claim.faction, locale) });
  if (claim.kind === "individual")
    return text(locale, "victory.individual", {
      player: text(locale, "replay.player", { id: claim.playerId }),
      goal:
        claim.goalId === "netease_cursed_fox_last_faction_v1"
          ? text(locale, "victory.goal.netease_cursed_fox_last_faction_v1")
          : claim.goalId,
    });
  return text(locale, "victory.relationship", {
    group:
      claim.groupId === "cupid_lovers" ? text(locale, "victory.group.cupid_lovers") : claim.groupId,
  });
}

export function outcomeLabel(
  outcome: GameOutcome,
  locale: Locale = "zh-CN",
  text: PlayerText = defaultText,
): string {
  if (outcome.kind === "no_winner") return text(locale, "replay.no_winner");
  const primary = victoryClaimLabel(outcome.primary, locale, text);
  return outcome.additional.length
    ? text(locale, "victory.additional", {
        primary,
        additional: outcome.additional
          .map((claim) => victoryClaimLabel(claim, locale, text))
          .join(locale === "zh-CN" ? "；" : "; "),
      })
    : primary;
}

export function outcomeWinnersLabel(
  outcome: GameOutcome,
  locale: Locale = "zh-CN",
  text: PlayerText = defaultText,
): string {
  const players =
    outcome.kind === "victory"
      ? outcome.winningPlayerIds
          .map((id) => text(locale, "replay.player", { id }))
          .join(locale === "zh-CN" ? "、" : ", ")
      : "";
  return text(locale, "victory.winners", { players: players || text(locale, "common.none") });
}

export function victoryPointLabel(
  point: VictoryPoint,
  locale: Locale = "zh-CN",
  text: PlayerText = defaultText,
): string {
  return text(locale, "victory.point", {
    day: point.day,
    phase: term("phase", point.phase, locale),
    checkpoint: text(locale, `checkpoint.${point.checkpoint}`),
  });
}
