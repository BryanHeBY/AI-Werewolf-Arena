/**
 * 负责觉醒猎人的原生命巡猎授权及一次方向付款。输入为N1原体绑定、真实死亡来源和引擎当前性，
 * 输出仅本次资格或已付不透明提案；始终复验原Role/Camp/Alive/私库，死亡时不重新捕获新body。
 * 本owner只提交唯一巡猎库存，不标死或推进阶段。失败／撤权零新付款，已付提案不因许可关闭退款；
 * Night-root抑制替死由真实提案WeakMap保有，JSON字段或相同目标ID不能mint该权限。
 */
import { Camp, Phase, type DeathCause } from "@ai-werewolf-arena/game-contract";
import type { PatrolDirection } from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import type { World } from "../../domain/world";
import {
  captureOriginalPlayer,
  originalPlayerAtCommit,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";
import type { NightLifeScope } from "../../domain/night-effects";
import {
  getAwakenedPatrolState,
  prepareAwakenedPatrolState,
  replaceAwakenedPatrolState,
} from "./state";

interface Owner {
  readonly actor: OriginalPlayerScope;
  readonly seats: readonly OriginalPlayerScope[];
  readonly revokedSeats: Set<OriginalPlayerScope>;
  revoked: boolean;
}
const owners = new WeakMap<World, Owner>();
/** 空对象仅作内存身份，不向调用方暴露原组件或真实狼名单。 */
export interface PatrolQualification {
  readonly kind: "awakened-patrol-qualification";
}
interface QualificationData {
  readonly world: World;
  readonly owner: Owner;
  readonly day: number;
  readonly rootPhase: Phase;
  readonly causes: readonly DeathCause[];
  readonly current: () => boolean;
  closed: boolean;
}
const qualifications = new WeakMap<PatrolQualification, QualificationData>();
export interface PaidPatrolProposal {
  readonly kind: "awakened-patrol-proposal";
}
interface ProposalData {
  readonly world: World;
  readonly owner: Owner;
  readonly day: number;
  readonly rootPhase: Phase;
  readonly direction: PatrolDirection;
  readonly target: OriginalPlayerScope;
  readonly state: NonNullable<ReturnType<typeof getAwakenedPatrolState>>;
  revoked: boolean;
}
const proposals = new WeakMap<PaidPatrolProposal, ProposalData>();

function actorCurrent(world: World, owner: Owner, dead: boolean): boolean {
  if (owner.revoked) return false;
  const sameBody = originalPlayerAtCommit(world, owner.actor, true);
  if (!sameBody) owner.revoked = true;
  return sameBody && owner.actor.life.alive !== dead;
}
/** 真实N1阶段调用；冻结初始座位环，不按之后的角色显示、阵营伪装或新body重建。 */
export function bindAwakenedPatrol(world: World, actorId: number): void {
  const previous = owners.get(world);
  if (previous) {
    if (previous.actor.id !== actorId || !actorCurrent(world, previous, false))
      throw new Error("awakened_patrol_owner_revoked");
    return;
  }
  const actor = captureOriginalPlayer(world, actorId),
    state = getAwakenedPatrolState(actor?.role);
  if (
    !actor ||
    actor.roleId !== "awakened_hunter" ||
    actor.campValue !== Camp.Good ||
    !state ||
    state.payment
  )
    throw new Error("awakened_patrol_owner_invalid");
  const ids = world.entityIds();
  if (new Set(ids).size !== ids.length || !ids.includes(actorId))
    throw new Error("awakened_patrol_seats_invalid");
  const seats = ids.map((id) => captureOriginalPlayer(world, id));
  if (seats.some((seat) => !seat) || !originalPlayerAtCommit(world, actor))
    throw new Error("awakened_patrol_seats_invalid");
  owners.set(world, {
    actor,
    seats: Object.freeze(seats as OriginalPlayerScope[]),
    revokedSeats: new Set(),
    revoked: false,
  });
}
function target(
  owner: Owner,
  world: World,
  direction: PatrolDirection,
): OriginalPlayerScope | null {
  const index = owner.seats.findIndex((s) => s.id === owner.actor.id),
    step = direction === "clockwise" ? 1 : -1;
  for (let distance = 1; distance < owner.seats.length; distance++) {
    const seat = owner.seats[(index + step * distance + owner.seats.length) % owner.seats.length]!;
    if (seat.campValue !== Camp.Wolf || owner.revokedSeats.has(seat)) continue;
    if (originalPlayerAtCommit(world, seat)) return seat;
    // 已观察到的死亡／换体／改身份不可通过恢复旧组件再次获得原巡猎目标资格。
    owner.revokedSeats.add(seat);
  }
  return null;
}
function current(data: QualificationData): boolean {
  return (
    !data.closed &&
    data.current() &&
    actorCurrent(data.world, data.owner, true) &&
    getAwakenedPatrolState(data.owner.actor.role)?.payment === null
  );
}
export function qualifyAwakenedPatrol(
  world: World,
  actorId: number,
  day: number,
  rootPhase: Phase,
  causes: readonly DeathCause[],
  isCurrent: () => boolean,
): PatrolQualification | null {
  const owner = owners.get(world);
  if (
    !owner ||
    owner.actor.id !== actorId ||
    !Number.isSafeInteger(day) ||
    day < 1 ||
    ![Phase.Night, Phase.Day, Phase.Voting].includes(rootPhase) ||
    !causes.length ||
    new Set(causes).size !== causes.length ||
    !causes.every((cause) =>
      ["wolf_kill", "poison", "exile", "awakened_beauty_replacement"].includes(cause),
    )
  )
    return null;
  const data: QualificationData = {
    world,
    owner,
    day,
    rootPhase,
    causes: Object.freeze([...causes]),
    current: isCurrent,
    closed: false,
  };
  if (!current(data) || !target(owner, world, "clockwise")) return null;
  const handle: PatrolQualification = Object.freeze({ kind: "awakened-patrol-qualification" });
  qualifications.set(handle, data);
  return handle;
}
export function awakenedPatrolCurrent(world: World, handle: PatrolQualification): boolean {
  const data = qualifications.get(handle);
  return (
    !!data && data.world === world && current(data) && !!target(data.owner, world, "clockwise")
  );
}
export function awakenedPatrolSeats(world: World, handle: PatrolQualification): readonly number[] {
  const data = qualifications.get(handle);
  return data?.world === world ? data.owner.seats.map((seat) => seat.id) : [];
}
/** 工具预检只核原死亡库存与方向，真实资格和付款仍必须持有本次不可复制句柄。 */
export function patrolChoiceAllowed(world: World, actorId: number, direction: unknown): boolean {
  const owner = owners.get(world);
  return (
    !!owner &&
    owner.actor.id === actorId &&
    actorCurrent(world, owner, true) &&
    getAwakenedPatrolState(owner.actor.role)?.payment === null &&
    (direction === null || direction === "clockwise" || direction === "counter_clockwise")
  );
}
export function closeAwakenedPatrol(handle: PatrolQualification): void {
  const data = qualifications.get(handle);
  if (data) data.closed = true;
}
/** 已付事实只从同一真实资格与唯一库存取值；不把调用方的方向／根阶段当付款回执。 */
export function awakenedPatrolPayment(world: World, handle: PatrolQualification) {
  const data = qualifications.get(handle);
  if (!data || data.world !== world || !data.closed) return null;
  const payment = getAwakenedPatrolState(data.owner.actor.role)?.payment;
  return payment && payment.day === data.day && payment.rootPhase === data.rootPhase
    ? { ...payment }
    : null;
}
/** 付款前末次实时选择最近原活狼；null同样耗唯一单位，但不生成死亡提案。 */
export function payAwakenedPatrol(
  world: World,
  handle: PatrolQualification,
  direction: PatrolDirection | null,
  beforeWrite: () => boolean,
): PaidPatrolProposal | null {
  const data = qualifications.get(handle);
  if (
    !data ||
    data.world !== world ||
    !awakenedPatrolCurrent(world, handle) ||
    (direction !== null && direction !== "clockwise" && direction !== "counter_clockwise")
  )
    throw new Error("awakened_patrol_payment_invalid");
  const expected = getAwakenedPatrolState(data.owner.actor.role)!;
  if (
    !beforeWrite() ||
    !current(data) ||
    getAwakenedPatrolState(data.owner.actor.role) !== expected
  )
    throw new Error("awakened_patrol_payment_revoked");
  // 最后外部回调之后按真实座位再算一次；此后只做本族纯数据构造及真实存储读，不调用World查询。
  const selected = direction ? target(data.owner, world, direction) : null;
  if (direction && !selected) throw new Error("awakened_patrol_target_unavailable");
  const next = prepareAwakenedPatrolState({
    ...expected,
    payment: {
      day: data.day,
      rootPhase: data.rootPhase,
      direction,
      targetId: selected?.id ?? null,
    },
  });
  if (
    !originalPlayerAtCommit(world, data.owner.actor, true) ||
    data.owner.actor.life.alive ||
    getAwakenedPatrolState(data.owner.actor.role) !== expected ||
    (selected && !originalPlayerAtCommit(world, selected))
  )
    throw new Error("awakened_patrol_payment_revoked");
  replaceAwakenedPatrolState(data.owner.actor.role, expected, next);
  data.closed = true;
  if (!selected || !direction) return null;
  const proposal: PaidPatrolProposal = Object.freeze({ kind: "awakened-patrol-proposal" });
  proposals.set(proposal, {
    world,
    owner: data.owner,
    day: data.day,
    rootPhase: data.rootPhase,
    direction,
    target: selected,
    state: next,
    revoked: false,
  });
  return proposal;
}
/** 已付提案不依赖已关闭的请求／已耗次数；保原actor首次死亡和目标原生命。 */
export function paidAwakenedPatrol(
  world: World,
  proposal: PaidPatrolProposal,
  day: number,
): {
  actorId: number;
  target: NightLifeScope;
  direction: PatrolDirection;
  rootPhase: Phase;
} | null {
  const paid = proposals.get(proposal);
  if (!paid || paid.world !== world || paid.day !== day || paid.revoked) return null;
  if (
    !actorCurrent(world, paid.owner, true) ||
    getAwakenedPatrolState(paid.owner.actor.role) !== paid.state ||
    !originalPlayerAtCommit(world, paid.target)
  ) {
    paid.revoked = true;
    return null;
  }
  return {
    actorId: paid.owner.actor.id,
    direction: paid.direction,
    rootPhase: paid.rootPhase,
    target: { id: paid.target.id, life: paid.target.life, version: paid.target.version },
  };
}
export function nightPatrolSuppressesBeauty(
  world: World,
  proposal: PaidPatrolProposal,
  day: number,
  targetScope: NightLifeScope,
): boolean {
  const paid = paidAwakenedPatrol(world, proposal, day);
  return (
    !!paid &&
    paid.rootPhase === Phase.Night &&
    paid.target.id === targetScope.id &&
    paid.target.life === targetScope.life &&
    paid.target.version === targetScope.version
  );
}
