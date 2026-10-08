import { FACTION_IDS, VICTORY_CHECKPOINTS, type GameOutcome, type VictoryClaim, type VictoryPoint, type VictoryAffiliation } from "@ai-werewolf-arena/game-catalog";
import { ReplayDocumentValidationError } from "./validation";

const fail = (): never => { throw new ReplayDocumentValidationError("invalid_field", "result.outcome"); };
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail();
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key))) return fail();
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor)) return fail();
    result[key] = descriptor.value;
  }
  return result;
}
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return fail();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor)) return fail();
  return descriptor.value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return fail();
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  const length = descriptors.length?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > 512 || Reflect.ownKeys(descriptors).length !== length + 1) return fail();
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor)) return fail();
    result.push(descriptor.value);
  }
  return result;
}
function ids(value: unknown): number[] {
  const result = array(value);
  if (result.some((id, index) => typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || index > 0 && (result[index - 1] as number) >= id)) return fail();
  return result as number[];
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_.:-]{0,127}$/.test(value)) return fail();
  return value;
}
function claim(value: unknown): VictoryClaim {
  const kind = own(value, "kind");
  if (kind === "faction") {
    const data = record(value, ["kind", "faction", "winningPlayerIds"]);
    if (!(FACTION_IDS as readonly unknown[]).includes(data.faction)) return fail();
    return { kind, faction: data.faction as "good" | "wolf" | "third_party", winningPlayerIds: ids(data.winningPlayerIds) };
  }
  if (kind === "individual") {
    const data = record(value, ["kind", "playerId", "goalId", "winningPlayerIds"]), winners = ids(data.winningPlayerIds);
    if (winners.length !== 1 || winners[0] !== data.playerId) return fail();
    return { kind, playerId: winners[0], goalId: identifier(data.goalId), winningPlayerIds: winners };
  }
  if (kind === "relationship") {
    const data = record(value, ["kind", "groupId", "winningPlayerIds"]), winners = ids(data.winningPlayerIds);
    if (winners.length === 0) return fail();
    return { kind, groupId: identifier(data.groupId), winningPlayerIds: winners };
  }
  return fail();
}

/** Strict detached facts; inherited fields/accessors are never interpreted. */
export function readGameOutcome(value: unknown, playerIds?: readonly number[]): GameOutcome {
  try {
    const kind = own(value, "kind");
    if (kind === "no_winner") { record(value, ["kind"]); return { kind }; }
    if (kind !== "victory") return fail();
    const data = record(value, ["kind", "primary", "additional", "winningPlayerIds"]);
    const primary = claim(data.primary), additional = array(data.additional).map(claim), winningPlayerIds = ids(data.winningPlayerIds);
    const claims = [primary, ...additional];
    const keys = claims.map(item => item.kind === "faction" ? `faction:${item.faction}` : item.kind === "individual" ? `individual:${item.playerId}:${item.goalId}` : `relationship:${item.groupId}`);
    if (new Set(keys).size !== keys.length) return fail();
    const expected = [...new Set(claims.flatMap(item => item.winningPlayerIds))].sort((a, b) => a - b);
    if (expected.length !== winningPlayerIds.length || expected.some((id, index) => id !== winningPlayerIds[index])) return fail();
    if (playerIds && winningPlayerIds.some(id => !playerIds.includes(id))) return fail();
    return { kind, primary, additional, winningPlayerIds };
  } catch { return fail(); }
}

export function readVictoryPoint(value: unknown): VictoryPoint {
  try {
    const point = record(value, ["day", "phase", "checkpoint"]);
    if (typeof point.day !== "number" || !Number.isSafeInteger(point.day) || point.day < 1 || !["night", "day", "voting"].includes(point.phase as string) || !(VICTORY_CHECKPOINTS as readonly unknown[]).includes(point.checkpoint)) return fail();
    if (point.checkpoint === "night_settled" && point.phase !== "day" || point.checkpoint === "exile_settled" && point.phase !== "voting" || point.checkpoint === "max_days_reached" && point.phase !== "night" || point.checkpoint === "day_interrupted" && point.phase === "night") return fail();
    return point as unknown as VictoryPoint;
  } catch { return fail(); }
}

/** Empty means explicitly no win membership; it never falls back to true camp. */
export function readVictoryAffiliations(value: unknown): VictoryAffiliation[] {
  try {
    const result = array(value).map((entry): VictoryAffiliation => {
      const kind = own(entry, "kind");
      if (kind === "faction") {
        const item = record(entry, ["kind", "faction"]);
        if (!(FACTION_IDS as readonly unknown[]).includes(item.faction)) return fail();
        return { kind, faction: item.faction as "good" | "wolf" | "third_party" };
      }
      if (kind === "individual") return { kind, goalId: identifier(record(entry, ["kind", "goalId"]).goalId) };
      if (kind === "relationship") return { kind, groupId: identifier(record(entry, ["kind", "groupId"]).groupId) };
      return fail();
    });
    const keys = result.map(item => item.kind === "faction" ? `faction:${item.faction}` : item.kind === "individual" ? `individual:${item.goalId}` : `relationship:${item.groupId}`);
    if (new Set(keys).size !== keys.length) return fail();
    return result;
  } catch { throw new ReplayDocumentValidationError("invalid_field", "victory.affiliations"); }
}
