/**
 * 负责完整行动接收预检：允许工具、首用 JSON schema、原参数修复、机制请求作用域和领域规则。
 * 输入为同一 World、原请求与外来工具参数；输出为脱离后的合法候选或原结构化拒绝。
 * 每实例只持有原 schema 缓存和不写第二 Tape 校验的 Gateway；schema 与具体 scope 仍按原时点晚读。
 * 本 owner 不消耗库存、提交领域动作或 settle 完成责任；选择／截止窗口由 AI ActionTurn 独立拥有。
 */
import { nobleBodyRequestScope } from "../mechanisms/roles/noble_secret_body/ports";
import { animalRequestScope } from "../mechanisms/roles/animal_dream/ports";
import { fragrantPairRequestScope } from "../mechanisms/roles/fragrant_pair_seer/ports";
import {
  demonWitchRequestTargetCurrent,
  demonWitchRequestCurrent,
  readDemonNativeNightTool,
  readDemonPotionTool,
} from "../mechanisms/roles/demon_hunter/ports";
import {
  demonHunterRequestScope,
  canSubmitDemonHunt,
  demonHunterActorId,
} from "../mechanisms/roles/demon_hunter/ports";
import { readDemonHuntTool } from "../mechanisms/roles/demon_hunter/ports";
import {
  ghostBrideRequestScope,
  weddingSetup,
} from "../mechanisms/roles/ghost_bride/ports";
import { readWeddingTool } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { lonelyGirlRequestScope } from "../mechanisms/roles/lonely_girl/ports";
import { readLonelyGirlTool } from "../mechanisms/roles/lonely_girl/ports";
import { wildChildRequestScope } from "../mechanisms/roles/wild_child/ports";
import { readWildChildTool } from "../mechanisms/roles/wild_child/ports";
import { shapeshifterRequestScope } from "../mechanisms/roles/shapeshifter/ports";
import { thiefRequestScope } from "../mechanisms/roles/thief/ports";
import { readThiefChoice } from "../mechanisms/roles/thief/ports";
import { wallRequestScope } from "../mechanisms/events/wall_notes/ports";
import { z, type ZodType } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { readWallTool } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import {
  DEATH_SHOT_STAGES,
  type ActionRequest,
  type ToolCall,
  type ToolName,
} from "../../domain";
import { World } from "../../domain/world";
import { ActionValidator } from "./action_validator";
import { ToolGateway } from "./tool_gateway";
import {
  getDefaultToolCallRepairRegistry,
  getDefaultToolValidationRuleRegistry,
  type ToolCallRepairRegistry,
  type ToolValidationRuleRegistry,
} from "../mechanisms";
import {
  getDefaultToolSpecRegistry,
  type ToolSpecRegistry,
} from "../mechanisms/registries/tool_spec_registry";
import { evaluateTurnConstraints, resolveTurnConstraints } from "./turn-constraints";
import type { Locale } from "@ai-werewolf-arena/game-contract";

/** 只描述预检结果，不表示领域已付款或生效；可选回合字段保留原拒绝结构接受集合。 */
export type GameActionValidation =
  | { ok: true; action: ToolCall }
  | {
      ok: false;
      error: string;
      message: string;
      details?: string[];
      expected_turn_id?: string;
      received_turn_id?: unknown;
    };

/**
 * 选择窗口的类型接口只声明原 locale 与预检函数，不提供写方法或领域完成接口。
 * 运行对象仍是原接收器和 World；这是消费契约，不是新的进程隔离或运行权限屏障。
 */
export interface ActionPreflightPort {
  readonly world: { readonly locale: Locale };
  validate(request: ActionRequest, name: string, rawArgs: unknown): GameActionValidation;
}
type Validation = GameActionValidation;

/** 预检只形成候选；实际应用与资源消费仍由引擎和具体机制提交。 */
export class ActionReception {
  private readonly schemas = new Map<ToolName, ZodType>();
  private readonly gateway: ToolGateway;

  constructor(
    readonly world: World,
    private readonly repair: ToolCallRepairRegistry = getDefaultToolCallRepairRegistry(),
    private readonly specs: ToolSpecRegistry = getDefaultToolSpecRegistry(),
    rules: ToolValidationRuleRegistry = getDefaultToolValidationRuleRegistry(),
  ) {
    // 这里仍关闭领域校验的 Tape 记录，避免接收预检制造第二次 validation 操作。
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
    // 同一工具只在首个合法参数形态的调用建立 schema；建图失败不先写缓存，后续 properties 仍原位读取。
    let schema = this.schemas.get(tool);
    if (!schema) {
      schema = z.fromJSONSchema(spec.parameters);
      this.schemas.set(tool, schema);
    }
    // 保留原数字字符串修复；不把布尔／文本按 truthiness 或 String() 宽转，也不补缺少的必填参数。
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
    // 机制 scope 按下面原字段顺序逐个读取；不提前缓存请求许可或绕过 Gateway 的提交前规则。
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
    // 已接受的是脱离的候选，不是领域 commit；库存、租约完成和实际效果仍要在原 owner 重验。
    return { ok: true, action: structuredClone(checked.sanitizedCall) };
  }
}
