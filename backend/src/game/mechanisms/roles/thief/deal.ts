import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import { copyEventData } from "@ai-werewolf-arena/game-text";
import { COMPONENT, type RoleComponent, Role, type World } from "../../../../core/domain";
export interface ThiefCard {
  cardId: string;
  role: Role;
}
export type ThiefSlot = 0 | 1;
export type ThiefSetupStatus = "pending" | "complete" | "cancelled" | "failed";
export interface ThiefDeal {
  readonly initialRoles: readonly Role[];
  readonly candidateCounts: ReadonlyMap<Role, number>;
  readonly hands: Map<number, ThiefCard>;
  readonly reserve: [ThiefCard, ThiefCard];
  status: ThiefSetupStatus;
  selection: { actorId: number; slot: ThiefSlot | null; role: Role } | null;
}
interface DealOwner {
  deal: ThiefDeal;
  cards: readonly ThiefCard[];
  initialCards: readonly ThiefCard[];
  playerIds: readonly number[];
  hands: Map<number, ThiefCard>;
  reserve: [ThiefCard, ThiefCard];
  status: ThiefSetupStatus;
  selection: ThiefDeal["selection"];
  selectionSnapshot: ThiefDeal["selection"];
  players: InitialPlayer[];
}
interface InitialPlayer {
  id: number;
  role: RoleComponent;
  roleId: Role;
  camp: RoleComponent["camp"];
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
export function readThiefCard(value: unknown): ThiefCard | null {
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
function readSlot(reserve: [ThiefCard, ThiefCard], slot: ThiefSlot): unknown {
  const d = Object.getOwnPropertyDescriptor(reserve, String(slot));
  return d && Object.hasOwn(d, "value") ? d.value : undefined;
}
export function installThiefDeal(
  world: World,
  roles: readonly Role[],
  playerIds: readonly number[],
): void {
  if (owned.has(world) || roles.length !== playerIds.length + 2)
    throw new Error("thief_initial_deal_invalid");
  const cards = roles.map((role, i) => ({ cardId: `deal:${i}`, role }));
  const initialCards = Object.freeze(cards.map((card) => Object.freeze({ ...card }))),
    initialRoles = Object.freeze([...roles]);
  const candidateCounts = new Map<Role, number>();
  for (const role of roles) candidateCounts.set(role, (candidateCounts.get(role) ?? 0) + 1);
  const hands = new Map(playerIds.map((id, i) => [id, cards[i]!])),
    reserve: [ThiefCard, ThiefCard] = [cards[playerIds.length]!, cards[playerIds.length + 1]!];
  const deal: ThiefDeal = {
    initialRoles,
    candidateCounts,
    hands,
    reserve,
    status: "pending",
    selection: null,
  };
  const players = playerIds.map((id) => {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role)!,
      life = captureNightLife(world, id)!;
    return {
      id,
      role,
      roleId: role.role,
      camp: role.camp,
      state: role.privateState,
      life,
      campComponent: world.getComponent(id, COMPONENT.Camp),
      victory: world.getComponent(id, COMPONENT.Victory),
      victoryJson: JSON.stringify(copyEventData(world.getComponent(id, COMPONENT.Victory))),
    };
  });
  owned.set(world, {
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
export function thiefDeal(world: World): ThiefDeal | undefined {
  return owned.get(world)?.deal;
}
export function initialThiefDeal(world: World): readonly Role[] | undefined {
  return owned.get(world)?.initialCards.map((card) => card.role);
}
export function thiefCandidateCounts(world: World): ReadonlyMap<Role, number> | undefined {
  const owner = owned.get(world);
  if (!owner) return;
  const counts = new Map<Role, number>();
  for (const card of owner.initialCards) counts.set(card.role, (counts.get(card.role) ?? 0) + 1);
  return counts;
}
export function thiefSetupStatus(world: World): ThiefSetupStatus | undefined {
  return owned.get(world)?.status;
}
export function hasActiveThiefSetup(world: World): boolean {
  return active.has(world);
}
export function thiefSetupReady(world: World): boolean {
  return !owned.has(world) || owned.get(world)!.status === "complete";
}
export function pendingThiefDealValid(world: World): boolean {
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
        field(p.role, "camp") === p.camp &&
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
      data = readThiefCard(card),
      original = o.initialCards[i]!;
    if (!data || data.cardId !== original.cardId || data.role !== original.role) return false;
    const current =
      i < o.playerIds.length
        ? Map.prototype.get.call(o.hands, o.playerIds[i]!)
        : readSlot(o.reserve, (i - o.playerIds.length) as ThiefSlot);
    if (current !== card) return false;
  }
  return true;
}
export function openThiefSetup(world: World): ThiefDeal {
  const o = owned.get(world);
  if (!o || o.status !== "pending" || opened.has(world) || active.has(world))
    throw new Error("thief_setup_unavailable");
  opened.add(world);
  active.add(world);
  return o.deal;
}
export function closeThiefSetup(world: World, status: Exclude<ThiefSetupStatus, "pending">): void {
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
export function selectThiefCard(world: World, actorId: number, slot: ThiefSlot | null): Role {
  const o = owned.get(world);
  if (!o || !hasActiveThiefSetup(world) || !pendingThiefDealValid(world))
    throw new Error("thief_selection_unavailable");
  const original = Map.prototype.get.call(o.hands, actorId) as ThiefCard;
  const chosen = slot === null ? original : (readSlot(o.reserve, slot) as ThiefCard);
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
export function projectThiefSetup(world: World) {
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
    raw.some((card) => !o.cards.includes(card as ThiefCard))
  )
    return;
  const data = raw.map(readThiefCard);
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
    policy: "lui_meme_thief_two_extra_villagers_v1" as const,
    status: o.status,
    hands: hands.map((row, i) => ({ actorId: row.actorId, ...data[i]! })),
    reserve: data.slice(hands.length) as [ThiefCard, ThiefCard],
    selection: o.selectionSnapshot ? { ...o.selectionSnapshot } : null,
  };
}

const activeNights = new WeakSet<World>(),
  committedNights = new WeakMap<World, Set<number>>();
export function hasActiveThiefNight(world: World): boolean {
  return activeNights.has(world);
}
export function hasThiefNightCommit(world: World, day: number): boolean {
  return committedNights.get(world)?.has(day) === true;
}
export function openThiefNight(world: World, day: number): () => void {
  if (!owned.has(world)) return () => {};
  if (
    !thiefSetupReady(world) ||
    hasActiveThiefSetup(world) ||
    activeNights.has(world) ||
    committedNights.get(world)?.has(day)
  )
    throw new Error("thief_night_reentry_or_unready");
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
