/** 智能体任务的领域端口；具体 transport 不得泄漏到调用方。 */
export interface AgentTurnOptions {
  timeoutMs: number;
}

export interface AgentTurnExecutor<TContext, TResult> {
  runTurn(context: TContext, options: AgentTurnOptions): Promise<TResult | null>;
  close(): Promise<void>;
}

