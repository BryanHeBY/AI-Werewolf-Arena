/**
 * Owns action submission preflight from allowed tools, machine schemas and repair data.
 * Inputs are requests and raw tool arguments; outputs are detached sanitized actions
 * or the existing structured refusals. Feature owners retain their scope predicates;
 * this validator never commits inventory or settles domain completion, and suppresses
 * a second validation Tape operation. Tool registration checks do not replace this
 * original lazy parameter read, first-use schema cache or argument/feature preflight.
 * The legacy ActionTurn export names its real owner.
 */
import { nobleBodyRequestScope } from "../../../game/mechanisms/roles/noble_secret_body/requests";
import { animalRequestScope } from "../../../game/mechanisms/roles/animal_dream/requests";
import { fragrantPairRequestScope } from "../../../game/mechanisms/roles/fragrant_pair_seer/requests";
import {
  demonWitchRequestTargetCurrent,
  demonWitchRequestCurrent,
  readDemonNativeNightTool,
  readDemonPotionTool,
} from "../../../game/mechanisms/roles/demon_hunter/native_potion_requests";
import {
  demonHunterRequestScope,
  canSubmitDemonHunt,
  demonHunterActorId,
} from "../../../game/mechanisms/roles/demon_hunter/authority";
import { readDemonHuntTool } from "../../../game/mechanisms/roles/demon_hunter/state";
import {
  ghostBrideRequestScope,
  weddingSetup,
} from "../../../game/mechanisms/roles/ghost_bride/authority";
import { readWeddingTool } from "@ai-werewolf-arena/game-text";
import { lonelyGirlRequestScope } from "../../../game/mechanisms/roles/lonely_girl/lifecycle";
import { readLonelyGirlTool } from "../../../game/mechanisms/roles/lonely_girl/state";
import { wildChildRequestScope } from "../../../game/mechanisms/roles/wild_child/lifecycle";
import { readWildChildTool } from "../../../game/mechanisms/roles/wild_child/state";
import { shapeshifterRequestScope } from "../../../game/mechanisms/roles/shapeshifter/setup";
import { thiefRequestScope } from "../../../game/mechanisms/roles/thief/setup";
import { readThiefChoice } from "../../../game/mechanisms/roles/thief/state";
import { wallRequestScope } from "../../../game/mechanisms/events/wall_notes/authority";
import { z, type ZodType } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { readWallTool, toolFailure } from "@ai-werewolf-arena/game-text";
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
  getDefaultToolValidationRuleRegistry,
  type ToolCallRepairRegistry,
  type ToolValidationRuleRegistry,
} from "../../../game/mechanisms";
import {
  getDefaultToolSpecRegistry,
  type ToolSpecRegistry,
} from "../../../game/mechanisms/registries/tool_spec_registry";
import { evaluateTurnConstraints, resolveTurnConstraints } from "./turn_constraints";
import type { ActionValidation as Validation } from "./action-turn";
export { ActionTurn } from "./action-turn";
export type { ActionReceipt } from "./action-turn";

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
    const initialChoice = tool === "choose_thief_card" || tool === "choose_shapeshifter_card";
    const thiefSlot = initialChoice ? readThiefChoice(rawArgs) : undefined;
    if (initialChoice && thiefSlot === undefined)
      return fail(
        tool === "choose_thief_card" ? RuleError.ThiefChoice : RuleError.ShapeshifterChoice,
      );
    if (tool === "choose_admired_player" && !readLonelyGirlTool({ name: tool, args: rawArgs }))
      return fail(RuleError.LonelyGirlChoice);
    const wildCall =
      tool === "choose_wild_model" ? readWildChildTool({ name: tool, args: rawArgs }) : null;
    if (tool === "choose_wild_model" && !wildCall) return fail(RuleError.WildChildChoice);
    const weddingTool =
      [
        "choose_bridegroom",
        "choose_wedding_witness",
        "speak_to_partner",
        "wedding_kill_vote",
      ].includes(tool) ||
      (tool === "kill_vote" && weddingSetup(this.world) !== null);
    const weddingCall = weddingTool ? readWeddingTool({ name: tool, args: rawArgs }) : null;
    if (weddingTool && !weddingCall) return fail(RuleError.GhostBrideChoice);
    const demonCall =
      name === "demon_hunt" ? readDemonHuntTool({ name: tool, args: rawArgs }) : null;
    if (
      name === "demon_hunt" &&
      (!demonCall ||
        !canSubmitDemonHunt(
          this.world,
          request.actorId,
          request.phase,
          request.context.day,
          demonHunterRequestScope(this.world, request),
          demonCall,
        ))
    )
      return fail(RuleError.ToolMismatch);
    const demonNative =
      (tool === "check_identity" || tool === "guard") && demonHunterActorId(this.world) !== null;
    const nativeCall = demonNative ? readDemonNativeNightTool({ name: tool, args: rawArgs }) : null;
    if (
      demonNative &&
      (!nativeCall ||
        !demonWitchRequestCurrent(this.world, request) ||
        (nativeCall.args.target_id !== null &&
          !demonWitchRequestTargetCurrent(this.world, request, nativeCall.args.target_id)))
    )
      return fail(RuleError.ToolMismatch);
    const demonWitch = tool === "use_potion" && demonHunterActorId(this.world) !== null;
    const potionCall = demonWitch ? readDemonPotionTool({ name: tool, args: rawArgs }) : null;
    if (
      demonWitch &&
      (!potionCall ||
        !demonWitchRequestTargetCurrent(this.world, request, potionCall.args.target_id))
    )
      return fail(RuleError.ToolMismatch);
    const input = (
      potionCall
        ? potionCall.args
        : demonCall
          ? demonCall.args
          : weddingCall
            ? weddingCall.args
            : wildCall
              ? wildCall.args
              : initialChoice
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
      shapeshifterScope: shapeshifterRequestScope(this.world, request),
      lonelyGirlScope: lonelyGirlRequestScope(this.world, request),
      ghostBrideScope: ghostBrideRequestScope(this.world, request),
      demonHunterScope: demonHunterRequestScope(this.world, request),
      nobleBodyScope: nobleBodyRequestScope(this.world, request),
      fragrantPairScope: fragrantPairRequestScope(this.world, request),
      animalScope: animalRequestScope(this.world, request),
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
