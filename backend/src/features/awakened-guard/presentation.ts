/**
 * 负责将觉醒守卫本人纯历史渲染为双语提示。输入严格脱离状态／语言，输出自身已知选择；
 * 不读取World、扩散他人私态或据展示重新创建全天保护，昵称和玩家原话不在此处理。
 */
import type { AwakenedGuardState } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
export function awakenedGuardPromptState(state: AwakenedGuardState | null, locale: Locale): string {
  const brief = text(locale, "role.awakened_guard.brief");
  if (!state) return brief;
  const history = state.cycles.map((c) =>
    c.status === "protected"
      ? text(locale, "awakened_guard.history.protected", { day: c.day, target: c.targetId })
      : text(
          locale,
          c.status === "open"
            ? "awakened_guard.history.open"
            : c.status === "passed"
              ? "awakened_guard.history.passed"
              : "awakened_guard.history.unused",
          { day: c.day },
        ),
  );
  return (
    brief +
    " " +
    text(locale, "role.awakened_guard.state", {
      history: history.join("; ") || text(locale, "common.none"),
    })
  );
}
