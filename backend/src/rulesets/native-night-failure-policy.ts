/**
 * 负责组合原生夜间的失败政策与来源资格检查。输入为延迟 World 查询、阶段种类及活的只读能力引用，
 * 输出为原拒绝或继续；每次特性查询仍保留原短路及重复 World 读取。
 * 绑定函数不查询板子、actor、库存、时钟或请求；只读类型不复制或冻结引用。
 * 本策略不扣库存、不结算回执或发布事实，实际付款与效果提交仍归原所有者。
 */
import type { World } from "../domain/world";
import { Role } from "../domain/identity";
import type { NightAbilityReadView } from "../features/night-abilities/abilities";
import { isRadiantEclipseBoard } from "../features/radiant-eclipse/ports";
import { isScholarMentorBoard } from "../features/scholar-mentor/ports";
import { isTimeConsortBoard } from "../features/time-wolf-consort/ports";
import { isMagicianBoard } from "../features/magician/ports";
import { isNightmareBoard } from "../features/nightmare/ports";
import {
  isEvilKnightBoard,
  assertEvilKnightNativeActor,
} from "../features/evil-knight/ports";
import { isFragrantPairBoard } from "../features/fragrant-pair-seer/ports";
import { isNobleBodyBoard } from "../features/noble-secret-body/ports";
import { isMistRavenBoard } from "../features/mist-raven/ports";
import {
  isRedMoonBoard,
  demonHunterActorId,
  demonWitchRequiredThisNight,
} from "../features/demon-hunter/ports";

export type NativeNightAction = "seer" | "guard" | "witch";

// 同一端口包含有序错误选择和来源校验；返回值／未抛错只说明该检查，不代表资源已付款。
export interface NativeNightFailurePolicy {
  scopeStale(kind: NativeNightAction): void;
  actionMissing(kind: NativeNightAction): void;
  actionInvalid(kind: NativeNightAction): void;
  strictWolfFailurePrefix(): string | null;
  usesDemonController(): boolean;
  requiresDemonPotionTurn(): boolean;
  assertNativeActor(actorId: number, role: Role): void;
  assertSeerSource(ability: NightAbilityReadView<"seer_check">): void;
  assertPotionSource(ability: NightAbilityReadView<"potion">): void;
  skipsEmptyBorrowedPotion(ability: NightAbilityReadView<"potion">): boolean;
}

/** 每次沿委托取得原 World 参数，不缓存 World，也不把一次板子命中当作后续许可。 */
export function bindNativeNightFailurePolicy(world: () => World): NativeNightFailurePolicy {
  const scopeStale = (kind: NativeNightAction): void => {
    if (kind !== "guard" && isRadiantEclipseBoard(world()))
      throw new Error(`radiant_eclipse_${kind}_scope_stale`);
    if (isScholarMentorBoard(world())) throw new Error(`scholar_mentor_${kind}_scope_stale`);
    if (isTimeConsortBoard(world())) throw new Error(`time_consort_${kind}_scope_stale`);
  };
  const actionRejected = (kind: NativeNightAction, reason: "missing" | "invalid"): void => {
    if (kind !== "guard" && isRadiantEclipseBoard(world()))
      throw new Error(`radiant_eclipse_${kind}_action_${reason}`);
    if (isScholarMentorBoard(world())) throw new Error(`scholar_mentor_${kind}_action_${reason}`);
    if (isTimeConsortBoard(world())) throw new Error(`time_consort_${kind}_action_${reason}`);
    if (kind === "guard") {
      if (isEvilKnightBoard(world())) throw new Error(`evil_knight_guard_action_${reason}`);
      return;
    }
    if (isMagicianBoard(world())) throw new Error(`magician_${kind}_action_${reason}`);
    if (isEvilKnightBoard(world()) || isNightmareBoard(world()))
      throw new Error(
        isNightmareBoard(world())
          ? `nightmare_${kind}_action_${reason}`
          : `evil_knight_${kind}_action_${reason}`,
      );
  };
  return Object.freeze({
    scopeStale,
    actionMissing: (kind: NativeNightAction) => actionRejected(kind, "missing"),
    actionInvalid: (kind: NativeNightAction) => actionRejected(kind, "invalid"),
    // 采用首个命中的严格板子前缀；每个查询都在该分支现场读取 World，不合并为缓存布尔值。
    strictWolfFailurePrefix() {
      if (isFragrantPairBoard(world())) return "fragrant_pair_seer";
      if (isNobleBodyBoard(world())) return "noble_secret_body";
      if (isRadiantEclipseBoard(world())) return "radiant_eclipse";
      if (isMistRavenBoard(world())) return "mist";
      if (isScholarMentorBoard(world())) return "scholar_mentor";
      if (isTimeConsortBoard(world())) return "time_consort";
      if (isNightmareBoard(world())) return "nightmare";
      if (isMagicianBoard(world())) return "magician";
      if (isRedMoonBoard(world())) return "red_moon";
      if (isEvilKnightBoard(world())) return "evil_knight";
      return null;
    },
    usesDemonController: () => demonHunterActorId(world()) !== null,
    requiresDemonPotionTurn: () => demonWitchRequiredThisNight(world()),
    assertNativeActor: (actorId: number, role: Role) =>
      assertEvilKnightNativeActor(world(), actorId, role),
    assertSeerSource(ability: NightAbilityReadView<"seer_check">) {
      if (
        isEvilKnightBoard(world()) &&
        (ability.source.kind !== "native" || ability.source.role !== Role.Seer)
      )
        throw new Error("evil_knight_seer_source_invalid");
    },
    assertPotionSource(ability: NightAbilityReadView<"potion">) {
      if (
        isEvilKnightBoard(world()) &&
        (ability.source.kind !== "native" || ability.source.role !== Role.Witch)
      )
        throw new Error("evil_knight_witch_source_invalid");
    },
    skipsEmptyBorrowedPotion: (ability: NightAbilityReadView<"potion">) =>
      isRadiantEclipseBoard(world()) &&
      ability.source.kind === "copy" &&
      ability.state.heal === 0 &&
      ability.state.poison === 0,
  });
}
