/**
 * 负责组合原生夜间的目标映射、反射及药剂请求提示。输入为延迟的上下文、日次和目标读取，
 * 输出保留原目标与回执引用；类型视图不声明 commit，但不复制、冻结对象或移除其运行字段。
 * 板子检查与 resolver 参数仍在原时点求值；绑定时不选择 actor、快照库存或调用这些 getter。
 * 请求提示不授予权限，已付回执的消费仍归独立原生效果端口。
 */
import type { NightStageContext } from "../game/mechanisms/stages/night/contracts";
import type { NightLifeScope } from "../domain/night-effects";
import type { AliveComponent } from "../domain/components/alive";
import {
  isMagicianBoard,
  resolveMagicianNightTarget,
  type MagicianResolvedTarget,
} from "../game/mechanisms/roles/magician/ports";
import {
  isTimeConsortBoard,
  resolveTimeConsortTarget,
  type TimeConsortReceipt,
} from "../game/mechanisms/roles/time_wolf_consort/ports";
import {
  isScholarMentorBoard,
  scholarMentorBlocks,
} from "../game/mechanisms/roles/scholar_mentor/ports";

// readonly／Omit 仅限制此 TypeScript 查询视图；life、scope 与回执仍为原运行对象。
export type NativeTargetScope = Readonly<Omit<NightLifeScope, "life">> & {
  readonly life: Readonly<AliveComponent>;
};
export type NativeMappedTarget = Omit<MagicianResolvedTarget, "scope"> & {
  readonly scope: NativeTargetScope;
};
export type NativeReflectedTarget = Omit<TimeConsortReceipt, "commit" | "scope"> & {
  readonly scope: NativeTargetScope;
};

export interface NativeNightTargetPolicy {
  mappedTarget(day: () => number, targetId: () => number): NativeMappedTarget | null;
  reflectedTarget(
    day: () => number,
    sourceId: () => number,
    targetId: () => number,
    kind: "check" | "guard" | "poison",
  ): NativeReflectedTarget | null;
  potionModifierHints(actorId: number): { modifier_poison_blocked?: boolean };
  potionKnifeHints(): { wolf_targets?: number[] };
}

type TargetRuntime = Pick<NightStageContext, "world" | "currentDay" | "state">;

/** 即使日次或目标来自访问器，也只在对应板子分支命中后调用委托；绑定时不提前求值。 */
export function bindNativeNightTargetPolicy(context: () => TargetRuntime): NativeNightTargetPolicy {
  return Object.freeze({
    mappedTarget(day: () => number, targetId: () => number) {
      return isMagicianBoard(context().world)
        ? resolveMagicianNightTarget(context().world, day(), targetId())
        : null;
    },
    reflectedTarget(
      day: () => number,
      sourceId: () => number,
      targetId: () => number,
      kind: "check" | "guard" | "poison",
    ) {
      return isTimeConsortBoard(context().world)
        ? resolveTimeConsortTarget(context().world, day(), sourceId(), targetId(), kind)
        : null;
    },
    potionModifierHints(actorId: number) {
      return isScholarMentorBoard(context().world)
        ? {
            modifier_poison_blocked: scholarMentorBlocks(
              context().world,
              context().currentDay(),
              actorId,
              "poison",
            ),
          }
        : {};
    },
    // 仅学者导师板子读取原刀目标与附加刀；去重保首次出现次序，提示不消费伤害或回执。
    potionKnifeHints() {
      return isScholarMentorBoard(context().world)
        ? {
            wolf_targets: [
              ...new Set(
                [
                  context().state.wolfTarget,
                  ...(context().state.modifierKnifeTargets ?? []),
                ].filter((id): id is number => id !== null),
              ),
            ],
          }
        : {};
    },
  });
}
