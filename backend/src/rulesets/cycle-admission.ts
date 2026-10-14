/**
 * 负责对一次周期与手动阶段跳转执行有限、有序的同步重入准入政策。
 * 输入为延迟读取的原 World 与 day/gameOver；输出为通过或首个原机制错误。
 * 提交证据、准备状态及活跃窗口仍由各机制拥有；拒绝不撤销已付效果，也不重开窗口。
 * 这里不推进阶段、不标记周期、不授予行动许可；终局返回、时钟和失败清理由阶段经理处理。
 */
import type { World } from "../core/domain/world";
import type { RuntimeSnapshot } from "@ai-werewolf-arena/game-contract";
import { hasRadiantNight } from "../game/mechanisms/roles/radiant_eclipse/ports";
import { hasDemonNightStarted } from "../game/mechanisms/roles/demon_hunter/ports";
import {
  weddingSetup, ghostBrideReady, hasActiveGhostBride, hasGhostBrideNightCommit,
} from "../game/mechanisms/roles/ghost_bride/ports";
import {
  lonelyGirlReady, hasActiveLonelyGirl, hasLonelyGirlNightCommit,
} from "../game/mechanisms/roles/lonely_girl/ports";
import {
  hasActiveWildChild, hasWildChildNightCommit,
} from "../game/mechanisms/roles/wild_child/ports";
import {
  hasActiveInitialIdentitySetup, hasActiveInitialIdentityNight,
  hasInitialIdentityNightCommit, initialIdentityKind,
} from "../game/mechanisms/roles/initial_identity/ports";
import { hasActiveWall } from "../game/mechanisms/events/wall_notes/ports";

/** 运行查询端口；readonly 约束字段赋值，不是数据快照或运行时授权屏障。 */
export interface CycleAdmissionRuntime {
  readonly world: World;
  readonly state: Readonly<Pick<RuntimeSnapshot, "day" | "gameOver">>;
}

/** 按原首错误次序读取现场状态；终局保留各原 gameOver 短路，仍核无条件活跃窗口。 */
export function assertCycleAdmission(runtime: CycleAdmissionRuntime): void {
  if (!runtime.state.gameOver && hasRadiantNight(runtime.world, runtime.state.day))
    throw new Error("radiant_night_reentry");
  if (!runtime.state.gameOver && hasDemonNightStarted(runtime.world, runtime.state.day))
    throw new Error("demon_hunter_cycle_reentry");
  const wedding = weddingSetup(runtime.world);
  if (
    hasActiveGhostBride(runtime.world) ||
    (wedding && wedding.status !== "pending" && !ghostBrideReady(runtime.world)) ||
    (!runtime.state.gameOver && hasGhostBrideNightCommit(runtime.world, runtime.state.day))
  )
    throw new Error("ghost_bride_cycle_reentry");
  if (
    hasActiveLonelyGirl(runtime.world) ||
    (!runtime.state.gameOver && hasLonelyGirlNightCommit(runtime.world, runtime.state.day))
  )
    throw new Error("lonely_girl_cycle_reentry");
  if (
    hasActiveWildChild(runtime.world) ||
    (!runtime.state.gameOver && hasWildChildNightCommit(runtime.world, runtime.state.day))
  )
    throw new Error("wild_child_cycle_reentry");
  if (hasActiveInitialIdentitySetup(runtime.world) || hasActiveInitialIdentityNight(runtime.world))
    throw new Error(`${initialIdentityKind(runtime.world) ?? "thief"}_setup_reentry`);
  if (!runtime.state.gameOver && hasInitialIdentityNightCommit(runtime.world, runtime.state.day))
    throw new Error(`${initialIdentityKind(runtime.world) ?? "thief"}_cycle_reentry_after_night`);
  if (hasActiveWall(runtime.world)) throw new Error("wall_window_reentry");
}

/** 跳转只核原三个机制；Mist 周期登记仍由经理在此前处理，阶段时钟在通过后推进。 */
export function assertPhaseJumpAdmission(runtime: CycleAdmissionRuntime): void {
  if (!runtime.state.gameOver && hasDemonNightStarted(runtime.world, runtime.state.day))
    throw new Error("demon_hunter_phase_reentry");
  if (
    hasActiveGhostBride(runtime.world) ||
    !ghostBrideReady(runtime.world) ||
    (!runtime.state.gameOver && hasGhostBrideNightCommit(runtime.world, runtime.state.day))
  )
    throw new Error("ghost_bride_phase_reentry");
  if (
    hasActiveLonelyGirl(runtime.world) ||
    !lonelyGirlReady(runtime.world) ||
    (!runtime.state.gameOver && hasLonelyGirlNightCommit(runtime.world, runtime.state.day))
  )
    throw new Error("lonely_girl_phase_reentry");
}
