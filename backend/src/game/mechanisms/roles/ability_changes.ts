/**
 * 负责普通夜能力原生安装、授予、起效日、启停、次数、首次死亡到期、借用退役和明确转移。
 * 输入为原角色／实例、安装数据、业务日期及具体转移 statePolicy；输出为原只读存储引用和事实。
 * 仅拥有 abilities、retiredAbilityIds 与公共 metadata 写权，角色 payload 库存仍归具体机制。
 * 保留原 clone、回调、World／getter 重检、安装／delete／push／发布顺序；不更换私有容器、
 * 恢复已付资源或用新 Store／通用事务遮蔽部分失败。
 */
import type {
  AbilitySource,
  NightAbilityKind,
  NightAbilityStates,
  NightAbilityReadState,
  RoleInspectionState,
} from "@ai-werewolf-arena/game-contract";

import { isDeepStrictEqual } from "node:util";
import { DREAM_PROTECTION_POLICIES } from "../../../core/domain/board";
import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import { Role, type EntityId, type GameEvent } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import {
  allNightAbilities,
  abilityStatus,
  projectPairState,
  copyAbilityData,
  roleInspectionPolicy,
  projectNightState,
  type NightAbility,
  type NightAbilityReadView,
} from "./abilities";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";

export interface AbilityGrant<K extends NightAbilityKind> {
  id: string;
  kind: K;
  state: NightAbilityStates[K];
  source: Extract<AbilitySource, { kind: "gift" | "copy" }>;
  startsOnDay: number;
  expiresAfterDay?: number;
  maxUses: number | null;
  sourceDisclosed?: boolean;
  activation?: "lucky" | "black_market";
}
const roleOf = (world: World, actorId: EntityId): RoleComponent => {
  const role = world.getComponent(actorId, COMPONENT.Role);
  if (!role) throw new Error("ability_actor_missing");
  return role;
};
const emit = (
  events: GameEvent[],
  actorId: EntityId,
  ability: NightAbilityReadView,
  operation: "granted" | "disabled" | "enabled" | "transferred_out",
) =>
  events.push({
    timestamp: Date.now(),
    type: "ability_changed",
    payload: {
      actorId,
      abilityId: ability.id,
      kind: ability.kind,
      operation,
      source: structuredClone(ability.source),
      sourceDisclosed: ability.sourceDisclosed,
      startsOnDay: ability.startsOnDay,
      ...(ability.expiresAfterDay === undefined
        ? {}
        : { expiresAfterDay: ability.expiresAfterDay }),
      maxUses: ability.maxUses,
    },
  });

/** 规则调用者明确提供状态／资源政策，不隐式复制目标历史或重置已付库存。 */
export function grantNightAbility<K extends NightAbilityKind>(
  world: World,
  actorId: EntityId,
  input: AbilityGrant<K>,
  events: GameEvent[],
): NightAbilityReadView<K> {
  if (input.kind === "pair_check") throw Error("ability_pair_native_only");
  if (input.source.kind !== "gift" && input.source.kind !== "copy")
    throw new Error("ability_grant_source_invalid");
  const ability = copyAbilityData({
    ...input,
    sourceDisclosed: input.sourceDisclosed ?? false,
    uses: 0,
    lastUsedDay: null,
    disabled: false,
  }) as unknown as NightAbility<K>;
  return installAbility(world, actorId, ability, events) as NightAbilityReadView<K>;
}

function installAbility(
  world: World,
  actorId: EntityId,
  ability: NightAbility,
  events: GameEvent[],
): NightAbility {
  const input = ability;
  if (input.kind === "pair_check") throw Error("ability_pair_native_only");
  if (input.kind === "role_check") roleInspectionPolicy(input.state);
  if (
    input.kind === "dream" &&
    input.state.protectionPolicy !== undefined &&
    !DREAM_PROTECTION_POLICIES.includes(input.state.protectionPolicy)
  )
    throw new Error("ability_dream_policy_invalid");
  const source = input.source;
  if (
    input.kind === "role_check" &&
    roleInspectionPolicy(input.state) === "mirror" &&
    source.kind !== "transfer" &&
    (Object.keys(input.state)
      .filter((key) => key !== "inspectionPolicy")
      .sort()
      .join() !== "history,lastDay,lastTarget,policy" ||
      input.state.lastTarget !== null ||
      input.state.lastDay !== null ||
      !Array.isArray(input.state.history) ||
      input.state.history.length !== 0 ||
      Object.keys(input.state.history).length !== 0 ||
      input.uses !== 0 ||
      input.lastUsedDay !== null ||
      input.disabled)
  )
    throw new Error("ability_mirror_initial_state_invalid");
  if (source.kind === "native") throw new Error("ability_grant_source_invalid");
  const role = roleOf(world, actorId);
  if (
    !/^[a-z][a-z0-9:_-]{0,127}$/.test(input.id) ||
    input.id.startsWith("native:") ||
    !Number.isSafeInteger(input.startsOnDay) ||
    input.startsOnDay < 1 ||
    (input.expiresAfterDay !== undefined &&
      (!Number.isSafeInteger(input.expiresAfterDay) ||
        input.expiresAfterDay < input.startsOnDay)) ||
    (input.maxUses !== null && (!Number.isSafeInteger(input.maxUses) || input.maxUses < 0))
  )
    throw new Error("ability_grant_invalid");
  roleOf(world, source.actorId);
  if (
    input.activation === "black_market" &&
    (source.kind === "copy" ||
      input.sourceDisclosed !== false ||
      input.id !== "gift:black-market" ||
      role.camp !== "good" ||
      input.startsOnDay < 2)
  )
    throw new Error("ability_black_market_policy_invalid");
  const origin =
    source.kind === "copy"
      ? allNightAbilities(roleOf(world, source.actorId)).find(
          (ability) => ability.id === source.abilityId,
        )
      : undefined;
  if (origin?.activation === "lucky" || origin?.activation === "black_market")
    throw new Error("ability_copy_lucky_not_supported");
  if (
    input.activation !== undefined &&
    (!["lucky", "black_market"].includes(input.activation) ||
      !(
        input.activation === "black_market"
          ? ["seer_check", "potion"]
          : ["seer_check", "potion", "guard"]
      ).includes(input.kind) ||
      input.maxUses !== 1)
  )
    throw new Error("ability_lucky_policy_invalid");
  if (
    allNightAbilities(role).some((ability) => ability.id === input.id) ||
    (
      ((role.privateState as { readonly retiredAbilityIds?: unknown }).retiredAbilityIds ??
        []) as string[]
    ).includes(input.id)
  )
    throw new Error("ability_id_duplicate");
  if (
    source.kind !== "gift" &&
    !allNightAbilities(roleOf(world, source.actorId)).some(
      (ability) => ability.id === source.abilityId && ability.kind === input.kind,
    )
  )
    throw new Error("ability_source_mismatch");
  const stored = ((role.privateState as { abilities?: Record<string, NightAbility> }).abilities ??=
    {}) as Record<string, NightAbility>;
  stored[ability.id] = ability;
  emit(events, actorId, ability, "granted");
  return ability;
}

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

/** 先验证／安装目标，再移除原 owner；保留计数、原夜时点与中途发布失败前缀。 */
export function transferNightAbility<K extends NightAbilityKind>(
  world: World,
  fromId: EntityId,
  toId: EntityId,
  id: string,
  targetId: string,
  events: GameEvent[],
  options: {
    kind: K;
    statePolicy: (state: Readonly<NightAbilityStates[K]>) => NightAbilityStates[K];
    sourceDisclosed?: boolean;
  },
): void {
  if (fromId === toId) throw new Error("ability_transfer_same_owner");
  const source = roleOf(world, fromId),
    ability = allNightAbilities(source).find((ability) => ability.id === id);
  if (!ability) throw new Error("ability_instance_missing");
  if (ability.kind === "pair_check") throw Error("ability_pair_native_only");
  if (!options || options.kind !== ability.kind || typeof options.statePolicy !== "function")
    throw new Error("ability_transfer_policy_required");
  const black = ability.activation === "black_market",
    target = roleOf(world, toId),
    fromLife = captureNightLife(world, fromId),
    toLife = captureNightLife(world, toId),
    originalState = ability.state,
    originalSource = ability.source,
    sourcePrivate = source.privateState,
    targetPrivate = target.privateState,
    originalRole = source.role,
    targetRole = target.role;
  if (
    black &&
    (!fromLife ||
      !toLife ||
      source.camp !== "good" ||
      target.camp !== "good" ||
      targetId !== id ||
      options.sourceDisclosed === true)
  )
    throw new Error("ability_black_market_transfer_invalid");
  const before = black
    ? copyAbilityData({
        id: ability.id,
        kind: ability.kind,
        source: ability.source,
        startsOnDay: ability.startsOnDay,
        expiresAfterDay: ability.expiresAfterDay,
        maxUses: ability.maxUses,
        uses: ability.uses,
        lastUsedDay: ability.lastUsedDay,
        disabled: ability.disabled,
        deathExpired: ability.deathExpired,
        activation: ability.activation,
        sourceDisclosed: ability.sourceDisclosed,
        state: projectNightState(ability),
      })
    : undefined;
  const targetState = copyAbilityData(
    options.statePolicy(
      copyAbilityData(black ? projectNightState(ability) : ability.state) as NightAbilityStates[K],
    ),
  );
  if (
    black &&
    (options.kind !== ability.kind ||
      options.sourceDisclosed === true ||
      world.getComponent(fromId, COMPONENT.Role) !== source ||
      source.role !== originalRole ||
      source.camp !== "good" ||
      source.privateState !== sourcePrivate ||
      world.getComponent(toId, COMPONENT.Role) !== target ||
      target.role !== targetRole ||
      target.camp !== "good" ||
      target.privateState !== targetPrivate ||
      !livingNightLife(world, fromLife!) ||
      !livingNightLife(world, toLife!) ||
      allNightAbilities(source).find((candidate) => candidate.id === id) !== ability ||
      ability.state !== originalState ||
      ability.source !== originalSource ||
      !isDeepStrictEqual(
        before,
        copyAbilityData({
          id: ability.id,
          kind: ability.kind,
          source: ability.source,
          startsOnDay: ability.startsOnDay,
          expiresAfterDay: ability.expiresAfterDay,
          maxUses: ability.maxUses,
          uses: ability.uses,
          lastUsedDay: ability.lastUsedDay,
          disabled: ability.disabled,
          deathExpired: ability.deathExpired,
          activation: ability.activation,
          sourceDisclosed: ability.sourceDisclosed,
          state: projectNightState(ability),
        }),
      ))
  )
    throw new Error("ability_black_market_transfer_revoked");
  if (
    (ability.activation === "lucky" || ability.activation === "black_market") &&
    !isDeepStrictEqual(targetState, black ? projectNightState(ability) : ability.state)
  )
    throw new Error("ability_transfer_lucky_state_changed");
  // 转移保持资源；seer_check 明确政策可重置知识，role_check 保留完整历史，其他政策不能补库存。
  if (
    ability.kind === "guard" &&
    (targetState as NightAbilityStates["guard"]).lastTarget !== ability.state.lastTarget
  )
    throw new Error("ability_transfer_resources_changed");
  if (
    ability.kind === "dream" &&
    ((targetState as NightAbilityStates["dream"]).lastTarget !== ability.state.lastTarget ||
      (targetState as NightAbilityStates["dream"]).lastDay !== ability.state.lastDay ||
      (targetState as NightAbilityStates["dream"]).protectionPolicy !==
        ability.state.protectionPolicy)
  )
    throw new Error("ability_transfer_resources_changed");
  if (
    ability.kind === "potion" &&
    [
      "heal",
      "poison",
      "selfHealRule",
      "canSelfHeal",
      "healUsedThisNight",
      "poisonUsedThisNight",
    ].some(
      (key) =>
        (targetState as unknown as Record<string, unknown>)[key] !==
        (ability.state as unknown as Record<string, unknown>)[key],
    )
  )
    throw new Error("ability_transfer_resources_changed");
  if (ability.kind === "role_check" && !isDeepStrictEqual(targetState, ability.state))
    throw new Error("ability_transfer_role_inspection_history_changed");
  const received = copyAbilityData({
    ...ability,
    state: targetState,
    id: targetId,
    sourceDisclosed: options.sourceDisclosed ?? false,
    source: { kind: "transfer", actorId: fromId, abilityId: id },
  }) as NightAbility;
  installAbility(world, toId, received, events);
  delete (
    (source.privateState as { readonly abilities?: unknown }).abilities as Record<
      string,
      NightAbility
    >
  )[id];
  (
    ((source.privateState as { retiredAbilityIds?: string[] }).retiredAbilityIds ??= []) as string[]
  ).push(id);
  emit(events, fromId, ability, "transferred_out");
}

/** 原生安装先完成原 copy／policy，再写实际 abilities 槽；不提前读取退休 ID 或更换私有容器。 */
export function installNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  state: NightAbilityStates[K],
): NightAbilityReadState<K> {
  if (kind === "pair_check" && role.role !== Role.AwakenedSeer)
    throw Error("ability_pair_native_role_invalid");
  const ownedState = (
    kind === "pair_check" ? copyAbilityData(projectPairState(state)) : copyAbilityData(state)
  ) as NightAbilityStates[K];
  if (kind === "role_check") roleInspectionPolicy(ownedState as RoleInspectionState);
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
    existing.state = ownedState;
  } else {
    stored[id] = {
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
  }
  return ownedState as NightAbilityReadState<K>;
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
