/**
 * 负责狼爪唯一私有库存槽。输入为原 Role 和已校验下一状态，输出原体或脱离数据投影。
 * 写入只替换原自身数据属性；不调用未知 setter，不重装被替换对象，JSON 不是已付运行证明。
 * 原生双爪与受传单爪共享同一 owner，不安装 canShoot 或赠枪镜像。
 */
import { types } from "node:util";
import { Camp } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_CLAW_POLICY,
  readAwakenedClawStateData,
  type AwakenedClawState,
  type AwakenedClawUnit,
} from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import type { RoleComponent } from "../../domain/components/role";
import { snapshotPlainData } from "../../domain/plain-data";
import { readWorldComponentAtCommit, type World } from "../../domain/world";
import type { CampComponent } from "../../domain/components/camp";
import type { NightLifeReadScope } from "../../domain/night-effects";
import { COMPONENT } from "../../domain/components/names";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import {
  originalPlayerCurrent,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import {
  aliveLifeVersion,
  aliveLifeDescriptor,
  type AliveComponent,
} from "../../domain/components/alive";

// 仅安装 writer 生成原库存身份；相同 JSON 或直接替换私态槽不能为开枪提供授权。
const owners = new WeakMap<
  RoleComponent,
  {
    world?: World;
    actorId?: number;
    state: AwakenedClawState;
    life?: AliveComponent;
    version?: number;
    camp?: CampComponent;
    roleId: unknown;
    revoked?: boolean;
  }
>();

function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
function safeLife(life: AliveComponent | undefined): life is AliveComponent {
  if (!life || types.isProxy(life) || aliveLifeVersion(life) === undefined) return false;
  const original = aliveLifeDescriptor(life),
    descriptor = Object.getOwnPropertyDescriptor(life, "alive");
  return (
    !!original && !!descriptor && descriptor.get === original.get && descriptor.set === original.set
  );
}
function canonical(data: AwakenedClawState): AwakenedClawState {
  return Object.freeze({
    policy: AWAKENED_CLAW_POLICY,
    units: Object.freeze(
      data.units.map((u) => Object.freeze({ ...u, source: Object.freeze({ ...u.source }) })),
    ),
    bequests: Object.freeze(data.bequests.map((r) => Object.freeze({ ...r }))),
  });
}
export function createNativeClaws(): AwakenedClawState {
  return canonical({
    policy: AWAKENED_CLAW_POLICY,
    units: [1, 2].map((index) => ({
      id: `awakened_claw:native:${index}`,
      source: { kind: "native", index: index as 1 | 2 },
      status: "ready",
    })),
    bequests: [],
  });
}
export function createReceivedClaw(
  giverId: number,
  day: number,
  unit: AwakenedClawUnit,
): AwakenedClawState {
  if (unit.source.kind !== "native" || unit.status !== "ready")
    throw new Error("awakened_claw_source_invalid");
  const data = readAwakenedClawStateData({
    policy: AWAKENED_CLAW_POLICY,
    units: [
      {
        id: `awakened_claw:bequest:${giverId}:${day}:${unit.source.index}`,
        source: { kind: "bequest", giverId, giverUnitId: unit.id, day },
        status: "ready",
      },
    ],
    bequests: [],
  });
  if (!data) throw new Error("awakened_claw_source_invalid");
  return canonical(data);
}
export function installAwakenedClaws(
  role: RoleComponent,
  state: AwakenedClawState,
  world?: World,
  actorId?: number,
  expectedRecipient?: OriginalPlayerScope,
): void {
  const container = own(role, "privateState");
  if (
    !container ||
    typeof container !== "object" ||
    types.isProxy(container) ||
    Object.getOwnPropertyDescriptor(container, "awakenedClaws") !== undefined ||
    !readAwakenedClawStateData(state)
  )
    throw new Error("awakened_claw_install_invalid");
  const life =
    world && actorId !== undefined ? world.getComponent(actorId, COMPONENT.Alive) : undefined;
  if (
    actorId !== undefined &&
    (!safeLife(life) || !life.alive || world?.getComponent(actorId, COMPONENT.Role) !== role)
  )
    throw new Error("awakened_claw_install_life_invalid");
  const original = canonical(state),
    camp =
      expectedRecipient?.camp ??
      (world && actorId !== undefined
        ? readWorldComponentAtCommit(world, actorId, COMPONENT.Camp)
        : undefined),
    roleId = own(role, "role");
  // 受传必须沿用开窗时的原体，不能在已扣原单位后再捕获替换生命并给它重新授权。
  if (
    expectedRecipient &&
    (!world ||
      actorId !== expectedRecipient.id ||
      role !== expectedRecipient.role ||
      life !== expectedRecipient.life ||
      aliveLifeVersion(life!) !== expectedRecipient.version ||
      !originalPlayerCurrent(world, expectedRecipient) ||
      readWorldComponentAtCommit(world, actorId, COMPONENT.Role) !== expectedRecipient.role ||
      readWorldComponentAtCommit(world, actorId, COMPONENT.Camp) !== expectedRecipient.camp ||
      own(expectedRecipient.role, "role") !== expectedRecipient.roleId ||
      own(expectedRecipient.camp, "camp") !== expectedRecipient.campValue ||
      readWorldComponentAtCommit(world, actorId, COMPONENT.Alive) !== expectedRecipient.life ||
      !safeLife(expectedRecipient.life) ||
      !expectedRecipient.life.alive ||
      aliveLifeVersion(expectedRecipient.life) !== expectedRecipient.version)
  )
    throw new Error("awakened_claw_install_life_invalid");
  Object.defineProperty(container, "awakenedClaws", {
    value: original,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  owners.set(role, {
    world,
    actorId,
    state: original,
    life: expectedRecipient?.life ?? life,
    version: expectedRecipient?.version ?? (life && aliveLifeVersion(life)),
    camp,
    roleId,
  });
}
/** 只给内部运行提供原库存；绑定首次 actor 后不可迁移至另一 World／席位。 */
export function ownedAwakenedClaws(world: World, actorId: number): AwakenedClawState | undefined {
  const role = world.getComponent(actorId, COMPONENT.Role),
    owner = role && owners.get(role),
    life = world.getComponent(actorId, COMPONENT.Alive);
  if (
    !role ||
    !owner ||
    owner.world !== world ||
    owner.revoked ||
    isRoleExecutionRetired(role) ||
    (owner.actorId !== undefined && owner.actorId !== actorId)
  )
    return undefined;
  if (getAwakenedClaws(role) !== owner.state || !safeLife(life)) {
    owner.revoked = true;
    return undefined;
  }
  // 原生初始化早于 World 安装生命，只在首次真实活窗绑定；受传安装时已经绑定目标原生命。
  if (!owner.life) {
    if (!life.alive) {
      owner.revoked = true;
      return undefined;
    }
    owner.life = life;
    owner.version = aliveLifeVersion(life);
    owner.camp = world.getComponent(actorId, COMPONENT.Camp);
  }
  if (owner.life !== life || aliveLifeVersion(life) !== owner.version! + (life.alive ? 0 : 1)) {
    owner.revoked = true;
    return undefined;
  }
  owner.actorId = actorId;
  return owner.state;
}
export function getAwakenedClaws(role: RoleComponent | undefined): AwakenedClawState | undefined {
  const state = own(own(role, "privateState"), "awakenedClaws");
  try {
    return readAwakenedClawStateData(snapshotPlainData(state, new Set(), 0, 32768))
      ? (state as AwakenedClawState)
      : undefined;
  } catch {
    return undefined;
  }
}
export function projectAwakenedClaws(role: RoleComponent | undefined): AwakenedClawState | null {
  const state = getAwakenedClaws(role);
  return state ? readAwakenedClawStateData(state) : null;
}
export function nextClawStatus(
  state: AwakenedClawState,
  unitId: string,
  status: "spent" | "expired",
): AwakenedClawState {
  if (!state.units.some((unit) => unit.id === unitId && unit.status === "ready"))
    throw new Error("awakened_claw_unavailable");
  return canonical({
    ...state,
    units: state.units.map((unit) => (unit.id === unitId ? { ...unit, status } : unit)),
  });
}
export function nextClawBequest(
  state: AwakenedClawState,
  unitId: string,
  day: number,
  targetId: number,
): AwakenedClawState {
  const next = readAwakenedClawStateData({
    ...state,
    units: state.units.map((unit) =>
      unit.id === unitId ? { ...unit, status: "transferred" } : unit,
    ),
    bequests: [...state.bequests, { day, targetId, unitId }],
  });
  if (
    !next ||
    !state.units.some((u) => u.id === unitId && u.status === "ready" && u.source.kind === "native")
  )
    throw new Error("awakened_claw_bequest_invalid");
  return canonical(next);
}
/** expected 是真实 owner 捕获的原库存；外部同形状态不能替换或恢复已付款单位。 */
export function replaceAwakenedClaws(
  role: RoleComponent,
  expected: AwakenedClawState,
  next: AwakenedClawState,
  target?: NightLifeReadScope | null,
): void {
  const container = own(role, "privateState");
  if (!container || typeof container !== "object" || types.isProxy(container))
    throw new Error("awakened_claw_revoked");
  const descriptor = Object.getOwnPropertyDescriptor(container, "awakenedClaws");
  if (
    !descriptor ||
    !("value" in descriptor) ||
    descriptor.value !== expected ||
    descriptor.writable !== true ||
    !readAwakenedClawStateData(next)
  )
    throw new Error("awakened_claw_revoked");
  // 目标范围虽由内部 chooser 交付，仍只收自有数据字段；任何 getter 都在稳定双端核验之前拒绝。
  const targetId = target ? own(target, "id") : undefined,
    targetLife = target ? (own(target, "life") as AliveComponent | undefined) : undefined,
    targetVersion = target ? own(target, "version") : undefined;
  if (
    target &&
    (typeof targetId !== "number" ||
      !Number.isSafeInteger(targetId) ||
      targetId < 1 ||
      typeof targetVersion !== "number" ||
      !Number.isSafeInteger(targetVersion) ||
      targetVersion < 0 ||
      !safeLife(targetLife))
  )
    throw new Error("awakened_claw_commit_target_invalid");
  const owner = owners.get(role);
  const { world, actorId, life, version, camp } = owner ?? {};
  // 所有可重入查询之后，用真实 Map 槽同时核两端；交换普通查询顺序不能消除互相撤权窗口。
  if (
    !owner ||
    owner.revoked ||
    owner.state !== expected ||
    !world ||
    actorId === undefined ||
    !safeLife(life) ||
    version === undefined ||
    !camp ||
    readWorldComponentAtCommit(world, actorId, COMPONENT.Role) !== role ||
    readWorldComponentAtCommit(world, actorId, COMPONENT.Camp) !== camp ||
    own(camp, "camp") !== Camp.Wolf ||
    own(role, "role") !== owner.roleId ||
    readWorldComponentAtCommit(world, actorId, COMPONENT.Alive) !== life ||
    aliveLifeVersion(life) !== version + (life.alive ? 0 : 1) ||
    isRoleExecutionRetired(role) ||
    (target &&
      (readWorldComponentAtCommit(world, targetId as number, COMPONENT.Alive) !== targetLife ||
        !targetLife!.alive ||
        aliveLifeVersion(targetLife!) !== targetVersion))
  )
    throw new Error("awakened_claw_commit_stale");
  Object.defineProperty(container, "awakenedClaws", { ...descriptor, value: next });
  owner.state = next;
}
