/**
 * 负责保存可信死亡动作的单次继续点。输入为本族已捕获原资源的程序，输出没有回调或 World 的不透明标记。
 * 引擎排空当前追加死亡链后才消费该标记；原程序只返回下一份提案，不能取得引擎 commit 或阶段写权。
 * 这里只持继续程序，不镜像库存、生命或许可；开始继续前即删除程序，失败不能再次执行同一标记。
 */
import type { DeathHookResult } from "./registry";

/** 标记不是可序列化授权；同形对象、复制对象及已经消费的标记均不能恢复程序。 */
export interface DeathActionContinuation {
  readonly kind: "death_action_continuation";
}

const programs = new WeakMap<object, () => Promise<DeathHookResult>>();
const queued = new WeakSet<object>();

/** 仅由内部 owned death hook 创建；公开扩展回调没有此 factory 的公共导出。 */
export function createDeathActionContinuation(
  resume: () => Promise<DeathHookResult>,
): DeathActionContinuation {
  const token: DeathActionContinuation = Object.freeze({ kind: "death_action_continuation" });
  programs.set(token, resume);
  return token;
}

/** 在提案写入生命前核对继续点，不能先提交死亡后才发现伪造／已用标记。 */
export function hasDeathActionContinuation(value: unknown): value is DeathActionContinuation {
  return typeof value === "object" && value !== null && programs.has(value) && !queued.has(value);
}

/** 一次捕获并预约整份结果的继续项；重复／旧标记在这份结果的任何真实死亡写入前拒绝。 */
export function queueDeathActionContinuations(value: unknown): readonly DeathActionContinuation[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("death_action_continuation_invalid");
  const captured: DeathActionContinuation[] = [],
    seen = new Set<object>();
  for (const token of value) {
    if (!hasDeathActionContinuation(token) || seen.has(token))
      throw new Error("death_action_continuation_invalid");
    seen.add(token);
    captured.push(token);
  }
  for (const token of captured) queued.add(token);
  return Object.freeze(captured);
}

/** 取出即消费，原异常直接传播；再次调用保原失败前缀而不重开资源窗口。 */
export async function resumeDeathActionContinuation(
  token: DeathActionContinuation,
): Promise<DeathHookResult> {
  const resume = programs.get(token);
  if (!resume || !queued.has(token)) throw new Error("death_action_continuation_invalid");
  programs.delete(token);
  return resume();
}
