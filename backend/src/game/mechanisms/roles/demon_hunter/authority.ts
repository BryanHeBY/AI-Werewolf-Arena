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
  type RoleComponent,
  type CampComponent,
  type VictoryComponent,
  type BoardConfig,
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
  type DemonHunterChoice,
  type DemonHunterState,
} from "./state";
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
}
interface Binding {
  world: World;
  config: BoardConfig;
  configJson: string;
  actorId: number;
  players: Map<number, Participant>;
  state: DemonHunterState;
  history: DemonHunterChoice[];
  historyJson: string;
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
function capture(world: World, id: number): Participant {
  const role = world.getComponent<RoleComponent>(id, COMPONENT.Role),
    campComponent = world.getComponent<CampComponent>(id, COMPONENT.Camp),
    victory = world.getComponent<VictoryComponent>(id, COMPONENT.Victory),
    life = world.getComponent<AliveComponent>(id, COMPONENT.Alive);
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
    inventoryRefs: inventoryReferences(privateState),
    auditPrivateJson: privateJson,
  };
  if (!originalLife(p, world, true)) throw new Error("demon_hunter_original_life_invalid");
  return p;
}
function validBinding(b: Binding): boolean {
  const state = readDemonHunterState(b.state);
  return (
    bindings.get(b.world) === b &&
    b.world.entityIds().length === b.players.size &&
    demonJson(b.config) === b.configJson &&
    !!state &&
    ownDemonData(b.players.get(b.actorId)?.privateState, "demonHunter") === b.state &&
    ownDemonData(b.state, "history") === b.history &&
    demonJson(state.history) === b.historyJson &&
    [...b.players.values()].every(
      (p) => originalIdentity(p, b.world) && demonJson(p.privateState) !== null,
    )
  );
}
/** Captures native objects once. A public profile registration is a separate later step. */
export function installDemonHunter(world: World, config: BoardConfig): void {
  if (bindings.has(world)) throw new Error("demon_hunter_already_installed");
  assertDemonHunterPreset(config);
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
    [...players.values()].some((p) => p.camp !== (p.kind === Role.Wolf ? Camp.Wolf : Camp.Good))
  )
    throw new Error("demon_hunter_initial_state_invalid");
  bindings.set(world, {
    world,
    config,
    configJson,
    actorId: actor.id,
    players,
    state,
    history: state.history,
    historyJson: "[]",
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
    requiresChoice: day >= 2 && targets.has(b.actorId),
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
  if (!n || n.day < 2 || n.opened || n.turn || n.choice || !liveNight(n))
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
  const length = Object.getOwnPropertyDescriptor(b.history, "length");
  if (!length?.writable || !Object.isExtensible(b.history) || (b.history.at(-1)?.day ?? 1) >= n.day)
    return null;
  const choice = Object.freeze({ day: n.day, targetId });
  const nextHistoryJson = demonJson([...b.history, choice]);
  if (nextHistoryJson === null) return null;
  b.history.push(choice);
  b.historyJson = nextHistoryJson;
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
/** Derived only from the actual engine choice. It is not reconstructed from a recorded cancellation fact. */
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
/** Freeze all original source qualifications before the caller marks any player in the initial wave. */
export function freezeDemonHunt(
  world: World,
  faultId: string | null = null,
): Readonly<DemonHuntSettlement> {
  const n = bindings.get(world)?.active;
  if (!n || n.closed || n.frozen) throw new Error("demon_hunter_freeze_unavailable");
  const choice = n.choice;
  if (n.requiresChoice && !choice) throw new Error("demon_hunter_required_choice_missing");
  let damage: DemonHuntSettlement["damage"] = null,
    cancelled: DemonHuntSettlement["cancelled"] = null;
  if (choice?.targetId !== null && choice) {
    if (liveNight(n) && targetCurrent(n, choice.targetId)) {
      const target = n.binding.players.get(choice.targetId)!;
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
  return Object.freeze({ choice, damage, cancelled });
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
/** Audit is a read of the last synchronous domain commit, never a refresh from mutable live inventory. */
export function demonHunterAuditPlayer(
  world: World,
  id: number,
): Record<string, unknown> | undefined {
  const p = bindings.get(world)?.players.get(id);
  return p ? (JSON.parse(p.auditPrivateJson) as Record<string, unknown>) : undefined;
}
export function demonHunterFreezeDay(world: World): number {
  const n = bindings.get(world)?.active;
  if (!n || n.closed || n.frozen) throw new Error("demon_hunter_freeze_unavailable");
  if (n.requiresChoice && !n.choice) throw new Error("demon_hunter_required_choice_missing");
  return n.day;
}
/** Internal original-instance boundary for the native poison proof, never a recording or model capability. */
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

/** Finite original Witch transaction. Audit changes are computed from the prior committed snapshot. */
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
  const current = () =>
    !n.closed &&
    !n.frozen &&
    b.active === n &&
    n.isCurrent() &&
    validBinding(b) &&
    targetCurrent(n, p.id);
  if (!current() || demonJson(p.privateState) !== p.auditPrivateJson) return null;
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
  // Reset is itself a finite synchronous transition. It cannot adopt arbitrary live inventory.
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
      demonJson(p.privateState) === p.auditPrivateJson,
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
  return [...n.binding.players.values()].some((p) => p.kind === Role.Witch && n.targets.has(p.id));
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
    actorIds.every((id) => n.binding.players.get(id)?.kind === Role.Wolf && targetCurrent(n, id))
  );
}

/** Before ordinary engine queries, reject foreign/proxy/accessor bodies without reading them. */
export function assertDemonNightReadable(world: World): void {
  const b = bindings.get(world);
  if (!b) return;
  if (
    !validBinding(b) ||
    ![...b.players.values()].every((p) => {
      const life = world.getComponent<AliveComponent>(p.id, COMPONENT.Alive);
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
