/**
 * 负责赠枪实例的授予、武装、转移、首次死亡收尾以及原体授权。
 * 输入为所属 World、原角色／生命／库存实例和明确业务夜时点；输出为同引用只读实例、
 * 捕获资格和原资源事实。owners/counters 是原唯一状态，不复制为第二份实例仓库。
 * 仅写 deathAbilities、retiredDeathAbilityIds 及本枪资源；不执行死亡、枪目标选择或录制 I/O。
 * 已付前缀和原 getter／提交顺序保持，替身或复活不能重新获得首次死亡枪权。
 * 阵营只晚取当前值，同值 Camp 替换不增加引用撤权；原纯已付体复验不变成新执行资格。
 * F05a 将永久退休拒绝放在新执行入口；已消费提案的纯原体／来源／生命及 capture.isCurrent 不含此判断。
 */
import type { DeathGun, DeathGunReadView } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import { Camp, type EntityId, type GameEvent } from "../../domain/model";
import { aliveLifeVersion, type AliveComponent } from "../../domain/components/alive";
import type { World } from "../../domain/world";
import { projectDeathGun } from "../../agents/observation/player-state";

// 原体证明捕获原 World、角色、private 容器、生命版本及来源；相同字符串 ID 不构成授权。
interface GunOwner {
  world: World;
  actorId: number;
  role: RoleComponent;
  roleKind: RoleComponent["role"];
  camp: Camp | undefined;
  privateState: RoleComponent["privateState"];
  life: AliveComponent;
  version: number;
  id: string;
  source: DeathGunReadView["source"];
  sourceKind: DeathGun["source"]["kind"];
  sourceActor: number;
  sourceId?: string;
  grantedNight: number;
  armedOnNight: number | null;
}

// 两个原 WeakMap 随实际 owner 整体迁移；计数只在成功安装后推进，不查询 RNG 或时钟。
const owners = new WeakMap<DeathGunReadView, GunOwner>(),
  counters = new WeakMap<World, number>();

export function allDeathGuns(role: RoleComponent | undefined): DeathGunReadView[] {
  return Object.values(
    ((role as { readonly privateState: { readonly deathAbilities?: unknown } } | undefined)
      ?.privateState.deathAbilities ?? {}) as Readonly<Record<string, DeathGunReadView>>,
  ).sort((a, b) => a.id.localeCompare(b.id));
}

export function findDeathGun(
  role: RoleComponent | undefined,
  id: string,
): DeathGunReadView | undefined {
  return allDeathGuns(role).find((gun) => gun.id === id);
}

function bind(world: World, actorId: number, gun: DeathGun, sourceRole: RoleComponent): void {
  const role = world.getComponent(actorId, COMPONENT.Role),
    life = world.getComponent(actorId, COMPONENT.Alive),
    version = life && aliveLifeVersion(life);
  if (!role || world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Good || !life?.alive || version === undefined)
    throw new Error("death_ability_owner_invalid");
  // 这是新赠枪绑定入口；只否决退休演员，原体／已付提案复验仍由不含墓碑的 ownerCurrent 执行。
  if (isRoleExecutionRetired(role) || isRoleExecutionRetired(sourceRole))
    throw new Error("death_ability_owner_invalid");
  owners.set(gun, {
    world,
    actorId,
    role,
    roleKind: role.role,
    camp: world.getComponent(actorId, COMPONENT.Camp)?.camp,
    privateState: role.privateState,
    life,
    version,
    id: gun.id,
    source: gun.source,
    sourceKind: gun.source.kind,
    sourceActor: gun.source.actorId,
    ...(gun.source.kind === "transfer" ? { sourceId: gun.source.abilityId } : {}),
    grantedNight: gun.grantedNight,
    armedOnNight: gun.armedOnNight,
  });
}

export function deathGunOwnerCurrent(
  world: World,
  actorId: number,
  gun: DeathGunReadView,
  onDeath = false,
): boolean {
  const owner = owners.get(gun);
  if (!owner || owner.world !== world || owner.actorId !== actorId) return false;
  const version = aliveLifeVersion(owner.life);
  return (
    gun.id === owner.id &&
    gun.kind === "gun" &&
    gun.source === owner.source &&
    gun.source.kind === owner.sourceKind &&
    gun.source.actorId === owner.sourceActor &&
    (gun.source.kind === "gift" || gun.source.abilityId === owner.sourceId) &&
    gun.sourceDisclosed === false &&
    gun.grantedNight === owner.grantedNight &&
    gun.armedOnNight === owner.armedOnNight &&
    world.getComponent(actorId, COMPONENT.Role) === owner.role &&
    owner.role.role === owner.roleKind &&
    world.getComponent(actorId, COMPONENT.Camp)?.camp === owner.camp &&
    owner.role.privateState === owner.privateState &&
    findDeathGun(owner.role, gun.id) === gun &&
    world.getComponent(actorId, COMPONENT.Alive) === owner.life &&
    (onDeath
      ? !owner.life.alive && version === owner.version + 1
      : owner.life.alive && version === owner.version)
  );
}

function emit(
  events: GameEvent[],
  actorId: number,
  gun: Pick<
    DeathGunReadView,
    "id" | "grantedNight" | "armedOnNight" | "remaining" | "disabled" | "deathExpired"
  >,
  operation: "granted" | "armed" | "disabled" | "enabled" | "transferred_out",
  abilityId = gun.id,
): void {
  events.push({
    timestamp: Date.now(),
    type: "death_ability_changed",
    payload: {
      actorId,
      abilityId,
      operation,
      grantedNight: gun.grantedNight,
      armedOnNight: gun.armedOnNight,
      remaining: gun.remaining,
      disabled: gun.disabled,
      deathExpired: gun.deathExpired,
    },
  });
}

/** 安装原体证明后写入目标库存，再推进计数并发表授予事实；发布失败保留此前写入，不回滚安装。 */
export function grantDeathGun(
  world: World,
  fromId: EntityId,
  toId: EntityId,
  night: number,
  events: GameEvent[],
): DeathGunReadView {
  const from = world.getComponent(fromId, COMPONENT.Role),
    to = world.getComponent(toId, COMPONENT.Role);
  if (
    fromId === toId ||
    !from ||
    world.getComponent(fromId, COMPONENT.Camp)?.camp !== Camp.Good ||
    !world.getComponent(fromId, COMPONENT.Alive)?.alive ||
    !to ||
    world.getComponent(toId, COMPONENT.Camp)?.camp !== Camp.Good ||
    !world.getComponent(toId, COMPONENT.Alive)?.alive ||
    !Number.isSafeInteger(night) ||
    night < 1
  )
    throw new Error("death_ability_grant_invalid");
  if (isRoleExecutionRetired(from) || isRoleExecutionRetired(to))
    throw new Error("death_ability_grant_invalid");
  if (allDeathGuns(to).length) throw new Error("death_ability_gun_already_owned");
  const next = (counters.get(world) ?? 0) + 1,
    id = `gift-gun:${next}`;
  if (
    (
      (to.privateState as { readonly retiredDeathAbilityIds?: unknown }).retiredDeathAbilityIds as
        string[] | undefined
    )?.includes(id)
  )
    throw new Error("death_ability_id_retired");
  const gun: DeathGun = {
    id,
    kind: "gun",
    source: { kind: "gift", actorId: fromId },
    sourceDisclosed: false,
    grantedNight: night,
    armedOnNight: null,
    remaining: 1,
    disabled: false,
    deathExpired: false,
  };
  bind(world, toId, gun, from);
  // bind 的原 privateState getter 后再核捕获双端；失败不安装枪、不推进计数，不回滚已建立证明。
  if (isRoleExecutionRetired(from) || isRoleExecutionRetired(to))
    throw new Error("death_ability_grant_invalid");
  const stored = ((
    to.privateState as { deathAbilities?: Record<string, DeathGun> }
  ).deathAbilities ??= {}) as Record<string, DeathGun>;
  // 目标库存 getter 仍在原点；它导致双端退休时，保字典前缀但不装入新枪。
  if (isRoleExecutionRetired(from) || isRoleExecutionRetired(to))
    throw new Error("death_ability_grant_invalid");
  stored[id] = gun;
  counters.set(world, next);
  emit(events, toId, gun, "granted");
  return gun;
}

// 武装先核原 owner 与库存，随后依次写枪的 armedOnNight、证明中的同值，最后发布事实。
export function armDeathGun(
  world: World,
  actorId: number,
  gun: DeathGunReadView,
  night: number,
  events: GameEvent[],
): void {
  if (!Number.isSafeInteger(night) || night < gun.grantedNight)
    throw new Error("death_ability_activation_invalid");
  if (
    !deathGunOwnerCurrent(world, actorId, gun) ||
    gun.armedOnNight !== null ||
    gun.disabled ||
    gun.deathExpired ||
    gun.remaining === 0
  )
    return;
  // 武装是新执行入口；单独查退休，不污染可供已付 pending 提案使用的纯原体谓词。
  if (isRoleExecutionRetired(owners.get(gun)!.role)) return;
  (gun as { armedOnNight: number | null }).armedOnNight = night;
  owners.get(gun)!.armedOnNight = night;
  emit(events, actorId, gun, "armed");
}

export function activeDeathGun(
  world: World,
  actorId: number,
  id: string,
  day: number,
  onDeath = false,
): DeathGunReadView | undefined {
  const gun = findDeathGun(world.getComponent(actorId, COMPONENT.Role), id);
  return gun &&
    deathGunOwnerCurrent(world, actorId, gun, onDeath) &&
    gun.armedOnNight !== null &&
    gun.armedOnNight <= day &&
    gun.remaining === 1 &&
    !gun.disabled &&
    !gun.deathExpired &&
    !isRoleExecutionRetired(owners.get(gun)!.role)
    ? gun
    : undefined;
}

/** 捕获的是原枪／来源字段并延迟核资格，不创建行动许可；剩弹、武装与当前性仍在实际查询时复核。 */
export function captureDeathGun(
  world: World,
  actorId: number,
  gun: DeathGunReadView,
  day: number,
  current: () => boolean,
) {
  const id = gun.id,
    kind = gun.kind,
    source = gun.source,
    sourceKind = source.kind,
    sourceActor = source.actorId,
    sourceId = source.kind === "transfer" ? source.abilityId : undefined;
  const disclosed = gun.sourceDisclosed,
    granted = gun.grantedNight,
    armed = gun.armedOnNight;
  const disabled = gun.disabled,
    expired = gun.deathExpired;
  const isCurrent = () =>
    current() &&
    gun.id === id &&
    gun.kind === kind &&
    gun.source === source &&
    gun.source.kind === sourceKind &&
    gun.source.actorId === sourceActor &&
    (gun.source.kind === "gift" || gun.source.abilityId === sourceId) &&
    gun.sourceDisclosed === disclosed &&
    gun.grantedNight === granted &&
    gun.armedOnNight === armed &&
    gun.disabled === disabled &&
    gun.deathExpired === expired &&
    deathGunOwnerCurrent(world, actorId, gun, true);
  return {
    isCurrent,
    isEligible: () => isCurrent() && activeDeathGun(world, actorId, id, day, true) === gun,
  };
}

// 死亡回调前捕获原枪及发布字段；首次死亡的 version+1 保持枪权，不能提前永久到期。
export function firstDeathGuns(
  world: World,
  actorId: number,
): Array<{
  actorId: number;
  gun: DeathGunReadView;
  id: string;
  grantedNight: number;
  armedOnNight: number | null;
}> {
  return allDeathGuns(world.getComponent(actorId, COMPONENT.Role))
    .filter((gun) => !gun.deathExpired && deathGunOwnerCurrent(world, actorId, gun, true))
    .map((gun) => ({
      actorId,
      gun,
      id: gun.id,
      grantedNight: gun.grantedNight,
      armedOnNight: gun.armedOnNight,
    }));
}

// 外层收尾逐枪依次清剩弹、禁用、标永久到期；事实只用先前捕获字段，失败不回滚已写前缀。
export function finishDeathGuns(
  rows: ReturnType<typeof firstDeathGuns>,
  events: GameEvent[],
): void {
  for (const { actorId, gun, id, grantedNight, armedOnNight } of rows) {
    if (gun.deathExpired) continue;
    (gun as { remaining: 0 | 1 }).remaining = 0;
    (gun as { disabled: boolean }).disabled = true;
    (gun as { deathExpired: boolean }).deathExpired = true;
    emit(
      events,
      actorId,
      { id, grantedNight, armedOnNight, remaining: 0, disabled: true, deathExpired: true },
      "disabled",
      id,
    );
  }
}

export function setDeathGunEnabled(
  world: World,
  actorId: number,
  id: string,
  enabled: boolean,
  events: GameEvent[],
): void {
  const gun = findDeathGun(world.getComponent(actorId, COMPONENT.Role), id);
  if (!gun || !deathGunOwnerCurrent(world, actorId, gun))
    throw new Error("death_ability_instance_unavailable");
  if (enabled && gun.deathExpired) throw new Error("death_ability_expired");
  if (gun.disabled === !enabled) return;
  (gun as { disabled: boolean }).disabled = !enabled;
  emit(events, actorId, gun, enabled ? "enabled" : "disabled");
}

// 先建立接收者新证明／库存，再删源实例、登记退休 ID，最后源转出→目标授予；不直接搬旧对象。
export function transferDeathGun(
  world: World,
  fromId: number,
  toId: number,
  id: string,
  events: GameEvent[],
): DeathGunReadView {
  const source = world.getComponent(fromId, COMPONENT.Role),
    target = world.getComponent(toId, COMPONENT.Role),
    gun = findDeathGun(source, id);
  if (
    !gun ||
    fromId === toId ||
    !deathGunOwnerCurrent(world, fromId, gun) ||
    !target ||
    world.getComponent(toId, COMPONENT.Camp)?.camp !== Camp.Good ||
    !world.getComponent(toId, COMPONENT.Alive)?.alive ||
    allDeathGuns(target).length ||
    (
      (target.privateState as { readonly retiredDeathAbilityIds?: unknown })
        .retiredDeathAbilityIds as string[] | undefined
    )?.includes(id)
  )
    throw new Error("death_ability_transfer_invalid");
  if (isRoleExecutionRetired(source!) || isRoleExecutionRetired(target))
    throw new Error("death_ability_transfer_invalid");
  const received: DeathGun = {
    ...projectDeathGun(gun),
    source: { kind: "transfer", actorId: fromId, abilityId: id },
  };
  delete (received as DeathGun & { status?: string }).status;
  bind(world, toId, received, source!);
  // 复制／绑定的原 getter 后才到目标库存写点；退休双端只拒新转移，不否定已消费枪的原体证明。
  if (isRoleExecutionRetired(source!) || isRoleExecutionRetired(target))
    throw new Error("death_ability_transfer_invalid");
  const targetStored = (
    ((target.privateState as { deathAbilities?: Record<string, DeathGun> }).deathAbilities ??=
      {}) as Record<string, DeathGun>
  );
  // 原目标容器已求值；只在实际实例写入前复验，不回滚此前证明或空字典。
  if (isRoleExecutionRetired(source!) || isRoleExecutionRetired(target))
    throw new Error("death_ability_transfer_invalid");
  targetStored[id] = received;
  delete (
    (source!.privateState as { readonly deathAbilities?: unknown }).deathAbilities as Record<
      string,
      DeathGun
    >
  )[id];
  (
    ((source!.privateState as { retiredDeathAbilityIds?: string[] }).retiredDeathAbilityIds ??=
      []) as string[]
  ).push(id);
  emit(events, fromId, gun, "transferred_out");
  emit(events, toId, received, "granted");
  return received;
}

// 枪目标、生命与行动许可由调用者复核；这里只将原枪剩弹写为 0，不新增授权、复检或事实。
export function consumeDeathGunShot(gun: DeathGunReadView): void {
  (gun as { remaining: 0 | 1 }).remaining = 0;
}
