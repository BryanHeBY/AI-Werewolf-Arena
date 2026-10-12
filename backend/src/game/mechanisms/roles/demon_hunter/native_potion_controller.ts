/**
 * Owns delivered Demon Witch source receipts and native potion-turn execution. Inputs are sealed
 * source bodies, potion requests and validated choices; outputs are paid heal/poison effects and
 * domain completion. Cancellation or stale sources never replenish stock or substitute a new
 * body into a delivered effect.
 */
import {
  COMPONENT,
  Phase,
  PotionType,
  StatusMark,
  settleRequestDelivery,
  type ActionProvider,
  type GameEvent,
  type World,
} from "../../../../core";
import {
  StatusMarksComponent,
  statusMarkSnapshot,
} from "../../../../core/domain/components/status_marks";
import { captureNightLife, type NightPoisonClaim } from "../../../../core/domain/night_effects";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import { recordNightAbilityUse, type NightAbility } from "../abilities";
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
} from "./native_potion_requests";
import {
  captureDemonNativePoison,
  commitDemonNativePoison,
  freezeDemonNightSources,
  type DemonNightSources,
} from "./native_poison";
import {
  openNativePoisonContribution,
  commitNativePoisonContribution,
  sealNativePoisonContribution,
  lateUnknownPoisonContribution,
  type NativePoisonContributions,
} from "./poison_contribution";

import {
  openNativeHealContribution,
  commitNativeHealContribution,
  sealNativeHealContribution,
  lateUnknownHealContribution,
  type NativeHealContributions,
} from "./heal_contribution";
interface DeliveredDemonHeal {
  readonly claim: Readonly<NightPoisonClaim>;
  readonly lateUnknown: () => boolean;
  readonly sealContribution: () => Readonly<NativeHealContributions>;
}
const deliveredHeals = new WeakMap<World, Map<number, Readonly<DeliveredDemonHeal>>>();
export interface DeliveredDemonPoison {
  readonly proof: object | null;
  readonly claim: Readonly<NightPoisonClaim>;
  readonly lateUnknown: () => boolean;
  readonly sealContribution: () => Readonly<NativePoisonContributions>;
}
const nativeAddMark = StatusMarksComponent.prototype.add;
const delivered = new WeakMap<World, Map<number, Readonly<DeliveredDemonPoison> | null>>();
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
export interface DemonWitchTurnResult {
  readonly poison: Readonly<DeliveredDemonPoison> | null;
  readonly used: boolean;
}
/** Explicit candidate runtime path for the one original Witch in the finite Demon boards. */
export async function executeDemonWitchTurn(input: {
  world: World;
  gateway: ToolGateway;
  events: GameEvent[];
  provider: ActionProvider;
  day: number;
  wolfTarget: number | null;
}): Promise<Readonly<DemonWitchTurnResult>> {
  const { world, gateway, events, provider, day, wolfTarget } = input,
    frame = openDemonWitchTurnFrame(world);
  if (!frame || frame.day !== day) throw new Error("demon_hunter_native_witch_unavailable");
  const ability = frame.ability as NightAbility<"potion">,
    scope = Object.freeze({});
  let closed = false;
  if (!world.entityIds().every((id) => demonWitchMarksSafe(world, id)))
    throw new Error("demon_hunter_native_marks_invalid");
  const request = new GameActionRequestFactory(world, events, day).create({
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
    if (!frame.commit(potion)) throw new Error("demon_hunter_native_witch_commit_failed");
    // Cache real consumption before proof/event recording can fail.
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
        claim: Object.freeze({
          source,
          target,
          isCurrent: () => frame.sourceCurrent() && frame.targetCurrent(targetId),
        }),
        lateUnknown: () => lateUnknownPoisonContribution(contribution),
        sealContribution: () => sealNativePoisonContribution(contribution),
      });
    } else if (potion === PotionType.Poison) {
      // The ordinary native toxin has no Demon-immunity proof.
      poison = Object.freeze({
        proof: null,
        claim: Object.freeze({
          source,
          target,
          isCurrent: () => frame.sourceCurrent() && frame.targetCurrent(targetId),
        }),
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

/** Original controller ledger is sealed before ordinary DamageResolution clears marks. */
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
export interface DeliveredDemonNightSources extends DemonNightSources {
  readonly poisonOverrides: readonly Readonly<{ targetId: number; poison: boolean }>[];
  readonly healOverrides: readonly Readonly<{ targetId: number; heal: boolean }>[];
}
/** Complete source set comes from the actual controller, never Tape facts or caller-supplied source metadata. */
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
