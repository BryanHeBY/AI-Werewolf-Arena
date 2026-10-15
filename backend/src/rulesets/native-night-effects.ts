/**
 * 负责绑定原生已付效果命令与原延迟控制器。输入为原阶段上下文、回执／能力和延迟参数；
 * 输出保原付款前缀、增益事实及反射；命令绑定本身不读 World、事件、状态或来源，也不授权新资格。
 * 反射先取原提交 callee，再读取 World、本族同夜 binding、source 和种类；原状态命令负责资格与消费。
 * 原 context／receipt receiver 与每次读取点保持，不增加退款、复制或序列化运行句柄。
 */
import { Role } from "../domain/identity";
import type { NightLifeScope } from "../domain/night-effects";
import type { NightStageContext } from "../game/mechanisms/stages/night/contracts";
import type { NightAbilityReadView } from "../game/mechanisms/roles/abilities";
import {
  isScholarMentorBoard,
  recordScholarMentorNativeTarget,
  scholarMentorKnifeEligible,
} from "../game/mechanisms/roles/scholar_mentor/ports";
import {
  isEvilKnightBoard,
  commitEvilKnightReflection,
  evilKnightNightBinding,
} from "../game/mechanisms/roles/evil_knight/ports";
import {
  commitTimeConsortEffect,
  type TimeConsortReceipt,
} from "../game/mechanisms/roles/time_wolf_consort/ports";
import {
  loadDemonNativeNightController,
  loadDemonNativePotionController,
} from "../game/mechanisms/roles/demon_hunter/ports";
import type { NativeReflectedTarget } from "./native-night-target-policy";

export interface NativeNightEffects {
  commitReflectedTarget(
    receipt: NativeReflectedTarget | null,
    day: number,
    sourceId: number,
    kind: "check" | "guard" | "poison",
  ): void;
  recordModifierTarget(
    day: number,
    actorId: number,
    kind: "check" | "guard" | "poison",
    targetId: () => number | null,
  ): void;
  recordKnifeModifierTarget(targetId: () => number | null): void;
  commitNativeReflection(
    kind: "seer_check" | "poison",
    ability: NightAbilityReadView<"seer_check" | "potion">,
    targetId: number,
    source: () => NightLifeScope,
    isCurrent: () => boolean,
  ): void;
  loadSealedNightController: typeof loadDemonNativeNightController;
  loadSealedPotionController: typeof loadDemonNativePotionController;
}

/** 同一阶段上下文仍在原命令调用点交给已付效果命令，不复制引用或提前读取。 */
export function bindNativeNightEffects(context: () => NightStageContext): NativeNightEffects {
  return Object.freeze({
    commitReflectedTarget(
      receipt: NativeReflectedTarget | null,
      day: number,
      sourceId: number,
      kind: "check" | "guard" | "poison",
    ) {
      commitTimeConsortEffect(context(), receipt as TimeConsortReceipt | null, day, sourceId, kind);
    },
    recordModifierTarget(
      day: number,
      actorId: number,
      kind: "check" | "guard" | "poison",
      targetId: () => number | null,
    ) {
      if (isScholarMentorBoard(context().world))
        recordScholarMentorNativeTarget(context().world, day, actorId, kind, targetId());
    },
    recordKnifeModifierTarget(targetId: () => number | null) {
      if (isScholarMentorBoard(context().world)) {
        const actor = context()
          .world.getAliveEntityIds()
          .find((id) => scholarMentorKnifeEligible(context().world, context().currentDay(), id));
        if (actor !== undefined)
          recordScholarMentorNativeTarget(
            context().world,
            context().currentDay(),
            actor,
            "kill",
            targetId(),
          );
      }
    },
    commitNativeReflection(
      kind: "seer_check" | "poison",
      ability: NightAbilityReadView<"seer_check" | "potion">,
      targetId: number,
      source: () => NightLifeScope,
      isCurrent: () => boolean,
    ) {
      if (isEvilKnightBoard(context().world)) {
        if (
          ability.source.kind !== "native" ||
          ability.source.role !== (kind === "seer_check" ? Role.Seer : Role.Witch)
        )
          throw new Error(
            kind === "seer_check"
              ? "evil_knight_seer_source_invalid"
              : "evil_knight_witch_source_invalid",
          );
        const reflection = commitEvilKnightReflection(
          context().world,
          evilKnightNightBinding(context().state, targetId),
          source(),
          kind,
          isCurrent,
        );
        if (reflection) (context().state.retaliationAttacks ??= []).push(reflection);
      }
    },
    loadSealedNightController: loadDemonNativeNightController,
    loadSealedPotionController: loadDemonNativePotionController,
  });
}
