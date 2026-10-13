/**
 * 负责把同步回调及其异步后代绑定到唯一录制会话，使用 AsyncLocalStorage 隔离并发调用。
 * 输入为会话管理器和回调，输出保持回调原返回值；嵌套作用域结束后恢复外层会话。
 * 此模块只传播记录上下文，不创建文件、不结束会话；作用域外记录保持可选。
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionRecordManager } from "./session_recorder";

const sessionRecorders = new AsyncLocalStorage<SessionRecordManager>();

/** 绑定同步工作及异步后代；异常传播和返回值由 AsyncLocalStorage.run 原样保持。 */
export function runWithSessionRecorder<T>(recorder: SessionRecordManager, run: () => T): T {
  return sessionRecorders.run(recorder, run);
}

/** 显式会话作用域以外返回 null；不使用进程全局的当前管理器。 */
export function getSessionRecorder(): SessionRecordManager | null {
  return sessionRecorders.getStore() ?? null;
}
