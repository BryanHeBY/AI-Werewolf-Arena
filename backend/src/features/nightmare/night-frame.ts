/**
 * 负责噩梦之影原名单、生命绑定、夜窗口与恐惧效果授权；输入为原角色与已通过目标政策的选择。
 * 输出是当前恐惧／狼刀阻断查询和原提交结果；仅原名单参与，组件替换不能悄然重开夜。
 * 数据构造、校验、写入和身份编码归同族状态槽；本 frame 保留 expectedState 更新和夜字段提交顺序。
 * 失败保留已写前缀，不以玩家投影或恐惧文案替代原生命／能力复验，也不回滚历史或补做关闭。
 * 当前 Camp 在原字段点由实际 World 查询；保原值比较，不把同值组件替换改成新的引用撤权。
 */
import type {
  NightmareShadowReadState,
} from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../domain/components/names";
import {
  aliveLifeVersion,
  aliveLifeDescriptor,
  type AliveComponent,
} from "../../domain/components/alive";

import type { World } from "../../domain/world";
import { Camp, type EntityId } from "../../domain/identity";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../domain/night-effects";
import type { NightAbilityReadView } from "../night-abilities/inventory-ports";
import { getNightmareShadowState, NIGHTMARE_SHADOW_STATE_SLOT } from "./state-slot";
import { nightmareFearTargets } from "./targets";

function authority(ability: NightAbilityReadView): string {
  const state = ability.state as unknown as Record<string, unknown>;
  return JSON.stringify([
    ability.id,
    ability.kind,
    ability.activation,
    ability.source,
    ability.sourceDisclosed,
    ability.startsOnDay,
    ability.expiresAfterDay,
    ability.maxUses,
    ability.disabled,
    ability.deathExpired,
    state.targetPolicy,
    state.actionPolicy,
    state.selfHealRule,
    state.knifeVisibility,
    state.potionPolicy,
    state.repeatPolicy,
    state.policy,
    state.inspectionPolicy,
    state.protectionPolicy,
  ]);
}
function captureRole(world: World, id: EntityId) {
  const role = world.getComponent(id, COMPONENT.Role);
  if (!role) throw new Error("nightmare_roster_missing");
  const kind = role.role,
    camp = world.getComponent(id, COMPONENT.Camp)?.camp,
    privateState = role.privateState;
  const life = world.getComponent(id, COMPONENT.Alive);
  const descriptor = life && aliveLifeDescriptor(life);
  const version = life && aliveLifeVersion(life);
  if (!life || !descriptor || version === undefined)
    throw new Error("nightmare_roster_life_missing");
  const lifeCurrent = () => {
    const current = Object.getOwnPropertyDescriptor(life, "alive");
    return (
      world.getComponent(id, COMPONENT.Alive) === life &&
      current?.get === descriptor.get &&
      current?.set === descriptor.set &&
      (aliveLifeVersion(life) === version ||
        (aliveLifeVersion(life) === version + 1 && !life.alive))
    );
  };
  const refs = Object.entries(privateState);
  const slots = Object.entries((privateState as { readonly abilities?: unknown }).abilities ?? {});
  const abilities = Object.values(
    ((privateState as { readonly abilities?: unknown }).abilities ?? {}) as Record<
      string,
      NightAbilityReadView
    >,
  ).map((ability) => ({
    ability,
    state: ability.state,
    source: ability.source,
    identity: authority(ability),
  }));
  return {
    id,
    role,
    current: () =>
      lifeCurrent() &&
      world.getComponent(id, COMPONENT.Role) === role &&
      role.role === kind &&
      world.getComponent(id, COMPONENT.Camp)?.camp === camp &&
      role.privateState === privateState &&
      refs.every(
        ([key, value]) => (privateState as Readonly<Record<string, unknown>>)[key] === value,
      ) &&
      Object.keys((privateState as { readonly abilities?: unknown }).abilities ?? {}).length ===
        slots.length &&
      slots.every(
        ([key, value]) =>
          (
            (privateState as { readonly abilities?: unknown }).abilities as
              Record<string, unknown> | undefined
          )?.[key] === value,
      ) &&
      abilities.every(
        (a) =>
          a.ability.state === a.state &&
          a.ability.source === a.source &&
          authority(a.ability) === a.identity,
      ),
  };
}
type Board = {
  actorId: EntityId;
  state: NightmareShadowReadState;
  expectedState: string;
  roster: ReturnType<typeof captureRole>[];
  night: {
    day: number;
    required: boolean;
    committed: boolean;
    target: NightLifeScope | null;
    wolfBlocked: boolean;
  } | null;
};
const boards = new WeakMap<World, Board>();
export function installNightmareBoard(world: World): void {
  if (boards.has(world)) throw new Error("nightmare_board_reinstall");
  const roster = world.entityIds().map((id) => captureRole(world, id));
  const actors = roster.filter((row) => getNightmareShadowState(row.role, () => world.getComponent(row.id, COMPONENT.Camp)));
  if (actors.length !== 1) throw new Error("nightmare_actor_count");
  const state = getNightmareShadowState(actors[0].role, () => world.getComponent(actors[0].id, COMPONENT.Camp))!;
  boards.set(world, {
    actorId: actors[0].id,
    state,
    expectedState: NIGHTMARE_SHADOW_STATE_SLOT.checkpoint.identity(state),
    roster,
    night: null,
  });
}
export function isNightmareBoard(world: World): boolean {
  return boards.has(world);
}
export function assertNightmareRosterCurrent(world: World): void {
  const board = boards.get(world);
  if (!board) return;
  if (
    world.entityIds().length !== board.roster.length ||
    board.roster.some((row) => !row.current()) ||
    getNightmareShadowState(world.getComponent(board.actorId, COMPONENT.Role), () => world.getComponent(board.actorId, COMPONENT.Camp)) !== board.state ||
    NIGHTMARE_SHADOW_STATE_SLOT.checkpoint.identity(board.state) !== board.expectedState
  )
    throw new Error("nightmare_roster_revoked");
}
export function beginNightmareNight(world: World, day: number): EntityId | null {
  const board = boards.get(world);
  if (!board) return null;
  assertNightmareRosterCurrent(world);
  if (
    !Number.isSafeInteger(day) ||
    day !== (board.night?.day ?? 0) + 1 ||
    (board.night?.required && !board.night.committed)
  )
    throw new Error("nightmare_night_reentry");
  board.night = {
    day,
    required: world.getAliveEntityIds().includes(board.actorId),
    committed: false,
    target: null,
    wolfBlocked: false,
  };
  return world.getAliveEntityIds().includes(board.actorId) ? board.actorId : null;
}
export function nightmarePackReady(world: World): boolean {
  assertNightmareRosterCurrent(world);
  return boards.get(world)?.state.packReady ?? true;
}
export function commitNightmareFear(
  world: World,
  actorId: EntityId,
  day: number,
  targetId: EntityId | null,
): void {
  assertNightmareRosterCurrent(world);
  const board = boards.get(world),
    night = board?.night;
  if (
    !board ||
    !night ||
    board.actorId !== actorId ||
    night.day !== day ||
    night.committed ||
    !world.getAliveEntityIds().includes(actorId)
  )
    throw new Error("nightmare_fear_scope_invalid");
  const candidates = nightmareFearTargets(world, actorId, day);
  if (
    targetId === null
      ? board.state.fearActionPolicy === "required_when_legal" && candidates.length > 0
      : !candidates.includes(targetId)
  )
    throw new Error("nightmare_fear_target_invalid");
  const target = targetId === null ? null : captureNightLife(world, targetId);
  if (targetId !== null && !target) throw new Error("nightmare_fear_target_invalid");
  const wolfBlocked =
    targetId !== null && !!world.getComponent(targetId, COMPONENT.Role) &&
    world.getComponent(targetId, COMPONENT.Camp)?.camp === Camp.Wolf;
  NIGHTMARE_SHADOW_STATE_SLOT.allowedWrites.recordFear(() => board.state, day, targetId);
  board.expectedState = NIGHTMARE_SHADOW_STATE_SLOT.checkpoint.identity(board.state);
  night.committed = true;
  night.target = target;
  night.wolfBlocked = wolfBlocked;
}
/** 原正常首次死亡仍保留本夜禁言供死亡行动窗口使用；复活或生命替换不因此获得续权。 */
export function nightmareFearBlocks(
  world: World,
  id: EntityId,
  day: number,
  allowFirstDeath = false,
): boolean {
  assertNightmareRosterCurrent(world);
  const night = boards.get(world)?.night,
    target = night?.target;
  if (!night || night.day !== day || !target || target.id !== id) return false;
  if (livingNightLife(world, target)) return true;
  if (!allowFirstDeath) throw new Error("nightmare_target_life_revoked");
  return (
    world.getComponent(id, COMPONENT.Alive) === target.life &&
    !target.life.alive &&
    aliveLifeVersion(target.life) === target.version + 1
  );
}
export function nightmareKnifeBlocked(world: World, day?: number): boolean {
  assertNightmareRosterCurrent(world);
  const night = boards.get(world)?.night;
  return !!night && (day === undefined || night.day === day) && night.wolfBlocked;
}

export function nightmareFearPending(world: World, actorId: EntityId, day: number): boolean {
  assertNightmareRosterCurrent(world);
  const board = boards.get(world),
    night = board?.night;
  return (
    !!board &&
    !!night &&
    board.actorId === actorId &&
    night.day === day &&
    night.required &&
    !night.committed &&
    world.getAliveEntityIds().includes(actorId)
  );
}
