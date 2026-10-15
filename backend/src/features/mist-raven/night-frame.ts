/**
 * 负责炼金魔女／狼鸦之爪的阵容原体、雾目标选择与待交付夜间伤害。输入为原玩家和已接受施法选择；
 * 输出保留原生命目标、蛇窗及关闭／中止操作，付款仍由施法 authority 负责。
 * 实际 Camp 只在原 own-data 点读取，组件引用、原字段或生命版本改变按原规则撤权，不保 Role 阵营镜像。
 * 只有匹配的原夜间对象可交付捕获伤害；复活不恢复旧许可，失败保留已付前缀，不补交付。
 */
import { types } from "node:util";
import { COMPONENT } from "../../domain/components/names";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../domain/components/alive";
import type { RoleComponent } from "../../domain/components/role";
import { Camp } from "../../domain/identity";
import type { World } from "../../domain/world";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../domain/night-effects";
import { MistCasterAuthority } from "./caster-authority";
import {
  createAlchemistState,
  createRavenState,
  type AlchemistState,
  type RavenState,
} from "./state";

const missing = Symbol("missing_mist_native_field"),
  invalid = Symbol("invalid_mist_native_field");
function data(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return invalid;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return !field ? missing : "value" in field ? field.value : invalid;
}
function plain(value: unknown): value is object {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function snakeTargetData(value: unknown): number[] | undefined {
  if (types.isProxy(value) || !Array.isArray(value)) return;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
      value as object,
    ),
    length = fields.length?.value;
  if ((length !== 0 && length !== 1) || Reflect.ownKeys(fields).length !== length + 1) return;
  if (length === 0) return [];
  const first = fields["0"];
  return first &&
    "value" in first &&
    Number.isSafeInteger(first.value) &&
    first.value > 0 &&
    first.value < Number.MAX_SAFE_INTEGER
    ? [first.value]
    : undefined;
}
function factoryLife(life: AliveComponent): boolean {
  const original = aliveLifeDescriptor(life);
  if (!original) return false;
  const actual = Object.getOwnPropertyDescriptor(life, "alive");
  return (
    !!actual &&
    actual.get === original.get &&
    actual.set === original.set &&
    actual.enumerable === original.enumerable &&
    actual.configurable === original.configurable
  );
}
function bindNativeAbilities(privateState: object): () => boolean {
  const privatePrototype = Object.getPrototypeOf(privateState);
  const container = data(privateState, "abilities");
  if (container === missing || container === undefined)
    return () =>
      Object.getPrototypeOf(privateState) === privatePrototype &&
      data(privateState, "abilities") === container;
  if (!plain(container)) throw new Error("mist_native_abilities_invalid");
  const names = Reflect.ownKeys(container);
  const containerPrototype = Object.getPrototypeOf(container);
  const guards = names.map((key) => {
    const ability = data(container, key);
    if (!plain(ability)) throw new Error("mist_native_abilities_invalid");
    const abilityPrototype = Object.getPrototypeOf(ability);
    const fields = [
      "id",
      "kind",
      "activation",
      "source",
      "state",
      "startsOnDay",
      "expiresAfterDay",
      "maxUses",
      "disabled",
      "deathExpired",
      "sourceDisclosed",
    ];
    const values = fields.map((k) => data(ability, k));
    const source = data(ability, "source"),
      state = data(ability, "state");
    if (!plain(source) || !plain(state) || data(source, "kind") !== "native")
      throw new Error("mist_native_abilities_invalid");
    const sourcePrototype = Object.getPrototypeOf(source),
      statePrototype = Object.getPrototypeOf(state);
    const sourceFields = ["kind", "role", "actorId", "abilityId"],
      sourceValues = sourceFields.map((k) => data(source, k));
    const policyFields = ["targetPolicy", "actionPolicy", "protectionPolicy"],
      policyValues = policyFields.map((k) => data(state, k));
    if (
      values.includes(invalid) ||
      sourceValues.includes(invalid) ||
      policyValues.includes(invalid)
    )
      throw new Error("mist_native_abilities_invalid");
    return () =>
      data(container, key) === ability &&
      Object.getPrototypeOf(ability) === abilityPrototype &&
      Object.getPrototypeOf(source) === sourcePrototype &&
      Object.getPrototypeOf(state) === statePrototype &&
      fields.every((k, i) => data(ability, k) === values[i]) &&
      sourceFields.every((k, i) => data(source, k) === sourceValues[i]) &&
      policyFields.every((k, i) => data(state, k) === policyValues[i]);
  });
  return () =>
    Object.getPrototypeOf(privateState) === privatePrototype &&
    data(privateState, "abilities") === container &&
    Object.getPrototypeOf(container) === containerPrototype &&
    Reflect.ownKeys(container).length === names.length &&
    guards.every((guard) => guard());
}
/** 阵容快照固定组件／字段原值和首生命版本；允许原体首次死亡的复验不授予复活后的新行动。 */
interface OriginalPlayer {
  id: number;
  role: RoleComponent;
  roleName: unknown;
  camp: unknown;
  campComponent: unknown;
  privateState: object;
  identity: unknown;
  identityFields: unknown[];
  life: AliveComponent;
  version: number;
  abilitiesCurrent: () => boolean;
}
/** 选择和狼刀绑定当夜原生命；handedOff、蛇窗与验证重入位各自独立，不复制施法库存。 */
interface MistNight {
  day: number;
  closed: boolean;
  handedOff: boolean;
  delayEligible: boolean;
  lives: ReadonlyMap<number, NightLifeScope>;
  mistDecided: boolean;
  mistTargets: readonly NightLifeScope[] | null;
  extraDecided: boolean;
  extra: NightLifeScope | null;
  wolfTarget: number | null;
  snakeRequested: boolean;
  snakeDecided: boolean;
  snakeValidating: boolean;
  snakeWindow: {
    actorId: number;
    targets: readonly NightLifeScope[];
    isCurrent: () => boolean;
  } | null;
}
interface Board {
  originals: ReadonlyMap<number, OriginalPlayer>;
  alchemistId: number;
  ravenId: number;
  latestCasters: Map<number, MistCasterAuthority>;
  started: Set<number>;
  night: MistNight | null;
}
const boards = new WeakMap<World, Board>();
function originalCurrent(world: World, player: OriginalPlayer): boolean {
  return (
    world.getComponent(player.id, COMPONENT.Role) === player.role &&
    data(player.role, "role") === player.roleName &&
    data(player.campComponent, "camp") === player.camp &&
    data(player.role, "privateState") === player.privateState &&
    world.getComponent(player.id, COMPONENT.Camp) === player.campComponent &&
    data(player.campComponent, "camp") === player.camp &&
    world.getComponent(player.id, COMPONENT.Identity) === player.identity &&
    ["id", "seat", "name", "sessionId"].every(
      (k, i) => data(player.identity, k) === player.identityFields[i],
    ) &&
    world.getComponent(player.id, COMPONENT.Alive) === player.life &&
    factoryLife(player.life) &&
    aliveLifeVersion(player.life) === player.version + (player.life.alive ? 0 : 1) &&
    player.abilitiesCurrent()
  );
}
function board(world: World): Board {
  const b = boards.get(world);
  if (
    !b ||
    world.entityIds().length !== b.originals.size ||
    ![...b.originals.values()].every((p) => originalCurrent(world, p)) ||
    ![...b.latestCasters.values()].every((caster) => caster.isCurrent(true))
  )
    throw new Error("mist_original_roster_revoked");
  return b;
}
function night(world: World, day: number): { b: Board; n: MistNight } {
  const b = board(world),
    n = b.night;
  if (!n || n.day !== day || n.closed) throw new Error("mist_night_unavailable");
  return { b, n };
}
export function isMistRavenBoard(world: World): boolean {
  return boards.has(world);
}
export function assertMistRosterCurrent(world: World): void {
  board(world);
}
export function installMistRavenBoard(world: World): void {
  if (boards.has(world)) throw new Error("mist_board_already_installed");
  const originals = new Map<number, OriginalPlayer>();
  for (const id of world.entityIds()) {
    const role = world.getComponent(id, COMPONENT.Role),
      privateState = data(role, "privateState"),
      identity = world.getComponent(id, COMPONENT.Identity),
      campComponent = world.getComponent(id, COMPONENT.Camp),
      life = world.getComponent(id, COMPONENT.Alive);
    const camp = data(campComponent, "camp"),
      roleName = data(role, "role");
    if (
      !role ||
      !plain(privateState) ||
      !life ||
      !factoryLife(life) ||
      !life.alive ||
      aliveLifeVersion(life) === undefined ||
      data(campComponent, "camp") !== camp ||
      data(identity, "id") !== id ||
      typeof data(identity, "name") !== "string" ||
      typeof data(identity, "sessionId") !== "string" ||
      !Number.isSafeInteger(data(identity, "seat"))
    )
      throw new Error("mist_original_roster_invalid");
    originals.set(id, {
      id,
      role,
      roleName,
      camp,
      campComponent,
      privateState,
      identity,
      identityFields: ["id", "seat", "name", "sessionId"].map((k) => data(identity, k)),
      life,
      version: aliveLifeVersion(life)!,
      abilitiesCurrent: bindNativeAbilities(privateState),
    });
  }
  const expected: Record<string, { count: number; camp: Camp }> = {
    wolf: { count: 3, camp: Camp.Wolf },
    raven_claw_wolf: { count: 1, camp: Camp.Wolf },
    villager: { count: 4, camp: Camp.Good },
    alchemist: { count: 1, camp: Camp.Good },
    seer: { count: 1, camp: Camp.Good },
    dreamer: { count: 1, camp: Camp.Good },
    idiot: { count: 1, camp: Camp.Good },
  };
  if (
    originals.size !== 12 ||
    [...originals.values()].some(
      (p) =>
        typeof p.roleName !== "string" ||
        !Object.hasOwn(expected, p.roleName) ||
        expected[p.roleName]!.camp !== p.camp,
    ) ||
    Object.entries(expected).some(
      ([name, spec]) =>
        [...originals.values()].filter((p) => p.roleName === name).length !== spec.count,
    )
  )
    throw new Error("mist_original_roster_invalid");
  const id = (name: string) => [...originals.values()].find((p) => p.roleName === name)!.id;
  const initialCasters = new Map<number, MistCasterAuthority>([
    [id("alchemist"), new MistCasterAuthority(world, id("alchemist"), 1, "alchemist")],
    [
      id("raven_claw_wolf"),
      new MistCasterAuthority(world, id("raven_claw_wolf"), 1, "raven_claw_wolf"),
    ],
  ]);
  if (
    JSON.stringify(initialCasters.get(id("alchemist"))!.state()) !==
      JSON.stringify(createAlchemistState()) ||
    JSON.stringify(initialCasters.get(id("raven_claw_wolf"))!.state()) !==
      JSON.stringify(createRavenState())
  )
    throw new Error("mist_initial_caster_state_invalid");
  boards.set(world, {
    originals,
    alchemistId: id("alchemist"),
    ravenId: id("raven_claw_wolf"),
    latestCasters: initialCasters,
    started: new Set(),
    night: null,
  });
}
export function beginMistNight(
  world: World,
  day: number,
): { actorId: number; knownTeammateIds: number[] } | null {
  const b = board(world);
  if (
    !Number.isSafeInteger(day) ||
    day < 1 ||
    day >= Number.MAX_SAFE_INTEGER ||
    b.started.has(day) ||
    (b.night && !b.night.closed)
  )
    throw new Error("mist_night_reentry");
  // started先落；后续caster创建或状态读取失败仍保本夜已尝试，不用失败重开规避原一次性门控。
  b.started.add(day);
  const lives = new Map(
    world.getAliveEntityIds().map((id) => [id, Object.freeze(captureNightLife(world, id)!)]),
  );
  const alchemist = lives.has(b.alchemistId)
    ? new MistCasterAuthority(world, b.alchemistId, day, "alchemist")
    : null;
  if (alchemist) b.latestCasters.set(b.alchemistId, alchemist);
  let unsealed: { actorId: number; knownTeammateIds: number[] } | null = null;
  if (lives.has(b.ravenId)) {
    const raven = new MistCasterAuthority(world, b.ravenId, day, "raven_claw_wolf"),
      before = raven.state() as RavenState;
    b.latestCasters.set(b.ravenId, raven);
    const state = raven.checkRavenAtNightStart(
      [...lives.keys()].filter((id) => b.originals.get(id)!.camp === Camp.Wolf),
    );
    if (before.awakenedDay === null && state.awakenedDay !== null)
      unsealed = { actorId: b.ravenId, knownTeammateIds: [...state.knownTeammateIds] };
  }
  b.night = {
    day,
    closed: false,
    handedOff: false,
    delayEligible: !!alchemist && (alchemist.state() as AlchemistState).healRemaining === 1,
    lives,
    mistDecided: false,
    mistTargets: null,
    extraDecided: false,
    extra: null,
    wolfTarget: null,
    snakeRequested: false,
    snakeDecided: false,
    snakeValidating: false,
    snakeWindow: null,
  };
  return unsealed;
}
export function mistCasterId(world: World, kind: "alchemist" | "raven_claw_wolf"): number {
  const b = board(world);
  return kind === "alchemist" ? b.alchemistId : b.ravenId;
}
export function ravenKnownTeammates(world: World): number[] {
  const b = board(world),
    caster = b.latestCasters.get(b.ravenId);
  return caster ? [...(caster.state(true) as RavenState).knownTeammateIds] : [];
}
export function ravenAwakened(world: World): boolean {
  const b = board(world),
    caster = b.latestCasters.get(b.ravenId);
  return !!caster && (caster.state(true) as RavenState).awakenedDay !== null;
}
export function mistChoiceTargets(world: World, day: number): number[] {
  const { b, n } = night(world, day),
    caster = b.latestCasters.get(b.alchemistId);
  if (
    n.handedOff ||
    n.mistDecided ||
    !n.lives.has(b.alchemistId) ||
    !caster?.isCurrent() ||
    (caster.state() as AlchemistState).mistRemaining === 0
  )
    return [];
  return [...n.lives.values()]
    .filter((scope) => livingNightLife(world, scope))
    .map((scope) => scope.id);
}
export function commitMistChoice(world: World, day: number, targets: number[] | null): void {
  const { b, n } = night(world, day),
    legal = mistChoiceTargets(world, day);
  if (legal.length < 3) throw new Error("mist_choice_unavailable");
  const state = b.latestCasters.get(b.alchemistId)!.commitMist(targets, legal);
  const chosen = state.mistHistory.at(-1)!.targetIds;
  n.mistTargets = chosen === null ? null : Object.freeze(chosen.map((id) => n.lives.get(id)!));
  n.mistDecided = true;
}
export function mistKnifeTargets(world: World): number[] | null {
  const b = board(world),
    n = b.night;
  if (!n || n.closed || !n.mistTargets) return null;
  return n.mistTargets.filter((scope) => livingNightLife(world, scope)).map((scope) => scope.id);
}
export function originalMistTarget(world: World, day: number, id: number): NightLifeScope | null {
  const { n } = night(world, day),
    scope = n.lives.get(id);
  return scope && livingNightLife(world, scope) ? scope : null;
}
export function ravenKnifeTargets(world: World, day: number): number[] {
  const { b, n } = night(world, day),
    caster = b.latestCasters.get(b.ravenId);
  if (n.handedOff || n.extraDecided || !n.lives.has(b.ravenId) || !caster?.isCurrent()) return [];
  const state = caster.state() as RavenState;
  if (state.awakenedDay === null || state.extraRemaining === 0) return [];
  return [...n.lives.values()]
    .filter((scope) => scope.id !== b.ravenId && livingNightLife(world, scope))
    .map((scope) => scope.id);
}
export function commitRavenKnife(world: World, day: number, target: number | null): void {
  const { b, n } = night(world, day),
    legal = ravenKnifeTargets(world, day);
  if (!legal.length) throw new Error("raven_knife_unavailable");
  b.latestCasters.get(b.ravenId)!.commitRavenKnife(target, [b.ravenId, ...legal]);
  n.extra = target === null ? null : n.lives.get(target)!;
  n.extraDecided = true;
}
export function handOffMistNight(
  world: World,
  day: number,
  wolfTarget: number | null,
): { delayEligible: boolean; extra: NightLifeScope | null } {
  const { n } = night(world, day);
  if (n.handedOff) throw new Error("mist_night_reentry");
  if (mistChoiceTargets(world, day).length >= 3 || ravenKnifeTargets(world, day).length > 0)
    throw new Error("mist_night_choices_unsettled");
  if (wolfTarget !== null && !originalMistTarget(world, day, wolfTarget))
    throw new Error("mist_knife_target_stale");
  const circle = mistKnifeTargets(world);
  if (circle !== null && (wolfTarget === null ? circle.length > 0 : !circle.includes(wolfTarget)))
    throw new Error("mist_knife_outside_circle");
  // 全部选择及圈内刀口复验通过后才写目标→交付位；返回引用不自行完成清理交接。
  n.wolfTarget = wolfTarget;
  n.handedOff = true;
  return { delayEligible: n.delayEligible, extra: n.extra };
}
export function openSnakeWindow(
  world: World,
  day: number,
  targets: readonly number[],
  isCurrent: () => boolean,
): void {
  const { b, n } = night(world, day),
    caster = b.latestCasters.get(b.alchemistId);
  if (!n.handedOff || !n.delayEligible || n.snakeRequested || !caster?.isCurrent())
    throw new Error("snake_window_unavailable");
  // 先记录已请求，再验目标数组；目标无效会关夜，不能更换输入后再次请求。
  n.snakeRequested = true;
  const target = n.wolfTarget,
    expected =
      target !== null &&
      originalMistTarget(world, day, target) &&
      (target !== b.alchemistId || day === 1)
        ? [target]
        : [];
  const chosen = snakeTargetData(targets);
  if (!chosen || chosen.length !== expected.length || chosen.some((id, i) => id !== expected[i])) {
    n.closed = true;
    throw new Error("snake_window_target_invalid");
  }
  n.snakeWindow = {
    actorId: b.alchemistId,
    targets: Object.freeze(expected.map((id) => n.lives.get(id)!)),
    isCurrent,
  };
}
export function snakeWindowTargets(world: World, day: number, actorId: number): number[] {
  const { b, n } = night(world, day),
    window = n.snakeWindow;
  if (
    !window ||
    n.snakeValidating ||
    window.actorId !== actorId ||
    !b.latestCasters.get(actorId)?.isCurrent()
  )
    throw new Error("snake_window_revoked");
  // 外部current回调前置重入位，回调后再核board/night/window原引用；异常关夜并抛回同错误。
  n.snakeValidating = true;
  let current: boolean;
  try {
    current = window.isCurrent();
    if (
      board(world) !== b ||
      b.night !== n ||
      n.closed ||
      n.snakeWindow !== window ||
      !b.latestCasters.get(actorId)?.isCurrent()
    )
      current = false;
  } catch (error) {
    n.closed = true;
    n.snakeWindow = null;
    throw error;
  } finally {
    n.snakeValidating = false;
  }
  if (!current) {
    n.closed = true;
    n.snakeWindow = null;
    throw new Error("snake_window_revoked");
  }
  return window.targets.filter((scope) => livingNightLife(world, scope)).map((scope) => scope.id);
}
export function commitSnakeChoice(
  world: World,
  day: number,
  actorId: number,
  target: number | null,
): void {
  const { b, n } = night(world, day),
    legal = snakeWindowTargets(world, day, actorId);
  b.latestCasters.get(actorId)!.commitSnake(target, legal);
  n.snakeDecided = true;
  n.snakeWindow = null;
}
export function closeMistNight(world: World, day: number): void {
  const { n } = night(world, day);
  if (!n.handedOff || n.snakeWindow || (n.delayEligible && !n.snakeDecided))
    throw new Error("mist_night_unsettled");
  n.closed = true;
}
/** 清理只关旧夜／清蛇窗，不校验或修复私态，也不恢复资源或重开窗口。 */
export function abortMistNight(world: World): void {
  const n = boards.get(world)?.night;
  if (n) {
    n.closed = true;
    n.snakeWindow = null;
  }
}
