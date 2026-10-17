/**
 * 负责本机制原生角色提示的逐片段捕获及既有公开政策／请求展示贡献。输入为原角色组件、语言、原 World 引用和未执行的当前阵营 source；输出仍由共享展示包格式化。
 * 只读取本机制已授权的原生状态，不用赠予／借用能力替换原文，不复制库存或缓存结果；字段、callee／receiver、格式化及异常的先后保持原查询点。
 * 公开政策与请求贡献保留各自原输入，捕获不授予行动权限、扩大受众或替代状态 owner。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { Role } from "@ai-werewolf-arena/game-contract";

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderCupidBoardRules(config: ReadonlyBoardConfig, locale: Locale): string[] {
  return config.cupid ||
    config.roleSetups.some((entry) => entry.role === Role.Cupid && entry.count > 0)
    ? [
        text(
          locale,
          config.cupid?.policy === "lui_meme_lovers_only_v1"
            ? "rules.lovers.lui"
            : "rules.lovers.netease",
        ),
      ]
    : [];
}

/** 只格式化本人已知关系和公开政策，不接收伴侣阵营或秘密胜利分组。 */
export function renderLoverPrompt(
  lover: { partnerId: number; policy: string; mayNotVotePartner: boolean },
  locale: () => Locale,
): string[] {
  const lines = [text(locale(), "prompt.status.lover", { partner: lover.partnerId })];
  lines.push(
    text(
      locale(),
      lover.policy === "lui_meme_lovers_only_v1" ? "rules.lovers.lui" : "rules.lovers.netease",
    ),
  );
  if (lover.mayNotVotePartner) lines.push(text(locale(), "prompt.status.lovers_vote"));
  return lines;
}
import { type RoleComponent } from "../../domain/components/role";
import { type World } from "../../domain/world";
import { getCupidState, projectCupidState } from "./ports";
import { formatNativeRoleMessage as nativeText } from "@ai-werewolf-arena/game-presentation";

export const captureCupidPresentation = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.cupid.state") +
  " " +
  nativeText(
    locale,
    getCupidState(role)?.policy === "lui_meme_lovers_only_v1"
      ? "role.cupid.lui"
      : "role.cupid.netease",
  ) +
  " " +
  nativeText(locale, "role.cupid.status", {
    state: JSON.stringify(projectCupidState(getCupidState(role)!)),
  });
