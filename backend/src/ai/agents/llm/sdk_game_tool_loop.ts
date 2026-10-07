import { RuleError, type RuleViolation } from "@ai-werewolf-arena/game-catalog";
import { text, toolFailure } from "@ai-werewolf-arena/game-text";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, ToolCall } from "../../../core/domain"
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../core/domain/action_request_context";
import { World } from "../../../core/domain/world";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import {
  getDefaultToolValidationRuleRegistry,
  ToolValidationRuleRegistry,
} from "../../../game/mechanisms";
import { AgentBugReportService } from "../reporting/bug_report_service";
import { gameToolProtocol } from "../game_tool_protocol";
import { ActionValidationService } from "./action_validation_service";
import { ToolCallRepairRegistry } from "../../../game/mechanisms";
import { LlmObserver } from "./llm_observer";
import { ChatMessage, ChatModelClient } from "../../integrations/llm/transport";
import { PlayerPromptSession } from "./player_prompt_session";
import { evaluateTurnConstraints, resolveTurnConstraints } from "../player/turn_constraints";

interface ToolLoopActionResult {
  action: ToolCall | null;
  thinkingText?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Native SDK implementation of the shared werewolf game tool protocol. */
export class SdkGameToolLoop {
  private readonly actionValidation = new ActionValidationService();
  private readonly stateValidation: ToolValidationRuleRegistry;
  private readonly bugReports: AgentBugReportService;

  constructor(
    private readonly world: World,
    private readonly repairRegistry: ToolCallRepairRegistry,
    private readonly promptSession: PlayerPromptSession,
    private readonly observer: LlmObserver,
  ) {
    this.stateValidation = getDefaultToolValidationRuleRegistry();
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
    try {
      const constraints = resolveTurnConstraints(request);
      const protocol = gameToolProtocol(this.world.locale);
      let selectedAction: ToolCall | null = null;
      const loop = client.runToolLoop<ToolCall>(
        messages,
        protocol.specs,
        {
          onToolCall: async (invocation) => {
            if (invocation.name === "get_game_schema") {
              return { toolResult: protocol.schema };
            }
            if (invocation.name === PlayerPromptSession.REPORT_BUG_TOOL) {
              if (typeof invocation.args.turn_id === "string" && invocation.args.turn_id !== turnId) {
                return { toolResult: this.rejectTurnId(request, invocation.name, invocation.args, turnId) };
              }
              return { toolResult: this.reportBug(request, invocation.args) };
            }

            let actionName = invocation.name;
            let actionArgs = invocation.args;
            if (invocation.name === "submit_action") {
              if (invocation.args.turn_id !== turnId) {
                return { toolResult: this.rejectTurnId(request, invocation.name, invocation.args, turnId) };
              }
              if (typeof invocation.args.action !== "string") {
                return { toolResult: toolFailure(this.world.locale, "invalid_submit_action_arguments") };
              }
              actionName = invocation.args.action;
              actionArgs = isRecord(invocation.args.arguments) ? invocation.args.arguments : {};
            }
            if (selectedAction) {
              return {
                toolResult: {
                  ...toolFailure(this.world.locale, "turn_constraints_max_actions_exceeded"),
                  details: [text(this.world.locale, "turn.maximum", { count: constraints.maxValidActions })],
                },
              };
            }
            const validated = this.actionValidation.validateToolInvocation(
              request,
              request.allowedTools,
              { name: actionName, args: actionArgs },
              (tool, rawArgs, actorId) => this.repairRegistry.coerceArgs(tool, rawArgs, { actorId }),
            );
            if (!validated.ok) {
              return { toolResult: toolFailure(this.world.locale, validated.error) };
            }
            const action = validated.action;
            const stateError = action.name === "use_potion"
              ? this.validateStatefulAction(request, action)
              : null;
            if (stateError) return { toolResult: toolFailure(this.world.locale, stateError.code, stateError.message) };

            const evaluation = evaluateTurnConstraints({ validActions: [action] }, constraints, this.world.locale);
            if (!evaluation.ok) {
              return {
                toolResult: {
                  ...toolFailure(this.world.locale, "turn_constraints_not_satisfied"),
                  details: evaluation.errors,
                },
              };
            }
            selectedAction = action;
            return {
              toolResult: { ok: true, accepted: true, action: action.name },
              finalAction: action,
            };
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
        action: result.finalAction ?? null,
        ...(thinkingText ? { thinkingText } : {}),
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private rejectTurnId(
    request: ActionRequest,
    tool: string,
    args: Record<string, unknown>,
    expectedTurnId: string,
  ): Record<string, unknown> {
    const result = {
      ok: false,
      error: "turn_id_mismatch",
      expected_turn_id: expectedTurnId,
      received_turn_id: args.turn_id ?? null,
      message: text(this.world.locale, "tool.turn_id_mismatch_context", { turn: expectedTurnId, tool }),
    };
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
    this.observer.trace(`tool_call_rejected player=${request.actorId} tool=${tool} expected_turn_id=${expectedTurnId} received_turn_id=${JSON.stringify(args.turn_id ?? null)}`);
    return result;
  }

  private validateStatefulAction(request: ActionRequest, action: ToolCall): RuleViolation | null {
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    return role
      ? this.stateValidation.validate({
          world: this.world,
          actorId: request.actorId,
          role,
          toolCall: action,
          phase: request.phase,
          actionWindow: request.actionWindow,
        })
      : { code: RuleError.ActorRoleMissing };
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
