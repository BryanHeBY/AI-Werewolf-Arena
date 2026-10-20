/**
 * 负责 ACP 会话的有界关闭与强制回收重试；输入为原会话、关闭方式和每次尝试的时限。
 * 输出为关闭完成或原失败／聚合失败。
 * 不变量：普通关闭失败后必须强制尝试，即使强制成功仍传播原失败；调用方负责关闭去重。
 * 同一会话的关闭任务去重归调用方（如会话池），本 helper 不持复用表，不把超时当成资源已回收。
 */
import { AcpSession } from "./session";
import { awaitBeforeDeadline } from "../../agents/runtime/turn-deadline";

export const ACP_CLOSE_TIMEOUT_MS = 6_000;
/** 初始化主失败与资源清理失败保留原对象，供创建 owner 继续汇总，不重写为单个超时原因。 */
export class AcpInitializationCleanupError extends AggregateError {
  constructor(primary: unknown, cleanup: unknown) {
    super([primary, cleanup], "acp_initialization_cleanup_failed");
  }
}

/** force=true 不再重试；普通关闭失败后强制尝试，失败顺序与错误对象身份保持。 */
export async function closeAcpSession(
  session: AcpSession,
  force = false,
  timeoutMs = ACP_CLOSE_TIMEOUT_MS,
): Promise<void> {
  // 每次尝试在调用处独立计算截止；timeoutMs 不是两次尝试合计的总预算。
  const attempt = (forced: boolean) =>
    awaitBeforeDeadline(() => session.close({ force: forced }), Date.now() + timeoutMs);
  try {
    await attempt(force);
  } catch (error) {
    if (force) throw error;
    try {
      await attempt(true);
    } catch (forcedError) {
      // 两次若拒绝同一对象就直接保留它；不同失败才按普通、强制的顺序汇总。
      if (forcedError === error) throw error;
      throw new AggregateError([error, forcedError], "acp_session_close_failed");
    }
    throw error;
  }
}
