/**
 * 负责有限猎魔人板的原生女巫行动、真实用药交付及夜间来源封存。
 * 输入为原 World、夜号、刀口、网关与 Provider；输出为行动回执、已付救／毒交付及封存来源。
 * 两条原毒分支在原 claim 创建位置附加 sourced intent，复用已捕获 source/target/day。
 * 保留瓶数付款、commit、交付缓存、事实发布与关闭的原次序；后续失败不回滚已提交前缀。
 * 新来源 metadata 与 life 句柄仅运行时使用，不加入事件、player DTO 或归档字段。
 */
import { recordPotionStock } from "../../domain/replay-fact-log";
import {
  COMPONENT,
  Phase,
  PotionType,
  StatusMark,
  settleRequestDelivery,
  type ActionProvider,
  type GameEvent,
  type World,
} from "../../domain";
import { StatusMarksComponent, statusMarkSnapshot } from "../../domain/components/status-marks";
import {
  captureNightLife,
  originalPoisonIntent,
  type NightPoisonClaim,
} from "../../domain/night-effects";
import type { ActionRequestFactoryConstructorPort } from "../../domain/actions";
import type { ToolGateway } from "../../engine/actions/tool-gateway";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { recordNightAbilityUse, type NightAbility } from "../night-abilities/inventory-ports";
import {
  openDemonWitchTurnFrame,
  demonHunterFreezeDay,
  demonWitchRequiredThisNight,
} from "./authority";
import {
  bindDemonWitchRequest,
  demonWitchRequestCurrent,
  readDemonPotionTool,
  demonWitchRequestTargetCurrent,
  demonWitchMarksSafe,
} from "./native-potion-requests";
import {
  captureDemonNativePoison,
  commitDemonNativePoison,
  freezeDemonNightSources,
  type DemonNightSources,
} from "./native-poison";
import {
  openNativePoisonContribution,
  commitNativePoisonContribution,
  sealNativePoisonContribution,
  lateUnknownPoisonContribution,
  type NativePoisonContributions,
} from "./poison-contribution";

import {
  openNativeHealContribution,
  commitNativeHealContribution,
  sealNativeHealContribution,
  lateUnknownHealContribution,
  type NativeHealContributions,
} from "./heal-contribution";
/** 已付救药的运行交付；原生命查询与贡献封存回调不能进入玩家 DTO 或归档。 */
interface DeliveredDemonHeal {
  readonly claim: Readonly<NightPoisonClaim>;
  readonly lateUnknown: () => boolean;
  readonly sealContribution: () => Readonly<NativeHealContributions>;
}
const deliveredHeals = new WeakMap<World, Map<number, Readonly<DeliveredDemonHeal>>>();
/**
 * 已付原生毒的运行交付；proof 仅在毒向猎魔人且原生免疫来源被登记时存在。
 * 普通原生毒仍保留 claim 与独立贡献；null proof 不表示没有付款或没有毒来源。
 */
export interface DeliveredDemonPoison {
  readonly proof: object | null;
  readonly claim: Readonly<NightPoisonClaim>;
  readonly lateUnknown: () => boolean;
  readonly sealContribution: () => Readonly<NativePoisonContributions>;
}
const nativeAddMark = StatusMarksComponent.prototype.add;
const delivered = new WeakMap<World, Map<number, Readonly<DeliveredDemonPoison> | null>>();
/**
 * 私有 token 对应的唯一封存账本，绑定原 World 与夜号。贡献在普通伤害清标记前捕获；
 * frozen 只在底层来源冻结成功后置位，后续构造失败也不恢复该 token 的可用性。
 */
interface Sealed {
  world: World;
  day: number;
  poison: Readonly<DeliveredDemonPoison> | null;
  contributions: Readonly<NativePoisonContributions> | null;
  heal: Readonly<DeliveredDemonHeal> | null;
  healContributions: Readonly<NativeHealContributions> | null;
  frozen: boolean;
}
const sealedSources = new WeakMap<object, Sealed>();
const sealedNights = new WeakMap<World, Set<number>>();
/** 本次行动交付结果；used 只区分用药与放弃，poison 不承载救药回执。 */
export interface DemonWitchTurnResult {
  readonly poison: Readonly<DeliveredDemonPoison> | null;
  readonly used: boolean;
}
/** 原有限猎魔人板中唯一原生女巫的执行路径；await 后复验原请求与目标，最终关闭交付窗口。 */
export async function executeDemonWitchTurn(input: {
  world: World;
  gateway: ToolGateway;
  events: GameEvent[];
  provider: ActionProvider;
  day: number;
  wolfTarget: number | null;
  /** 只在原 new 点读取；原 frame 开启／夜复位已发生，依赖不授予用药资格。 */
  construction: { readonly requestFactory: ActionRequestFactoryConstructorPort };
}): Promise<Readonly<DemonWitchTurnResult>> {
  const { world, gateway, events, provider, day, wolfTarget } = input,
    frame = openDemonWitchTurnFrame(world);
  if (!frame || frame.day !== day) throw new Error("demon_hunter_native_witch_unavailable");
  const ability = frame.ability as NightAbility<"potion">,
    scope = Object.freeze({});
  let closed = false;
  recordPotionStock(events, day, frame.witchId, "native:potion", ability.state);
  if (!world.entityIds().every((id) => demonWitchMarksSafe(world, id)))
    throw new Error("demon_hunter_native_marks_invalid");
  // frame 开启和 marks 检查先完成；原 new／bind 在 try 外，失败保留复位前缀，不加新的 finally。
  const request = new input.construction.requestFactory(world, events, day).create({
    phase: Phase.Night,
    actorId: frame.witchId,
    allowedTools: ["use_potion"],
    stage: "witch",
    requiresAction: true,
    summary: { key: "request.summary.night_action" },
    context: {
      ability_id: "native:potion",
      allow_fallback: false,
      action_failure_policy: "error",
      ...(ability.state.heal > 0 ? { wolf_target: wolfTarget } : {}),
    },
  });
  bindDemonWitchRequest(
    world,
    request,
    scope,
    () => !closed && frame.isCurrent(),
    frame.targetCurrent,
  );
  const authorized = () => demonWitchRequestCurrent(world, request);
  try {
    if (!authorized()) throw new Error("demon_hunter_native_witch_revoked");
    const raw = await provider.getAction(request);
    if (!authorized()) throw new Error("demon_hunter_native_witch_revoked");
    const call = readDemonPotionTool(raw);
    if (!call || !demonWitchRequestTargetCurrent(world, request, call.args.target_id))
      throw new Error("demon_hunter_native_witch_invalid");
    const candidateMarks = world.getComponent(call.args.target_id, COMPONENT.StatusMarks);
    if (
      candidateMarks &&
      (!statusMarkSnapshot(candidateMarks, StatusMark.PoisonMark) ||
        Object.getPrototypeOf(candidateMarks) !== StatusMarksComponent.prototype ||
        Object.getOwnPropertyDescriptor(candidateMarks, "has"))
    )
      throw new Error("demon_hunter_native_marks_invalid");
    const checked = gateway.validateAndSanitize(world, frame.witchId, call, {
      phase: Phase.Night,
      day,
      abilityId: "native:potion",
      deferOperation: true,
    });
    if (
      !checked.ok ||
      !checked.sanitizedCall ||
      !authorized() ||
      !demonWitchRequestTargetCurrent(world, request, call.args.target_id)
    )
      throw new Error("demon_hunter_native_witch_invalid");
    const targetId = call.args.target_id,
      potion = call.args.potion_type;
    const source = captureNightLife(world, frame.witchId),
      target = captureNightLife(world, targetId);
    if (!source || !target) throw new Error("demon_hunter_native_witch_revoked");
    Object.freeze(source);
    Object.freeze(target);
    let poison: Readonly<DeliveredDemonPoison> | null = null;
    const native =
      potion === PotionType.Poison && targetId === frame.demonId
        ? captureDemonNativePoison(world, frame.witchId, ability, targetId)
        : null;
    if (potion === PotionType.Poison && targetId === frame.demonId && !native)
      throw new Error("demon_hunter_native_poison_unavailable");
    let marks = world.getComponent(targetId, COMPONENT.StatusMarks);
    if (potion !== PotionType.None && !marks) {
      marks = new StatusMarksComponent();
      world.addComponent(targetId, COMPONENT.StatusMarks, marks);
    }
    const contribution =
      potion === PotionType.Poison && marks
        ? openNativePoisonContribution(world, targetId, marks)
        : null;
    const healContribution =
      potion === PotionType.Heal && marks
        ? openNativeHealContribution(world, targetId, marks)
        : null;
    // 先登记使用、写标记及扣瓶，再由 frame 核对真实库存提交；失败不伪造付款回滚。
    recordNightAbilityUse(ability, day, potion !== PotionType.None);
    if (potion !== PotionType.None) {
      nativeAddMark.call(
        marks!,
        potion === PotionType.Heal ? StatusMark.HealMark : StatusMark.PoisonMark,
      );
      ability.state[potion]--;
      ability.state[potion === PotionType.Heal ? "healUsedThisNight" : "poisonUsedThisNight"] =
        true;
    }
    recordPotionStock(events, day, frame.witchId, "native:potion", ability.state);
    if (!frame.commit(potion)) throw new Error("demon_hunter_native_witch_commit_failed");
    // frame 已提交后先登记真实贡献；随后 proof、交付或事实发布失败仍保留这段已付前缀。
    if (contribution) commitNativePoisonContribution(contribution);
    if (healContribution) {
      commitNativeHealContribution(healContribution);
      const heals = deliveredHeals.get(world) ?? new Map<number, Readonly<DeliveredDemonHeal>>();
      if (heals.has(day)) throw new Error("demon_hunter_native_witch_delivery_reentry");
      heals.set(
        day,
        Object.freeze({
          claim: Object.freeze({
            source,
            target,
            isCurrent: () => frame.sourceCurrent() && frame.targetCurrent(targetId),
          }),
          lateUnknown: () => lateUnknownHealContribution(healContribution),
          sealContribution: () => sealNativeHealContribution(healContribution),
        }),
      );
      deliveredHeals.set(world, heals);
    }
    if (native && contribution) {
      const proof = commitDemonNativePoison(native);
      if (!proof) throw new Error("demon_hunter_native_poison_commit_failed");
      poison = Object.freeze({
        proof,
        claim: Object.freeze(
          originalPoisonIntent(
            {
              source,
              target,
              isCurrent: () => frame.sourceCurrent() && frame.targetCurrent(targetId),
            },
            {
              family: "demon-witch",
              day,
              stage: "witch",
              actorLife: source,
              requestedTargetId: targetId,
              abilityId: "native:potion",
            },
          ),
        ),
        lateUnknown: () => lateUnknownPoisonContribution(contribution),
        sealContribution: () => sealNativePoisonContribution(contribution),
      });
    } else if (potion === PotionType.Poison) {
      // 普通原生毒不持有猎魔人免疫 proof；来源与后续独立毒贡献仍必须保留。
      poison = Object.freeze({
        proof: null,
        claim: Object.freeze(
          originalPoisonIntent(
            {
              source,
              target,
              isCurrent: () => frame.sourceCurrent() && frame.targetCurrent(targetId),
            },
            {
              family: "demon-witch",
              day,
              stage: "witch",
              actorLife: source,
              requestedTargetId: targetId,
              abilityId: "native:potion",
            },
          ),
        ),
        lateUnknown: () => lateUnknownPoisonContribution(contribution!),
        sealContribution: () => sealNativePoisonContribution(contribution!),
      });
    }
    const nights = delivered.get(world) ?? new Map<number, Readonly<DeliveredDemonPoison> | null>();
    if (nights.has(day)) throw new Error("demon_hunter_native_witch_delivery_reentry");
    nights.set(day, poison);
    delivered.set(world, nights);
    settleRequestDelivery(scope, true);
    safeRecordLogicOp({
      scope: "gateway",
      op: "validate_tool_call",
      actorId: frame.witchId,
      phase: Phase.Night,
      status: "ok",
      input: { tool: call.name, args: call.args },
    });
    events.push({
      timestamp: Date.now(),
      type: potion === PotionType.None ? "witch_potion_skipped" : "witch_potion_used",
      payload: {
        actorId: frame.witchId,
        targetId,
        potionType: potion,
      },
    } as GameEvent);
    return Object.freeze({ poison, used: potion !== PotionType.None });
  } finally {
    closed = true;
    settleRequestDelivery(scope, false);
  }
}

/** 在普通伤害清除标记前封存原交付贡献；返回仅本控制器登记的运行 token，同夜不得重封。 */
export function sealDeliveredDemonWitchSources(world: World, day: number): object {
  if (
    demonHunterFreezeDay(world) !== day ||
    (demonWitchRequiredThisNight(world) && !delivered.get(world)?.has(day))
  )
    throw new Error("demon_hunter_native_sources_missing");
  const seen = sealedNights.get(world) ?? new Set<number>();
  if (seen.has(day)) throw new Error("demon_hunter_native_sources_already_sealed");
  const poison = delivered.get(world)?.get(day) ?? null;
  const contributions = poison?.sealContribution() ?? null;
  const heal = deliveredHeals.get(world)?.get(day) ?? null,
    healContributions = heal?.sealContribution() ?? null;
  const token = Object.freeze({});
  sealedSources.set(token, {
    world,
    day,
    poison,
    contributions,
    heal,
    healContributions,
    frozen: false,
  });
  seen.add(day);
  sealedNights.set(world, seen);
  return token;
}
/** 冻结后的来源结果；救／毒覆盖只重算本控制器涉及的目标，不替代其它独立来源。 */
export interface DeliveredDemonNightSources extends DemonNightSources {
  readonly poisonOverrides: readonly Readonly<{ targetId: number; poison: boolean }>[];
  readonly healOverrides: readonly Readonly<{ targetId: number; heal: boolean }>[];
}
/**
 * 完整来源只取真实控制器与私有 token，不从 Tape 事实或调用方 metadata 恢复授权。
 * 先查询原来源当前性及迟到的独立贡献，再冻结底层毒／狩猎；底层成功后立即消费封存账本。
 * 猎魔人的原生毒免疫只抵消该原生贡献，unknown 或迟到独立毒继续参与目标的最终覆盖。
 */
export function freezeDeliveredDemonNightSources(
  world: World,
  token: object,
  faultId: string | null = null,
): Readonly<DeliveredDemonNightSources> {
  const sealed = sealedSources.get(token),
    day = demonHunterFreezeDay(world);
  if (!sealed || sealed.world !== world || sealed.day !== day || sealed.frozen)
    throw new Error("demon_hunter_native_sources_invalid");
  const poison = sealed.poison,
    contributions = sealed.contributions;
  const originalSourceCurrent = poison?.claim.isCurrent?.() === true;
  const lateUnknown = poison?.lateUnknown() ?? false;
  const healCurrent = sealed.heal?.claim.isCurrent?.() === true,
    lateHeal = sealed.heal?.lateUnknown() ?? false;
  const result = freezeDemonNightSources(world, poison?.proof ? [poison.proof] : [], faultId);
  sealed.frozen = true;
  const immunity =
    !!poison?.proof &&
    contributions?.native === true &&
    originalSourceCurrent &&
    result.poisonImmunities.length === 1;
  return Object.freeze({
    hunt: result.hunt,
    healOverrides: Object.freeze(
      sealed.heal && sealed.healContributions
        ? [
            Object.freeze({
              targetId: sealed.heal.claim.target.id,
              heal:
                sealed.healContributions.unknown ||
                lateHeal ||
                (sealed.healContributions.native && healCurrent),
            }),
          ]
        : [],
    ),
    poisonImmunities: Object.freeze(immunity ? [...result.poisonImmunities] : []),
    poisonOverrides: Object.freeze(
      poison && contributions
        ? [
            Object.freeze({
              targetId: poison.claim.target.id,
              poison:
                contributions.unknown ||
                lateUnknown ||
                (contributions.native && originalSourceCurrent && !immunity),
            }),
          ]
        : [],
    ),
  });
}
