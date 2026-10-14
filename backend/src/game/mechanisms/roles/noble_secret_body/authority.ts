/**
 * 负责夜之贵族／秘密之身的原体、生命、夜仆契约和实际付款权威。输入为原 roster、实际夜间及受控行动；
 * 输出为已重检提交、通知、到期提案与显式纯数据快照；纯状态写入和唯一审计影子由 state 槽拥有。
 * 正常／撤销、原体替换、资源与记录失败保留原合法前缀，不恢复已付契约或修改对局阶段。
 * 新夜间身份仅关联本 Night 对象；到期消费同一身份，不改变旧日次数值、期限或归档字段。
 * 规则依据：docs/rules/awa-noble-secret-body-twelve-v1.md。
 */
import { attachNightUnit, isNightUnit, nightUnitOf, type NightUnit } from "../../../../core/domain/night-unit";
import { types } from "node:util";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { World } from "../../../../core/domain/world";
import { Camp, Role, Phase } from "../../../../core/domain/identity";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import {
  NobleBodyStateSlot,
  readNobleState,
  readSecretBodyState,
  chooseServant,
  chooseBodyTarget,
  endServant,
  spendBodyForNight,
  revealBodyByExile,
  type NobleState,
  type SecretBodyState,
} from "./state";
import { planSecretBodyBlock, copySecretBodySources, type SecretBodySources } from "./damage";
import {
  copyNobleKnowledge,
  copySecretBodyKnowledge,
  projectNobleKnowledge,
  projectSecretBodyKnowledge,
} from "./player_projection";
import type {
  NobleKnowledge,
  SecretBodyKnowledge,
  NobleBodyNightNotice,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
const invalid = Symbol("invalid_noble_body_owner");
function own(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return invalid;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && "value" in field ? field.value : field ? invalid : undefined;
}
const identityKeys = ["id", "seat", "name", "sessionId"] as const;
interface OriginalPlayer {
  readonly id: number;
  readonly role: RoleComponent;
  readonly kind: unknown;
  readonly camp: unknown;
  readonly privateState: Record<string, unknown>;
  readonly identity: unknown;
  readonly identityValues: readonly unknown[];
  readonly campComponent: unknown;
  readonly victory: unknown;
  readonly victoryValues: string;
  readonly life: AliveComponent;
  readonly version: number;
}
function factoryLife(life: AliveComponent): boolean {
  if (types.isProxy(life)) return false;
  const original = aliveLifeDescriptor(life),
    current = Object.getOwnPropertyDescriptor(life, "alive");
  return (
    !!original &&
    !!current &&
    original.get === current.get &&
    original.set === current.set &&
    original.enumerable === current.enumerable &&
    original.configurable === current.configurable
  );
}
function victoryJson(value: unknown): string | null {
  const affiliations = own(value, "affiliations");
  if (types.isProxy(affiliations) || !Array.isArray(affiliations)) return null;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
      affiliations as object,
    ),
    length: unknown = fields.length?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(fields).length !== length + 1
  )
    return null;
  const entries: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const field = fields[String(i)];
    if (!field || !("value" in field)) return null;
    const raw = field.value;
    if (!raw || typeof raw !== "object" || types.isProxy(raw) || Array.isArray(raw)) return null;
    const row = Object.getOwnPropertyDescriptors(raw),
      data: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(row)) {
      if (
        typeof key !== "string" ||
        !("value" in row[key]!) ||
        !["string", "number"].includes(typeof row[key]!.value)
      )
        return null;
      data[key] = row[key]!.value;
    }
    entries.push(data);
  }
  return JSON.stringify(entries);
}
function capture(world: World, id: number): OriginalPlayer {
  const role = world.getComponent(id, COMPONENT.Role),
    life = world.getComponent(id, COMPONENT.Alive),
    identity = world.getComponent(id, COMPONENT.Identity),
    victory = world.getComponent(id, COMPONENT.Victory);
  const privateState = own(role, "privateState"),
    kind = own(role, "role"),
    camp = own(role, "camp"),
    campComponent = world.getComponent(id, COMPONENT.Camp),
    identityValues = identityKeys.map((k) => own(identity, k)),
    victoryValues = victoryJson(victory);
  const [identityId, seat, name, sessionId] = identityValues;
  if (
    !role ||
    !Object.values(Role).includes(kind as Role) ||
    ![Camp.Good, Camp.Wolf].includes(camp as Camp) ||
    own(campComponent, "camp") !== camp ||
    identityId !== id ||
    !Number.isSafeInteger(seat) ||
    (seat as number) < 1 ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof sessionId !== "string" ||
    !sessionId.trim() ||
    !life ||
    !factoryLife(life) ||
    !life.alive ||
    aliveLifeVersion(life) === undefined ||
    !privateState ||
    typeof privateState !== "object" ||
    types.isProxy(privateState) ||
    Array.isArray(privateState) ||
    victoryValues === null ||
    victoryValues !== JSON.stringify([{ kind: "faction", faction: camp }])
  )
    throw Error("noble_body_initial_binding_invalid");
  return {
    id,
    role,
    kind,
    camp,
    privateState: privateState as Record<string, unknown>,
    identity,
    identityValues,
    campComponent,
    victory,
    victoryValues,
    life,
    version: aliveLifeVersion(life)!,
  };
}
function playerCurrent(world: World, p: OriginalPlayer, living = false): boolean {
  if (
    world.getComponent(p.id, COMPONENT.Role) !== p.role ||
    own(p.role, "role") !== p.kind ||
    own(p.role, "camp") !== p.camp ||
    own(p.role, "privateState") !== p.privateState ||
    world.getComponent(p.id, COMPONENT.Identity) !== p.identity ||
    identityKeys.some((k, i) => own(p.identity, k) !== p.identityValues[i]) ||
    world.getComponent(p.id, COMPONENT.Camp) !== p.campComponent ||
    own(p.campComponent, "camp") !== p.camp ||
    world.getComponent(p.id, COMPONENT.Victory) !== p.victory ||
    victoryJson(p.victory) !== p.victoryValues ||
    world.getComponent(p.id, COMPONENT.Alive) !== p.life ||
    !factoryLife(p.life)
  )
    return false;
  const version = aliveLifeVersion(p.life);
  return p.life.alive ? version === p.version : !living && version === p.version + 1;
}
interface ContractBinding {
  readonly target: OriginalPlayer;
  readonly createdNight: number;
  readonly expiresNight: number;
  readonly id: string;
}
interface ChoiceLease {
  opened: boolean;
  committed: boolean;
}
interface Night {
  readonly day: number;
  readonly isCurrent: () => boolean;
  status: "open" | "normal" | "aborted";
  readonly body: ChoiceLease;
  readonly noble: ChoiceLease;
  readonly requiresBody: boolean;
  readonly requiresNoble: boolean;
  bodyTarget: OriginalPlayer | null;
  bodyResolved: boolean;
  expiryProcessed: boolean;
  revealOpened: boolean;
  revealCompleted: boolean;
}
interface Owner {
  readonly world: World;
  readonly players: ReadonlyMap<number, OriginalPlayer>;
  readonly noble: OriginalPlayer;
  readonly body: OriginalPlayer;
  readonly stateSlot: NobleBodyStateSlot;
  readonly contracts: Map<string, ContractBinding>;
  readonly nights: Map<number, Night>;
  active: Night | null;
  checkingController: boolean;
  nobleKnowledge: NobleKnowledge;
  bodyKnowledge: SecretBodyKnowledge;
  readonly notices: NobleBodyNightNotice[];
}
const owners = new WeakMap<World, Owner>();
function canonicalState(owner: Owner): boolean {
  return (
    own(owner.noble.privateState, "noble") === owner.stateSlot.nobleState &&
    own(owner.body.privateState, "secretBody") === owner.stateSlot.bodyState &&
    owner.stateSlot.matchesCanonicalData()
  );
}
function requireOwner(world: World): Owner {
  const owner = owners.get(world);
  if (
    !owner ||
    owner.checkingController ||
    world.entityIds().length !== owner.players.size ||
    [...owner.players.values()].some((p) => !playerCurrent(world, p)) ||
    !canonicalState(owner)
  )
    throw Error("noble_body_owner_revoked");
  return owner;
}
function checkController(owner: Owner, isCurrent: () => boolean): boolean {
  if (owner.checkingController) throw Error("noble_body_controller_reentry");
  owner.checkingController = true;
  try {
    return isCurrent();
  } finally {
    owner.checkingController = false;
  }
}
function requireNight(
  world: World,
  day: number,
  allowNormal = false,
): { owner: Owner; night: Night } {
  const owner = requireOwner(world),
    night = owner.nights.get(day);
  if (
    !night ||
    (night.status !== "open" && !(allowNormal && night.status === "normal")) ||
    !checkController(owner, night.isCurrent)
  )
    throw Error("noble_body_night_unavailable");
  // 控制回调可能同步取消或改变权威，返回后仍按原顺序再次复验。
  requireOwner(world);
  if (night.status !== "open" && !(allowNormal && night.status === "normal"))
    throw Error("noble_body_night_unavailable");
  return { owner, night };
}
/** 精确角色／预设资格归 bootstrap；这里只捕获一次原状态及其归一化初值，不初始化或授予替代库存。 */
export function installNobleBodyAuthority(world: World, nobleId: number, bodyId: number): void {
  if (owners.has(world)) throw Error("noble_body_already_installed");
  const players = new Map(world.entityIds().map((id) => [id, capture(world, id)])),
    noble = players.get(nobleId),
    body = players.get(bodyId);
  const nobleState = noble && own(noble.privateState, "noble"),
    bodyState = body && own(body.privateState, "secretBody"),
    nobleData = readNobleState(nobleState),
    bodyData = readSecretBodyState(bodyState);
  if (
    !noble ||
    !body ||
    noble === body ||
    noble.camp !== Camp.Wolf ||
    body.camp !== Camp.Good ||
    !nobleData ||
    nobleData.contracts.length ||
    nobleData.lastChoice !== null ||
    !bodyData ||
    bodyData.body.kind !== "intact" ||
    bodyData.lastChoice !== null
  )
    throw Error("noble_body_initial_state_invalid");
  owners.set(world, {
    world,
    players,
    noble,
    body,
    stateSlot: new NobleBodyStateSlot(
      nobleState as NobleState,
      bodyState as SecretBodyState,
      nobleData,
      bodyData,
    ),
    contracts: new Map(),
    nights: new Map(),
    active: null,
    checkingController: false,
    nobleKnowledge: copyNobleKnowledge({
      wolfActionPolicy: nobleData.wolfActionPolicy,
      lastNotifiedNight: 0,
      lastChoice: null,
      contracts: [],
    }),
    bodyKnowledge: copySecretBodyKnowledge({
      protectionRepeatPolicy: bodyData.protectionRepeatPolicy,
      lastNotifiedNight: 0,
      lastChoice: null,
      resource: "intact",
      publicRevealDay: null,
    }),
    notices: [],
  });
}
function mayBegin(owner: Owner, day: number): boolean {
  return (
    !owner.active &&
    !owner.stateSlot.nobleState.contracts.some((c) => c.status.kind === "pending" && c.expiresNight < day) &&
    ![...owner.nights.keys()].some((previous) => previous >= day) &&
    [...owner.nights.values()].every(
      (n) => n.status !== "normal" || (n.bodyResolved && n.expiryProcessed),
    )
  );
}
/** 同步返回通知回执，即使之后没有技能请求；控制方须在当夜请求前按原顺序写入玩家私有记录。 */
export function beginNobleBodyNight(
  world: World,
  day: number,
  isCurrent: () => boolean,
  nightUnit?: NightUnit,
): readonly NobleBodyNightNotice[] {
  // 新自有身份必须属于本次真实夜；旧两参数／三参数调用不增加元数据读取。
  if (isNightUnit(nightUnit) && nightUnit.day !== day)
    throw Error("noble_body_night_unit_day_mismatch");
  const owner = requireOwner(world);
  if (
    !Number.isSafeInteger(day) ||
    day < 1 ||
    day >= Number.MAX_SAFE_INTEGER - 1 ||
    !mayBegin(owner, day) ||
    typeof isCurrent !== "function" ||
    types.isProxy(isCurrent) ||
    !checkController(owner, isCurrent)
  )
    throw Error("noble_body_night_unavailable");
  requireOwner(world);
  if (!mayBegin(owner, day)) throw Error("noble_body_night_unavailable");
  const night: Night = {
    day,
    isCurrent,
    status: "open",
    body: { opened: false, committed: false },
    noble: { opened: false, committed: false },
    requiresBody: playerCurrent(world, owner.body, true) && owner.stateSlot.bodyState.body.kind === "intact",
    requiresNoble:
      day >= 2 &&
      playerCurrent(world, owner.noble, true) &&
      !owner.stateSlot.nobleState.contracts.some((c) => c.status.kind === "pending"),
    bodyTarget: null,
    bodyResolved: false,
    expiryProcessed: false,
    revealOpened: false,
    revealCompleted: false,
  };
  attachNightUnit(night, nightUnit);
  owner.nights.set(day, night);
  owner.active = night;
  const notices: NobleBodyNightNotice[] = [];
  if (playerCurrent(world, owner.noble, true)) {
    owner.nobleKnowledge = copyNobleKnowledge({
      wolfActionPolicy: owner.stateSlot.nobleState.wolfActionPolicy,
      lastNotifiedNight: day,
      lastChoice: owner.stateSlot.nobleState.lastChoice,
      contracts: owner.stateSlot.nobleState.contracts,
    });
    notices.push(
      Object.freeze({
        kind: "night_noble",
        actorId: owner.noble.id,
        day,
        known: copyNobleKnowledge(owner.nobleKnowledge),
      }),
    );
  }
  if (playerCurrent(world, owner.body, true)) {
    owner.bodyKnowledge = copySecretBodyKnowledge({
      protectionRepeatPolicy: owner.stateSlot.bodyState.protectionRepeatPolicy,
      lastNotifiedNight: day,
      lastChoice: owner.stateSlot.bodyState.lastChoice,
      resource:
        owner.stateSlot.bodyState.body.kind === "intact"
          ? "intact"
          : owner.stateSlot.bodyState.body.kind === "exile_revealed"
            ? "exile_revealed"
            : "spent",
      publicRevealDay:
        owner.stateSlot.bodyState.body.kind === "exile_revealed" ? owner.stateSlot.bodyState.body.day : null,
    });
    notices.push(
      Object.freeze({
        kind: "secret_body",
        actorId: owner.body.id,
        day,
        known: copySecretBodyKnowledge(owner.bodyKnowledge),
      }),
    );
  }
  owner.notices.push(...notices);
  return Object.freeze(notices);
}
function choiceLease(world: World, day: number, kind: "body" | "noble") {
  const { owner, night } = requireNight(world, day),
    actor = owner[kind],
    lease = night[kind];
  if (!playerCurrent(world, actor, true) || lease.opened || lease.committed)
    throw Error("noble_body_choice_unavailable");
  if (
    kind === "noble" &&
    (!night.requiresNoble ||
      day < 2 ||
      owner.stateSlot.nobleState.contracts.some((c) => c.status.kind === "pending"))
  )
    throw Error("night_noble_unavailable");
  if (kind === "body" && (!night.requiresBody || owner.stateSlot.bodyState.body.kind !== "intact"))
    throw Error("secret_body_unavailable");
  lease.opened = true;
  const eligible = () => {
    try {
      const current = requireNight(world, day);
      return (
        current.night === night &&
        lease.opened &&
        !lease.committed &&
        playerCurrent(world, actor, true)
      );
    } catch {
      return false;
    }
  };
  return { owner, night, lease, eligible };
}
export function openServantChoice(world: World, day: number) {
  const { owner, night, lease, eligible } = choiceLease(world, day, "noble");
  return Object.freeze({
    isCurrent: eligible,
    commit(targetId: number | null) {
      if (!eligible()) throw Error("night_noble_choice_revoked");
      const next = chooseServant(
        owner.stateSlot.nobleState,
        day,
        targetId,
        owner.noble.id,
        [...owner.players.values()].filter((p) => playerCurrent(world, p, true)).map((p) => p.id),
      );
      const target = targetId === null ? null : owner.players.get(targetId)!;
      owner.stateSlot.commitNoble(next);
      lease.committed = true;
      const created = next.contracts.find((c) => c.createdNight === day);
      owner.nobleKnowledge = copyNobleKnowledge({
        ...owner.nobleKnowledge,
        lastChoice: next.lastChoice,
        contracts: created
          ? [...owner.nobleKnowledge.contracts, created]
          : owner.nobleKnowledge.contracts,
      });
      if (target)
        owner.contracts.set(
          `servant:night:${day}`,
          Object.freeze({
            target,
            createdNight: day,
            expiresNight: day + 1,
            id: `servant:night:${day}`,
          }),
        );
      return Object.freeze({
        actorId: owner.noble.id,
        day,
        targetId,
        contractId: target ? `servant:night:${day}` : null,
      });
    },
  });
}
export function openSecretBodyChoice(world: World, day: number) {
  const { owner, night, lease, eligible } = choiceLease(world, day, "body");
  return Object.freeze({
    isCurrent: eligible,
    commit(targetId: number | null) {
      if (!eligible()) throw Error("secret_body_choice_revoked");
      const next = chooseBodyTarget(
        owner.stateSlot.bodyState,
        day,
        targetId,
        [...owner.players.values()].filter((p) => playerCurrent(world, p, true)).map((p) => p.id),
      );
      owner.stateSlot.commitBody(next);
      owner.bodyKnowledge = copySecretBodyKnowledge({
        ...owner.bodyKnowledge,
        lastChoice: next.lastChoice,
      });
      night.bodyTarget = targetId === null ? null : owner.players.get(targetId)!;
      lease.committed = true;
      return Object.freeze({ actorId: owner.body.id, day, targetId });
    },
  });
}
/** 猎魔资格归已交付猎魔行动；此同步例外只关闭原契约，不自行造成或取消其他伤害。 */
export function clearServantFromHunt(
  world: World,
  day: number,
  targetId: number,
): Readonly<{ contractId: string; targetId: number }> | null {
  const { owner } = requireNight(world, day),
    contract = owner.stateSlot.nobleState.contracts.find(
      (c) => c.status.kind === "pending" && c.targetId === targetId,
    );
  if (!contract) return null;
  const binding = owner.contracts.get(contract.id);
  if (!binding || !playerCurrent(world, binding.target, true))
    throw Error("night_noble_contract_revoked");
  owner.stateSlot.commitNoble(endServant(owner.stateSlot.nobleState, contract.id, day, "cleared"));
  return Object.freeze({ contractId: contract.id, targetId });
}
/** 调用方在实际夜伤前同时记录到期与返回提案；本函数只结束契约，不标记目标死亡。 */
export function expireServantAtNightEnd(
  world: World,
  day: number,
  nightUnit?: NightUnit,
): Readonly<{ contractId: string; targetId: number; cause: "servant_expiry" }> | null {
  const { owner, night } = requireNight(world, day);
  // 已绑定的新调用须消费同一真实夜；旧两参数API与未知元数据仍保原接受边界。
  const boundUnit = nightUnitOf(night);
  if (isNightUnit(nightUnit) && boundUnit && boundUnit !== nightUnit)
    throw Error("noble_body_night_unit_mismatch");
  if (night.expiryProcessed) throw Error("night_noble_expiry_already_processed");
  const contract = owner.stateSlot.nobleState.contracts.find(
    (c) => c.status.kind === "pending" && c.expiresNight === day,
  );
  if (!contract) {
    night.expiryProcessed = true;
    return null;
  }
  const binding = owner.contracts.get(contract.id);
  if (!binding || !playerCurrent(world, binding.target, true))
    throw Error("night_noble_contract_revoked");
  owner.stateSlot.commitNoble(endServant(owner.stateSlot.nobleState, contract.id, day, "expired"));
  night.expiryProcessed = true;
  return Object.freeze({
    contractId: contract.id,
    targetId: contract.targetId,
    cause: "servant_expiry" as const,
  });
}
/** 在原生命实际标死后、遗言或警徽 await 前关闭契约；状态槽写入不能替代这次生命提交。 */
export function closeServantForDeath(
  world: World,
  day: number,
  targetId: number,
): Readonly<{ contractId: string; targetId: number }> | null {
  const owner = requireOwner(world),
    contract = owner.stateSlot.nobleState.contracts.find(
      (c) => c.status.kind === "pending" && c.targetId === targetId,
    );
  if (!contract) return null;
  const binding = owner.contracts.get(contract.id);
  if (
    !binding ||
    !playerCurrent(world, binding.target) ||
    binding.target.life.alive ||
    aliveLifeVersion(binding.target.life) !== binding.target.version + 1
  )
    throw Error("night_noble_death_not_committed");
  owner.stateSlot.commitNoble(endServant(owner.stateSlot.nobleState, contract.id, day, "target_dead"));
  return Object.freeze({ contractId: contract.id, targetId });
}
/** 只有已付且匹配原体的选择能消费一次身体；控制方提供最终有效来源，并把返回回执与实际伤害配对。 */
export function resolveSecretBodyDamage(world: World, day: number, sources: SecretBodySources) {
  const originalOwner = owners.get(world),
    originalNight = originalOwner?.nights.get(day);
  // 回调递归不得消费或终止外层结算，仍在原 try 前拒绝。
  if (originalOwner?.checkingController) throw Error("noble_body_controller_reentry");
  try {
    const { owner, night } = requireNight(world, day, true);
    if (night.status !== "normal") throw Error("secret_body_damage_before_action_close");
    if (night.bodyResolved) throw Error("secret_body_damage_already_processed");
    if (!night.body.committed || owner.stateSlot.bodyState.body.kind !== "intact") {
      const unchanged = Object.freeze({ blocked: null, sources: copySecretBodySources(sources) });
      night.bodyResolved = true;
      return unchanged;
    }
    if (
      !playerCurrent(world, owner.body) ||
      (night.bodyTarget && !playerCurrent(world, night.bodyTarget))
    )
      throw Error("secret_body_paid_binding_revoked");
    const plan = planSecretBodyBlock(owner.body.id, night.bodyTarget?.id ?? null, sources);
    if (plan.blocked)
      owner.stateSlot.commitBody(spendBodyForNight(owner.stateSlot.bodyState, day, owner.body.id, plan.blocked));
    night.bodyResolved = true;
    return plan;
  } catch (error) {
    if (originalNight?.status === "normal" && !originalNight.bodyResolved)
      originalNight.status = "aborted";
    throw error;
  }
}
export function closeNobleBodyNight(world: World, day: number, status: "normal" | "aborted"): void {
  const owner = owners.get(world),
    night = owner?.nights.get(day);
  if (
    !owner ||
    owner.checkingController ||
    !night ||
    !["normal", "aborted"].includes(status) ||
    (night.status !== "open" &&
      !(
        status === "aborted" &&
        !night.bodyResolved &&
        ["normal", "aborted"].includes(night.status)
      ))
  )
    throw Error("noble_body_night_unavailable");
  if (
    status === "normal" &&
    (!night.expiryProcessed ||
      (night.requiresBody && !night.body.committed) ||
      (night.requiresNoble && !night.noble.committed))
  )
    throw Error("noble_body_night_incomplete");
  night.status = status;
  if (owner.active === night) owner.active = null;
}
/** 活人放逐资格归 VotingPipeline，并有独立翻牌发言；耗身保持原提交顺序，不作为死亡遗言。 */
export function consumeSecretBodyExile(
  world: World,
  day: number,
): Readonly<{ actorId: number; day: number }> {
  const owner = requireOwner(world),
    night = owner.nights.get(day);
  if (
    owner.active ||
    !night ||
    night.status !== "normal" ||
    !night.bodyResolved ||
    [...owner.nights.keys()].some((previous) => previous > day) ||
    !playerCurrent(world, owner.body, true)
  )
    throw Error("secret_body_exile_owner_revoked");
  owner.stateSlot.commitBody(revealBodyByExile(owner.stateSlot.bodyState, day));
  owner.bodyKnowledge = copySecretBodyKnowledge({
    ...owner.bodyKnowledge,
    resource: "exile_revealed",
    publicRevealDay: day,
  });
  return Object.freeze({ actorId: owner.body.id, day });
}
/** 玩家知识只从已告知数据投影；requireOwner仍复验原体和槽，不把真实库存或隐藏终态输出给玩家。 */
export function getNobleBodyPlayerState(world: World, actorId: number, phase: Phase) {
  const owner = requireOwner(world);
  if (actorId === owner.body.id)
    return {
      kind: "secret_body" as const,
      state: projectSecretBodyKnowledge(owner.bodyKnowledge, phase),
    };
  if (actorId === owner.noble.id)
    return {
      kind: "night_noble" as const,
      state: projectNobleKnowledge(owner.nobleKnowledge, phase),
    };
  return null;
}
/** 失败检查点逐属性解码已成功编码的槽影子；不读取替代库存，未完成编码仍保留原已记录影子。 */
export function checkpointNobleBodyAuthority(world: World, complete: boolean) {
  const owner = complete ? requireOwner(world) : owners.get(world);
  if (!owner) throw Error("noble_body_owner_unavailable");
  return {
    nobleId: owner.noble.id,
    bodyId: owner.body.id,
    noble: owner.stateSlot.decodeNobleShadow(),
    body: owner.stateSlot.decodeBodyShadow(),
    knowledge: {
      noble: copyNobleKnowledge(owner.nobleKnowledge),
      body: copySecretBodyKnowledge(owner.bodyKnowledge),
    },
    notices: owner.notices.map((n) =>
      n.kind === "night_noble"
        ? { ...n, known: copyNobleKnowledge(n.known) }
        : { ...n, known: copySecretBodyKnowledge(n.known) },
    ),
    nights: [...owner.nights.values()].map((n) => ({
      day: n.day,
      status: n.status,
      bodyChosen: n.body.committed,
      nobleChosen: n.noble.committed,
      expiryProcessed: n.expiryProcessed,
      bodyResolved: n.bodyResolved,
      revealOpened: n.revealOpened,
      revealCompleted: n.revealCompleted,
    })),
  };
}

export function snapshotNobleBodyAuthority(world: World) {
  return checkpointNobleBodyAuthority(world, true);
}
export function isNobleBodyBoard(world: World): boolean {
  return owners.has(world);
}
export function assertNobleBodyRosterCurrent(world: World): void {
  requireOwner(world);
}
export function nobleBodyChoiceActor(
  world: World,
  day: number,
  kind: "body" | "noble",
): number | null {
  const { owner, night } = requireNight(world, day);
  const lease = night[kind];
  return (kind === "body" ? night.requiresBody : night.requiresNoble) &&
    !lease.opened &&
    !lease.committed &&
    playerCurrent(world, owner[kind], true)
    ? owner[kind].id
    : null;
}
export function nobleBodyChoiceTargets(
  world: World,
  day: number,
  kind: "body" | "noble",
): readonly number[] {
  const { owner, night } = requireNight(world, day);
  if (
    !(kind === "body" ? night.requiresBody : night.requiresNoble) ||
    !playerCurrent(world, owner[kind], true)
  )
    throw Error("noble_body_choice_unavailable");
  const last = owner.stateSlot.bodyState.lastChoice;
  return Object.freeze(
    [...owner.players.values()]
      .filter(
        (p) =>
          playerCurrent(world, p, true) &&
          (kind === "noble"
            ? p.id !== owner.noble.id
            : !(
                owner.stateSlot.bodyState.protectionRepeatPolicy === "awa_nonconsecutive_nights_v1" &&
                last?.day === day - 1 &&
                last.targetId === p.id
              )),
      )
      .map((p) => p.id),
  );
}

export function abortNobleBodyNight(world: World, day: number): void {
  const owner = owners.get(world),
    night = owner?.nights.get(day);
  if (night && (night.status === "open" || (night.status === "normal" && !night.bodyResolved)))
    closeNobleBodyNight(world, day, "aborted");
}

export function openSecretBodyRevealSpeech(world: World, day: number, isCurrent: () => boolean) {
  const owner = requireOwner(world),
    night = owner.nights.get(day);
  const valid = () => {
    try {
      requireOwner(world);
      const available =
        !owner.active &&
        night?.status === "normal" &&
        night.bodyResolved &&
        !night.revealCompleted &&
        ![...owner.nights.keys()].some((d) => d > day) &&
        playerCurrent(world, owner.body, true) &&
        owner.stateSlot.bodyState.body.kind === "exile_revealed" &&
        owner.stateSlot.bodyState.body.day === day;
      if (!available || !checkController(owner, isCurrent)) return false;
      requireOwner(world);
      return (
        !owner.active &&
        night.status === "normal" &&
        !night.revealCompleted &&
        playerCurrent(world, owner.body, true)
      );
    } catch {
      return false;
    }
  };
  if (!night || night.revealOpened || !valid())
    throw Error("secret_body_reveal_speech_unavailable");
  night.revealOpened = true;
  return Object.freeze({
    actorId: owner.body.id,
    isCurrent: valid,
    commit(text: string) {
      if (!valid() || typeof text !== "string" || !text.trim() || text.length > 8192)
        throw Error("secret_body_reveal_speech_unavailable");
      night.revealCompleted = true;
      return Object.freeze({ actorId: owner.body.id, day, text });
    },
  });
}
