import { toolFailure } from "@ai-werewolf-arena/game-text";
import { ActionRequest, ToolCall } from "../../../core/domain"
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../core/domain/action_request_context";
import { World } from "../../../core/domain/world";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { AgentBugReportService } from "../reporting/bug_report_service";
import { gameToolProtocol } from "../game_tool_protocol";
import { ActionReception, ActionTurn } from "../player/action_reception";
import { ToolCallRepairRegistry, type ToolSpecRegistry, getDefaultToolSpecRegistry } from "../../../game/mechanisms";
import { LlmObserver } from "./llm_observer";
import { ChatMessage, ChatModelClient } from "../../integrations/llm/transport";
import { PlayerPromptSession } from "./player_prompt_session";
import { resolveTurnConstraints } from "../player/turn_constraints";

interface ToolLoopActionResult {
  action: ToolCall | null;
  thinkingText?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Native SDK implementation of the shared werewolf game tool protocol. */
export class SdkGameToolLoop {
  private readonly reception: ActionReception;
  private readonly bugReports: AgentBugReportService;

  constructor(
    private readonly world: World,
    repairRegistry: ToolCallRepairRegistry,
    private readonly promptSession: PlayerPromptSession,
    private readonly observer: LlmObserver,
    toolSpecRegistry: ToolSpecRegistry = getDefaultToolSpecRegistry(),
  ) {
    this.reception = new ActionReception(world, repairRegistry, toolSpecRegistry);
    this.bugReports = new AgentBugReportService(world, {
      onAccepted: (report, reportId) => {
        const message = report.message.length > 120
          ? `${report.message.slice(0, 120)}...`
          : report.message;
        console.log(
          `[LLM_BUG] player=${report.actorId} phase=${report.phase} stage=${report.stage} severity=${report.severity} category=${report.category} report_id=${reportId} message=${message}`,
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
  ): Promise<ToolLoopActionResult> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    const turn = new ActionTurn(this.reception, request, turnId);
    try {
      const constraints = resolveTurnConstraints(request);
      const protocol = gameToolProtocol(this.world.locale);
      const loop = client.runToolLoop<ToolCall>(
        messages,
        protocol.specs,
        {
          onToolCall: async (invocation) => {
            if (controller.signal.aborted) {
              return { toolResult: toolFailure(this.world.locale, "turn_not_open_or_session_invalid") };
            }
            if (invocation.name === "get_game_schema") {
              return { toolResult: protocol.schema };
            }
            if (invocation.name === PlayerPromptSession.REPORT_BUG_TOOL) {
              const refusal = turn.authorize(invocation.args.turn_id ?? turnId, "report_bug");
              if (refusal) return { toolResult: this.recordRefusal(request, invocation.name, invocation.args, refusal) };
              return { toolResult: this.reportBug(request, invocation.args) };
            }

            let actionName = invocation.name;
            let actionArgs = invocation.args;
            if (invocation.name === "submit_action") {
              if (invocation.args.turn_id !== turnId) {
                return { toolResult: this.recordRefusal(request, invocation.name, invocation.args, turn.authorize(invocation.args.turn_id)!) };
              }
              if (typeof invocation.args.action !== "string") {
                return { toolResult: toolFailure(this.world.locale, "invalid_submit_action_arguments") };
              }
              actionName = invocation.args.action;
              if (!isRecord(invocation.args.arguments)) {
                return { toolResult: toolFailure(this.world.locale, "invalid_submit_action_arguments") };
              }
              actionArgs = invocation.args.arguments;
            }
            const receipt = turn.submit(turnId, actionName, actionArgs);
            if (!receipt.ok) {
              return { toolResult: this.recordRefusal(request, invocation.name, invocation.args, receipt) };
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
      const result = await Promise.race([
        loop,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            turn.close();
            controller.abort();
            reject(new Error(`llm_request_timeout_${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
      const thinkingText = this.observer.thinkingText(
        result.assistantText ?? "",
        result.thinkingTrace ?? [],
      );
      if (result.assistantText) {
        this.promptSession.appendAssistant(request.actorId, result.assistantText);
      }
      this.observer.thinking(result.thinkingTrace ?? [], request);
      this.observer.rawResponse(result.assistantText ?? "", request);
      return {
        action: turn.action,
        ...(thinkingText ? { thinkingText } : {}),
      };
    } finally {
      turn.close();
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
      input: { day: getActionRequestDay(request), stage: getActionRequestStage(request), tool, args },
      output: result,
    });
    this.observer.trace(`tool_call_rejected player=${request.actorId} tool=${tool} code=${result.error}`);
    return result;
  }

  private reportBug(request: ActionRequest, args: Record<string, unknown>): Record<string, unknown> {
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
