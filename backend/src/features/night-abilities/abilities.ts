/**
 * 负责普通夜能力唯一库存的数据复制、查询、原生安装和通用 metadata 提交。
 * 输入为原角色、捕获实例、已准备 payload 与明确日期；输出保留原字典／实例引用和能力变化事实。
 * 本 owner 写 abilities、retiredAbilityIds 及通用启停／次数／到期字段；原生 payload 准备仍归 ability_changes，
 * 授予／转移的来源与状态政策仍归 night-ability-grants，具体瓶数、梦历史、借用抑制及 Demon 审计另有原权威。
 * 字典创建、退休 ID 修订和逐字段提交保原求值顺序；发表或后续写入失败不回滚已完成前缀。
 * 数据复制不新增严格 live schema、JSON 档案接受或行动许可；readonly 视图仍是同一对象，不是冻结或第二库存。
 * F05a 只在 active／授予／转移执行入口拒永久退休身份，纯库存、状态、原生安装、已付写入与清理不据此过滤。
 */

import type {
  PairSeerState,
  NightAbilityStates,
  RoleInspectionPolicy,
  NightAbilityKind,
  AbilitySource,
  NightAbilityReadStates,
  NightAbilityReadState,
} from "@ai-werewolf-arena/game-contract";
import { readPairSeerState } from "../fragrant-pair-seer/pair-data-ports";
import { nativePotionSecondTurn } from "../witch/potion-policy-ports";
import { Role } from "../../domain/model";
import type { RoleComponent } from "../../domain/components/role";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import type { RoleInitializationComponent } from "../../rulesets/roles/contracts";
import { COMPONENT } from "../../domain/components/names";
import type { EntityId, GameEvent } from "../../domain/model";
import type { World } from "../../domain/world";
import { roleOf, emit } from "./night-ability-change-runtime";
import { types as utilTypes } from "node:util";
import type {
  NightAbilityMetadata,
  AbilityStatus,
} from "@ai-werewolf-arena/game-contract/night-ability-views";
export { projectRoleInspectionState, projectSeerState, projectWitchState } from "../../agents/observation/player-state";


export const ROLE_INSPECTION_POLICY_ROLES: Readonly<Record<RoleInspectionPolicy, Role>> = {
  gargoyle: Role.Gargoyle,
  psychic: Role.Psychic,
  mirror: Role.MirrorGirl,
  pure_white: Role.PureWhiteGirl,
  wolf_witch: Role.WolfWitch,
};


/** Pair 初始化和玩家投影共享此原纯数据校验；不读实例、World 或授予能力权限。 */
export function projectPairState(value: unknown): PairSeerState {
  const state = readPairSeerState(value);
  if (!state) throw Error("fragrant_pair_state_invalid");
  return state;
}
type NightAbilityUnion = {
  [P in NightAbilityKind]: NightAbilityMetadata & {
    kind: P;
    state: NightAbilityStates[P];
  };
}[NightAbilityKind];
export type NightAbility<K extends NightAbilityKind = NightAbilityKind> = Extract<
  NightAbilityUnion,
  { kind: K }
>;
type NightAbilityReadUnion = {
  [K in NightAbilityKind]: Readonly<
    Omit<NightAbility<K>, "state" | "source" | "nightSuppression">
  > & {
    readonly state: NightAbilityReadStates[K];
    readonly source: Readonly<AbilitySource>;
    readonly nightSuppression?: Readonly<
      import("@ai-werewolf-arena/game-contract").EclipseSuppression
    >;
  };
}[NightAbilityKind];
export type NightAbilityReadView<K extends NightAbilityKind = NightAbilityKind> = Extract<
  NightAbilityReadUnion,
  { kind: K }
>;

/** 复制有效 JSON 数据；可选 undefined 字段在落盘形状中保持缺失，不改 live 实例。 */
export function copyAbilityData<T>(value: T): T {
  const result = structuredClone(value),
    ancestors = new WeakSet<object>();
  const visit = (item: unknown): void => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || !item || ancestors.has(item))
      throw new Error("ability_state_not_json");
    ancestors.add(item);
    if (Array.isArray(item)) {
      for (let index = 0; index < item.length; index++) {
        if (!Object.hasOwn(item, index)) throw new Error("ability_state_not_json");
        visit(item[index]);
      }
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null)
        throw new Error("ability_state_not_json");
      for (const [key, entry] of Object.entries(item)) {
        if (entry === undefined) delete (item as Record<string, unknown>)[key];
        else visit(entry);
      }
    }
    ancestors.delete(item);
  };
  visit(result);
  return result;
}

/** 资源只归该玩家实际库存中的实例，不另建并行角色状态。 */
export function allNightAbilities(role: RoleComponent | undefined): NightAbilityReadView[] {
  const stored = (role as { readonly privateState: { readonly abilities?: unknown } } | undefined)
    ?.privateState.abilities as Readonly<Record<string, NightAbilityReadView>> | undefined;
  return stored
    ? Object.values(stored).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    : [];
}

/** 检查原 nightSuppression 描述符，畸形或访问器保持 blocked，不调用该字段 getter；只读结果不授予权限／lease。 */
export function nightAbilityDisabled(ability: NightAbilityReadView): boolean {
  const blocker = Object.getOwnPropertyDescriptor(ability, "nightSuppression");
  return ability.disabled || (!!blocker && (!("value" in blocker) || blocker.value !== undefined));
}

export function abilityStatus(ability: NightAbilityReadView, day: number): AbilityStatus {
  if (nightAbilityDisabled(ability) || ability.deathExpired) return "disabled";
  if (day < ability.startsOnDay) return "pending";
  if (ability.expiresAfterDay !== undefined && day > ability.expiresAfterDay) return "expired";
  if (ability.maxUses !== null && ability.uses >= ability.maxUses) return "spent";
  if (
    ability.lastUsedDay === day &&
    !(ability.kind === "potion" && nativePotionSecondTurn(ability, day))
  )
    return "used_this_night";
  if (
    ability.kind === "potion" &&
    ability.source.kind === "native" &&
    ability.source.role === Role.Witch &&
    ability.state.potionPolicy === "awa_both_native_experimental_v1" &&
    ability.state.potionTurnClosedDay === day
  )
    return "used_this_night";
  return "active";
}

export function findNightAbility<K extends NightAbilityKind>(
  role: RoleComponent | undefined,
  kind: K,
  id?: string,
): NightAbilityReadView<K> | undefined {
  const candidates = allNightAbilities(role).filter(
    (ability): ability is NightAbilityReadView<K> => ability.kind === kind,
  );
  if (id !== undefined) return candidates.find((ability) => ability.id === id);
  // 原调用者优先选原生实例；仅有一份明确受赠实例时才采用该实例。
  return (
    candidates.find((ability) => ability.source.kind === "native") ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

export function activeNightAbility<K extends NightAbilityKind>(
  role: RoleComponent | undefined,
  kind: K,
  day: number,
  id?: string,
): NightAbilityReadView<K> | undefined {
  const ability = findNightAbility(role, kind, id);
  // 原数据查找／status 先完成；永久退休只否决执行，不删除库存或把状态改成 disabled。
  return ability && abilityStatus(ability, day) === "active" && role && !isRoleExecutionRetired(role)
    ? ability
    : undefined;
}

/** 读取原退休 ID 列表，不授予库存写权限。 */
export function retiredNightAbilityIds(role: RoleComponent): readonly string[] {
  return ((role.privateState as { readonly retiredAbilityIds?: unknown }).retiredAbilityIds ??
    []) as readonly string[];
}

/**
 * 原准备方已按各族规则复制并接受 payload；这里先创建字典，再读退休 ID 修订原生编号。
 * kind／来源失配时保留旧实例；匹配只替换 state，原 metadata、次数和起效日期保持。
 * 字典已创建后退休列表读取失败，不撤销这一前缀；本步不新增状态 schema 或行动许可。
 */
export function commitPreparedNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  ownedState: NightAbilityStates[K],
): NightAbilityReadState<K>;
export function commitPreparedNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  ownedState: NightAbilityStates[K],
  mayCommit: () => boolean,
): NightAbilityReadState<K> | null;
export function commitPreparedNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  ownedState: NightAbilityStates[K],
  mayCommit?: () => boolean,
): NightAbilityReadState<K> | null {
  const stored = ((role.privateState as { abilities?: Record<string, NightAbility> }).abilities ??=
    {}) as Record<string, NightAbility>;
  const retired = ((role.privateState as { readonly retiredAbilityIds?: unknown })
    .retiredAbilityIds ?? []) as string[];
  const baseId = `native:${kind}`;
  let id = baseId,
    revision = 1;
  while (retired.includes(id)) id = `${baseId}:${++revision}`;
  const existing = stored[id];
  if (existing) {
    if (
      existing.kind !== kind ||
      existing.source.kind !== "native" ||
      existing.source.role !== role.role
    )
      throw new Error("ability_native_binding_conflict");
    // 已建字典与原冲突读取不回滚；回调仅否决实际 state 安装，不是完整资源许可。
    if (mayCommit && !mayCommit()) return null;
    existing.state = ownedState;
  } else {
    // 原 RHS（尤其 role.role getter）先全部完成，再核未付拒绝；不强化外来字典的接受域。
    const installed = {
      id,
      kind,
      state: ownedState,
      source: { kind: "native", role: role.role },
      sourceDisclosed: true,
      startsOnDay: 1,
      maxUses: null,
      uses: 0,
      lastUsedDay: null,
      disabled: false,
    } as NightAbility;
    if (mayCommit && !mayCommit()) return null;
    stored[id] = installed;
  }
  return ownedState as NightAbilityReadState<K>;
}

/**
 * 按原库存 ID 寻找实例；死亡到期不能重开，启停值已一致时不发布事实。
 * 先写 disabled 再发表，事件写入失败仍保留已完成的启停值，不退还具体资源。
 */
export function setNightAbilityEnabled(
  world: World,
  actorId: EntityId,
  id: string,
  enabled: boolean,
  events: GameEvent[],
): void {
  const ability = allNightAbilities(roleOf(world, actorId)).find((ability) => ability.id === id);
  if (!ability) throw new Error("ability_instance_missing");
  if (enabled && ability.deathExpired) throw new Error("ability_lucky_expired_on_death");
  if (ability.disabled === !enabled) return;
  (ability as { disabled: boolean }).disabled = !enabled;
  emit(events, actorId, ability, enabled ? "enabled" : "disabled");
}

/**
 * 退役角色已核对原体／捕获槽的借用实例，只重定义原 disabled 数据属性。
 * 目标 supplier 在 Object.defineProperty 方法查找之后执行，保原 late 字段读取位置。
 * 不按可变 id 重查、不读或执行替换的 disabled getter/setter、不删槽／退休 ID，不发布启停事实。
 * 借用租约、原主抑制和已付 payload 仍归具体 Frame；本写入不提供新行动权限或退款。
 */
export function retireBorrowedNightAbility(readBorrowed: () => NightAbilityReadView): void {
  Object.defineProperty(readBorrowed(), "disabled", {
    value: true,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** 实际死亡到期跟随同一实例经过转移／复活；已经付款的夜效果仍按原政策保留。 */
export function expireLuckyAbilitiesOnDeath(
  world: World,
  actorId: EntityId,
  events: GameEvent[],
): void {
  for (const ability of allNightAbilities(world.getComponent(actorId, COMPONENT.Role))) {
    if (
      (ability.activation !== "lucky" && ability.activation !== "black_market") ||
      ability.deathExpired
    )
      continue;
    (ability as { deathExpired?: boolean }).deathExpired = true;
    (ability as { disabled: boolean }).disabled = true;
    emit(events, actorId, ability, "disabled");
  }
}


/** 初始化／学习流程仍在原调用点决定起效日；这里只写原 startsOnDay，不推进业务时钟。 */
export function setNightAbilityStartDay(ability: NightAbilityReadView, day: number): void {
  (ability as { startsOnDay: number }).startsOnDay = day;
}

/** 原 status 重检后先记 lastUsedDay，再可选增加 uses；payload 库存与已付效果继续归具体机制。 */
export function recordNightAbilityUse(
  ability: NightAbilityReadView,
  day: number,
  consumed: boolean,
): void {
  if (abilityStatus(ability, day) !== "active") throw new Error("ability_not_active");
  (ability as { lastUsedDay: number | null }).lastUsedDay = day;
  if (consumed) (ability as { uses: number }).uses++;
}

/** 本族初始化已经先完成；这里只在原清空点安装新空字典，不读取退休列表或补偿旧库存。 */
export function initializeNightAbilityInventory(role: RoleInitializationComponent): void {
  role.privateState.abilities = {};
}

/** 来源与安装政策已由授予 owner 复验；安装先于发表，同一事件失败不撤回已安装实例。 */
export function commitGrantedNightAbility(
  role: RoleComponent,
  actorId: EntityId,
  ability: NightAbility,
  events: GameEvent[],
  sourceRole: RoleComponent,
): NightAbility {
  // 捕获的源／目标角色只提供本次退休读数，不新增 World 换体策略或授予许可。
  if (isRoleExecutionRetired(role) || isRoleExecutionRetired(sourceRole))
    throw new Error("ability_actor_execution_retired");
  // 原字典赋值已发生后才发布；push／时钟／来源克隆失败都保留已安装实例。
  const stored = ((role.privateState as { abilities?: Record<string, NightAbility> }).abilities ??=
    {}) as Record<string, NightAbility>;
  // 容器 getter／空字典初始化后再核；失败保原已写前缀，不安装新实例。
  if (isRoleExecutionRetired(role) || isRoleExecutionRetired(sourceRole))
    throw new Error("ability_actor_execution_retired");
  stored[ability.id] = ability;
  emit(events, actorId, ability, "granted");
  return ability;
}

/** 转移只接收稳定的自有数据槽；这不是其他 live payload 的通用 schema，也不改变授予的接受面。 */
function transferPrivateState(role: RoleComponent): object {
  if (utilTypes.isProxy(role)) throw new Error("ability_transfer_inventory_invalid");
  const descriptor = Object.getOwnPropertyDescriptor(role, "privateState");
  const value = descriptor && "value" in descriptor ? descriptor.value : undefined;
  if (!value || typeof value !== "object" || utilTypes.isProxy(value))
    throw new Error("ability_transfer_inventory_invalid");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("ability_transfer_inventory_invalid");
  return value;
}

/** 库存与条目保持同引用；不调用库存访问器，也不把两次 getter 相等当作稳定性证明。 */
function transferInventory(privateState: object): Record<string, NightAbility> | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(privateState, "abilities");
  if (!descriptor) {
    if ("abilities" in privateState) throw new Error("ability_transfer_inventory_invalid");
    return undefined;
  }
  if (!("value" in descriptor)) throw new Error("ability_transfer_inventory_invalid");
  const value = descriptor.value;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || utilTypes.isProxy(value))
    throw new Error("ability_transfer_inventory_invalid");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("ability_transfer_inventory_invalid");
  for (const key of Reflect.ownKeys(value)) {
    if (!("value" in Object.getOwnPropertyDescriptor(value, key)!))
      throw new Error("ability_transfer_inventory_invalid");
  }
  return value as Record<string, NightAbility>;
}

/**
 * 完整预检已完成后，唯一库存 owner 晚核原角色与真实数据槽，再按源删除／退休、目标安装、两条事实提交。
 * 同角色、同容器、同字典或源条目别名不属于合法转移输入；空目标字典仍到安装点才创建。
 * 退休列表的 getter／push 在源删除后原点执行；任何抛错保已完成前缀与原 Error，不退款、不补偿、不暗改 disabled。
 * 记录 sink 只获得事件输入，不取得库存写权；任意强制写回旧槽的 JS monkeypatch 不属于这一有界唯一 owner 保证。
 */
export function commitTransferredNightAbility(
  world: World,
  source: RoleComponent,
  originalPrivateState: object,
  target: RoleComponent,
  fromId: EntityId,
  toId: EntityId,
  id: string,
  ability: NightAbilityReadView,
  received: NightAbility,
  events: GameEvent[],
): void {
  if (source === target) throw new Error("ability_transfer_inventory_alias");
  if (roleOf(world, fromId) !== source || roleOf(world, toId) !== target)
    throw new Error("ability_transfer_owner_revoked");
  const sourcePrivate = transferPrivateState(source), targetPrivate = transferPrivateState(target);
  if (sourcePrivate !== originalPrivateState) throw new Error("ability_transfer_owner_revoked");
  if (sourcePrivate === targetPrivate) throw new Error("ability_transfer_inventory_alias");
  const sourceStored = transferInventory(sourcePrivate), targetStored = transferInventory(targetPrivate);
  if (sourceStored === targetStored && sourceStored !== undefined)
    throw new Error("ability_transfer_inventory_alias");
  if (utilTypes.isProxy(ability)) throw new Error("ability_transfer_inventory_invalid");
  const sourceEntry = sourceStored && Object.getOwnPropertyDescriptor(sourceStored, id),
    sourceId = Object.getOwnPropertyDescriptor(ability, "id");
  if (
    !sourceStored || !sourceEntry || !("value" in sourceEntry) || sourceEntry.value !== ability ||
    !sourceId || !("value" in sourceId) || sourceId.value !== id ||
    Reflect.ownKeys(sourceStored).filter(
      (key) => Object.getOwnPropertyDescriptor(sourceStored, key)!.value === ability,
    ).length !== 1
  )
    throw new Error("ability_transfer_source_slot_invalid");
  if (targetStored && Reflect.ownKeys(targetStored).some(
    (key) => Object.getOwnPropertyDescriptor(targetStored, key)!.value === ability,
  ))
    throw new Error("ability_transfer_inventory_alias");
  // 原政策与完整槽预检之后才否决退休双端；不借数据查询过滤 actor。
  if (isRoleExecutionRetired(source) || isRoleExecutionRetired(target))
    throw new Error("ability_transfer_owner_revoked");
  // 删除按已核对的真实 key，而非凭 Object.values 中的实例 id 猜测槽；失败不进入目标安装。
  delete sourceStored[id];
  (
    ((sourcePrivate as { retiredAbilityIds?: string[] }).retiredAbilityIds ??= []) as string[]
  ).push(id);
  // 源已经删除／登记 ID；期间 getter 导致角色授权退休仍拒目标安装，不补回源。
  if (isRoleExecutionRetired(source) || isRoleExecutionRetired(target))
    throw new Error("ability_transfer_owner_revoked");
  // 空目标库存的创建也在源退休之后；安装或 granted 发布失败不会重装源槽。
  const stored = targetStored ?? ((targetPrivate as { abilities?: Record<string, NightAbility> }).abilities = {});
  if (isRoleExecutionRetired(source) || isRoleExecutionRetired(target))
    throw new Error("ability_transfer_owner_revoked");
  stored[received.id] = received;
  emit(events, toId, received, "granted");
  emit(events, fromId, ability, "transferred_out");
}
