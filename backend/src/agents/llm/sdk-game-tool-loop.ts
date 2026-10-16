/**
 * 负责把 SDK 工具调用适配到共同 ActionTurn 选择窗口；输入为模型消息、原引擎请求与 SDK 调用。
 * 输出保留预检回执、已选候选及拒绝／模型证据，规则与 schema 接收由游戏 Gateway 拥有。
 * 计时器、abort 与 finally-close 仍属于本 loop；accepted 仅表示 selected 且 applied:false，
 * 不消耗库存、提交领域动作或订阅 settlement，失败保留原读取与记录顺序。
 */
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { ActionRequest, ToolCall } from "../../domain";
import { getActionRequestDay, getActionRequestStage } from "../../domain/action-request-context";
import { World } from "../../domain/world";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { AgentBugReportService } from "../reporting/bug-report-service";
import { gameToolProtocol } from "../game-tool-protocol";
import { ActionReception } from "../../engine/actions/action-reception";
import { ActionTurn } from "../player/action-turn";
import {
  ToolCallRepairRegistry,
  type ToolSpecRegistry,
  getDefaultToolSpecRegistry,
  type ToolValidationRuleRegistry,
  getDefaultToolValidationRuleRegistry,
} from "../../rulesets/mechanism-api";
import { LlmObserver } from "../player/player-observer";
import { ChatMessage, ChatModelClient } from "../../adapters/llm/transport";
import { PlayerPromptSession } from "./player-prompt-session";
import { resolveTurnConstraints } from "../../engine/actions/turn-constraints";
import { awaitWithAbort } from "../runtime/turn-deadline";

interface ToolLoopActionResult {
  action: ToolCall | null;
  thinkingText?: string;
  failureCode?: "turn_invalid_action_limit" | "action_turn_failed";
}

/** 原生 SDK 游戏协议适配，所有候选通过同一选择与预检 owner。 */
export class SdkGameToolLoop {
  private readonly reception: ActionReception;
  private readonly bugReports: AgentBugReportService;

  constructor(
    private readonly world: World,
    repairRegistry: ToolCallRepairRegistry,
    private readonly promptSession: PlayerPromptSession,
    private readonly observer: LlmObserver,
    toolSpecRegistry: ToolSpecRegistry = getDefaultToolSpecRegistry(),
    validationRules: ToolValidationRuleRegistry = getDefaultToolValidationRuleRegistry(),
  ) {
    this.reception = new ActionReception(world, repairRegistry, toolSpecRegistry, validationRules);
    this.bugReports = new AgentBugReportService(world, {
      onAccepted: (report, reportId) => {
        const message =
          report.message.length > 120 ? `${report.message.slice(0, 120)}...` : report.message;
        this.observer.emit(
          {
            type: "bug",
            reportId,
            message,
            severity: report.severity,
            category: report.category,
            stage: report.stage,
          },
          { playerId: report.actorId, phase: report.phase, day: report.day, stage: report.stage },
        );
      },
    });
  }

  async run(
    client: ChatModelClient,
    request: ActionRequest,
    messages: ChatMessage[],
    timeoutMs: number,
    turnId: string,
    signal?: AbortSignal,
  ): Promise<ToolLoopActionResult> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    const turn = new ActionTurn(this.reception, request, turnId);
    let protocolRejected = false;
    const abort = () => {
      turn.close();
      controller.abort(signal?.reason);
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    try {
      if (controller.signal.aborted) throw controller.signal.reason;
      const constraints = resolveTurnConstraints(request);
      const protocol = gameToolProtocol(this.world.locale);
      // 先调用 SDK 启动工具循环，随后才创建本层计时器；中止关闭选择窗口并发出信号，外层等待结束不等于底层任务已退出。
      const loop = client.runToolLoop<ToolCall>(
        messages,
        protocol.specs,
        {
          onToolCall: async (invocation) => {
            if (controller.signal.aborted) {
              return {
                toolResult: toolFailure(this.world.locale, "turn_not_open_or_session_invalid"),
              };
            }
            if (invocation.name === "get_game_schema") {
              return { toolResult: protocol.schema };
            }
            if (invocation.name === PlayerPromptSession.REPORT_BUG_TOOL) {
              const refusal = turn.authorize(invocation.args.turn_id ?? turnId, "report_bug");
              if (refusal)
                return {
                  toolResult: this.recordRefusal(
                    request,
                    invocation.name,
                    invocation.args,
                    refusal,
                  ),
                };
              return { toolResult: this.reportBug(request, invocation.args) };
            }

            let actionName = invocation.name;
            let actionArgs = invocation.args;
            if (invocation.name === "submit_action") {
              if (invocation.args.turn_id !== turnId) {
                protocolRejected = true;
                return {
                  toolResult: this.recordRefusal(
                    request,
                    invocation.name,
                    invocation.args,
                    turn.authorize(invocation.args.turn_id)!,
                  ),
                };
              }
              const receipt = turn.submit(
                turnId,
                invocation.args.action,
                invocation.args.arguments,
              );
              if (!receipt.ok)
                return {
                  toolResult: this.recordRefusal(
                    request,
                    invocation.name,
                    invocation.args,
                    receipt,
                  ),
                };
              return { toolResult: receipt, finalAction: turn.action! };
            }
            const receipt = turn.submit(turnId, actionName, actionArgs);
            if (!receipt.ok) {
              return {
                toolResult: this.recordRefusal(request, invocation.name, invocation.args, receipt),
              };
            }
            return { toolResult: receipt, finalAction: turn.action! };
          },
        },
        {
          signal: controller.signal,
          maxSteps: 8,
          toolChoice: constraints.minValidActions > 0 ? "required" : "auto",
        },
      );
      const result = await awaitWithAbort(
        Promise.race([
          loop,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              turn.close();
              const error = new Error(`llm_request_timeout_${timeoutMs}ms`);
              controller.abort(error);
              reject(error);
            }, timeoutMs);
          }),
        ]),
        controller.signal,
      );
      const thinkingText = this.observer.thinkingText(
        result.assistantText ?? "",
        result.thinkingTrace ?? [],
      );
      if (result.assistantText) {
        this.promptSession.appendAssistant(request.actorId, result.assistantText);
      }
      this.observer.thinking(result.thinkingTrace ?? [], request);
      this.observer.rawResponse(result.assistantText ?? "", request);
      const failedActionInput =
        result.failedToolInvocations?.some(
          (call) => call.name !== "get_game_schema" && call.name !== "report_bug",
        ) === true;
      if (
        !turn.action &&
        request.context.action_failure_policy === "error" &&
        (turn.outcome.rejectedActions || protocolRejected || failedActionInput)
      )
        return {
          action: null,
          failureCode: turn.outcome.failureCode ?? "action_turn_failed",
          ...(thinkingText ? { thinkingText } : {}),
        };
      return {
        action: turn.action,
        ...(thinkingText ? { thinkingText } : {}),
      };
    } finally {
      turn.close();
      signal?.removeEventListener("abort", abort);
      if (timer) clearTimeout(timer);
    }
  }

  private recordRefusal(
    request: ActionRequest,
    tool: string,
    args: Record<string, unknown>,
    result: { ok: false; error: string; message: string },
  ): Record<string, unknown> {
    safeRecordLogicOp({
      scope: "llm_action_provider",
      op: "tool_call_rejected",
      actorId: request.actorId,
      phase: String(request.phase),
      status: "rejected",
      reason: result.error,
      input: {
        day: getActionRequestDay(request),
        stage: getActionRequestStage(request),
        tool,
        args,
      },
      output: result,
    });
    this.observer.trace(
      `tool_call_rejected player=${request.actorId} tool=${tool} code=${result.error}`,
    );
    return result;
  }

  private reportBug(
    request: ActionRequest,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.bugReports.report({
      actorId: request.actorId,
      day: getActionRequestDay(request),
      phase: String(request.phase),
      stage: getActionRequestStage(request),
      category: args.category,
      severity: args.severity,
      message: args.message,
    });
  }
}
