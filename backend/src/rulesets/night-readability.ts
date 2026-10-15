/**
 * 负责夜间设置准入与逐检查点的名单可读性组合。输入为原 World、已捕获的机制归属和板子参数查询；
 * 输出为通过或按原顺序抛出的首个错误。设置在取消检查前校验，名单在开夜后及行动 await 两侧复验。
 * 各机制权威拥有原体、生命、库存和失效状态；本组合不缓存名单、不写资源、不新建窗口或改变阶段。
 * 所有查询仍在原表达式处读取，命中失败立即停止；猎魔 marks 保原逐编号短路，不把合法数据当许可。
 */
import type { World } from "../domain/world";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { hasActiveGhostBride, ghostBrideReady } from "../game/mechanisms/roles/ghost_bride/ports";
import { hasActiveLonelyGirl, lonelyGirlReady } from "../game/mechanisms/roles/lonely_girl/ports";
import { hasActiveWildChild, wildChildReady } from "../game/mechanisms/roles/wild_child/ports";
import { hasActiveInitialIdentitySetup, initialIdentitySetupReady, initialIdentityKind } from "../game/mechanisms/roles/initial_identity/ports";
import { animalAuthoritySnapshot } from "../game/mechanisms/roles/animal_dream/ports";
import { fragrantAuthoritySnapshot } from "../game/mechanisms/roles/fragrant_pair_seer/ports";
import { assertNobleBodyRosterCurrent } from "../game/mechanisms/roles/noble_secret_body/ports";
import { assertRadiantRosterCurrent } from "../game/mechanisms/roles/radiant_eclipse/ports";
import { assertMistRosterCurrent } from "../game/mechanisms/roles/mist_raven/ports";
import { assertTricksterRosterCurrent } from "../game/mechanisms/roles/trickster/ports";
import { assertWolfSorcererRosterCurrent } from "../game/mechanisms/roles/wolf_sorcerer/ports";
import { assertTimeConsortRosterCurrent } from "../game/mechanisms/roles/time_wolf_consort/ports";
import { assertScholarMentorRosterCurrent } from "../game/mechanisms/roles/scholar_mentor/ports";
import { assertMagicianRosterCurrent } from "../game/mechanisms/roles/magician/ports";
import { assertNightmareRosterCurrent } from "../game/mechanisms/roles/nightmare_shadow/ports";
import { assertEvilKnightRosterCurrent } from "../game/mechanisms/roles/evil_knight/ports";
import { assertDemonNightReadable } from "../game/mechanisms/roles/demon_hunter/ports";
import { demonWitchMarksSafe } from "../game/mechanisms/roles/demon_hunter/ports";

/** 只在原位置读取实际 World；不在创建查询对象时启动任何设置或反射玩家组件。 */
export interface NightSetupRuntime { world(): World; }

/** 归属是本次生命周期已捕获的值，参数仍来自原局部 config；不是可序列化的授权或新库存快照。 */
export interface NightReadabilityRuntime extends NightSetupRuntime {
  config(): Pick<ReadonlyBoardConfig, "trickster" | "wolfSorcerer" | "timeConsort" | "scholarMentor" | "magician">;
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
    throw new Error(`${initialIdentityKind(runtime.world()) ?? "thief"}_setup_before_night_required`);
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
  if (!runtime.world().entityIds().every((id) => demonWitchMarksSafe(runtime.world(), id)))
    throw new Error("demon_hunter_unreadable_marks");
}
