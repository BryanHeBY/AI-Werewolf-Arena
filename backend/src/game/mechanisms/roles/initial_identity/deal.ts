/**
 * 负责拥有盗贼／千面人发到的卡、原手牌与首夜设置状态；阵营只晚读真实 Camp，保原组件引用撤权。
 * 输入为已安装阵容和明确选牌；输出为库存、设置状态和玩家 setup 数据副本。
 * 原 World 对应的 deal owner 持有手牌及参与者快照；关闭后保留选牌身份，后续角色替换
 * 不重新发库存，副本不授予 live 选择权限。
 */
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { COMPONENT, type RoleComponent, type Camp, Role, type World } from "../../../../core/domain";
export interface InitialIdentityCard {
  cardId: string;
  role: Role;
}
export type InitialIdentitySlot = 0 | 1;
export type InitialIdentitySetupStatus = "pending" | "complete" | "cancelled" | "failed";
export interface InitialIdentityDeal {
  readonly initialRoles: readonly Role[];
  readonly candidateCounts: ReadonlyMap<Role, number>;
  readonly hands: Map<number, InitialIdentityCard>;
  readonly reserve: [InitialIdentityCard, InitialIdentityCard];
  status: InitialIdentitySetupStatus;
  selection: { actorId: number; slot: InitialIdentitySlot | null; role: Role } | null;
}
export type InitialIdentityKind = "thief" | "shapeshifter";
export const INITIAL_IDENTITY_POLICIES = Object.freeze({
  thief: "lui_meme_thief_two_extra_villagers_v1",
  shapeshifter: "awa_netease_shapeshifter_two_extra_villagers_v1",
} as const);
interface DealOwner {
  kind: InitialIdentityKind;
  deal: InitialIdentityDeal;
  cards: readonly InitialIdentityCard[];
  initialCards: readonly InitialIdentityCard[];
  playerIds: readonly number[];
  hands: Map<number, InitialIdentityCard>;
  reserve: [InitialIdentityCard, InitialIdentityCard];
  status: InitialIdentitySetupStatus;
  selection: InitialIdentityDeal["selection"];
  selectionSnapshot: InitialIdentityDeal["selection"];
  players: InitialPlayer[];
}
interface InitialPlayer {
  id: number;
  role: RoleComponent;
  roleId: Role;
  camp: Camp | undefined;
  state: RoleComponent["privateState"];
  life: NightLifeScope;
  campComponent: unknown;
  victory: unknown;
  victoryJson: string;
}
const owned = new WeakMap<World, DealOwner>();
const opened = new WeakSet<World>(),
  active = new WeakSet<World>();
function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && Object.hasOwn(d, "value") ? d.value : undefined;
}
export function readInitialIdentityCard(value: unknown): InitialIdentityCard | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.every((k) => k === "cardId" || k === "role")) return null;
  const cardId = field(value, "cardId"),
    role = field(value, "role");
  return typeof cardId === "string" &&
    /^deal:[0-9]+$/.test(cardId) &&
    Object.values(Role).includes(role as Role)
    ? { cardId, role: role as Role }
    : null;
}
function readSlot(
  reserve: [InitialIdentityCard, InitialIdentityCard],
  slot: InitialIdentitySlot,
): unknown {
  const d = Object.getOwnPropertyDescriptor(reserve, String(slot));
  return d && Object.hasOwn(d, "value") ? d.value : undefined;
}
export function installInitialIdentityDeal(
  world: World,
  roles: readonly Role[],
  playerIds: readonly number[],
  kind: InitialIdentityKind = "thief",
): void {
  if (kind !== "thief" && kind !== "shapeshifter") throw new Error("initial_identity_kind_invalid");
  if (owned.has(world) || roles.length !== playerIds.length + 2)
    throw new Error(`${kind}_initial_deal_invalid`);
  const cards = roles.map((role, i) => ({ cardId: `deal:${i}`, role }));
  const initialCards = Object.freeze(cards.map((card) => Object.freeze({ ...card }))),
    initialRoles = Object.freeze([...roles]);
  const candidateCounts = new Map<Role, number>();
  for (const role of roles) candidateCounts.set(role, (candidateCounts.get(role) ?? 0) + 1);
  const hands = new Map(playerIds.map((id, i) => [id, cards[i]!])),
    reserve: [InitialIdentityCard, InitialIdentityCard] = [
      cards[playerIds.length]!,
      cards[playerIds.length + 1]!,
    ];
  const deal: InitialIdentityDeal = {
    initialRoles,
    candidateCounts,
    hands,
    reserve,
    status: "pending",
    selection: null,
  };
  const players = playerIds.map((id) => {
    const role = world.getComponent(id, COMPONENT.Role)!,
      life = captureNightLife(world, id)!;
    return {
      id,
      role,
      roleId: role.role,
      camp: world.getComponent(id, COMPONENT.Camp)?.camp,
      state: role.privateState,
      life,
      campComponent: world.getComponent(id, COMPONENT.Camp),
      victory: world.getComponent(id, COMPONENT.Victory),
      victoryJson: JSON.stringify(copyEventData(world.getComponent(id, COMPONENT.Victory))),
    };
  });
  owned.set(world, {
    kind,
    deal,
    cards: Object.freeze([...cards]),
    initialCards,
    playerIds: Object.freeze([...playerIds]),
    hands,
    reserve,
    status: "pending",
    selection: null,
    selectionSnapshot: null,
    players,
  });
}
export function initialIdentityKind(world: World): InitialIdentityKind | undefined {
  return owned.get(world)?.kind;
}
function unavailable(world: World, suffix: string): Error {
  return new Error(`${initialIdentityKind(world) ?? "thief"}_${suffix}`);
}
export function initialIdentityStock(world: World): InitialIdentityDeal | undefined {
  return owned.get(world)?.deal;
}
export function initialIdentityDeal(world: World): readonly Role[] | undefined {
  return owned.get(world)?.initialCards.map((card) => card.role);
}
export function initialIdentityCandidateCounts(
  world: World,
): ReadonlyMap<Role, number> | undefined {
  const owner = owned.get(world);
  if (!owner) return;
  const counts = new Map<Role, number>();
  for (const card of owner.initialCards) counts.set(card.role, (counts.get(card.role) ?? 0) + 1);
  return counts;
}
export function initialIdentitySetupStatus(world: World): InitialIdentitySetupStatus | undefined {
  return owned.get(world)?.status;
}
export function hasActiveInitialIdentitySetup(world: World): boolean {
  return active.has(world);
}
export function initialIdentitySetupReady(world: World): boolean {
  return !owned.has(world) || owned.get(world)!.status === "complete";
}
export function pendingInitialIdentityDealValid(world: World): boolean {
  const o = owned.get(world);
  if (
    !o ||
    o.status !== "pending" ||
    field(o.deal, "hands") !== o.hands ||
    field(o.deal, "reserve") !== o.reserve
  )
    return false;
  if (
    world.entityIds().length !== o.playerIds.length ||
    !o.players.every(
      (p) =>
        livingNightLife(world, p.life) &&
        world.getComponent(p.id, COMPONENT.Role) === p.role &&
        field(p.role, "role") === p.roleId &&
        field(p.campComponent, "camp") === p.camp &&
        field(p.role, "privateState") === p.state &&
        world.getComponent(p.id, COMPONENT.Camp) === p.campComponent &&
        field(p.campComponent, "camp") === p.camp &&
        world.getComponent(p.id, COMPONENT.Victory) === p.victory,
    )
  )
    return false;
  try {
    if (o.players.some((p) => JSON.stringify(copyEventData(p.victory)) !== p.victoryJson))
      return false;
  } catch {
    return false;
  }
  const size = Object.getOwnPropertyDescriptor(Map.prototype, "size")!.get!.call(o.hands);
  if (size !== o.playerIds.length || o.reserve.length !== 2) return false;
  for (let i = 0; i < o.cards.length; i++) {
    const card = o.cards[i]!,
      data = readInitialIdentityCard(card),
      original = o.initialCards[i]!;
    if (!data || data.cardId !== original.cardId || data.role !== original.role) return false;
    const current =
      i < o.playerIds.length
        ? Map.prototype.get.call(o.hands, o.playerIds[i]!)
        : readSlot(o.reserve, (i - o.playerIds.length) as InitialIdentitySlot);
    if (current !== card) return false;
  }
  return true;
}
export function openInitialIdentitySetup(world: World): InitialIdentityDeal {
  const o = owned.get(world);
  if (!o || o.status !== "pending" || opened.has(world) || active.has(world))
    throw unavailable(world, "setup_unavailable");
  opened.add(world);
  active.add(world);
  return o.deal;
}
export function closeInitialIdentitySetup(
  world: World,
  status: Exclude<InitialIdentitySetupStatus, "pending">,
): void {
  active.delete(world);
  const o = owned.get(world);
  if (!o) return;
  o.status = status;
  const d = Object.getOwnPropertyDescriptor(o.deal, "status");
  if (d && Object.hasOwn(d, "value") && d.writable)
    try {
      Object.defineProperty(o.deal, "status", { ...d, value: status });
    } catch {
      /* Authority closes even with corrupted storage. */
    }
}
export function selectInitialIdentityCard(
  world: World,
  actorId: number,
  slot: InitialIdentitySlot | null,
): Role {
  const o = owned.get(world);
  if (!o || !hasActiveInitialIdentitySetup(world) || !pendingInitialIdentityDealValid(world))
    throw unavailable(world, "selection_unavailable");
  const original = Map.prototype.get.call(o.hands, actorId) as InitialIdentityCard;
  if (
    o.kind === "shapeshifter" &&
    (slot === null ||
      (slot !== 0 && slot !== 1) ||
      readInitialIdentityCard(original)?.role !== Role.Shapeshifter ||
      (o.reserve.some((card) => readInitialIdentityCard(card)?.role === Role.Wolf) &&
        readInitialIdentityCard(readSlot(o.reserve, slot))?.role !== Role.Wolf))
  )
    throw unavailable(world, "selection_invalid");
  const chosen = slot === null ? original : (readSlot(o.reserve, slot) as InitialIdentityCard);
  if (slot !== null) {
    Map.prototype.set.call(o.hands, actorId, chosen);
    o.reserve[slot] = original;
  }
  const selection = { actorId, slot, role: chosen.role };
  o.selection = selection;
  o.selectionSnapshot = Object.freeze({ ...selection });
  o.deal.selection = selection;
  return chosen.role;
}
export function projectInitialIdentitySetup(world: World) {
  const o = owned.get(world);
  if (!o) return;
  if (
    field(o.deal, "hands") !== o.hands ||
    field(o.deal, "reserve") !== o.reserve ||
    o.reserve.length !== 2
  )
    return;
  const hands = o.playerIds.map((actorId) => ({
      actorId,
      card: Map.prototype.get.call(o.hands, actorId) as unknown,
    })),
    reserves = [readSlot(o.reserve, 0), readSlot(o.reserve, 1)];
  const raw = [...hands.map((row) => row.card), ...reserves];
  if (
    raw.length !== o.cards.length ||
    new Set(raw).size !== o.cards.length ||
    raw.some((card) => !o.cards.includes(card as InitialIdentityCard))
  )
    return;
  const data = raw.map(readInitialIdentityCard);
  if (data.some((card) => !card)) return;
  for (const card of data)
    if (!o.initialCards.some((c) => c.cardId === card!.cardId && c.role === card!.role)) return;
  const selection = field(o.deal, "selection");
  if (selection !== o.selection) return;
  if (
    selection &&
    (!o.selectionSnapshot ||
      Reflect.ownKeys(selection as object).length !== 3 ||
      ["actorId", "slot", "role"].some(
        (key) => field(selection, key) !== field(o.selectionSnapshot, key),
      ))
  )
    return;
  const selected = o.selectionSnapshot;
  const selectedIndex = selected ? o.playerIds.indexOf(selected.actorId) : -1;
  for (let i = 0; i < o.playerIds.length; i++) {
    const expected =
      selectedIndex === i && selected?.slot !== null && selected?.slot !== undefined
        ? o.cards[o.playerIds.length + selected.slot]
        : o.cards[i];
    if (raw[i] !== expected) return;
  }
  for (const slot of [0, 1] as const) {
    const expected =
      selected?.slot === slot ? o.cards[selectedIndex] : o.cards[o.playerIds.length + slot];
    if (reserves[slot] !== expected) return;
  }
  return {
    policy: INITIAL_IDENTITY_POLICIES[o.kind],
    status: o.status,
    hands: hands.map((row, i) => ({ actorId: row.actorId, ...data[i]! })),
    reserve: data.slice(hands.length) as [InitialIdentityCard, InitialIdentityCard],
    selection: o.selectionSnapshot ? { ...o.selectionSnapshot } : null,
  };
}

const activeNights = new WeakSet<World>(),
  committedNights = new WeakMap<World, Set<number>>();
export function hasActiveInitialIdentityNight(world: World): boolean {
  return activeNights.has(world);
}
export function hasInitialIdentityNightCommit(world: World, day: number): boolean {
  return committedNights.get(world)?.has(day) === true;
}
export function openInitialIdentityNight(world: World, day: number): () => void {
  if (!owned.has(world)) return () => {};
  if (
    !initialIdentitySetupReady(world) ||
    hasActiveInitialIdentitySetup(world) ||
    activeNights.has(world) ||
    committedNights.get(world)?.has(day)
  )
    throw unavailable(world, "night_reentry_or_unready");
  let days = committedNights.get(world);
  if (!days) {
    days = new Set();
    committedNights.set(world, days);
  }
  days.add(day);
  activeNights.add(world);
  return () => {
    activeNights.delete(world);
  };
}
