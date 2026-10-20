/**
 * 负责本机制原生角色提示的逐片段捕获及既有公开政策／请求展示贡献。输入为原角色组件、语言、原 World 引用和未执行的当前阵营 source；输出仍由共享展示包格式化。
 * 只读取本机制已授权的原生状态，不用赠予／借用能力替换原文，不复制库存或缓存结果；字段、callee／receiver、格式化及异常的先后保持原查询点。
 * 公开政策与请求贡献保留各自原输入，捕获不授予行动权限、扩大受众或替代状态 owner。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { Role } from "@ai-werewolf-arena/game-contract";

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderSeerBoardRules(config: ReadonlyBoardConfig, locale: Locale): string[] {
  return config.roleSetups.some((entry) => entry.role === Role.Seer && entry.count > 0)
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
    : [];
}
import { type RoleComponent } from "../../domain/components/role";
import { type World } from "../../domain/world";
import { getSeerState } from "./ports";
import {
  formatNativeRoleMessage as nativeText,
  formatNativeRoleTerm as nativeTerm,
  formatNativeInspectionLabel as nativeInspectionLabel,
} from "@ai-werewolf-arena/game-presentation";

// 预言家最新结果在基础文字之前格式化；保留原 legacy camp 与 lastResult 分支。
export const captureSeerPresentation = (
  roleComp: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => {
  const state = getSeerState(roleComp);
  const latest =
    state && state.lastTarget !== null && (state.lastResult || state.lastIsWerewolf !== null)
      ? ` ${state.lastResult ? nativeText(locale, "inspection.latest", { target: state.lastTarget, result: nativeInspectionLabel(state.lastResult, locale) }) : nativeText(locale, "role.seer.latest", { target: state.lastTarget, camp: nativeTerm("camp", state.lastIsWerewolf ? "wolf" : "good", locale) })}`
      : "";
  return (
    nativeText(locale, "role.seer.state") +
    latest +
    " " +
    nativeText(
      locale,
      state?.targetPolicy === "awa_fresh_others_v1"
        ? "role.seer.targets_fresh"
        : "role.seer.targets_alive",
    ) +
    " " +
    nativeText(
      locale,
      state?.actionPolicy !== "awa_optional_v1"
        ? "role.seer.action_required"
        : "role.seer.action_optional",
    )
  );
};
