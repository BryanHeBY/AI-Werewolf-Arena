/**
 * 负责本机制的公开政策说明；输入只读板子和语言，输出双语规则片段。
 * 不读取玩家私态、创建机制或重新校验行动，组合层保留各片段的原调用顺序。
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
