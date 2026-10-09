import { wildChildRequestScope } from "../../../game/mechanisms/roles/wild_child/lifecycle";
import { readWildChildTool } from "../../../game/mechanisms/roles/wild_child/state";
import { thiefRequestScope } from "../../../game/mechanisms/roles/thief/setup";
import { readThiefChoice } from "../../../game/mechanisms/roles/thief/state";
import { wallRequestScope } from "../../../game/mechanisms/events/wall_notes/authority";
import { z, type ZodType } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { readWallTool, text, toolFailure } from "@ai-werewolf-arena/game-text";
import {
  DEATH_SHOT_STAGES,
  type ActionRequest,
  type ToolCall,
  type ToolName,
} from "../../../core/domain";
import { World } from "../../../core/domain/world";
import { ActionValidator } from "../../../game/gateway/action_validator";
import { ToolGateway } from "../../../game/gateway/tool_gateway";
import {
  getDefaultToolCallRepairRegistry,
  getDefaultToolSpecRegistry,
  getDefaultToolValidationRuleRegistry,
  type ToolCallRepairRegistry,
  type ToolSpecRegistry,
  type ToolValidationRuleRegistry,
} from "../../../game/mechanisms";
import { evaluateTurnConstraints, resolveTurnConstraints } from "./turn_constraints";

export type ActionReceipt =
  | { ok: true; accepted: true; applied: false; action: ToolName }
  | {
      ok: false;
      error: string;
      message: string;
      details?: string[];
      expected_turn_id?: string;
      received_turn_id?: unknown;
    };
type Validation = { ok: true; action: ToolCall } | Extract<ActionReceipt, { ok: false }>;

/** Read-only preflight. The engine still owns application and resource consumption. */
export class ActionReception {
  private readonly schemas = new Map<ToolName, ZodType>();
  private readonly gateway: ToolGateway;

  constructor(
    readonly world: World,
    private readonly repair: ToolCallRepairRegistry = getDefaultToolCallRepairRegistry(),
    private readonly specs: ToolSpecRegistry = getDefaultToolSpecRegistry(),
    rules: ToolValidationRuleRegistry = getDefaultToolValidationRuleRegistry(),
  ) {
    // Preflight must not create a second domain validation operation in the Tape.
    this.gateway = new ToolGateway(new ActionValidator(rules, false));
  }

  validate(request: ActionRequest, name: string, rawArgs: unknown): Validation {
    const fail = (code: string) => toolFailure(this.world.locale, code);
    if (!request.allowedTools.includes(name as ToolName) || name === "report_bug") {
      return fail("tool_not_allowed_in_this_turn");
    }
    const tool = name as ToolName;
    const spec = this.specs.get(tool);
    if (!spec || rawArgs === null || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
      return fail("invalid_tool_arguments");
    }
    let schema = this.schemas.get(tool);
    if (!schema) {
      schema = z.fromJSONSchema(spec.parameters);
      this.schemas.set(tool, schema);
    }
    // Preserve the existing numeric-string repair, but never coerce booleans or
    // text by truthiness/String(), and never invent missing required arguments.
    const wallCall = tool === "write_note" ? readWallTool({ name: tool, args: rawArgs }) : null;
    if (tool === "write_note" && !wallCall) return fail(RuleError.WallNoteText);
    const thiefSlot = tool === "choose_thief_card" ? readThiefChoice(rawArgs) : undefined;
    if (tool === "choose_thief_card" && thiefSlot === undefined) return fail(RuleError.ThiefChoice);
    const wildCall =
      tool === "choose_wild_model" ? readWildChildTool({ name: tool, args: rawArgs }) : null;
    if (tool === "choose_wild_model" && !wildCall) return fail(RuleError.WildChildChoice);
    const input = (
      wildCall
        ? wildCall.args
        : tool === "choose_thief_card"
          ? { slot: thiefSlot }
          : wallCall
            ? wallCall.args
            : { ...rawArgs }
    ) as Record<string, unknown>;
    const properties = spec.parameters.properties as
      Record<string, { type?: string | string[] }> | undefined;
    for (const [key, value] of Object.entries(input)) {
      const type = properties?.[key]?.type;
      const numeric =
        type === "number" ||
        type === "integer" ||
        (Array.isArray(type) && (type.includes("number") || type.includes("integer")));
      if (numeric && typeof value === "string" && /^\d+$/.test(value)) input[key] = Number(value);
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail("invalid_tool_arguments");
    const args = this.repair.coerceArgs(tool, parsed.data as Record<string, unknown>, {
      actorId: request.actorId,
    });
    if (!args || !schema.safeParse(args).success) return fail("invalid_tool_arguments");
    const call = { name: tool, args } as ToolCall;
    const deathStage =
      DEATH_SHOT_STAGES.includes(request.context.stage) ||
      request.context.stage === "last_words" ||
      request.context.stage === "sheriff_badge_choice";
    const deathTool =
      (tool === "choose_badge_successor" &&
        request.context.stage === "sheriff_badge_choice" &&
        request.context.trigger === "badge_handoff") ||
      (tool === "shoot" &&
        DEATH_SHOT_STAGES.includes(request.context.stage) &&
        request.context.trigger === "on_death") ||
      (tool === "speak" &&
        request.context.stage === "last_words" &&
        request.context.trigger === "last_words");
    if (
      deathStage &&
      (!deathTool ||
        !this.world.hasDeathAction(
          request.actorId,
          tool,
          request.phase,
          request.context.day,
          request.context.death_action_id,
          request.context.ability_id,
        ))
    ) {
      return fail(RuleError.DeathActionUnavailable);
    }
    const checked = this.gateway.validateAndSanitize(this.world, request.actorId, call, {
      phase: request.phase,
      day: request.context.day,
      thiefScope: thiefRequestScope(this.world, request),
      wildChildScope: wildChildRequestScope(this.world, request),
      wallScope: wallRequestScope(this.world, request),
      wallId: request.context.wall_id,
      itemInstanceId: request.context.item_instance_id,
      debateId: request.context.debate_id,
      abilityId: request.context.ability_id,
      actionWindow: request.actionWindow,
      sheriffCandidates: request.context.sheriff_candidates,
      exileCandidates: request.context.exile_candidates,
      badgeCandidates: request.context.badge_candidates,
      allowSelfDestruct:
        request.allowedTools.includes("self_destruct") ||
        request.allowedTools.includes("self_destruct_with_target"),
      duelWindow: request.context.duel_window,
      allowKnightDuel:
        request.context.stage === request.context.duel_window &&
        request.allowedTools.includes("duel"),
      deathActionId: deathTool ? request.context.death_action_id : undefined,
    });
    if (!checked.ok || !checked.sanitizedCall) {
      return toolFailure(
        this.world.locale,
        checked.error ?? "invalid_tool_arguments",
        checked.message,
      );
    }
    const evaluation = evaluateTurnConstraints(
      { validActions: [checked.sanitizedCall] },
      resolveTurnConstraints(request),
      this.world.locale,
    );
    if (!evaluation.ok) {
      return { ...fail("turn_constraints_not_satisfied"), details: evaluation.errors };
    }
    return { ok: true, action: structuredClone(checked.sanitizedCall) };
  }
}

/** One owner per open turn. Rejection keeps it open; selection seals it once. */
export class ActionTurn {
  private selected: ToolCall | null = null;
  private closed = false;
  private rejectedActions = 0;
  constructor(
    private readonly reception: ActionReception,
    readonly request: ActionRequest,
    readonly turnId: string,
  ) {}

  get action(): ToolCall | null {
    return this.selected ? structuredClone(this.selected) : null;
  }
  get outcome(): { rejectedActions: number; failureCode: "turn_invalid_action_limit" | null } {
    return {
      rejectedActions: this.rejectedActions,
      failureCode:
        !this.selected &&
        this.request.context.action_failure_policy === "error" &&
        this.rejectedActions >= 3
          ? "turn_invalid_action_limit"
          : null,
    };
  }

  authorize(turnId: unknown, tool = "submit_action"): Extract<ActionReceipt, { ok: false }> | null {
    const locale = this.reception.world.locale;
    if (this.closed || this.selected || (this.request.deadlineAtMs ?? Infinity) <= Date.now()) {
      return toolFailure(locale, "turn_not_open_or_session_invalid");
    }
    if (this.outcome.failureCode) return toolFailure(locale, this.outcome.failureCode);
    if (turnId !== this.turnId) {
      return {
        ...toolFailure(locale, "turn_id_mismatch"),
        expected_turn_id: this.turnId,
        received_turn_id: typeof turnId === "string" ? turnId : null,
        message: text(locale, "tool.turn_id_mismatch_context", { turn: this.turnId, tool }),
      };
    }
    return null;
  }

  submit(turnId: unknown, name: unknown, args: unknown): ActionReceipt {
    const refusal = this.authorize(turnId);
    if (refusal) return refusal;
    if (
      typeof name !== "string" ||
      args === null ||
      typeof args !== "object" ||
      Array.isArray(args)
    ) {
      this.rejectedActions++;
      return toolFailure(this.reception.world.locale, "invalid_submit_action_arguments");
    }
    const result = this.reception.validate(this.request, name, args);
    if (!result.ok) {
      this.rejectedActions++;
      return result;
    }
    this.selected = result.action;
    return { ok: true, accepted: true, applied: false, action: result.action.name };
  }
  /** Schema rejection may happen before tool execution, but only the addressed live turn owns it. */
  rejectSubmissionInput(turnId: unknown): ActionReceipt {
    const refusal = this.authorize(turnId);
    if (refusal) return refusal;
    this.rejectedActions++;
    return toolFailure(this.reception.world.locale, "invalid_submit_action_arguments");
  }

  close(): void {
    this.closed = true;
  }
}
