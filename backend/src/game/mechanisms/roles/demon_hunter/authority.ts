/**
 * 负责猎魔人选择、原生能力封存快照与可核查资源提交，拥有该板子的原对象和提交账本。
 * 输入保留原 World／state／request，输出为有限封存回合及已接受期限别名的原有写入。
 * 不变量：必须匹配原封存资格；审计只读最近合法同步提交，不能采用任意 live 库存。
 * 失效或失败保持部分写入与结算顺序，别名不增加能力；受保护白痴替换只恢复 idiot 槽，
 * 原生库存及 JSON／descriptor 检查仍归各自领域所有者。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { registerRequestAliasPropagation } from "../../../../core/domain/request_delivery";
import { recordNobleContractClosure } from "../noble_secret_body/facts";
import type { NobleContractClosedFact } from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import {
  isNobleBodyBoard,
  assertNobleBodyRosterCurrent,
  checkpointNobleBodyAuthority,
  clearServantFromHunt,
} from "../noble_secret_body/authority";
import {
  RED_MOON_ROLE,
  getRedMoonState,
  readRedMoonShadow,
  copyRedMoonPayload,
  encodeRedMoonShadow,
  writeRedMoonTransition,
} from "../red_moon_apostle/ports";
import { types } from "node:util";
import {
  COMPONENT,
  Camp,
  Phase,
  Role,
  WitchSelfHealRule,
  aliveLifeDescriptor,
  aliveLifeVersion,
  bindRequestDeliveryGuard,
  settleRequestDelivery,
  type AliveComponent,
  type IdentityComponent,
  type BadgeComponent,
  type VotingRightComponent,
  type StatusMarksComponent,
  StatusMark,
  type RoleComponent,
  type CampComponent,
  type VictoryComponent,
  type World,
} from "../../../../core";
import {
  DEMON_HUNTER_POLICY,
  DEMON_HUNTER_ROLE,
  demonJson,
  demonSnapshot,
  ownDemonData,
  exactDemonData,
  getDemonHunterState,
  readDemonHunterState,
  readDemonHuntTool,
  captureDemonHunterStateSlot,
  appendDemonHunterChoiceData,
  demonHunterHistoryCurrent,
  type DemonHunterStateSlot,
} from "./state-slot";
import type { DemonHunterChoice, DemonHunterState } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import { statusMarkSnapshot } from "../../../../core/domain/components/status_marks";
import { assertDemonHunterPreset } from "./preset";
import type { FaultDecisionBoundary } from "../../../engine/fault_plan";
interface Participant {
  id: number;
  role: RoleComponent;
  kind: Role;
  camp: Camp;
  campComponent: CampComponent;
  privateState: RoleComponent["privateState"];
  privateRefs: ReadonlyArray<readonly [string, unknown]>;
  inventoryRefs: ReadonlyArray<readonly [readonly string[], object]>;
  victory: VictoryComponent;
  affiliations: VictoryComponent["affiliations"];
  victoryJson: string;
  life: AliveComponent;
  lifeDescriptor: PropertyDescriptor;
  initialVersion: number;
  auditPrivateJson: string;
  delegatedKey: "noble" | "secretBody" | null;
  checkpoint: {
    identity: object;
    seat: number;
    name: string;
    badge: object;
    vote: object;
    marks: StatusMarksComponent;
    badgeJson: string;
    voteJson: string;
  } | null;
}
interface Binding extends DemonHunterStateSlot {
  world: World;
  config: ReadonlyBoardConfig;
  configJson: string;
  actorId: number;
  players: Map<number, Participant>;
  nights: Map<number, Night>;
  active: Night | null;
}
interface Night {
  binding: Binding;
  day: number;
  isCurrent: () => boolean;
  closed: boolean;
  frozen: boolean;
  targets: Map<number, number>;
  turn: Turn | null;
  opened: boolean;
  requiresChoice: boolean;
  witchOpened: boolean;
  choice: Readonly<DemonHunterChoice> | null;
}
interface Turn {
  night: Night;
  scope: object;
  request: DemonHunterRequest | null;
  requestJson: string | null;
  deadline: number | null;
}
export interface DemonHunterRequest {
  actorId: number;
  phase: Phase;
  allowedTools: readonly string[];
  context: {
    day: number;
    stage: string;
    turn_constraints?: unknown;
    allow_fallback?: boolean;
    action_failure_policy?: string;
    requiresAction?: boolean;
  };
  deadlineAtMs?: number;
}
const bindings = new WeakMap<World, Binding>(),
  turns = new WeakMap<object, Turn>();
const requests = new WeakMap<
  object,
  {
    turn: Turn;
    context: object;
    json: string;
    fields: PropertyDescriptorMap;
    deadline: number | null;
  }
>();
function originalLife(p: Participant, world: World, live = false, version?: number): boolean {
  if (world.getComponent(p.id, COMPONENT.Alive) !== p.life || types.isProxy(p.life)) return false;
  const d = Object.getOwnPropertyDescriptor(p.life, "alive");
  if (
    !d ||
    d.get !== p.lifeDescriptor.get ||
    d.set !== p.lifeDescriptor.set ||
    d.enumerable !== p.lifeDescriptor.enumerable ||
    d.configurable !== p.lifeDescriptor.configurable
  )
    return false;
  const alive = p.lifeDescriptor.get!.call(p.life) === true;
  return (
    (!live || alive) && aliveLifeVersion(p.life) === (version ?? p.initialVersion + (alive ? 0 : 1))
  );
}
function inventoryReferences(value: object): Array<readonly [readonly string[], object]> {
  const references: Array<readonly [readonly string[], object]> = [];
  const visit = (item: object, path: string[]): void => {
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
      if ("value" in descriptor && descriptor.value && typeof descriptor.value === "object") {
        const next = [...path, key];
        references.push([next, descriptor.value]);
        visit(descriptor.value, next);
      }
    }
  };
  visit(value, []);
  return references;
}
function originalInventory(p: Participant): boolean {
  return p.inventoryRefs.every(([path, original]) => {
    let current: unknown = p.privateState;
    for (const key of path) current = ownDemonData(current, key);
    return current === original && !types.isProxy(original);
  });
}
function originalIdentity(p: Participant, world: World): boolean {
  if (types.isProxy(p.privateState)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(p.privateState);
  return (
    originalInventory(p) &&
    world.getComponent(p.id, COMPONENT.Role) === p.role &&
    ownDemonData(p.role, "role") === p.kind &&
    ownDemonData(p.role, "camp") === p.camp &&
    ownDemonData(p.role, "privateState") === p.privateState &&
    Object.keys(descriptors).length === p.privateRefs.length &&
    p.privateRefs.every(
      ([key, value]) =>
        descriptors[key] && "value" in descriptors[key]! && descriptors[key]!.value === value,
    ) &&
    world.getComponent(p.id, COMPONENT.Camp) === p.campComponent &&
    ownDemonData(p.campComponent, "camp") === p.camp &&
    world.getComponent(p.id, COMPONENT.Victory) === p.victory &&
    ownDemonData(p.victory, "affiliations") === p.affiliations &&
    demonJson(p.affiliations) === p.victoryJson
  );
}
function captureDemonCheckpointMetadata(world: World, id: number): Participant["checkpoint"] {
  const identity = world.getComponent(id, COMPONENT.Identity),
    badge = world.getComponent(id, COMPONENT.Badge),
    vote = world.getComponent(id, COMPONENT.VotingRight),
    marks = world.getComponent(id, COMPONENT.StatusMarks);
  const seat = ownDemonData(identity, "seat"),
    name = ownDemonData(identity, "name"),
    badgeJson = demonBadgeJson(badge),
    voteJson = demonVoteJson(vote);
  if (
    !identity ||
    !badge ||
    !vote ||
    !marks ||
    !Number.isSafeInteger(seat) ||
    (seat as number) < 1 ||
    typeof name !== "string" ||
    !badgeJson ||
    !voteJson ||
    !Object.values(StatusMark).every((mark) => statusMarkSnapshot(marks, mark))
  )
    return null;
  return { identity, seat: seat as number, name, badge, vote, marks, badgeJson, voteJson };
}
function demonBadgeJson(badge: unknown): string | null {
  if (!badge || typeof badge !== "object" || types.isProxy(badge)) return null;
  const optional = Object.getOwnPropertyDescriptor(badge, "handoffPolicy");
  if (optional && !("value" in optional)) return null;
  const isSheriff = ownDemonData(badge, "isSheriff"),
    destroyed = ownDemonData(badge, "destroyed"),
    voteWeight = ownDemonData(badge, "voteWeight"),
    handoffPolicy = ownDemonData(badge, "handoffPolicy");
  return typeof isSheriff === "boolean" &&
    typeof destroyed === "boolean" &&
    typeof voteWeight === "number" &&
    Number.isFinite(voteWeight) &&
    voteWeight > 0 &&
    (handoffPolicy === undefined ||
      handoffPolicy === "awa_next_seat_v1" ||
      handoffPolicy === "awa_holder_choice_v1")
    ? JSON.stringify({
        isSheriff,
        destroyed,
        voteWeight,
        ...(handoffPolicy === undefined ? {} : { handoffPolicy }),
      })
    : null;
}
function demonVoteJson(vote: unknown): string | null {
  const weight = ownDemonData(vote, "weight"),
    canVote = ownDemonData(vote, "canVote");
  return typeof weight === "number" &&
    Number.isFinite(weight) &&
    (weight > 0 || (weight === 0 && canVote === false)) &&
    typeof canVote === "boolean"
    ? JSON.stringify({ weight, canVote })
    : null;
}
function capture(world: World, id: number): Participant {
  const role = world.getComponent(id, COMPONENT.Role),
    campComponent = world.getComponent(id, COMPONENT.Camp),
    victory = world.getComponent(id, COMPONENT.Victory),
    life = world.getComponent(id, COMPONENT.Alive);
  const kind = ownDemonData(role, "role"),
    camp = ownDemonData(role, "camp"),
    privateState = ownDemonData(role, "privateState"),
    affiliations = ownDemonData(victory, "affiliations"),
    lifeDescriptor = life && aliveLifeDescriptor(life),
    version = life && aliveLifeVersion(life),
    privateJson = demonJson(privateState),
    victoryJson = demonJson(affiliations);
  if (
    !role ||
    !campComponent ||
    !victory ||
    !life ||
    types.isProxy(life) ||
    !lifeDescriptor?.get ||
    version === undefined ||
    typeof kind !== "string" ||
    ![Camp.Good, Camp.Wolf].includes(camp as Camp) ||
    ownDemonData(campComponent, "camp") !== camp ||
    !privateState ||
    typeof privateState !== "object" ||
    types.isProxy(privateState) ||
    !Array.isArray(affiliations) ||
    !privateJson ||
    !victoryJson ||
    victoryJson !== demonJson([{ kind: "faction", faction: camp }])
  )
    throw new Error("demon_hunter_original_player_invalid");
  const delegatedKey =
    isNobleBodyBoard(world) && kind === Role.NightNoble
      ? "noble"
      : isNobleBodyBoard(world) && kind === Role.AwakenedIdiot
        ? "secretBody"
        : null;
  const p: Participant = {
    id,
    role,
    kind: kind as Role,
    camp: camp as Camp,
    campComponent,
    victory,
    affiliations: affiliations as VictoryComponent["affiliations"],
    victoryJson,
    life,
    lifeDescriptor,
    initialVersion: version,
    privateState: privateState as RoleComponent["privateState"],
    privateRefs: Object.entries(privateState),
    inventoryRefs: inventoryReferences(privateState).filter(
      ([path]) => path.length === 1 || path[0] !== delegatedKey,
    ),
    delegatedKey,
    auditPrivateJson: privateJson,
    checkpoint: captureDemonCheckpointMetadata(world, id),
  };
  if (!originalLife(p, world, true)) throw new Error("demon_hunter_original_life_invalid");
  return p;
}
function delegatedCurrent(b: Binding): boolean {
  if (!b.config.nobleSecretBody) return true;
  try {
    assertNobleBodyRosterCurrent(b.world);
    const owned = checkpointNobleBodyAuthority(b.world, true);
    return (
      b.players.get(owned.nobleId)?.kind === Role.NightNoble &&
      b.players.get(owned.bodyId)?.kind === Role.AwakenedIdiot
    );
  } catch {
    return false;
  }
}
/** 两个原生子树只归其领域 owner；其他 private key 仍与原同步恶魔快照比较。 */
function privateAuditCurrent(b: Binding, p: Participant): boolean {
  const current = demonJson(p.privateState);
  if (!current) return false;
  if (!p.delegatedKey) return current === p.auditPrivateJson;
  if (!delegatedCurrent(b)) return false;
  const actual = JSON.parse(current),
    expected = JSON.parse(p.auditPrivateJson);
  delete actual[p.delegatedKey];
  delete expected[p.delegatedKey];
  return JSON.stringify(actual) === JSON.stringify(expected);
}
function committedPrivate(b: Binding, p: Participant, complete = false): Record<string, unknown> {
  const cached = JSON.parse(p.auditPrivateJson) as Record<string, unknown>;
  if (p.delegatedKey) {
    const owned = checkpointNobleBodyAuthority(b.world, complete);
    if (p.id !== (p.delegatedKey === "noble" ? owned.nobleId : owned.bodyId))
      throw Error("demon_hunter_delegated_actor_invalid");
    cached[p.delegatedKey] = p.delegatedKey === "noble" ? owned.noble : owned.body;
  }
  return cached;
}
function validBinding(b: Binding): boolean {
  const state = readDemonHunterState(b.state);
  return (
    bindings.get(b.world) === b &&
    delegatedCurrent(b) &&
    b.world.entityIds().length === b.players.size &&
    demonJson(b.config) === b.configJson &&
    !!state &&
    ownDemonData(b.players.get(b.actorId)?.privateState, "demonHunter") === b.state &&
    demonHunterHistoryCurrent(b, state) &&
    [...b.players.values()].every(
      (p) => originalIdentity(p, b.world) && demonJson(p.privateState) !== null,
    )
  );
}
/** 原生对象只捕获一次；公开 profile 注册是后续独立步骤。 */
export function installDemonHunter(world: World, config: ReadonlyBoardConfig): void {
  if (bindings.has(world)) throw new Error("demon_hunter_already_installed");
  assertDemonHunterPreset(config);
  if (config.nobleSecretBody) {
    if (!isNobleBodyBoard(world)) throw Error("demon_hunter_initial_state_invalid");
    const owned = checkpointNobleBodyAuthority(world, true);
    if (
      ownDemonData(world.getComponent(owned.nobleId, COMPONENT.Role), "role") !== Role.NightNoble ||
      ownDemonData(world.getComponent(owned.bodyId, COMPONENT.Role), "role") !== Role.AwakenedIdiot
    )
      throw Error("demon_hunter_initial_state_invalid");
  }
  const players = new Map(world.entityIds().map((id) => [id, capture(world, id)])),
    actors = [...players.values()].filter((p) => String(p.kind) === DEMON_HUNTER_ROLE),
    actor = actors[0],
    state = actor && getDemonHunterState(actor.role),
    configJson = demonJson(config),
    counts: Record<string, number> = {};
  for (const p of players.values()) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
  if (
    !actor ||
    actors.length !== 1 ||
    players.size !== config.boardSize ||
    actor.camp !== Camp.Good ||
    !state ||
    state.history.length !== 0 ||
    !configJson ||
    config.roleSetups.length !== Object.keys(counts).length ||
    config.roleSetups.some((entry) => counts[entry.role] !== entry.count) ||
    [...players.values()].some(
      (p) =>
        p.camp !==
        ([Role.Wolf, Role.RedMoonApostle, Role.NightNoble].includes(p.kind)
          ? Camp.Wolf
          : Camp.Good),
    )
  )
    throw new Error("demon_hunter_initial_state_invalid");
  bindings.set(world, {
    world,
    config,
    configJson,
    actorId: actor.id,
    players,
    ...captureDemonHunterStateSlot(state),
    nights: new Map(),
    active: null,
  });
}
export function beginDemonHunterNight(world: World, day: number, isCurrent: () => boolean): void {
  const b = bindings.get(world);
  if (
    !b ||
    !Number.isSafeInteger(day) ||
    day < 1 ||
    b.active ||
    b.nights.has(day) ||
    [...b.nights.keys()].some((previous) => previous >= day) ||
    !validBinding(b) ||
    ![...b.players.values()].every((p) => originalLife(p, world)) ||
    !isCurrent()
  )
    throw new Error("demon_hunter_night_unavailable");
  const targets = new Map<number, number>();
  for (const p of b.players.values())
    if (originalLife(p, world, true)) targets.set(p.id, aliveLifeVersion(p.life)!);
  const night: Night = {
    binding: b,
    day,
    isCurrent,
    targets,
    closed: false,
    frozen: false,
    turn: null,
    opened: false,
    requiresChoice: day >= 2 && targets.has(b.actorId) && !demonRedMoonNightSealed(world, day),
    witchOpened: false,
    choice: null,
  };
  b.nights.set(day, night);
  b.active = night;
}
function targetCurrent(n: Night, targetId: number): boolean {
  const p = n.binding.players.get(targetId),
    version = n.targets.get(targetId);
  return (
    !!p &&
    version !== undefined &&
    originalIdentity(p, n.binding.world) &&
    originalLife(p, n.binding.world, true, version)
  );
}
function liveNight(n: Night): boolean {
  return (
    n.binding.active === n &&
    !n.closed &&
    !n.frozen &&
    n.isCurrent() &&
    validBinding(n.binding) &&
    targetCurrent(n, n.binding.actorId)
  );
}
export function openDemonHunterTurn(world: World): object {
  const n = bindings.get(world)?.active;
  if (!n || !n.requiresChoice || n.day < 2 || n.opened || n.turn || n.choice || !liveNight(n))
    throw new Error("demon_hunter_turn_unavailable");
  const scope = Object.freeze({}),
    turn: Turn = { night: n, scope, request: null, requestJson: null, deadline: null };
  n.opened = true;
  n.turn = turn;
  turns.set(scope, turn);
  return scope;
}
function requestData(request: DemonHunterRequest): string | null {
  try {
    const { deadlineAtMs: _deadline, ...rest } = demonSnapshot(
      request,
      new Set<object>(),
      0,
      16384,
    ) as Record<string, unknown>;
    return JSON.stringify(rest);
  } catch {
    return null;
  }
}
function requestCurrent(t: Turn, request: DemonHunterRequest): boolean {
  const a = requests.get(request);
  return (
    !!a &&
    a.turn === t &&
    ownDemonData(request, "context") === a.context &&
    requestData(request) === a.json &&
    (ownDemonData(request, "deadlineAtMs") ?? null) === a.deadline &&
    (a.deadline === null || a.deadline > Date.now()) &&
    (t.deadline === null || t.deadline > Date.now())
  );
}
function turnCurrent(t: Turn): boolean {
  return (
    t.night.turn === t &&
    !t.night.choice &&
    liveNight(t.night) &&
    !!t.request &&
    requestCurrent(t, t.request)
  );
}
export function bindDemonHunterRequest(world: World, request: DemonHunterRequest): void {
  const t = bindings.get(world)?.active?.turn;
  if (!t || t.request || !liveNight(t.night)) return;
  try {
    const p = demonSnapshot(request, new Set<object>(), 0, 16384) as DemonHunterRequest,
      constraints = p.context.turn_constraints as Record<string, unknown> | undefined,
      encoded = requestData(request);
    if (
      p.actorId !== t.night.binding.actorId ||
      p.phase !== Phase.Night ||
      p.context.day !== t.night.day ||
      p.context.stage !== "demon_hunter" ||
      !Array.isArray(p.allowedTools) ||
      p.allowedTools.length !== 1 ||
      p.allowedTools[0] !== "demon_hunt" ||
      p.context.allow_fallback !== false ||
      p.context.action_failure_policy !== "error" ||
      constraints?.min_valid_actions !== 1 ||
      constraints.max_valid_actions !== 1 ||
      demonJson(constraints.required_any_tools) !== demonJson(["demon_hunt"]) ||
      !encoded ||
      (p.deadlineAtMs !== undefined &&
        (!Number.isFinite(p.deadlineAtMs) || p.deadlineAtMs <= Date.now()))
    )
      return;
    bindRequestDeliveryGuard(
      request,
      () => demonHunterRequestScope(world, request) !== undefined,
      t.scope,
    );
    t.request = request;
    t.requestJson = encoded;
    t.deadline = p.deadlineAtMs ?? null;
    requests.set(request, {
      turn: t,
      context: ownDemonData(request, "context") as object,
      json: encoded,
      fields: Object.getOwnPropertyDescriptors(request),
      deadline: t.deadline,
    });
    registerRequestAliasPropagation(request, 60, inheritDemonHunterDeadlineRequest);
  } catch {
    return;
  }
}
export function demonHunterRequestScope(
  world: World,
  request: DemonHunterRequest,
): object | undefined {
  const a = requests.get(request);
  return a &&
    a.turn.night.binding.world === world &&
    turnCurrent(a.turn) &&
    requestCurrent(a.turn, request)
    ? a.turn.scope
    : undefined;
}
export function inheritDemonHunterDeadlineRequest(
  source: DemonHunterRequest,
  target: DemonHunterRequest,
): void {
  const a = requests.get(source);
  if (
    !a ||
    requests.has(target) ||
    !demonHunterRequestScope(a.turn.night.binding.world, source) ||
    types.isProxy(target)
  )
    return;
  const fields = Object.getOwnPropertyDescriptors(target),
    deadline = ownDemonData(target, "deadlineAtMs"),
    keys = Object.keys(a.fields).filter((key) => key !== "deadlineAtMs"),
    others = Object.keys(fields).filter((key) => key !== "deadlineAtMs");
  if (
    (deadline !== undefined &&
      (typeof deadline !== "number" || !Number.isFinite(deadline) || deadline <= Date.now())) ||
    (a.turn.deadline !== null && (typeof deadline !== "number" || deadline > a.turn.deadline))
  )
    return;
  if (
    keys.length !== others.length ||
    !keys.every(
      (key) =>
        others.includes(key) &&
        fields[key] &&
        "value" in fields[key]! &&
        "value" in a.fields[key]! &&
        fields[key]!.value === a.fields[key]!.value,
    ) ||
    requestData(target) !== a.json
  )
    return;
  try {
    bindRequestDeliveryGuard(
      target,
      () => demonHunterRequestScope(a.turn.night.binding.world, target) !== undefined,
      a.turn.scope,
    );
    a.turn.deadline = typeof deadline === "number" ? deadline : null;
    requests.set(target, { ...a, fields, deadline: a.turn.deadline });
    registerRequestAliasPropagation(target, 60, inheritDemonHunterDeadlineRequest);
  } catch {
    return;
  }
}
export function authorizedDemonHunter(
  world: World,
  actorId: number,
  phase: Phase,
  day: number,
  scope: object | undefined,
): boolean {
  const t = scope && turns.get(scope);
  return (
    !!t &&
    t.night.binding.world === world &&
    actorId === t.night.binding.actorId &&
    phase === Phase.Night &&
    day === t.night.day &&
    turnCurrent(t)
  );
}
export function demonHunterActorId(world: World): number | null {
  return bindings.get(world)?.actorId ?? null;
}
export function canSubmitDemonHunt(
  world: World,
  actorId: number,
  phase: Phase,
  day: number,
  scope: object | undefined,
  input: unknown,
): boolean {
  if (!scope || !authorizedDemonHunter(world, actorId, phase, day, scope)) return false;
  const t = turns.get(scope),
    call = readDemonHuntTool(input);
  return (
    !!t &&
    !!call &&
    (call.args.target_id === null ||
      (call.args.target_id !== actorId && targetCurrent(t.night, call.args.target_id)))
  );
}
export function commitDemonHunt(
  world: World,
  scope: object,
  input: unknown,
): Readonly<DemonHunterChoice> | null {
  const t = turns.get(scope),
    call = readDemonHuntTool(input);
  if (!t || t.night.binding.world !== world || !turnCurrent(t) || !call) return null;
  const n = t.night,
    b = n.binding,
    targetId = call.args.target_id;
  if (targetId !== null && (targetId === b.actorId || !targetCurrent(n, targetId))) return null;
  const choice = appendDemonHunterChoiceData(b, n, targetId);
  if (!choice) return null;
  const actor = b.players.get(b.actorId)!;
  actor.auditPrivateJson = demonJson(actor.privateState)!;
  n.choice = choice;
  n.turn = null;
  settleRequestDelivery(scope, true);
  return choice;
}
export function closeDemonHunterTurn(scope: object): void {
  const t = turns.get(scope);
  if (t && t.night.turn === t) t.night.turn = null;
  settleRequestDelivery(scope, false);
}
/** 只由引擎实际选择派生，不从已记录的取消事实重建。 */
export function committedDemonFaultBoundary(world: World): FaultDecisionBoundary | null {
  const n = bindings.get(world)?.active,
    c = n?.choice;
  return n &&
    !n.closed &&
    !n.frozen &&
    n.binding.active === n &&
    n.isCurrent() &&
    c &&
    c.targetId !== null
    ? Object.freeze({
        day: n.day,
        actorId: n.binding.actorId,
        targetId: c.targetId,
        stage: "demon_hunter",
        turn: 1,
      })
    : null;
}
export interface DemonHuntSettlement {
  readonly servantCleared?: Readonly<NobleContractClosedFact>;
  readonly choice: Readonly<DemonHunterChoice> | null;
  readonly damage: Readonly<{
    targetId: number;
    cause: "demon_hunt" | "demon_hunt_backlash";
  }> | null;
  readonly cancelled: Readonly<{
    policy: typeof DEMON_HUNTER_POLICY;
    actorId: number;
    day: number;
    targetId: number;
    reason: "authority_revoked";
    faultId: string | null;
  }> | null;
}
/** 在 caller 标记初始波任何玩家前，冻结全部原来源资格。 */
export function freezeDemonHunt(
  world: World,
  faultId: string | null = null,
): Readonly<DemonHuntSettlement> {
  const n = bindings.get(world)?.active;
  if (!n || n.closed || n.frozen) throw new Error("demon_hunter_freeze_unavailable");
  const choice = n.choice;
  if (n.requiresChoice && !choice) throw new Error("demon_hunter_required_choice_missing");
  let servantCleared: DemonHuntSettlement["servantCleared"];
  let damage: DemonHuntSettlement["damage"] = null,
    cancelled: DemonHuntSettlement["cancelled"] = null;
  if (choice?.targetId !== null && choice) {
    if (liveNight(n) && targetCurrent(n, choice.targetId)) {
      const target = n.binding.players.get(choice.targetId)!;
      const cleared = n.binding.config.nobleSecretBody
        ? clearServantFromHunt(world, n.day, choice.targetId)
        : null;
      if (cleared) servantCleared = recordNobleContractClosure(world, n.day, cleared, Phase.Night);
      if (!servantCleared)
        damage = Object.freeze({
          targetId: target.camp === Camp.Wolf ? target.id : n.binding.actorId,
          cause: target.camp === Camp.Wolf ? "demon_hunt" : "demon_hunt_backlash",
        });
    } else
      cancelled = Object.freeze({
        policy: DEMON_HUNTER_POLICY,
        actorId: n.binding.actorId,
        day: n.day,
        targetId: choice.targetId,
        reason: "authority_revoked",
        faultId,
      });
  }
  n.frozen = true;
  return Object.freeze({
    choice,
    damage,
    cancelled,
    ...(servantCleared ? { servantCleared } : {}),
  });
}
export function closeDemonHunterNight(world: World): void {
  const b = bindings.get(world),
    n = b?.active;
  if (!b || !n) return;
  if (n.turn) closeDemonHunterTurn(n.turn.scope);
  n.closed = true;
  b.active = null;
}
export function projectDemonHunter(
  world: World,
  role: RoleComponent,
): DemonHunterState | undefined {
  const b = bindings.get(world),
    p = b?.players.get(b.actorId);
  return b && p?.role === role && validBinding(b)
    ? (readDemonHunterState(b.state) ?? undefined)
    : undefined;
}
/** 审计读取最近同步领域提交，不从可变 live 库存刷新。 */
export function demonHunterAuditPlayer(
  world: World,
  id: number,
): Record<string, unknown> | undefined {
  const b = bindings.get(world),
    p = b?.players.get(id);
  return b && p ? committedPrivate(b, p) : undefined;
}
export function demonHunterFreezeDay(world: World): number {
  const n = bindings.get(world)?.active;
  if (!n || n.closed || n.frozen) throw new Error("demon_hunter_freeze_unavailable");
  if (n.requiresChoice && !n.choice) throw new Error("demon_hunter_required_choice_missing");
  return n.day;
}
/** 原生毒药证明的内部原实例边界，不是记录或模型能力。 */
export interface DemonNativePoisonFrame {
  readonly day: number;
  readonly actorId: number;
  readonly witchId: number;
  readonly isCurrent: () => boolean;
  readonly cacheConsumption: () => void;
  readonly assertFreezeOpen: () => void;
}
export function demonNativePoisonFrame(
  world: World,
  witchId: number,
  ability: object,
  targetId: number,
): Readonly<DemonNativePoisonFrame> | null {
  const b = bindings.get(world),
    n = b?.active,
    p = b?.players.get(witchId);
  if (
    !b ||
    !n ||
    !p ||
    p.kind !== Role.Witch ||
    targetId !== b.actorId ||
    ownDemonData(ownDemonData(p.privateState, "abilities"), "native:potion") !== ability ||
    !p.inventoryRefs.some(
      ([path, original]) =>
        path.length === 2 &&
        path[0] === "abilities" &&
        path[1] === "native:potion" &&
        original === ability,
    )
  )
    return null;
  const isCurrent = () =>
    !n.closed &&
    !n.frozen &&
    b.active === n &&
    n.isCurrent() &&
    validBinding(b) &&
    targetCurrent(n, witchId) &&
    targetCurrent(n, b.actorId);
  if (!isCurrent()) return null;
  return Object.freeze({
    day: n.day,
    actorId: b.actorId,
    witchId,
    isCurrent,
    assertFreezeOpen: () => {
      demonHunterFreezeDay(world);
    },
    cacheConsumption: () => {
      if (isCurrent()) p.auditPrivateJson = demonJson(p.privateState)!;
    },
  });
}

/** 女巫既有有限提交；审计变化由上一次已提交快照计算。 */
export interface DemonWitchTurnFrame {
  readonly day: number;
  readonly witchId: number;
  readonly demonId: number;
  readonly ability: object;
  readonly isCurrent: () => boolean;
  readonly targetCurrent: (targetId: number) => boolean;
  readonly sourceCurrent: () => boolean;
  readonly commit: (potion: "heal" | "poison" | "none") => boolean;
}
export function openDemonWitchTurnFrame(world: World): Readonly<DemonWitchTurnFrame> | null {
  const b = bindings.get(world),
    n = b?.active,
    p = b && [...b.players.values()].find((p) => p.kind === Role.Witch),
    ability = p && ownDemonData(ownDemonData(p.privateState, "abilities"), "native:potion");
  if (!b || !n || !p || !ability || typeof ability !== "object" || n.witchOpened) return null;
  if (demonRedMoonNightSealed(world, n.day)) return null;
  const current = () =>
    !n.closed &&
    !n.frozen &&
    b.active === n &&
    n.isCurrent() &&
    validBinding(b) &&
    targetCurrent(n, p.id);
  if (!current() || !privateAuditCurrent(b, p)) return null;
  const original = demonSnapshot(p.privateState) as Record<string, unknown>,
    abilities = ownDemonData(original, "abilities") as Record<string, unknown>,
    snapshot = ownDemonData(abilities, "native:potion") as Record<string, unknown>,
    state = ownDemonData(snapshot, "state") as Record<string, unknown>;
  if (
    !exactDemonData(snapshot, [
      "id",
      "kind",
      "state",
      "source",
      "sourceDisclosed",
      "startsOnDay",
      "maxUses",
      "uses",
      "lastUsedDay",
      "disabled",
    ]) ||
    snapshot.sourceDisclosed !== true ||
    snapshot.startsOnDay !== 1 ||
    snapshot.maxUses !== null ||
    snapshot.disabled !== false ||
    !state ||
    snapshot.uses !== 2 - (state.heal as number) - (state.poison as number) ||
    (snapshot.lastUsedDay !== null &&
      (!Number.isSafeInteger(snapshot.lastUsedDay) ||
        (snapshot.lastUsedDay as number) < 1 ||
        (snapshot.lastUsedDay as number) >= n.day)) ||
    !state ||
    ownDemonData(snapshot, "id") !== "native:potion" ||
    ownDemonData(snapshot, "kind") !== "potion" ||
    demonJson(ownDemonData(snapshot, "source")) !==
      demonJson({ kind: "native", role: Role.Witch }) ||
    Object.keys(state).length !== 6 ||
    ![0, 1].includes(state.heal as number) ||
    ![0, 1].includes(state.poison as number) ||
    state.selfHealRule !== WitchSelfHealRule.Disabled ||
    state.canSelfHeal !== false ||
    typeof state.healUsedThisNight !== "boolean" ||
    typeof state.poisonUsedThisNight !== "boolean"
  )
    return null;
  const originalState = ownDemonData(ability, "state") as Record<string, unknown>;
  const writable = () =>
    [
      ...["heal", "poison", "canSelfHeal", "healUsedThisNight", "poisonUsedThisNight"].map(
        (key) => [originalState, key] as const,
      ),
      [ability, "uses"] as const,
      [ability, "lastUsedDay"] as const,
    ].every(([object, key]) => {
      const d = Object.getOwnPropertyDescriptor(object, key);
      return !!d && "value" in d && d.writable === true;
    });
  if (!writable()) return null;
  // 重置本身是有限同步转换，不能采用任意 live 库存。
  n.witchOpened = true;
  const resetState: Record<string, unknown> = {
    ...state,
    healUsedThisNight: false,
    poisonUsedThisNight: false,
    canSelfHeal: false,
  };
  const resetAbility = { ...snapshot, state: resetState };
  const resetJson = JSON.stringify(resetAbility);
  originalState.healUsedThisNight = false;
  originalState.poisonUsedThisNight = false;
  originalState.canSelfHeal = false;
  const resetPrivate = { ...original, abilities: { ...abilities, "native:potion": resetAbility } };
  if (demonJson(p.privateState) !== JSON.stringify(resetPrivate))
    throw new Error("demon_hunter_native_reset_failed");
  p.auditPrivateJson = JSON.stringify(resetPrivate);
  let committed = false,
    committedJson: string | null = null;
  return Object.freeze({
    day: n.day,
    witchId: p.id,
    demonId: b.actorId,
    ability,
    isCurrent: () =>
      !committed &&
      current() &&
      writable() &&
      demonJson(ability) === resetJson &&
      privateAuditCurrent(b, p),
    targetCurrent: (id: number) => current() && targetCurrent(n, id),
    sourceCurrent: () => committed && current() && demonJson(p.privateState) === committedJson,
    commit: (potion: "heal" | "poison" | "none") => {
      if (committed || !current() || !["heal", "poison", "none"].includes(potion)) return false;
      const expectedState = { ...resetState };
      if (potion !== "none") {
        if ((resetState[potion] as number) < 1) return false;
        expectedState[potion] = (resetState[potion] as number) - 1;
        expectedState[potion === "heal" ? "healUsedThisNight" : "poisonUsedThisNight"] = true;
      }
      const expectedAbility = {
        ...resetAbility,
        state: expectedState,
        uses: (snapshot.uses as number) + (potion === "none" ? 0 : 1),
        lastUsedDay: n.day,
      };
      const expectedPrivate = {
        ...original,
        abilities: { ...abilities, "native:potion": expectedAbility },
      };
      const json = JSON.stringify(expectedPrivate);
      if (demonJson(p.privateState) !== json) return false;
      committed = true;
      committedJson = json;
      p.auditPrivateJson = json;
      return true;
    },
  });
}

export function demonWitchRequiredThisNight(world: World): boolean {
  const n = bindings.get(world)?.active;
  if (!n || n.closed || n.frozen) throw new Error("demon_hunter_freeze_unavailable");
  return (
    !demonRedMoonNightSealed(world, n.day) &&
    [...n.binding.players.values()].some((p) => p.kind === Role.Witch && n.targets.has(p.id))
  );
}

export function demonHunterNeedsTurn(world: World, day: number): boolean {
  const n = bindings.get(world)?.active;
  if (!n || n.day !== day || n.closed || n.frozen)
    throw new Error("demon_hunter_night_unavailable");
  return n.requiresChoice;
}
export function originalDemonNightLives(
  world: World,
): ReadonlyMap<number, { life: AliveComponent; version: number }> {
  const n = bindings.get(world)?.active;
  if (!n || n.closed) throw new Error("demon_hunter_night_unavailable");
  return new Map(
    [...n.targets].map(([id, version]) => [id, { life: n.binding.players.get(id)!.life, version }]),
  );
}
export function demonHunterIsGod(world: World, role: RoleComponent): boolean {
  const b = bindings.get(world),
    p = b?.players.get(b.actorId);
  return !!b && !!p && p.role === role && originalIdentity(p, world);
}
export function demonOriginalWolfSourceCurrent(
  world: World,
  day: number,
  actorIds: readonly number[],
): boolean {
  const n = bindings.get(world)?.active;
  return (
    !!n &&
    n.day === day &&
    !n.closed &&
    n.isCurrent() &&
    validBinding(n.binding) &&
    actorIds.length > 0 &&
    actorIds.every((id) => {
      const kind = n.binding.players.get(id)?.kind;
      return (
        kind !== undefined &&
        [Role.Wolf, Role.RedMoonApostle, Role.NightNoble].includes(kind) &&
        targetCurrent(n, id)
      );
    })
  );
}

/** 普通引擎查询前拒绝 foreign／Proxy／accessor 原体，不读取这些外来字段。 */
export function assertDemonNightReadable(world: World): void {
  const b = bindings.get(world);
  if (!b) return;
  assertDemonBadgeReadable(world);
  if (
    !validBinding(b) ||
    ![...b.players.values()].every((p) => {
      const life = world.getComponent(p.id, COMPONENT.Alive);
      if (!life || types.isProxy(life)) return false;
      const factory = aliveLifeDescriptor(life),
        current = Object.getOwnPropertyDescriptor(life, "alive");
      return (
        !!factory?.get &&
        !!current &&
        factory.get === current.get &&
        factory.set === current.set &&
        factory.enumerable === current.enumerable &&
        factory.configurable === current.configurable
      );
    })
  )
    throw new Error("demon_hunter_unreadable_world");
}
export function assertDemonOriginalRoster(world: World): void {
  const b = bindings.get(world);
  if (b && (!validBinding(b) || ![...b.players.values()].every((p) => originalLife(p, world))))
    throw new Error("demon_hunter_original_roster_revoked");
}
export function hasDemonNightStarted(world: World, day: number): boolean {
  return bindings.get(world)?.nights.has(day) === true;
}

export function demonOriginalWolfTargetCurrent(
  world: World,
  day: number,
  targetId: number,
): boolean {
  const n = bindings.get(world)?.active;
  return (
    !!n &&
    n.day === day &&
    !n.closed &&
    n.isCurrent() &&
    validBinding(n.binding) &&
    targetCurrent(n, targetId)
  );
}

/** 原生预言家／守卫的有限提交从最近合法快照计算下一库存。 */
export interface DemonNativeNightFrame {
  readonly targetCurrent: (id: number) => boolean;
  readonly sourceCurrent: () => boolean;
  readonly isCurrent: () => boolean;
  readonly commitSeer: (targetId: number, result: unknown) => boolean;
  readonly commitGuard: (targetId: number | null) => boolean;
}
const nativeArrayPush = Array.prototype.push;
function writableDemonFields(value: object, fields: readonly string[]): boolean {
  return fields.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !!descriptor && "value" in descriptor && descriptor.writable === true;
  });
}
export function openDemonNativeNightFrame(
  world: World,
  actorId: number,
  ability: object,
  kind: "seer_check" | "guard",
  day: number,
): Readonly<DemonNativeNightFrame> | null {
  const b = bindings.get(world);
  if (!b) return null;
  const n = b.active,
    p = b.players.get(actorId),
    id = `native:${kind}`;
  if (n && demonRedMoonNightSealed(world, n.day)) return null;
  const role = kind === "seer_check" ? Role.Seer : Role.Guard;
  const originalJson = p?.auditPrivateJson;
  const original = originalJson ? (JSON.parse(originalJson) as Record<string, unknown>) : null;
  const abilities = original?.abilities as Record<string, unknown> | undefined;
  const snapshot = abilities?.[id] as Record<string, unknown> | undefined;
  const state = snapshot?.state as Record<string, unknown> | undefined;
  const originalState = ownDemonData(ability, "state");
  if (
    !n ||
    n.day !== day ||
    !p ||
    p.kind !== role ||
    !snapshot ||
    !state ||
    ownDemonData(ownDemonData(p.privateState, "abilities"), id) !== ability ||
    !originalState ||
    typeof originalState !== "object" ||
    !exactDemonData(snapshot, [
      "id",
      "kind",
      "state",
      "source",
      "sourceDisclosed",
      "startsOnDay",
      "maxUses",
      "uses",
      "lastUsedDay",
      "disabled",
    ]) ||
    snapshot.id !== id ||
    snapshot.kind !== kind ||
    snapshot.sourceDisclosed !== true ||
    snapshot.startsOnDay !== 1 ||
    snapshot.maxUses !== null ||
    snapshot.disabled !== false ||
    demonJson(snapshot.source) !== demonJson({ kind: "native", role }) ||
    !Number.isSafeInteger(snapshot.uses) ||
    (snapshot.uses as number) < 0 ||
    (snapshot.lastUsedDay !== null &&
      (!Number.isSafeInteger(snapshot.lastUsedDay) ||
        (snapshot.lastUsedDay as number) < 1 ||
        (snapshot.lastUsedDay as number) >= day)) ||
    (kind === "seer_check"
      ? !exactDemonData(state, ["lastTarget", "lastIsWerewolf", "lastResult", "history"]) ||
        !Array.isArray(state.history) ||
        state.history.length !== snapshot.uses
      : !exactDemonData(state, ["lastTarget", "repeatPolicy"]) ||
        state.repeatPolicy !== "netease_consecutive_nights_v1")
  )
    throw new Error("demon_hunter_native_night_stock_invalid");
  let committed = false;
  const writable = () =>
    writableDemonFields(ability, ["uses", "lastUsedDay"]) &&
    writableDemonFields(
      originalState,
      kind === "guard" ? ["lastTarget"] : ["lastTarget", "lastIsWerewolf", "lastResult"],
    ) &&
    (kind !== "seer_check" ||
      (() => {
        const history = ownDemonData(originalState, "history");
        return (
          Array.isArray(history) &&
          !types.isProxy(history) &&
          Object.isExtensible(history) &&
          writableDemonFields(history, ["length"])
        );
      })());
  const current = () =>
    !committed &&
    !n.closed &&
    !n.frozen &&
    b.active === n &&
    n.isCurrent() &&
    validBinding(b) &&
    targetCurrent(n, actorId) &&
    demonJson(p.privateState) === originalJson &&
    writable();
  if (!current()) throw new Error("demon_hunter_native_night_stock_revoked");
  const commit = (targetId: number | null, inspection?: unknown) => {
    if (!current() || (targetId !== null && !targetCurrent(n, targetId))) return false;
    let nextState: Record<string, unknown>;
    if (kind === "seer_check") {
      if (targetId === null) return false;
      const result = { kind: "camp", camp: b.players.get(targetId)!.camp };
      if (demonJson(inspection) !== demonJson(result)) return false;
      const row = { targetId, isWerewolf: result.camp === Camp.Wolf, result: { ...result } };
      nextState = {
        ...state,
        lastTarget: targetId,
        lastIsWerewolf: row.isWerewolf,
        lastResult: { ...result },
        history: [...(state.history as unknown[]), row],
      };
      const liveState = originalState as Record<string, unknown>;
      liveState.lastTarget = targetId;
      liveState.lastIsWerewolf = row.isWerewolf;
      liveState.lastResult = { ...result };
      nativeArrayPush.call(ownDemonData(originalState, "history"), row);
    } else {
      if (targetId !== null && snapshot.lastUsedDay === day - 1 && state.lastTarget === targetId)
        return false;
      nextState = { ...state, lastTarget: targetId };
      (originalState as Record<string, unknown>).lastTarget = targetId;
    }
    const nextAbility = {
      ...snapshot,
      state: nextState,
      uses: (snapshot.uses as number) + (targetId === null ? 0 : 1),
      lastUsedDay: day,
    };
    (ability as Record<string, unknown>).uses = nextAbility.uses;
    (ability as Record<string, unknown>).lastUsedDay = day;
    const json = JSON.stringify({ ...original, abilities: { ...abilities, [id]: nextAbility } });
    if (demonJson(p.privateState) !== json)
      throw new Error("demon_hunter_native_night_commit_failed");
    committed = true;
    p.auditPrivateJson = json;
    return true;
  };
  return Object.freeze({
    targetCurrent: (id: number) =>
      !n.closed && b.active === n && n.isCurrent() && validBinding(b) && targetCurrent(n, id),
    sourceCurrent: () =>
      committed &&
      !n.closed &&
      b.active === n &&
      n.isCurrent() &&
      validBinding(b) &&
      targetCurrent(n, actorId) &&
      privateAuditCurrent(b, p),
    isCurrent: current,
    commitSeer: (targetId: number, result: unknown) =>
      kind === "seer_check" && commit(targetId, result),
    commitGuard: (targetId: number | null) => kind === "guard" && commit(targetId),
  });
}

/** 猎人消耗是同步库存转换，包括跳过和禁止触发的死因。 */
export function openDemonHunterStockFrame(
  world: World,
  actorId: number,
  state: object,
): Readonly<{ isCurrent: () => boolean; consume: () => void }> | null {
  const b = bindings.get(world);
  if (!b) return null;
  const p = b.players.get(actorId);
  if (
    !p ||
    p.kind !== Role.Hunter ||
    ownDemonData(p.privateState, "hunter") !== state ||
    !validBinding(b) ||
    !originalLife(p, world) ||
    p.lifeDescriptor.get!.call(p.life) !== false ||
    !privateAuditCurrent(b, p) ||
    !writableDemonFields(state, ["canShoot"])
  )
    throw new Error("demon_hunter_native_hunter_stock_revoked");
  const originalJson = p.auditPrivateJson,
    original = JSON.parse(originalJson),
    hunter = original.hunter;
  if (
    !exactDemonData(hunter, ["canShoot", "deathActionPolicy"]) ||
    typeof hunter.canShoot !== "boolean" ||
    hunter.deathActionPolicy !== "awa_knife_or_exile_v1"
  )
    throw new Error("demon_hunter_native_hunter_stock_invalid");
  let committed = false;
  const isCurrent = () =>
    !committed &&
    validBinding(b) &&
    originalLife(p, world) &&
    p.lifeDescriptor.get!.call(p.life) === false &&
    demonJson(p.privateState) === originalJson &&
    writableDemonFields(state, ["canShoot"]);
  return Object.freeze({
    isCurrent,
    consume: () => {
      if (
        committed ||
        !validBinding(b) ||
        !originalLife(p, world) ||
        p.lifeDescriptor.get!.call(p.life) !== false ||
        demonJson(p.privateState) !== originalJson ||
        !writableDemonFields(state, ["canShoot"])
      )
        throw new Error("demon_hunter_native_hunter_stock_revoked");
      (state as Record<string, unknown>).canShoot = false;
      const json = JSON.stringify({ ...original, hunter: { ...hunter, canShoot: false } });
      if (demonJson(p.privateState) !== json)
        throw new Error("demon_hunter_native_hunter_commit_failed");
      committed = true;
      p.auditPrivateJson = json;
    },
  });
}

/** 失败周期中即使外来代码替换对象，仍保留原阵容及已提交库存。 */
export function demonHunterCheckpointPlayers(world: World, complete: boolean) {
  const b = bindings.get(world);
  if (!b) return null;
  if (
    complete &&
    (!validBinding(b) ||
      ![...b.players.values()].every((p) => originalLife(p, world) && privateAuditCurrent(b, p)))
  )
    throw new Error("demon_hunter_checkpoint_original_state_revoked");
  return [...b.players.values()].map((p) => {
    const cp = p.checkpoint;
    if (!cp) throw new Error("demon_hunter_checkpoint_metadata_missing");
    const currentBadge = demonBadgeJson(cp.badge),
      currentVote = demonVoteJson(cp.vote);
    const originalMetadata =
      world.getComponent(p.id, COMPONENT.Identity) === cp.identity &&
      ownDemonData(cp.identity, "seat") === cp.seat &&
      ownDemonData(cp.identity, "name") === cp.name &&
      world.getComponent(p.id, COMPONENT.Badge) === cp.badge &&
      world.getComponent(p.id, COMPONENT.VotingRight) === cp.vote &&
      world.getComponent(p.id, COMPONENT.StatusMarks) === cp.marks;
    const marks = Object.values(StatusMark).map(
      (mark) => [mark, statusMarkSnapshot(cp.marks, mark)] as const,
    );
    if (complete) {
      if (
        !originalMetadata ||
        !currentBadge ||
        !currentVote ||
        currentBadge !== cp.badgeJson ||
        currentVote !== cp.voteJson ||
        marks.some(([, snapshot]) => !snapshot)
      )
        throw new Error("demon_hunter_checkpoint_metadata_revoked");
    }
    return {
      id: p.id,
      seat: cp.seat,
      name: cp.name,
      role: p.kind,
      camp: p.camp,
      alive: p.lifeDescriptor.get!.call(p.life) === true,
      privateState: committedPrivate(b, p, complete),
      victory: { affiliations: JSON.parse(p.victoryJson) as VictoryComponent["affiliations"] },
      vote: JSON.parse(cp.voteJson) as { weight: number; canVote: boolean },
      badge: JSON.parse(cp.badgeJson) as {
        isSheriff: boolean;
        destroyed: boolean;
        voteWeight: number;
        handoffPolicy?: import("../../../../core/domain/board").SheriffBadgePolicy;
      },
      marks: marks.flatMap(([mark, snapshot]) => (snapshot?.present ? [mark] : [])),
    };
  });
}

/** 权限回调在任何旧枪政策／状态读取前检查 descriptor。 */
export function demonHunterNativeGunCurrent(world: World, actorId: number): boolean {
  const b = bindings.get(world);
  if (!b) return true;
  const p = b.players.get(actorId);
  return (
    !!p &&
    p.kind === Role.Hunter &&
    validBinding(b) &&
    originalLife(p, world) &&
    p.lifeDescriptor.get!.call(p.life) === false &&
    privateAuditCurrent(b, p)
  );
}

/** 有限板子的警徽写入在实际同步提交时缓存，不在失败 checkpoint 中刷新。 */
export function openDemonBadgeFrame(world: World): Readonly<{
  commit: (
    change:
      | { kind: "assign"; sheriffId: number; weight: number; policy: string | undefined }
      | {
          kind: "handoff";
          fromId: number;
          toId: number | null;
          weight: number;
          policy: string | undefined;
        },
  ) => void;
}> | null {
  const b = bindings.get(world);
  if (!b) return null;
  if (!validBinding(b)) throw new Error("demon_hunter_badge_original_state_revoked");
  const before = new Map(
    [...b.players.values()].map((p) => {
      const cp = p.checkpoint;
      if (
        !cp ||
        world.getComponent(p.id, COMPONENT.Badge) !== cp.badge ||
        world.getComponent(p.id, COMPONENT.VotingRight) !== cp.vote ||
        !originalLife(p, world) ||
        demonBadgeJson(cp.badge) !== cp.badgeJson ||
        demonVoteJson(cp.vote) !== cp.voteJson ||
        !writableDemonFields(cp.badge, ["isSheriff", "destroyed", "voteWeight"]) ||
        !writableDemonFields(cp.vote, ["weight"]) ||
        !Object.isExtensible(cp.badge) ||
        Object.getOwnPropertyDescriptor(cp.badge, "handoffPolicy")?.configurable === false
      )
        throw new Error("demon_hunter_badge_stock_revoked");
      return [
        p.id,
        {
          cp,
          badge: JSON.parse(cp.badgeJson),
          vote: JSON.parse(cp.voteJson),
          alive: p.lifeDescriptor.get!.call(p.life) === true,
        },
      ] as const;
    }),
  );
  let committed = false;
  return Object.freeze({
    commit: (change) => {
      if (
        committed ||
        !validBinding(b) ||
        change.weight !== 1.5 ||
        change.policy !== (b.config.nobleSecretBody ? "awa_holder_choice_v1" : undefined)
      )
        throw new Error("demon_hunter_badge_commit_invalid");
      const expected = new Map(
        [...before].map(([id, item]) => [id, { badge: { ...item.badge }, vote: { ...item.vote } }]),
      );
      if (change.kind === "assign") {
        if (!before.get(change.sheriffId)?.alive)
          throw new Error("demon_hunter_badge_commit_invalid");
        for (const [id, item] of before)
          if (item.alive) {
            const next = expected.get(id)!;
            next.badge.isSheriff = id === change.sheriffId;
            next.badge.destroyed = false;
            next.badge.voteWeight = change.weight;
            if (change.policy) next.badge.handoffPolicy = change.policy;
            else delete next.badge.handoffPolicy;
            if (next.vote.canVote) next.vote.weight = id === change.sheriffId ? change.weight : 1;
          }
      } else {
        const from = expected.get(change.fromId);
        if (
          !from ||
          !from.badge.isSheriff ||
          from.badge.destroyed ||
          change.toId === change.fromId ||
          (change.toId !== null && !before.get(change.toId)?.alive)
        )
          throw new Error("demon_hunter_badge_commit_invalid");
        from.badge.isSheriff = false;
        from.badge.destroyed = true;
        from.vote.weight = from.vote.canVote ? 1 : 0;
        if (change.toId !== null) {
          const next = expected.get(change.toId)!;
          next.badge.isSheriff = true;
          next.badge.destroyed = false;
          next.badge.voteWeight = change.weight;
          if (change.policy) next.badge.handoffPolicy = change.policy;
          else delete next.badge.handoffPolicy;
          next.vote.weight = change.weight;
        }
      }
      for (const [id, next] of expected) {
        const cp = before.get(id)!.cp;
        if (
          world.getComponent(id, COMPONENT.Badge) !== cp.badge ||
          world.getComponent(id, COMPONENT.VotingRight) !== cp.vote ||
          demonBadgeJson(cp.badge) !== JSON.stringify(next.badge) ||
          demonVoteJson(cp.vote) !== JSON.stringify(next.vote)
        )
          throw new Error("demon_hunter_badge_commit_revoked");
      }
      committed = true;
      for (const [id, next] of expected) {
        const cp = before.get(id)!.cp;
        cp.badgeJson = JSON.stringify(next.badge);
        cp.voteJson = JSON.stringify(next.vote);
      }
    },
  });
}

/** 原生警徽可选 metadata 必须区分缺失与被拒绝的 accessor。 */
export function assertDemonBadgeReadable(world: World): void {
  const b = bindings.get(world);
  if (!b) return;
  for (const p of b.players.values()) {
    const cp = p.checkpoint;
    if (!cp) continue;
    if (
      world.getComponent(p.id, COMPONENT.Badge) !== cp.badge ||
      world.getComponent(p.id, COMPONENT.VotingRight) !== cp.vote ||
      !demonBadgeJson(cp.badge) ||
      !demonVoteJson(cp.vote)
    )
      throw new Error("demon_hunter_badge_unreadable");
  }
}

export function demonNativeNightActor(
  world: World,
  kind: "seer_check" | "guard",
): { actorId: number; ability: object } | null {
  const b = bindings.get(world),
    n = b?.active;
  if (!b || !n || n.closed || n.frozen || !validBinding(b))
    throw new Error("demon_hunter_native_night_unavailable");
  const p = [...b.players.values()].find(
    (p) => p.kind === (kind === "seer_check" ? Role.Seer : Role.Guard),
  );
  if (!p || !n.targets.has(p.id) || demonRedMoonNightSealed(world, n.day)) return null;
  const ability = ownDemonData(ownDemonData(p.privateState, "abilities"), `native:${kind}`);
  if (!ability || typeof ability !== "object")
    throw new Error("demon_hunter_native_night_unavailable");
  return { actorId: p.id, ability };
}

/** 原生红月状态的有限审计转换，不采用任意 live 库存。 */
export function commitDemonRedMoonTransition(
  world: World,
  actorId: number,
  kind: "blast" | "exile" | "expire",
  day: number,
): boolean {
  const b = bindings.get(world),
    p = b?.players.get(actorId);
  const n = kind === "expire" ? b?.active : b?.nights.get(day);
  if (
    !b ||
    !p ||
    !n ||
    n.day !== day ||
    !validBinding(b) ||
    String(p.kind) !== RED_MOON_ROLE ||
    ![...b.players.values()].every((player) => originalLife(player, world)) ||
    !privateAuditCurrent(b, p)
  )
    return false;
  const state = getRedMoonState(p.role);
  if (!state || !writableDemonFields(state, ["blastDay", "exileDay", "expirySettled"]))
    return false;
  // 本族编码函数只消费已捕获的影子；解析查找先于 audit 字段读取，原体／夜权限仍留在这里。
  const original = readRedMoonShadow(() => p.auditPrivateJson);
  const next = copyRedMoonPayload(state);
  if (kind === "expire") {
    if (n.closed || !n.frozen || state.exileDay !== day - 1 || state.expirySettled) return false;
    next.expirySettled = true;
  } else {
    if (
      b.active ||
      !n.closed ||
      !n.frozen ||
      [...b.nights.keys()].some((d) => d > day) ||
      !originalLife(p, world, true) ||
      state.blastDay !== null ||
      state.exileDay !== null
    )
      return false;
    const wolves = [...b.players.values()].filter(
      (player) => player.camp === Camp.Wolf && originalLife(player, world, true),
    ).length;
    if (kind === "blast") {
      if (wolves === 1 && state.lastWolfBlastPolicy === "forbidden") return false;
      next.blastDay = day;
    } else if (kind === "exile") {
      if (wolves !== 1) return false;
      next.exileDay = day;
    } else return false;
  }
  const expected = encodeRedMoonShadow(original, next);
  // 三写只归本族 slot；完整容器验收和 audit 最终更新保持原点，后续失败不撤销先前字段。
  writeRedMoonTransition(state, next);
  if (demonJson(p.privateState) !== expected) throw new Error("red_moon_state_commit_failed");
  p.auditPrivateJson = expected;
  return true;
}

/** 原红月自爆只抑制紧接的下一夜好人行动。 */
export function demonRedMoonNightSealed(world: World, day: number): boolean {
  const b = bindings.get(world);
  if (!b) return false;
  const p = [...b.players.values()].find((p) => String(p.kind) === RED_MOON_ROLE);
  if (!p) return false;
  if (!validBinding(b) || ![...b.players.values()].every((p) => originalLife(p, world)))
    throw new Error("red_moon_original_state_revoked");
  const state = getRedMoonState(p.role);
  if (!state || !privateAuditCurrent(b, p)) throw new Error("red_moon_original_state_revoked");
  const sealed = Number.isSafeInteger(day) && day > 1 && state.blastDay === day - 1;
  if (sealed && originalLife(p, world, true)) throw new Error("red_moon_blast_death_unsettled");
  return sealed;
}

/** 有限板子的白痴翻牌时，同时保留私有库存与公开票权审计。 */
export function commitDemonIdiotReveal(world: World, actorId: number): boolean {
  const b = bindings.get(world);
  if (!b) return false;
  const p = b.players.get(actorId),
    cp = p?.checkpoint;
  if (
    !p ||
    !cp ||
    p.kind !== Role.Idiot ||
    !validBinding(b) ||
    !originalLife(p, world, true) ||
    !privateAuditCurrent(b, p) ||
    world.getComponent(actorId, COMPONENT.VotingRight) !== cp.vote ||
    demonVoteJson(cp.vote) !== cp.voteJson ||
    !writableDemonFields(p.privateState, ["idiot"]) ||
    !writableDemonFields(cp.vote, ["canVote", "weight"])
  )
    throw new Error("demon_hunter_idiot_state_revoked");
  const before = ownDemonData(p.privateState, "idiot");
  if (!exactDemonData(before, ["revealed"]) || ownDemonData(before, "revealed") !== false)
    throw new Error("demon_hunter_idiot_state_revoked");
  // 消耗翻牌前先验证后续同步警徽交接。
  openDemonBadgeFrame(world);
  const next = { revealed: true };
  const original = JSON.parse(p.auditPrivateJson) as Record<string, unknown>;
  const expectedPrivate = JSON.stringify({ ...original, idiot: next });
  const expectedVote = JSON.stringify({ ...JSON.parse(cp.voteJson), canVote: false, weight: 0 });
  (p.privateState as { idiot: typeof next }).idiot = next;
  (cp.vote as VotingRightComponent).canVote = false;
  (cp.vote as VotingRightComponent).weight = 0;
  if (demonJson(p.privateState) !== expectedPrivate || demonVoteJson(cp.vote) !== expectedVote)
    throw new Error("demon_hunter_idiot_commit_failed");
  p.privateRefs = p.privateRefs.map(
    ([key, value]) => [key, key === "idiot" ? next : value] as const,
  );
  p.inventoryRefs = p.inventoryRefs.map(
    ([path, value]) => [path, path.length === 1 && path[0] === "idiot" ? next : value] as const,
  );
  p.auditPrivateJson = expectedPrivate;
  cp.voteJson = expectedVote;
  return true;
}

/** 在任何旧状态 getter 可执行前读取已提交的白痴状态。 */
export function demonIdiotRevealed(world: World, actorId: number): boolean | null {
  const b = bindings.get(world);
  if (!b) return null;
  const p = b.players.get(actorId),
    cp = p?.checkpoint;
  if (
    !p ||
    !cp ||
    p.kind !== Role.Idiot ||
    !validBinding(b) ||
    !originalLife(p, world, true) ||
    !privateAuditCurrent(b, p) ||
    world.getComponent(actorId, COMPONENT.VotingRight) !== cp.vote ||
    demonVoteJson(cp.vote) !== cp.voteJson
  )
    throw new Error("demon_hunter_idiot_state_revoked");
  const state = ownDemonData(p.privateState, "idiot");
  const revealed = ownDemonData(state, "revealed");
  if (!exactDemonData(state, ["revealed"]) || typeof revealed !== "boolean")
    throw new Error("demon_hunter_idiot_state_revoked");
  return revealed;
}

/** 有限板子当前日只由最近已结算的夜产生。 */
export function demonRedMoonDay(world: World, actorId: number): number | null {
  const b = bindings.get(world),
    p = b?.players.get(actorId);
  if (!b || !p || String(p.kind) !== RED_MOON_ROLE) return null;
  demonHunterCheckpointPlayers(world, true);
  if (b.active || !originalLife(p, world, true)) return null;
  const day = [...b.nights.keys()].at(-1);
  const n = day === undefined ? null : b.nights.get(day);
  return n?.closed && n.frozen ? n.day : null;
}
export function demonRedMoonCanBlast(world: World, actorId: number): boolean {
  if (demonRedMoonDay(world, actorId) === null) return false;
  const b = bindings.get(world)!,
    p = b.players.get(actorId)!;
  const state = getRedMoonState(p.role);
  if (!state || state.blastDay !== null || state.exileDay !== null) return false;
  const wolves = [...b.players.values()].filter(
    (player) => player.camp === Camp.Wolf && originalLife(player, world, true),
  ).length;
  return wolves > 1 || state.lastWolfBlastPolicy === "ends_game";
}
export function commitDemonRedMoonBlast(
  world: World,
  actorId: number,
): { day: number; sealsNight: boolean } | null {
  const day = demonRedMoonDay(world, actorId);
  if (day === null || !demonRedMoonCanBlast(world, actorId)) return null;
  const b = bindings.get(world)!;
  const wolves = [...b.players.values()].filter(
    (player) => player.camp === Camp.Wolf && originalLife(player, world, true),
  ).length;
  if (!commitDemonRedMoonTransition(world, actorId, "blast", day)) return null;
  return { day, sealsNight: wolves > 1 };
}

/** 被延后的存活最后一狼只在普通来源已结算后到期。 */
export function demonRedMoonExpiry(world: World, day: number): number | null {
  const b = bindings.get(world);
  if (!b) return null;
  const p = [...b.players.values()].find((player) => String(player.kind) === RED_MOON_ROLE);
  if (!p) return null;
  demonHunterCheckpointPlayers(world, true);
  const n = b.active;
  if (!n || n.day !== day || n.closed || !n.frozen)
    throw new Error("red_moon_expiry_phase_invalid");
  const state = getRedMoonState(p.role);
  if (!state) throw new Error("red_moon_original_state_revoked");
  return state.exileDay === day - 1 && !state.expirySettled && originalLife(p, world, true)
    ? p.id
    : null;
}

export function isRedMoonBoard(world: World): boolean {
  const b = bindings.get(world);
  if (!b || ![...b.players.values()].some((p) => p.kind === Role.RedMoonApostle)) return false;
  if (!validBinding(b)) throw new Error("red_moon_original_state_revoked");
  return true;
}
