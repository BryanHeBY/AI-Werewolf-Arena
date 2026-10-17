/**
 * 负责本机制的公开政策说明；输入只读板子和语言，输出双语规则片段。
 * 不读取玩家私态、创建机制或重新校验行动，组合层保留各片段的原调用顺序。
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
