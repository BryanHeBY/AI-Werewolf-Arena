/**
 * 负责夜间设置准入与逐检查点的名单可读性组合。输入为原 World、已捕获的机制归属和板子参数查询；
 * 输出为通过或按原顺序抛出的首个错误。设置在取消检查前校验，名单在开夜后及行动 await 两侧复验。
 * 各机制权威拥有原体、生命、库存和失效状态；本组合不缓存名单、不写资源、不新建窗口或改变阶段。
 * 所有查询仍在原表达式处读取，命中失败立即停止；猎魔 marks 保原逐编号短路，不把合法数据当许可。
 */
import type { World } from "../domain/world";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { hasActiveGhostBride, ghostBrideReady } from "../features/ghost-bride/ports";
import { hasActiveLonelyGirl, lonelyGirlReady } from "../features/lonely-girl/ports";
import { hasActiveWildChild, wildChildReady } from "../features/wild-child/ports";
import {
  hasActiveInitialIdentitySetup,
  initialIdentitySetupReady,
  initialIdentityKind,
} from "../features/initial-identity/ports";
import { animalAuthoritySnapshot } from "../features/animal-dream/ports";
import { fragrantAuthoritySnapshot } from "../features/fragrant-pair-seer/ports";
import { assertNobleBodyRosterCurrent } from "../features/noble-secret-body/ports";
import { assertRadiantRosterCurrent } from "../features/radiant-eclipse/ports";
import { assertMistRosterCurrent } from "../features/mist-raven/ports";
import { assertTricksterRosterCurrent } from "../features/trickster/ports";
import { assertWolfSorcererRosterCurrent } from "../features/wolf-sorcerer/ports";
import { assertTimeConsortRosterCurrent } from "../features/time-wolf-consort/ports";
import { assertScholarMentorRosterCurrent } from "../features/scholar-mentor/ports";
import { assertMagicianRosterCurrent } from "../features/magician/ports";
import { assertNightmareRosterCurrent } from "../features/nightmare/ports";
import { assertEvilKnightRosterCurrent } from "../features/evil-knight/ports";
import { assertDemonNightReadable } from "../features/demon-hunter/ports";
import { demonWitchMarksSafe } from "../features/demon-hunter/ports";

/** 只在原位置读取实际 World；不在创建查询对象时启动任何设置或反射玩家组件。 */
export interface NightSetupRuntime {
  world(): World;
}

/** 归属是本次生命周期已捕获的值，参数仍来自原局部 config；不是可序列化的授权或新库存快照。 */
export interface NightReadabilityRuntime extends NightSetupRuntime {
  config(): Pick<
    ReadonlyBoardConfig,
    "trickster" | "wolfSorcerer" | "timeConsort" | "scholarMentor" | "magician"
  >;
  ownsAnimal(): boolean;
  ownsFragrant(): boolean;
  ownsNoble(): boolean;
  ownsRadiant(): boolean;
  ownsMist(): boolean;
  ownsDemon(): boolean;
}

export function assertNightSetupReady(runtime: NightSetupRuntime): void {
  if (hasActiveGhostBride(runtime.world()) || !ghostBrideReady(runtime.world()))
    throw new Error("ghost_bride_setup_before_night_required");
  if (hasActiveLonelyGirl(runtime.world()) || !lonelyGirlReady(runtime.world()))
    throw new Error("lonely_girl_setup_before_night_required");
  if (hasActiveWildChild(runtime.world()) || !wildChildReady(runtime.world()))
    throw new Error("wild_child_setup_before_night_required");
  if (hasActiveInitialIdentitySetup(runtime.world()) || !initialIdentitySetupReady(runtime.world()))
    throw new Error(
      `${initialIdentityKind(runtime.world()) ?? "thief"}_setup_before_night_required`,
    );
}

/** 每个检查点重新遍历既有权威；关闭与失败清理由流水线及生命周期 owner 负责。 */
export function assertNightReadable(runtime: NightReadabilityRuntime): void {
  if (runtime.ownsAnimal() && !animalAuthoritySnapshot(runtime.world()))
    throw new Error("animal_authority_revoked");
  if (runtime.ownsFragrant()) fragrantAuthoritySnapshot(runtime.world());
  if (runtime.ownsNoble()) assertNobleBodyRosterCurrent(runtime.world());
  if (runtime.ownsRadiant()) assertRadiantRosterCurrent(runtime.world());
  if (runtime.ownsMist()) assertMistRosterCurrent(runtime.world());
  if (runtime.config().trickster) assertTricksterRosterCurrent(runtime.world());
  if (runtime.config().wolfSorcerer) assertWolfSorcererRosterCurrent(runtime.world());
  if (runtime.config().timeConsort) assertTimeConsortRosterCurrent(runtime.world());
  if (runtime.config().scholarMentor) assertScholarMentorRosterCurrent(runtime.world());
  if (runtime.config().magician) assertMagicianRosterCurrent(runtime.world());
  assertNightmareRosterCurrent(runtime.world());
  assertEvilKnightRosterCurrent(runtime.world());
  if (!runtime.ownsDemon()) return;
  assertDemonNightReadable(runtime.world());
  if (
    !runtime
      .world()
      .entityIds()
      .every((id) => demonWitchMarksSafe(runtime.world(), id))
  )
    throw new Error("demon_hunter_unreadable_marks");
}
