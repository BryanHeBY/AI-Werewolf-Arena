/**
 * 负责普通夜能力授予、复制与明确转移的完整提交。输入为原 World、拥有者、安装数据与具体 statePolicy；
 * 输出为同一实际库存中的只读实例及原能力变化事实。校验、复制、来源复验和目标安装都由本模块负责。
 * 授予仍安装后发布；独立 F03 转移政策先完整预检，再由唯一库存 owner 先删源／退休、后安装目标／发布。
 * 转移拒绝共享或不稳定库存路径；异常保留已经发生的前缀和原 Error，不退款，记录 sink 不取得库存写权。
 * 字典安装／发布与删除／退休提交交唯一 abilities owner；本模块保完整来源政策，角色 payload、生命／租约和临时抑制仍有原负责人。
 * 数据复制仍消费唯一 copyAbilityData，原接受集合不加强；这不是全部角色状态 schema 或严格复盘 codec。
 */
import { roleInspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import type { AbilitySource, NightAbilityKind, NightAbilityStates } from "@ai-werewolf-arena/game-contract";
import { isDeepStrictEqual } from "node:util";
import { DREAM_PROTECTION_POLICIES } from "../../../core/domain/board";
import { COMPONENT } from "../../../core/domain/components/names";
import { type EntityId, type GameEvent } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { RoleComponent } from "../../../core/domain/components/role";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import { allNightAbilities, copyAbilityData, commitGrantedNightAbility, commitTransferredNightAbility, type NightAbility, type NightAbilityReadView } from "./abilities";
import { projectNightState } from "../../observation/night-ability-projection";
import { roleOf } from "./night-ability-change-runtime";

/** 安装数据只声明赠予／复制来源；日期和资源政策仍在原安装流程核对，不代表已有行动许可。 */
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
  const role = validateAbilityInstall(world, actorId, ability);
  return commitGrantedNightAbility(role, actorId, ability, events) as NightAbilityReadView<K>;
}

/** 完整原安装预检只返回实际目标 Role；库存提交另有唯一 owner，授予和转移共用原政策。 */
function validateAbilityInstall(
  world: World,
  actorId: EntityId,
  ability: NightAbility,
): RoleComponent {
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
  return role;
}

/** 先完成原复制／资源／来源／目标预检；转移提交保计数和原夜时点，但失败不再留下两份合法有效库存。 */
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
  // 政策回调消费独立数据；黑市随后复验原组件／生命／槽及规范化内容，不用复制结果恢复许可。
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
  const installationTarget = validateAbilityInstall(world, toId, received);
  // 预检和复制全通过才交库存写权；F03 的源先退休政策不伪装成旧失败前缀等价。
  commitTransferredNightAbility(world, source, sourcePrivate, installationTarget, fromId, toId, id, ability, received, events);
}
