/**
 * 负责把典狱长纯状态裁为主持者真正知道的pair历史，再渲染双语规则。
 * 主持者看不到其他人的decision／resolved；只有本人也入局时保留本人的独立choice。
 * 输入是已脱离状态，输出不含World、窗口、scope或他人的秘密决定。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { WardenState, WardenKnowledge } from "@ai-werewolf-arena/game-contract/facts/warden";
export function projectWardenKnowledge(state: WardenState, actorId: number): WardenKnowledge {
  return {
    policy: state.policy,
    forcePolicy: state.forcePolicy,
    history: state.history.map((r) => {
      const own = r.decisions.find((d) => d.playerId === actorId);
      return {
        day: r.day,
        pair: r.pair ? [r.pair[0], r.pair[1]] : null,
        ...(own ? { ownChoice: own.choice } : {}),
      };
    }),
  };
}
export function wardenPromptState(state: WardenState | null, locale: Locale): string {
  return (
    text(locale, "role.warden.brief") +
    " " +
    text(locale, "role.warden.state", {
      ids: state?.history.flatMap((r) => r.pair ?? []).join(", ") || text(locale, "common.none"),
    })
  );
}
