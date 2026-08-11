import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, ToolCall } from "../../../core/domain/model";
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../core/domain/action_request_context";
import { World } from "../../../core/domain/world";
import {
  getDefaultToolValidationRuleRegistry,
  ToolValidationRuleRegistry,
} from "../../../game/mechanisms";
import { AgentBugReportService } from "../reporting/bug_report_service";
import { WEREWOLF_GAME_TOOL_SCHEMA, WEREWOLF_GAME_TOOL_SPECS } from "../game_tool_protocol";
import { ActionValidationService } from "./action_validation_service";
import { LegacyResponseInterpreter } from "./legacy_response_interpreter";
import { LlmObserver } from "./llm_observer";
import { ChatMessage, ChatModelClient, ToolLoopActionResult } from "./model_client";
import { PlayerPromptSession } from "./player_prompt_session";
import { evaluateTurnConstraints, resolveTurnConstraints } from "./turn_constraints";

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
    private readonly interpreter: LegacyResponseInterpreter,
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
    if (!client.runToolLoop) return { action: null };
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
      const constraints = resolveTurnConstraints(request);
      let selectedAction: ToolCall | null = null;
      const loop = client.runToolLoop<ToolCall>(
        messages,
        WEREWOLF_GAME_TOOL_SPECS,
        {
          onToolCall: async (invocation) => {
            if (invocation.name === "get_game_schema") {
              return { toolResult: WEREWOLF_GAME_TOOL_SCHEMA };
            }
            if (invocation.name === PlayerPromptSession.REPORT_BUG_TOOL) {
              if (typeof invocation.args.turn_id === "string" && invocation.args.turn_id !== turnId) {
                return { toolResult: { ok: false, error: "turn_not_open_or_session_invalid" } };
              }
              return { toolResult: this.reportBug(request, invocation.args) };
            }

            let actionName = invocation.name;
            let actionArgs = invocation.args;
            if (invocation.name === "submit_action") {
              if (invocation.args.turn_id !== turnId) {
                return { toolResult: { ok: false, error: "turn_not_open_or_session_invalid" } };
              }
              if (typeof invocation.args.action !== "string") {
                return { toolResult: { ok: false, error: "invalid_submit_action_arguments" } };
              }
              actionName = invocation.args.action;
              actionArgs = isRecord(invocation.args.arguments) ? invocation.args.arguments : {};
            }
            if (selectedAction) {
              return {
                toolResult: {
                  ok: false,
                  error: "turn_constraints_max_actions_exceeded",
                  details: [`本轮最多允许${constraints.maxValidActions}次有效行动。`],
                },
              };
            }
            const validated = this.actionValidation.validateToolInvocation(
              request,
              request.allowedTools,
              { name: actionName, args: actionArgs },
              (raw, allowedTools, actorId) => this.interpreter.parse(raw, allowedTools, actorId),
            );
            if (!validated.ok) {
              return { toolResult: { ok: false, error: validated.error } };
            }
            const action = validated.action;
            const stateError = action.name === "use_potion"
              ? this.validateStatefulAction(request, action)
              : null;
            if (stateError) return { toolResult: { ok: false, error: stateError } };

            const evaluation = evaluateTurnConstraints({ validActions: [action] }, constraints);
            if (!evaluation.ok) {
              return {
                toolResult: {
                  ok: false,
                  error: "turn_constraints_not_satisfied",
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

  private validateStatefulAction(request: ActionRequest, action: ToolCall): string | null {
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
      : "非法操作，玩家角色不存在";
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
