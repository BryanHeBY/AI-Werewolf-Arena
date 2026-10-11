import { types } from "node:util";

export const SCHOLAR_MENTOR_POLICY = "awa_scholar_mentor_twelve_v1" as const;
export type ModifierCaster = "day_scholar" | "night_mentor";
export type ModifierMode = "enhance" | "weaken";
export interface ModifierChoice {
  day: number;
  mode: ModifierMode | null;
  targetId: number | null;
}
export interface ModifierState {
  policy: typeof SCHOLAR_MENTOR_POLICY;
  caster: ModifierCaster;
  remaining: { enhance: number; weaken: number };
  history: ModifierChoice[];
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !types.isProxy(value) && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]): boolean {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return (
    Reflect.ownKeys(descriptors).length === allowed.length &&
    allowed.every((key) => descriptors[key] !== undefined && "value" in descriptors[key]!)
  );
}
function arrayItems(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || types.isProxy(value)) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(descriptors).length !== length + 1
  )
    return undefined;
  const out: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor)) return undefined;
    out.push(descriptor.value);
  }
  return out;
}
export function createModifierState(caster: ModifierCaster): ModifierState {
  if (caster !== "day_scholar" && caster !== "night_mentor")
    throw new Error("modifier_caster_invalid");
  return {
    policy: SCHOLAR_MENTOR_POLICY,
    caster,
    remaining: { enhance: 1, weaken: 1 },
    history: [],
  };
}
export function readModifierState(value: unknown): ModifierState | undefined {
  if (
    !object(value) ||
    !keys(value, ["policy", "caster", "remaining", "history"]) ||
    value.policy !== SCHOLAR_MENTOR_POLICY ||
    (value.caster !== "day_scholar" && value.caster !== "night_mentor") ||
    !object(value.remaining) ||
    !keys(value.remaining, ["enhance", "weaken"]) ||
    !Array.isArray(value.history)
  )
    return undefined;
  const items = arrayItems(value.history);
  if (!items) return undefined;
  let last = 1,
    enhance = 1,
    weaken = 1;
  const history: ModifierChoice[] = [];
  for (const item of items) {
    if (
      !object(item) ||
      !keys(item, ["day", "mode", "targetId"]) ||
      typeof item.day !== "number" ||
      !Number.isSafeInteger(item.day) ||
      item.day >= Number.MAX_SAFE_INTEGER ||
      item.day <= last ||
      (item.mode !== null && item.mode !== "enhance" && item.mode !== "weaken")
    )
      return undefined;
    if (
      item.mode === null
        ? item.targetId !== null
        : typeof item.targetId !== "number" ||
          !Number.isSafeInteger(item.targetId) ||
          item.targetId < 1
    )
      return undefined;
    if (item.mode === "enhance") enhance--;
    if (item.mode === "weaken") weaken--;
    if (enhance < 0 || weaken < 0) return undefined;
    last = item.day;
    history.push({ day: item.day, mode: item.mode, targetId: item.targetId as number | null });
  }
  if (value.remaining.enhance !== enhance || value.remaining.weaken !== weaken) return undefined;
  return {
    policy: SCHOLAR_MENTOR_POLICY,
    caster: value.caster,
    remaining: { enhance, weaken },
    history,
  };
}
/** Pure selection: no effect or collision is revealed to the caster. */
export function selectModifier(
  state: ModifierState,
  day: number,
  mode: ModifierMode | null,
  targetId: number | null,
  livingIds: readonly number[],
): ModifierState {
  const next = readModifierState(state);
  if (
    !next ||
    !Number.isSafeInteger(day) ||
    day >= Number.MAX_SAFE_INTEGER ||
    day < 2 ||
    day <= (next.history.at(-1)?.day ?? 1)
  )
    throw new Error("modifier_choice_day_invalid");
  if (mode !== null && mode !== "enhance" && mode !== "weaken")
    throw new Error("modifier_mode_invalid");
  if (
    mode === null
      ? targetId !== null
      : targetId === null ||
        !Number.isSafeInteger(targetId) ||
        targetId < 1 ||
        !livingIds.includes(targetId)
  )
    throw new Error("modifier_target_invalid");
  if (mode !== null) {
    if (next.remaining[mode] !== 1) throw new Error("modifier_charge_spent");
    next.remaining[mode] = 0;
  }
  next.history.push({ day, mode, targetId });
  return next;
}
export interface ModifierPlayer {
  id: number;
  role: string;
  camp: "good" | "wolf";
  alive: boolean;
}
export interface CommittedModifier {
  actorId: number;
  caster: ModifierCaster;
  mode: ModifierMode;
  targetId: number;
}
export interface ModifierResolution {
  pendingDeaths: number[];
  conflict: "same_good" | "both_wolves" | null;
  goodEffects: Array<{ targetId: number; role: "seer" | "guard" | "witch"; mode: ModifierMode }>;
  bonusKnifeActorId: number | null;
  blockWolfKnife: boolean;
}
/** Finite-board resolution. Immune caster targets are filtered before collision. */
export function resolveModifiers(
  players: readonly ModifierPlayer[],
  selections: readonly CommittedModifier[],
): ModifierResolution {
  const roster = new Map(players.map((player) => [player.id, player]));
  if (
    roster.size !== players.length ||
    players.some((p) => !Number.isSafeInteger(p.id) || p.id < 1)
  )
    throw new Error("modifier_roster_invalid");
  const deck: Record<string, { count: number; camp: "good" | "wolf" }> = {
    wolf: { count: 3, camp: "wolf" },
    night_mentor: { count: 1, camp: "wolf" },
    villager: { count: 4, camp: "good" },
    day_scholar: { count: 1, camp: "good" },
    seer: { count: 1, camp: "good" },
    guard: { count: 1, camp: "good" },
    witch: { count: 1, camp: "good" },
  };
  if (
    players.length !== 12 ||
    players.some((p) => !Object.hasOwn(deck, p.role) || deck[p.role]!.camp !== p.camp) ||
    Object.entries(deck).some(
      ([role, spec]) => players.filter((p) => p.role === role).length !== spec.count,
    )
  )
    throw new Error("modifier_roster_invalid");
  const actors = new Set<number>(),
    casters = new Set<ModifierCaster>();
  const effective: CommittedModifier[] = [];
  for (const selection of selections) {
    const actor = roster.get(selection.actorId),
      target = roster.get(selection.targetId);
    if (
      !actor?.alive ||
      !target?.alive ||
      actor.role !== selection.caster ||
      (selection.caster !== "day_scholar" && selection.caster !== "night_mentor") ||
      actor.camp !== (selection.caster === "day_scholar" ? "good" : "wolf") ||
      (selection.mode !== "enhance" && selection.mode !== "weaken") ||
      actors.has(actor.id) ||
      casters.has(selection.caster)
    )
      throw new Error("modifier_selection_invalid");
    actors.add(actor.id);
    casters.add(selection.caster);
    if (target.role !== "day_scholar" && target.role !== "night_mentor")
      effective.push({ ...selection });
  }
  const out: ModifierResolution = {
    pendingDeaths: [],
    conflict: null,
    goodEffects: [],
    bonusKnifeActorId: null,
    blockWolfKnife: false,
  };
  if (effective.length === 2) {
    const [a, b] = effective as [CommittedModifier, CommittedModifier];
    const first = roster.get(a.targetId)!,
      second = roster.get(b.targetId)!;
    if (first.camp === "good" && first.id === second.id) {
      out.pendingDeaths = [first.id];
      out.conflict = "same_good";
      return out;
    }
    if (first.camp === "wolf" && second.camp === "wolf") {
      out.pendingDeaths = [effective.find((s) => s.caster === "night_mentor")!.actorId];
      out.conflict = "both_wolves";
      return out;
    }
  }
  for (const selection of effective) {
    const target = roster.get(selection.targetId)!;
    if (target.camp === "wolf") {
      if (selection.mode === "weaken") out.blockWolfKnife = true;
      else out.bonusKnifeActorId = target.id;
    } else if (target.role === "seer" || target.role === "guard" || target.role === "witch") {
      out.goodEffects.push({ targetId: target.id, role: target.role, mode: selection.mode });
    }
  }
  return out;
}
