/**
 * 负责定义智能体任务执行／关闭的公开结构契约；输入原上下文与本次超时，输出 TResult、null 或原拒绝。
 * 类型不创建计时器或资源，也不实现取消、迟到回收或授权；这些责任归具体执行器和持有它的调用方。
 * 审计 pipeline 在原 finally 调用 close；此契约不保证所有实现都持资源，亦不把 null 当成功提交。
 */
export interface AgentTurnOptions {
  /** 单次 runTurn 的原超时输入；具体实现决定如何约束等待，不表示关闭预算或同步任务可被抢占。 */
  timeoutMs: number;
}

/** 保持 context 原结构与引用约定；结果校验、重试和资源生命周期由实际调用链负责。 */
export interface AgentTurnExecutor<TContext, TResult> {
  runTurn(context: TContext, options: AgentTurnOptions): Promise<TResult | null>;
  close(): Promise<void>;
}
