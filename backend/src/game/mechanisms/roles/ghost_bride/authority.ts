/**
 * Owns Ghost Bride wedding turns, participant snapshots and transactional commits. Receives
 * original World objects and sealed requests; writes accepted choices and bound aliases only
 * through current wedding authority. Cancellation and failed commits keep their original
 * settlement order; alias routing never replaces local validation.
 */
import { registerRequestAliasPropagation } from "../../../../core/domain/request_delivery";
import { types } from "node:util";
import {
  GHOST_BRIDE_POLICY,
  GHOST_BRIDE_ROLE,
  freshGhostBrideState,
  readGhostBrideState,
  type GhostBrideState,
  type WeddingPair,
  type WeddingGroup,
  type WeddingSetup,
  type WeddingKnifeCapture,
  type WeddingTool,
  readWeddingTool,
} from "@ai-werewolf-arena/game-text";
import {
  bindRequestDeliveryGuard,
  settleRequestDelivery,
  DeathCause,
  type DeathSources,
  COMPONENT,
  Camp,
  Role,
  Phase,
  createVictoryComponent,
  type World,
  type BoardConfig,
  type RoleComponent,
  type CampComponent,
  type VictoryComponent,
} from "../../../../core/domain";
import {
  aliveLifeVersion,
  aliveLifeDescriptor,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import { assertGhostBridePreset } from "./preset";

/** Read own data only: substituted getters never execute during rejection or auditing. */
function data(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && Object.hasOwn(d, "value") ? d.value : undefined;
}
function snapshot(value: unknown, depth = 0, arrayLimit = 128): unknown {
  if (
    value === null ||
    ["string", "boolean"].includes(typeof value) ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  if (
    !value ||
    typeof value !== "object" ||
    types.isProxy(value) ||
    depth > 12 ||
    Object.getOwnPropertySymbols(value).length
  )
    throw new Error("ghost_bride_authority_not_data");
  const array = Array.isArray(value),
    proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
    throw new Error("ghost_bride_authority_not_plain");
  const fields = Object.getOwnPropertyDescriptors(value),
    result: Record<string, unknown> = {};
  for (const [key, d] of Object.entries(fields)) {
    if (array && key === "length") continue;
    if (!d.enumerable || !Object.hasOwn(d, "value"))
      throw new Error("ghost_bride_authority_accessor");
    Object.defineProperty(result, key, {
      value: snapshot(d.value, depth + 1, arrayLimit),
      enumerable: true,
    });
  }
  if (!array) return result;
  const length = fields.length?.value;
  if (
    !Number.isSafeInteger(length) ||
    length > arrayLimit ||
    Object.keys(result).length !== length ||
    !Array.from({ length }, (_, i) => Object.hasOwn(result, i)).every(Boolean)
  )
    throw new Error("ghost_bride_authority_array");
  return Array.from({ length }, (_, i) => result[i]);
}
function json(value: unknown): string | null {
  try {
    return JSON.stringify(snapshot(value));
  } catch {
    return null;
  }
}
interface Participant {
  id: number;
  role: RoleComponent;
  kind: Role;
  camp: Camp;
  campComponent: CampComponent;
  state: RoleComponent["privateState"];
  stateRefs: ReadonlyArray<readonly [string, unknown]>;
  initialPrivateState: unknown;
  expectedPrivateJson: string;
  auditPrivateJson: string;
  life: AliveComponent;
  version: number;
  aliveDescriptor: PropertyDescriptor;
  victory: VictoryComponent;
  affiliations: VictoryComponent["affiliations"];
  victoryJson: string;
}
type TurnKind = "bridegroom" | "chat" | "witness" | "knife";
interface Binding {
  world: World;
  config: BoardConfig;
  configJson: string;
  actorId: number;
  participants: Map<number, Participant>;
  state: GhostBrideState;
  status: WeddingSetup["status"];
  pair: Readonly<WeddingPair> | null;
  group: Readonly<WeddingGroup> | null;
  votes: WeddingSetup["witnessVotes"];
  consent: Turn | null;
  chats: number;
  setupCurrent: (() => boolean) | null;
  turn: Turn | null;
  pendingChat: Turn | null;
  assignments: ReadonlyMap<number, Camp> | null;
  nights: Map<number, Night>;
  activeNight: Night | null;
}
interface Turn {
  binding: Binding;
  kind: TurnKind;
  actorId: number;
  day: number;
  tool: WeddingTool["name"];
  scope: object;
  isCurrent: () => boolean;
  privateJson: Map<number, string>;
  targetVersions: Map<number, number>;
  request: WeddingRequest | null;
  requestJson: string | null;
  deadline: number | null;
  chat: Readonly<{ actorId: number; recipientId: number; day: number; text: string }> | null;
  delivered: boolean;
}
interface Night {
  binding: Binding;
  day: number;
  capture: Readonly<WeddingKnifeCapture>;
  isCurrent: () => boolean;
  actorVersions: Map<number, number>;
  targetVersions: Map<number, number>;
  votes: Array<{ actorId: number; targetId: number | null; abstain: boolean }>;
  chats: number;
  requiredChats: number;
  closed: boolean;
  knifeCommitted: boolean;
  targetId: number | null;
}
export interface WeddingRequest {
  phase: Phase;
  actorId: number;
  allowedTools: readonly string[];
  context: { day: number; stage: string };
  deadlineAtMs?: number;
}
const bindings = new WeakMap<World, Binding>(),
  turns = new WeakMap<object, Turn>(),
  requests = new WeakMap<
    object,
    {
      turn: Turn;
      context: object;
      json: string;
      fields: PropertyDescriptorMap;
      deadline: number | null;
    }
  >();
function capture(world: World, id: number): Participant {
  const role = world.getComponent(id, COMPONENT.Role),
    campComponent = world.getComponent(id, COMPONENT.Camp),
    life = world.getComponent(id, COMPONENT.Alive),
    victory = world.getComponent(id, COMPONENT.Victory);
  const kind = data(role, "role"),
    camp = data(role, "camp"),
    state = data(role, "privateState"),
    affiliations = data(victory, "affiliations"),
    version = life && aliveLifeVersion(life),
    aliveDescriptor = life && aliveLifeDescriptor(life),
    actualDescriptor = life && Object.getOwnPropertyDescriptor(life, "alive"),
    privateJson = json(state),
    victoryJson = json(affiliations);
  if (
    !role ||
    !campComponent ||
    !life ||
    !victory ||
    !aliveDescriptor ||
    !actualDescriptor ||
    actualDescriptor.get !== aliveDescriptor.get ||
    actualDescriptor.set !== aliveDescriptor.set ||
    version === undefined ||
    !life.alive ||
    typeof kind !== "string" ||
    !Object.values(Camp).includes(camp as Camp) ||
    data(campComponent, "camp") !== camp ||
    !state ||
    typeof state !== "object" ||
    !Array.isArray(affiliations) ||
    !privateJson ||
    !victoryJson ||
    victoryJson !== json([{ kind: "faction", faction: camp }])
  )
    throw new Error("ghost_bride_initial_roster_invalid");
  return {
    id,
    role,
    kind: kind as Role,
    camp: camp as Camp,
    campComponent,
    life,
    victory,
    state: state as RoleComponent["privateState"],
    stateRefs: Object.entries(state),
    initialPrivateState: snapshot(state),
    expectedPrivateJson: privateJson,
    auditPrivateJson: privateJson,
    affiliations,
    victoryJson,
    version,
    aliveDescriptor,
  };
}
function sameBody(b: Binding, p: Participant, mustLive = false): boolean {
  const d = Object.getOwnPropertyDescriptor(p.life, "alive");
  if (
    b.world.getComponent(p.id, COMPONENT.Alive) !== p.life ||
    !d ||
    d.get !== p.aliveDescriptor.get ||
    d.set !== p.aliveDescriptor.set ||
    (!d.get && d.value !== p.aliveDescriptor.value)
  )
    return false;
  // Only the originally captured accessor is evaluated after its descriptor is verified.
  const alive = p.aliveDescriptor.get
    ? p.aliveDescriptor.get.call(p.life) === true
    : d.value === true;
  return (!mustLive || alive) && aliveLifeVersion(p.life) === p.version + (alive ? 0 : 1);
}
function sameIdentity(b: Binding, p: Participant): boolean {
  if (types.isProxy(p.state)) return false;
  const fields = Object.getOwnPropertyDescriptors(p.state);
  return (
    b.world.getComponent(p.id, COMPONENT.Role) === p.role &&
    data(p.role, "role") === p.kind &&
    data(p.role, "camp") === p.camp &&
    data(p.role, "privateState") === p.state &&
    Object.keys(fields).length === p.stateRefs.length &&
    p.stateRefs.every(
      ([k, v]) => fields[k] && Object.hasOwn(fields[k], "value") && fields[k]!.value === v,
    ) &&
    b.world.getComponent(p.id, COMPONENT.Camp) === p.campComponent &&
    data(p.campComponent, "camp") === p.camp &&
    b.world.getComponent(p.id, COMPONENT.Victory) === p.victory &&
    data(p.victory, "affiliations") === p.affiliations &&
    json(p.affiliations) === p.victoryJson
  );
}
function validBinding(b: Binding, setup = false): boolean {
  const s = readGhostBrideState(b.state),
    expectedGroom = b.pair?.groomId ?? null,
    expectedRemaining = b.status === "pending" || b.status === "active" ? 1 : 0;
  return (
    bindings.get(b.world) === b &&
    b.world.entityIds().length === b.participants.size &&
    json(b.config) === b.configJson &&
    !!s &&
    s.groomId === expectedGroom &&
    s.remaining === expectedRemaining &&
    data(b.participants.get(b.actorId)?.state, "ghostBride") === b.state &&
    [...b.participants.values()].every((p) => {
      const encoded = json(p.state);
      if (
        !sameBody(b, p, setup) ||
        !sameIdentity(b, p) ||
        encoded === null ||
        (setup && encoded !== p.expectedPrivateJson)
      )
        return false;
      p.auditPrivateJson = encoded;
      return true;
    })
  );
}
function writable(state: object, key: string): boolean {
  const d = Object.getOwnPropertyDescriptor(state, key);
  return !!d && Object.hasOwn(d, "value") && d.writable === true;
}
function third(b: Binding, id: number): void {
  const p = b.participants.get(id)!,
    victory = createVictoryComponent([{ kind: "faction", faction: Camp.ThirdParty }]);
  b.world.addComponent(id, COMPONENT.Victory, victory);
  p.victory = victory;
  p.affiliations = victory.affiliations;
  p.victoryJson = json(victory.affiliations)!;
}
/** Installation is deliberately separate from catalog activation and runtime setup. */
export function installGhostBride(world: World, config: BoardConfig): void {
  if (bindings.has(world)) throw new Error("ghost_bride_already_installed");
  assertGhostBridePreset(config);
  const participants = new Map(world.entityIds().map((id) => [id, capture(world, id)])),
    brides = [...participants.values()].filter((p) => String(p.kind) === GHOST_BRIDE_ROLE),
    actor = brides[0],
    state = data(actor?.state, "ghostBride"),
    parsed = readGhostBrideState(state),
    configJson = json(config);
  const counts: Record<string, number> = {};
  for (const p of participants.values()) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
  const deck = new Map(config.roleSetups.map((r) => [String(r.role), r.count]));
  if (
    participants.size !== 12 ||
    brides.length !== 1 ||
    !actor ||
    actor.camp !== Camp.ThirdParty ||
    !parsed ||
    parsed.remaining !== 1 ||
    parsed.groomId !== null ||
    !configJson ||
    Object.entries(counts).some(([r, n]) => deck.get(r) !== n) ||
    deck.size !== Object.keys(counts).length ||
    [...participants.values()].some(
      (p) => p.id !== actor.id && p.camp !== (p.kind === Role.Wolf ? Camp.Wolf : Camp.Good),
    ) ||
    !writable(state as object, "remaining") ||
    !writable(state as object, "groomId")
  )
    throw new Error("ghost_bride_initial_state_invalid");
  bindings.set(world, {
    world,
    config,
    configJson,
    actorId: actor.id,
    participants,
    state: state as GhostBrideState,
    status: "pending",
    pair: null,
    group: null,
    votes: [],
    consent: null,
    chats: 0,
    setupCurrent: null,
    turn: null,
    pendingChat: null,
    assignments: null,
    nights: new Map(),
    activeNight: null,
  });
}
export function beginWeddingSetup(
  world: World,
  config: BoardConfig,
  isCurrent: () => boolean,
): void {
  const b = bindings.get(world);
  if (!b || b.config !== config || b.status !== "pending" || !validBinding(b, true) || !isCurrent())
    throw new Error("ghost_bride_setup_unavailable");
  b.status = "active";
  b.setupCurrent = isCurrent;
}
export function weddingSetup(world: World): WeddingSetup | null {
  const b = bindings.get(world);
  return b
    ? {
        policy: GHOST_BRIDE_POLICY,
        status: b.status,
        actorId: b.actorId,
        groomId: b.pair?.groomId ?? null,
        witnessId: b.group?.witnessId ?? null,
        witnessVotes: b.votes.map((v) => ({ ...v })),
      }
    : null;
}
export function weddingPair(world: World): Readonly<WeddingPair> | null {
  return bindings.get(world)?.pair ?? null;
}
export function weddingGroup(world: World): Readonly<WeddingGroup> | null {
  return bindings.get(world)?.group ?? null;
}
export function ghostBrideReady(world: World): boolean {
  const b = bindings.get(world);
  return b
    ? b.status === "complete" && validBinding(b)
    : !world
        .entityIds()
        .some((id) => data(world.getComponent(id, COMPONENT.Role), "role") === GHOST_BRIDE_ROLE);
}
export function hasActiveGhostBride(world: World): boolean {
  const b = bindings.get(world);
  return !!b && (b.status === "active" || b.status === "paired" || !!b.activeNight);
}
export function hasGhostBrideNightCommit(world: World, day: number): boolean {
  return bindings.get(world)?.nights.has(day) ?? false;
}
function expectedTurn(b: Binding, kind: TurnKind, actorId: number, day: number): boolean {
  if (kind === "bridegroom")
    return b.status === "active" && !b.pair && actorId === b.actorId && day === 1;
  if (!b.pair) return false;
  const members = [b.actorId, b.pair.groomId];
  if (b.status === "paired" && day === 1) {
    if (kind === "chat") return b.chats < 2 && actorId === members[b.chats];
    if (kind === "witness")
      return b.chats === 2 && b.votes.length < 2 && actorId === members[b.votes.length];
  }
  const n = b.activeNight;
  if (b.status !== "complete" || !n || n.day !== day || n.closed) return false;
  if (kind === "chat")
    return (
      day > 1 &&
      n.chats < 2 &&
      actorId === members[n.chats] &&
      members.every((id) => sameBody(b, b.participants.get(id)!, true))
    );
  return (
    kind === "knife" &&
    !n.knifeCommitted &&
    n.chats === n.requiredChats &&
    n.votes.length < n.capture.actorIds.length &&
    actorId === n.capture.actorIds[n.votes.length] &&
    validKnifeOwner(n)
  );
}
export function openWeddingTurn(
  world: World,
  kind: TurnKind,
  actorId: number,
  day: number,
  isCurrent: () => boolean,
): object {
  const b = bindings.get(world),
    setup = b?.status !== "complete";
  if (
    !b ||
    b.turn ||
    b.pendingChat ||
    !isCurrent() ||
    (setup && !b.setupCurrent?.()) ||
    !expectedTurn(b, kind, actorId, day) ||
    !validBinding(b, setup) ||
    !sameBody(b, b.participants.get(actorId)!, true)
  )
    throw new Error("ghost_bride_turn_unavailable");
  const tool: WeddingTool["name"] =
    kind === "bridegroom"
      ? "choose_bridegroom"
      : kind === "witness"
        ? "choose_wedding_witness"
        : kind === "chat"
          ? "speak_to_partner"
          : b.activeNight!.capture.owner === "ordinary_pack"
            ? "kill_vote"
            : "wedding_kill_vote";
  const scope = Object.freeze({}),
    turn: Turn = {
      binding: b,
      kind,
      actorId,
      day,
      tool,
      scope,
      isCurrent,
      privateJson: new Map([...b.participants].map(([id, p]) => [id, json(p.state)!])),
      request: null,
      requestJson: null,
      deadline: null,
      chat: null,
      delivered: false,
      targetVersions: new Map(
        [...b.participants].map(([id, p]) => [id, aliveLifeVersion(p.life)!]),
      ),
    };
  b.turn = turn;
  turns.set(scope, turn);
  return scope;
}
function validWindow(t: Turn): boolean {
  const b = t.binding,
    setup = b.status !== "complete";
  return (
    b.turn === t &&
    t.isCurrent() &&
    (!setup || b.setupCurrent?.() === true) &&
    expectedTurn(b, t.kind, t.actorId, t.day) &&
    validBinding(b, setup) &&
    sameBody(b, b.participants.get(t.actorId)!, true) &&
    [...b.participants].every(([id, p]) => json(p.state) === t.privateJson.get(id))
  );
}
function validDeadline(t: Turn): boolean {
  return t.deadline === null || t.deadline > Date.now();
}
function validRequestProof(t: Turn): boolean {
  const r = t.request,
    a = r && requests.get(r);
  return (
    !!r &&
    !!a &&
    a.turn === t &&
    data(r, "context") === a.context &&
    requestData(r) === t.requestJson &&
    validDeadline(t) &&
    (data(r, "deadlineAtMs") ?? null) === a.deadline
  );
}
function validTurn(t: Turn): boolean {
  return (
    validWindow(t) &&
    validRequestProof(t) &&
    (t.kind !== "witness" || t.binding.votes.length !== 1 || validConsent(t.binding, t))
  );
}
function validConsent(b: Binding, second: Turn): boolean {
  const t = b.consent;
  return (
    !!t &&
    t.binding === b &&
    t.kind === "witness" &&
    t.actorId === b.actorId &&
    t.day === 1 &&
    b.setupCurrent?.() === true &&
    t.isCurrent() &&
    second.isCurrent() &&
    b.turn === second &&
    expectedTurn(b, second.kind, second.actorId, second.day) &&
    validBinding(b, true) &&
    validRequestProof(t) &&
    validRequestProof(second) &&
    [...b.participants].every(([id, p]) => json(p.state) === second.privateJson.get(id)) &&
    [...b.participants].every(([id, p]) => json(p.state) === t.privateJson.get(id)) &&
    targetCurrent(t, b.votes[0]!.targetId)
  );
}
export function authorizedWeddingTurn(
  world: World,
  actorId: number,
  phase: Phase,
  day: number,
  scope: object | undefined,
): boolean {
  const t = scope && turns.get(scope);
  return (
    !!t &&
    t.binding.world === world &&
    t.actorId === actorId &&
    phase === Phase.Night &&
    day === t.day &&
    validTurn(t)
  );
}
export function closeWeddingTurn(scope: object): void {
  const t = turns.get(scope);
  if (t && t.binding.turn === t) t.binding.turn = null;
  if (!t || t.binding.pendingChat !== t) settleRequestDelivery(scope, false);
}
export function closeWeddingSetup(world: World, status: "failed" | "cancelled"): void {
  const b = bindings.get(world);
  if (!b || b.status === "complete" || b.status === "failed" || b.status === "cancelled") return;
  if (b.turn) settleRequestDelivery(b.turn.scope, false);
  if (b.pendingChat) settleRequestDelivery(b.pendingChat.scope, false);
  b.status = status;
  b.turn = null;
  b.pendingChat = null;
  b.setupCurrent = null;
  if (writable(b.state, "remaining")) b.state.remaining = 0;
  // Keep only the actually committed pair; never consume or repair a substituted state.
}
const stages: Record<TurnKind, string> = {
  bridegroom: "ghost_bride_groom",
  chat: "ghost_bride_chat",
  witness: "ghost_bride_witness",
  knife: "ghost_bride_knife",
};
function requestData(request: WeddingRequest): string | null {
  try {
    const { deadlineAtMs: _deadline, ...rest } = snapshot(request, 0, 16384) as Record<
      string,
      unknown
    >;
    return JSON.stringify(rest);
  } catch {
    return null;
  }
}
export function bindGhostBrideRequest(world: World, request: WeddingRequest): void {
  const t = bindings.get(world)?.turn;
  if (!t) return;
  let p: WeddingRequest & { context: Record<string, unknown> };
  try {
    p = snapshot(request, 0, 16384) as WeddingRequest & { context: Record<string, unknown> };
  } catch {
    return;
  }
  const constraints = data(p.context, "turn_constraints") as Record<string, unknown> | undefined,
    encoded = requestData(request);
  if (
    t &&
    !t.request &&
    validWindow(t) &&
    p.actorId === t.actorId &&
    p.phase === Phase.Night &&
    p.context.day === t.day &&
    p.context.stage ===
      (t.kind === "knife" && t.binding.activeNight?.capture.owner === "ordinary_pack"
        ? "wolf_vote"
        : stages[t.kind]) &&
    p.allowedTools.length === 1 &&
    p.allowedTools[0] === t.tool &&
    data(p.context, "allow_fallback") === false &&
    data(p.context, "action_failure_policy") === "error" &&
    constraints?.min_valid_actions === 1 &&
    constraints.max_valid_actions === 1 &&
    json(constraints.required_any_tools) === json([t.tool]) &&
    encoded &&
    requestData(request) === encoded &&
    data(request, "deadlineAtMs") === p.deadlineAtMs &&
    (p.deadlineAtMs === undefined ||
      (Number.isFinite(p.deadlineAtMs) && p.deadlineAtMs > Date.now()))
  ) {
    t.request = request;
    t.requestJson = encoded;
    t.deadline = p.deadlineAtMs ?? null;
    requests.set(request, {
      turn: t,
      context: data(request, "context") as object,
      json: encoded,
      fields: Object.getOwnPropertyDescriptors(request),
      deadline: p.deadlineAtMs ?? null,
    });
    bindRequestDeliveryGuard(
      request,
      () => ghostBrideRequestScope(world, request) !== undefined,
      t.scope,
    );
    registerRequestAliasPropagation(request, 50, inheritGhostBrideDeadlineRequest);
  }
}
export function ghostBrideRequestScope(world: World, request: WeddingRequest): object | undefined {
  const a = requests.get(request);
  return a &&
    a.turn.binding.world === world &&
    data(request, "context") === a.context &&
    requestData(request) === a.json &&
    (data(request, "deadlineAtMs") ?? null) === a.deadline &&
    validTurn(a.turn)
    ? a.turn.scope
    : undefined;
}
export function inheritGhostBrideDeadlineRequest(
  source: WeddingRequest,
  target: WeddingRequest,
): void {
  const a = requests.get(source);
  if (requests.has(target)) return;
  if (!a || !ghostBrideRequestScope(a.turn.binding.world, source)) return;
  const fields = Object.getOwnPropertyDescriptors(target),
    keys = Object.keys(a.fields).filter((k) => k !== "deadlineAtMs"),
    others = Object.keys(fields).filter((k) => k !== "deadlineAtMs");
  const deadline = data(target, "deadlineAtMs"),
    effective = a.turn.deadline;
  if (
    (deadline !== undefined &&
      (typeof deadline !== "number" || !Number.isFinite(deadline) || deadline <= Date.now())) ||
    (effective !== null && (typeof deadline !== "number" || deadline > effective))
  )
    return;
  if (
    keys.length === others.length &&
    keys.every(
      (k) =>
        others.includes(k) &&
        fields[k] &&
        Object.hasOwn(fields[k], "value") &&
        fields[k]!.value === a.fields[k]!.value,
    ) &&
    requestData(target) === a.json
  ) {
    a.turn.deadline = typeof deadline === "number" ? deadline : null;
    requests.set(target, { ...a, deadline: typeof deadline === "number" ? deadline : null });
    bindRequestDeliveryGuard(
      target,
      () => ghostBrideRequestScope(a.turn.binding.world, target) !== undefined,
      a.turn.scope,
    );
    registerRequestAliasPropagation(target, 50, inheritGhostBrideDeadlineRequest);
  }
}
function targetCurrent(t: Turn, id: number): boolean {
  const p = t.binding.participants.get(id);
  return (
    !!p && sameBody(t.binding, p, true) && aliveLifeVersion(p.life) === t.targetVersions.get(id)
  );
}
export function commitWeddingTool(scope: object, value: unknown): boolean {
  const t = turns.get(scope);
  const accepted = commitWeddingToolInternal(scope, value);
  if (!accepted) settleRequestDelivery(scope, false);
  else if (t?.kind !== "chat") settleRequestDelivery(scope, true);
  return accepted;
}
function commitWeddingToolInternal(scope: object, value: unknown): boolean {
  const t = turns.get(scope),
    call = readWeddingTool(value);
  if (!t || !call || call.name !== t.tool || !validTurn(t)) return false;
  const b = t.binding;
  if (call.name === "choose_bridegroom") {
    const id = call.args.target_id;
    if (
      id === b.actorId ||
      !targetCurrent(t, id) ||
      !writable(b.state, "remaining") ||
      !writable(b.state, "groomId")
    )
      return false;
    const pair = Object.freeze({
      policy: GHOST_BRIDE_POLICY,
      groupId: `ghost-bride:1:${b.actorId}`,
      brideId: b.actorId,
      groomId: id,
      day: 1 as const,
    });
    b.state.remaining = 0;
    b.state.groomId = id;
    b.pair = pair;
    third(b, b.actorId);
    third(b, id);
    b.status = "paired";
    b.participants.get(b.actorId)!.expectedPrivateJson = json(
      b.participants.get(b.actorId)!.state,
    )!;
  } else if (call.name === "speak_to_partner") {
    const partner = t.actorId === b.actorId ? b.pair!.groomId : b.actorId;
    if (!targetCurrent(t, partner)) return false;
    t.chat = Object.freeze({
      actorId: t.actorId,
      recipientId: partner,
      day: t.day,
      text: call.args.text,
    });
    b.pendingChat = t;
  } else if (call.name === "choose_wedding_witness") {
    const id = call.args.target_id;
    if (id === b.actorId || id === b.pair!.groomId || !targetCurrent(t, id)) return false;
    if (b.votes.length === 1 && !validConsent(b, t)) return false;
    b.votes.push(Object.freeze({ actorId: t.actorId, targetId: id }));
    if (b.votes.length === 1) b.consent = t;
    if (b.votes.length === 2) {
      if (b.votes[0]!.targetId !== id) {
        // Both valid but disagreeing votes really committed; replay must retain this action.
        settleRequestDelivery(scope, true);
        closeWeddingSetup(b.world, "failed");
        return false;
      }
      const group = Object.freeze({ ...b.pair!, witnessId: id });
      third(b, id);
      b.group = group;
      b.assignments = new Map(
        [...b.participants].map(([pid, p]) => [
          pid,
          [group.brideId, group.groomId, group.witnessId].includes(pid) ? Camp.ThirdParty : p.camp,
        ]),
      );
      b.status = "complete";
      b.setupCurrent = null;
    }
  } else {
    const n = b.activeNight!,
      id = call.args.target_id;
    if (
      id !== null &&
      (!targetCurrent(t, id) ||
        (n.capture.owner === "pair" && [b.actorId, b.pair!.groomId].includes(id)) ||
        (n.capture.owner === "witness" && id === t.actorId))
    )
      return false;
    n.votes.push(Object.freeze({ actorId: t.actorId, targetId: id, abstain: call.args.abstain }));
  }
  if (t.kind !== "chat") settleRequestDelivery(scope, true);
  closeWeddingTurn(scope);
  return true;
}
function validKnifeOwner(n: Night): boolean {
  const b = n.binding;
  return (
    b.activeNight === n &&
    !n.closed &&
    n.isCurrent() &&
    b.status === "complete" &&
    validBinding(b) &&
    n.capture.actorIds.every((id) => {
      const p = b.participants.get(id)!;
      return sameBody(b, p, true) && aliveLifeVersion(p.life) === n.actorVersions.get(id);
    })
  );
}
export function captureWeddingKnife(
  world: World,
  day: number,
  isCurrent: () => boolean,
): Readonly<WeddingKnifeCapture> {
  const b = bindings.get(world);
  if (
    !b ||
    b.status !== "complete" ||
    !b.group ||
    b.activeNight ||
    b.nights.has(day) ||
    !Number.isSafeInteger(day) ||
    day < 1 ||
    !isCurrent() ||
    !validBinding(b)
  )
    throw new Error("ghost_bride_night_unavailable");
  const groupIds = [b.actorId, b.group.groomId, b.group.witnessId],
    singles = [...b.participants.values()]
      .filter((p) => p.kind === Role.Wolf && !groupIds.includes(p.id) && sameBody(b, p, true))
      .map((p) => p.id),
    pairIds = [b.actorId, b.group.groomId],
    pairAlive = pairIds.every((id) => sameBody(b, b.participants.get(id)!, true)),
    pairDead = pairIds.every((id) => !b.participants.get(id)!.life.alive),
    witnessAlive = sameBody(b, b.participants.get(b.group.witnessId)!, true);
  const owner = singles.length
      ? "ordinary_pack"
      : pairAlive
        ? "pair"
        : pairDead && witnessAlive
          ? "witness"
          : "none",
    actorIds = singles.length
      ? singles
      : owner === "pair"
        ? pairIds
        : owner === "witness"
          ? [b.group.witnessId]
          : [];
  const capture = Object.freeze({
    policy: GHOST_BRIDE_POLICY,
    groupId: b.group.groupId,
    day,
    owner,
    actorIds: Object.freeze(actorIds) as unknown as number[],
  });
  const n: Night = {
    binding: b,
    day,
    capture,
    isCurrent,
    actorVersions: new Map(
      actorIds.map((id) => [id, aliveLifeVersion(b.participants.get(id)!.life)!]),
    ),
    targetVersions: new Map([...b.participants].map(([id, p]) => [id, aliveLifeVersion(p.life)!])),
    votes: [],
    chats: 0,
    requiredChats: day > 1 && pairAlive ? 2 : 0,
    closed: false,
    knifeCommitted: false,
    targetId: null,
  };
  b.nights.set(day, n);
  b.activeNight = n;
  return capture;
}
export function resolveWeddingKnife(world: World, day: number): number | null {
  const n = bindings.get(world)?.activeNight;
  if (!n || n.day !== day || n.knifeCommitted) throw new Error("ghost_bride_knife_unavailable");
  n.knifeCommitted = true;
  if (!validKnifeOwner(n)) {
    n.targetId = null;
    return null;
  }
  if (n.votes.length !== n.capture.actorIds.length || n.chats !== n.requiredChats)
    throw new Error("ghost_bride_required_knife_missing");
  const counts = new Map<number, number>();
  for (const v of n.votes)
    if (!v.abstain && v.targetId !== null)
      counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + 1);
  const target = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  const p = target === null ? undefined : n.binding.participants.get(target);
  n.targetId =
    p && sameBody(n.binding, p, true) && aliveLifeVersion(p.life) === n.targetVersions.get(p.id)
      ? p.id
      : null;
  return n.targetId;
}
export function weddingKnifeCurrent(world: World, day: number, targetId: number): boolean {
  const n = bindings.get(world)?.activeNight,
    p = n?.binding.participants.get(targetId);
  return (
    !!n &&
    n.day === day &&
    n.knifeCommitted &&
    n.targetId === targetId &&
    validKnifeOwner(n) &&
    !!p &&
    sameBody(n.binding, p, true) &&
    aliveLifeVersion(p.life) === n.targetVersions.get(targetId)
  );
}
export function closeWeddingNight(world: World): void {
  const b = bindings.get(world);
  if (!b?.activeNight) return;
  if (b.turn) settleRequestDelivery(b.turn.scope, false);
  if (b.pendingChat) settleRequestDelivery(b.pendingChat.scope, false);
  b.activeNight.closed = true;
  b.activeNight = null;
  b.turn = null;
  b.pendingChat = null;
}
export function weddingMember(world: World, role: RoleComponent): boolean {
  const b = bindings.get(world);
  if (!b?.pair) return false;
  if (!validBinding(b)) throw new Error("ghost_bride_authority_invalid");
  return [b.actorId, b.pair.groomId, b.group?.witnessId].some(
    (id) => id !== undefined && b.participants.get(id)?.role === role,
  );
}
export function weddingAssignment(world: World): ReadonlyArray<readonly [number, Camp]> | null {
  const b = bindings.get(world);
  if (!b) return null;
  if (b.status !== "complete" || !b.assignments || !validBinding(b))
    throw new Error("ghost_bride_victory_unavailable");
  return Object.freeze([...b.assignments].map(([id, camp]) => Object.freeze([id, camp] as const)));
}
export function weddingFactionResult(
  world: World,
): { faction: Camp | null; winningPlayerIds: number[] } | null {
  const b = bindings.get(world),
    assignment = weddingAssignment(world);
  if (!b || !assignment) return null;
  const alive = new Set(
    assignment.filter(([id]) => sameBody(b, b.participants.get(id)!, true)).map(([, camp]) => camp),
  );
  if (alive.size > 1) return null;
  const faction = [...alive][0] ?? null;
  return {
    faction,
    winningPlayerIds: faction
      ? assignment.filter(([, camp]) => camp === faction).map(([id]) => id)
      : [],
  };
}
export function weddingAuditPlayer(world: World, id: number, failedCycle = false) {
  const b = bindings.get(world),
    p = b?.participants.get(id);
  if (!b || !p || (!failedCycle && b.status !== "failed" && b.status !== "cancelled")) return null;
  // Refresh each still-owned plain stock independently: another participant may have failed.
  // json reads descriptors only, so foreign getters/proxies keep the last safe snapshot.
  if (sameBody(b, p) && sameIdentity(b, p)) {
    const encoded = json(p.state);
    if (encoded !== null) p.auditPrivateJson = encoded;
  }
  const alive = p.aliveDescriptor.get
    ? p.aliveDescriptor.get.call(p.life) === true
    : p.aliveDescriptor.value === true;
  return {
    role: p.kind,
    camp: p.camp,
    alive,
    privateState:
      id === b.actorId
        ? {
            ghostBride: {
              ...freshGhostBrideState(),
              remaining: 0,
              groomId: b.pair?.groomId ?? null,
            },
          }
        : (JSON.parse(p.auditPrivateJson) as Record<string, unknown>),
    victory: JSON.parse(p.victoryJson) as VictoryComponent["affiliations"],
  };
}

const deathEdges = new WeakMap<World, Set<string>>();
/** Close independent roots before native gun eligibility. Derived Lovers never seed a reverse edge. */
export function expandWeddingDeaths(
  world: World,
  ids: number[],
  sources: DeathSources,
  eligibleDead: ReadonlySet<number>,
  nightOrigin?: Set<number>,
): Array<{ actorId: number; targetId: number }> {
  const b = bindings.get(world);
  if (!b) return [];
  if (b.status !== "complete" || !b.group || !validBinding(b))
    throw new Error("ghost_bride_relation_unavailable");
  const pairIds = [b.actorId, b.group.groomId],
    members = new Set(ids),
    roots = new Set(ids.filter((id) => (sources[id] ?? []).some((c) => c !== DeathCause.Lovers))),
    edges: Array<{ actorId: number; targetId: number }> = [],
    emitted = deathEdges.get(world) ?? new Set<string>();
  for (const root of pairIds) {
    if (!roots.has(root)) continue;
    const target = pairIds.find((id) => id !== root)!,
      p = b.participants.get(target)!;
    if (!sameBody(b, p, true) && !members.has(target) && !eligibleDead.has(target)) continue;
    if (!members.has(target)) {
      members.add(target);
      ids.push(target);
    }
    if (!(sources[target] ?? []).includes(DeathCause.Lovers))
      sources[target] = [...(sources[target] ?? []), DeathCause.Lovers];
    if (nightOrigin?.has(root)) nightOrigin.add(target);
    const key = `${root}:${target}`;
    if (!emitted.has(key)) {
      emitted.add(key);
      edges.push({ actorId: root, targetId: target });
    }
  }
  deathEdges.set(world, emitted);
  return edges;
}

export function weddingNightCapture(
  world: World,
  day: number,
): Readonly<WeddingKnifeCapture> | null {
  return bindings.get(world)?.nights.get(day)?.capture ?? null;
}

/** Consume a committed message once, after rechecking both original lives and the original request. */
export function takeWeddingChat(
  scope: object,
): { actorId: number; recipientId: number; day: number; text: string } | null {
  const t = turns.get(scope),
    message = t?.chat;
  if (!t || !message || t.delivered) return null;
  const b = t.binding,
    setup = b.status !== "complete";
  if (
    b.pendingChat !== t ||
    !t.isCurrent() ||
    (setup && b.setupCurrent?.() !== true) ||
    !validBinding(b, setup) ||
    !validRequestProof(t) ||
    !targetCurrent(t, message.actorId) ||
    !targetCurrent(t, message.recipientId) ||
    (!setup && (!b.activeNight || b.activeNight.day !== t.day || b.activeNight.closed)) ||
    [...b.participants].some(([id, p]) => json(p.state) !== t.privateJson.get(id))
  ) {
    if (b.pendingChat === t) settleRequestDelivery(scope, false);
    return null;
  }
  t.delivered = true;
  b.pendingChat = null;
  if (setup) b.chats++;
  else b.activeNight!.chats++;
  settleRequestDelivery(scope, true);
  return { ...message };
}
export type WeddingActorView =
  | {
      policy: typeof GHOST_BRIDE_POLICY;
      member: "bride" | "groom";
      faction: Camp.ThirdParty;
      partnerId: number;
      witnessId: number | null;
      proposedWitnessId?: number;
      canKnife: boolean;
    }
  | {
      policy: typeof GHOST_BRIDE_POLICY;
      member: "witness";
      faction: Camp.ThirdParty;
      brideId: number;
      groomId: number;
      canKnife: boolean;
    };
/** Minimal identity-independent projection; Witness never receives chats, votes or native stocks. */
export function weddingActorView(world: World, actorId: number): WeddingActorView | null {
  const b = bindings.get(world);
  if (!b?.pair || b.status === "failed" || b.status === "cancelled") return null;
  if (!validBinding(b)) throw new Error("ghost_bride_authority_invalid");
  const n = b.activeNight,
    canKnife = !!n && n.capture.actorIds.includes(actorId) && validKnifeOwner(n);
  if (actorId === b.actorId || actorId === b.pair.groomId)
    return {
      policy: GHOST_BRIDE_POLICY,
      member: actorId === b.actorId ? "bride" : "groom",
      faction: Camp.ThirdParty,
      partnerId: actorId === b.actorId ? b.pair.groomId : b.actorId,
      witnessId: b.group?.witnessId ?? null,
      ...(actorId === b.pair.groomId && b.votes.length === 1
        ? { proposedWitnessId: b.votes[0]!.targetId }
        : {}),
      canKnife,
    };
  return actorId === b.group?.witnessId
    ? {
        policy: GHOST_BRIDE_POLICY,
        member: "witness",
        faction: Camp.ThirdParty,
        brideId: b.actorId,
        groomId: b.pair.groomId,
        canKnife,
      }
    : null;
}

/** Pure preflight over the same original body/request target proof used at commit. */
export function canSubmitWeddingTool(
  world: World,
  actorId: number,
  phase: Phase,
  day: number,
  scope: object | undefined,
  value: unknown,
): boolean {
  const t = scope && turns.get(scope),
    call = readWeddingTool(value);
  if (
    !t ||
    !call ||
    call.name !== t.tool ||
    !authorizedWeddingTurn(world, actorId, phase, day, scope)
  )
    return false;
  if (call.name === "speak_to_partner")
    return targetCurrent(
      t,
      t.actorId === t.binding.actorId ? t.binding.pair!.groomId : t.binding.actorId,
    );
  const id = call.args.target_id;
  if (id === null) return call.name === "kill_vote" || call.name === "wedding_kill_vote";
  if (!targetCurrent(t, id)) return false;
  if (call.name === "choose_bridegroom") return id !== t.binding.actorId;
  if (call.name === "choose_wedding_witness")
    return id !== t.binding.actorId && id !== t.binding.pair!.groomId;
  const owner = t.binding.activeNight!.capture.owner;
  return owner === "pair"
    ? ![t.binding.actorId, t.binding.pair!.groomId].includes(id)
    : owner !== "witness" || id !== actorId;
}
export function weddingBrideState(world: World, actorId: number): GhostBrideState | null {
  const b = bindings.get(world);
  if (!b || actorId !== b.actorId) return null;
  if (!validBinding(b)) throw new Error("ghost_bride_authority_invalid");
  return readGhostBrideState(b.state);
}

const swallowedBadges = new WeakSet<World>();
export function weddingBadgeSwallowed(world: World): boolean {
  return swallowedBadges.has(world);
}
export function swallowWeddingBadges(
  world: World,
  events: import("../../../../core/domain").GameEvent[],
): void {
  const b = bindings.get(world);
  if (!b || !ghostBrideReady(world)) throw new Error("ghost_bride_badge_authority_invalid");
  swallowedBadges.add(world);
  for (const id of world.entityIds()) {
    const badge = world.getComponent(id, COMPONENT.Badge);
    const vote = world.getComponent(id, COMPONENT.VotingRight);
    if (badge) {
      if (badge.isSheriff && !badge.destroyed)
        events.push({
          timestamp: Date.now(),
          type: "sheriff_badge_destroyed",
          payload: { targetId: id, reason: "ghost_bride_single_wolf_blast" },
        });
      badge.isSheriff = false;
      badge.destroyed = true;
      badge.voteWeight = 1;
      delete badge.handoffPolicy;
    }
    if (vote) vote.weight = vote.canVote ? 1 : 0;
  }
}
