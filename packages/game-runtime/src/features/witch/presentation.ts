/**
 * 负责本机制原生角色提示的逐片段捕获及既有公开政策／请求展示贡献。输入为原角色组件、语言、原 World 引用和未执行的当前阵营 source；输出仍由共享展示包格式化。
 * 只读取本机制已授权的原生状态，不用赠予／借用能力替换原文，不复制库存或缓存结果；字段、callee／receiver、格式化及异常的先后保持原查询点。
 * 公开政策与请求贡献保留各自原输入，捕获不授予行动权限、扩大受众或替代状态 owner。
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
import { type RoleComponent } from "../../domain/components/role";
import { type World } from "../../domain/world";
import { getWitchState } from "./ports";
import { formatNativeRoleMessage as nativeText } from "@ai-werewolf-arena/game-presentation";

// 女巫先读取 heal／poison 并完成库存文案，之后才分别查询刀口及用药政策；不得提前收齐状态。
export const captureWitchPresentation = (
  roleComp: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.witch.state", {
    heal: getWitchState(roleComp)?.heal ?? 0,
    poison: getWitchState(roleComp)?.poison ?? 0,
  }) +
  " " +
  nativeText(
    locale,
    getWitchState(roleComp)?.knifeVisibility === "awa_always_v1"
      ? "role.witch.knife_always"
      : "role.witch.knife_with_heal",
  ) +
  " " +
  nativeText(
    locale,
    getWitchState(roleComp)?.potionPolicy === "awa_both_native_experimental_v1"
      ? "role.witch.potions_both"
      : "role.witch.potions_one",
  );
