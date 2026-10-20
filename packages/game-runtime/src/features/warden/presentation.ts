/**
 * 负责把典狱长纯状态裁为主持者真正知道的pair历史，再渲染双语规则。
 * 主持者看不到其他人的decision／resolved；只有本人也入局时保留本人的独立choice。
 * 输入是已脱离状态，输出不含World、窗口、scope或他人的秘密决定。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { WardenState, WardenKnowledge } from "@ai-werewolf-arena/game-contract/facts/warden";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";

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

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderWardenStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
  witchKnifeContext: () => string,
): string | undefined {
  if (
    request.allowedTools.includes("warden_pair") &&
    request.context.warden_candidates !== undefined
  )
    return text(queries.locale(), "prompt.stage.warden_candidates", {
      ids: request.context.warden_candidates.join(", "),
    });
  if (
    request.allowedTools.includes("warden_decide") &&
    request.context.warden_partner_id !== undefined
  )
    return text(queries.locale(), "prompt.stage.warden_partner", {
      partner: request.context.warden_partner_id,
    });
  if (
    request.allowedTools.some((t) => ["check_identity", "use_potion", "dream"].includes(t)) &&
    request.context.warden_forced_target !== undefined
  ) {
    const forced = text(queries.locale(), "prompt.stage.warden_forced", {
      target: request.context.warden_forced_target,
    });
    // 强制目标和已获准的刀口是两条独立信息，不能因交易约束遮掉女巫的合法知情。
    // 刀口只读取本次请求，不向 World 查询未披露的狼刀或交易对象身份。
    return request.allowedTools.includes("use_potion")
      ? [forced, witchKnifeContext()].join(" ")
      : forced;
  }
}
