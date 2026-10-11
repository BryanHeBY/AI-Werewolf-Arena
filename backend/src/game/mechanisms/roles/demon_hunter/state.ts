import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { types } from "node:util";
import type { RoleComponent } from "../../../../core";
import {
  DEMON_HUNTER_POLICY,
  readDemonHunterState as readState,
  readDemonHuntTool as readTool,
} from "@ai-werewolf-arena/game-text";
export { DEMON_HUNTER_POLICY };
export const DEMON_HUNTER_ROLE = "demon_hunter" as const;
export interface DemonHunterChoice {
  day: number;
  targetId: number | null;
}
export interface DemonHunterState {
  policy: typeof DEMON_HUNTER_POLICY;
  history: DemonHunterChoice[];
}
export function ownDemonData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
export function demonSnapshot(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
  arrayLimit = 256,
): unknown {
  return snapshotPlainData(value, seen, depth, arrayLimit, "demon_hunter_data_invalid");
}
export function demonJson(value: unknown): string | null {
  try {
    return JSON.stringify(demonSnapshot(value));
  } catch {
    return null;
  }
}
export function exactDemonData(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function freshDemonHunterState(): DemonHunterState {
  return { policy: DEMON_HUNTER_POLICY, history: [] };
}
export function readDemonHunterState(value: unknown): DemonHunterState | null {
  try {
    return readState(demonSnapshot(value));
  } catch {
    return null;
  }
}
export function getDemonHunterState(role: RoleComponent | undefined): DemonHunterState | undefined {
  const s = ownDemonData(ownDemonData(role, "privateState"), "demonHunter");
  return readDemonHunterState(s) ? (s as DemonHunterState) : undefined;
}
export interface DemonHuntTool {
  name: "demon_hunt";
  args: { target_id: number | null; abstain: boolean };
}
export function readDemonHuntTool(value: unknown): DemonHuntTool | null {
  try {
    return readTool(demonSnapshot(value));
  } catch {
    return null;
  }
}
