/**
 * 负责本机制的公开政策和当前请求提示；输入只读配置、已授权请求及语言查询，输出双语说明。
 * 不读取 World 或重新推导目标，保持原字段读取顺序；提示不授予技能或行动权限。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { WitchSelfHealRule } from "@ai-werewolf-arena/game-contract";
import { Role } from "@ai-werewolf-arena/game-contract";

/** 只渲染请求已授权披露的刀口；undefined 与 null 分别保留“不知情”和“没有刀口”的含义。 */
export function buildWitchKnifeContextHint(request: ActionRequest, locale: Locale): string {
  if (request.context.wolf_targets !== undefined)
    return request.context.wolf_targets.length
      ? text(locale, "prompt.stage.wolf_targets", {
          targets: request.context.wolf_targets.join(", "),
        })
      : text(locale, "prompt.stage.no_wolf_target");
  if (typeof request.context.wolf_target === "number") {
    return text(locale, "prompt.stage.wolf_target", {
      target: request.context.wolf_target,
    });
  }
  return request.context.wolf_target === null
    ? text(locale, "prompt.stage.no_wolf_target")
    : text(locale, "prompt.stage.unknown_wolf_target");
}

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderWitchSelfHealRules(
  config: ReadonlyBoardConfig,
  locale: Locale,
  healRule: WitchSelfHealRule,
): string[] {
  return config.witch
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
    : [];
}

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderWitchBoardRules(config: ReadonlyBoardConfig, locale: Locale): string[] {
  return config.roleSetups.some((entry) => entry.role === Role.Witch && entry.count > 0)
    ? [
        text(
          locale,
          config.witch?.knifeVisibility === "awa_always_v1"
            ? "role.witch.knife_always"
            : "role.witch.knife_with_heal",
        ),
        text(
          locale,
          config.witch?.potionPolicy === "awa_both_native_experimental_v1"
            ? "role.witch.potions_both"
            : "role.witch.potions_one",
        ),
      ]
    : [];
}
