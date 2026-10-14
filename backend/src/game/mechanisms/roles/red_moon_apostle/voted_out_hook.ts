/**
 * 负责赤月使徒放逐延期的完整同步组合。输入为原 World、玩家与可写事件数组；输出为免死结果或 null。
 * 在原放逐钩子时点先查询最近已关闭并封存的原夜，再由猎魔权威复验原赤月实例、末狼与库存并提交审计。
 * 成功提交后才发表原延期事实；事件方法查找或时钟失败不退款，也不在此标死、推进阶段或另开租约。
 * 其它出局原因不经此放逐入口豁免；重复提交仍由原权威拒绝，不从 live 角色标签猜测延期资格。
 */
import type { VotedOutHook } from "../../hooks/hook_registry";
import { demonRedMoonDay, commitDemonRedMoonTransition } from "../demon_hunter/red-moon-ports";
export const redMoonVotedOutHook: VotedOutHook = (world, actorId, events) => {
  const day = demonRedMoonDay(world, actorId);
  if (day === null || !commitDemonRedMoonTransition(world, actorId, "exile", day)) return null;
  // 资源和审计已提交；保持 push 的方法／receiver 查找先于时钟与载荷，后续抛错不发布免死结果。
  events.push({
    timestamp: Date.now(),
    type: "red_moon_exile_delayed",
    payload: { actorId, day, night: day + 1 },
  });
  return { prevented: true, removed: [], reason: "red_moon_exile_delayed" };
};
