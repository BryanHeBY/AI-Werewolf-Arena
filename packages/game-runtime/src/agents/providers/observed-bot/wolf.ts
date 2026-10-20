/**
 * 负责狼聊、刀目标、魅惑与自爆的观察选择；输入为已知队友、自己的历史／能力提示和本次请求候选。
 * 输出为原动作或 null，不从队友名单推断实际阵营、实时存活或重新授予已撤销的狼队资格。
 * 生产回退的 F01 检查在外层分别要求自身 canChat／canVoteForKill 为 true；本叶不执行该授权检查。
 * 选择和随机顺序保持，实际目标、窗口、原体、资源与付款仍由各机制在提交处复验。
 */
import type { ObservedToolHandler } from "./context";

export const speak_to_wolves: ObservedToolHandler = (context) => {
  const {} = context;
  return { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } };
};

export const kill_vote: ObservedToolHandler = (context) => {
  const { teammateIds, others, pick, request, style } = context;
  // 迷雾／鸦爪板子会显式发刀候选；给了名单便优先使用，不再追加基于队友知识的过滤。
  if (request.context.wolf_kill_candidates !== undefined && style === "conservative")
    return { name: "kill_vote", args: { target_id: null, abstain: true } };
  const target =
    request.context.wolf_kill_candidates !== undefined
      ? pick([...request.context.wolf_kill_candidates])
      : pick(others.filter((id) => !teammateIds.includes(id)));
  return {
    name: "kill_vote",
    args: { target_id: target ?? null, abstain: target === undefined },
  };
};

export const charm: ObservedToolHandler = (context) => {
  const { request, ownState, others, pick, style } = context;
  // 仅看已告知的最后一次魅惑记录，避开上一日同目标；不读取目标关系或真实存活。
  const previous = ownState.wolfBeauty?.history.at(-1),
    target =
      style === "conservative"
        ? undefined
        : pick(
            others.filter(
              (id) => previous?.day !== request.context.day - 1 || previous.targetId !== id,
            ),
          );
  return { name: "charm", args: { target_id: target ?? null } };
};

export const self_destruct_with_target: ObservedToolHandler = (context) => {
  const { ownState, teammateIds, others, pick, random, style } = context;
  // 先风格和已知自爆提示，再消费原概率；提示不是现时原体许可，目标也只排除已知队友。
  if (style !== "active" || ownState.whiteWolfKing?.canDetonate !== true || random.next() >= 0.5)
    return null;
  const target = pick(others.filter((id) => !teammateIds.includes(id)));
  return {
    name: "self_destruct_with_target",
    args: { reason: "Active simulated strategy", confirm: true, target_id: target ?? null },
  };
};

export const self_destruct: ObservedToolHandler = (context) => {
  const { request, random, style } = context;
  return style === "active" && request.context.day > 1 && random.next() < 0.25
    ? { name: "self_destruct", args: { reason: "Active simulated strategy", confirm: true } }
    : null;
};
