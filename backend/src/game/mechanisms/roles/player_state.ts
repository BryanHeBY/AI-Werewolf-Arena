import { WitchSelfHealRule, type GuardRepeatPolicy } from "../../../core/domain/model";
import { readInspectionResult } from "@ai-werewolf-arena/replay-contract";
import type { InspectionResult } from "@ai-werewolf-arena/game-catalog";

/** Player DTOs deliberately do not inherit engine-state fields, including report rows. */
export interface PlayerGuardState {
  lastTarget: number | null;
  repeatPolicy?: GuardRepeatPolicy;
}
export interface PlayerHunterState {
  canShoot: boolean;
}
export interface PlayerWolfKingState {
  canShoot: boolean;
}
export interface PlayerWhiteWolfKingState {
  canDetonate: boolean;
}
export interface PlayerKnightState {
  canDuel: boolean;
}
export interface PlayerIdiotState {
  revealed: boolean;
}
export interface PlayerDreamerState {
  lastTarget: number | null;
  lastDay: number | null;
  history: Array<{ day: number; targetId: number }>;
}
export interface PlayerWolfBeautyState {
  targetId: number | null;
  lastActedDay: number | null;
  history: Array<{ day: number; targetId: number | null }>;
}
export interface PlayerBearState {
  history: Array<{ day: number; roared: boolean }>;
}
export interface PlayerSeerState {
  targetPolicy?: import("../../../core/domain/board").SeerTargetPolicy;
  actionPolicy?: import("../../../core/domain/board").SeerActionPolicy;
  lastTarget: number | null;
  lastIsWerewolf: boolean | null;
  lastResult?: InspectionResult | null;
  history: Array<{ targetId: number; isWerewolf: boolean; result?: InspectionResult }>;
}
export interface PlayerWitchState {
  heal: number;
  poison: number;
  selfHealRule: WitchSelfHealRule;
  canSelfHeal: boolean;
  healUsedThisNight: boolean;
  poisonUsedThisNight: boolean;
}
export interface PlayerRoleInspectionState {
  policy?: "gargoyle" | "psychic" | "mirror";
  lastTarget: number | null;
  lastDay: number | null;
  history: Array<{
    day: number;
    targetId: number;
    result: Extract<InspectionResult, { kind: "role" }>;
  }>;
}

/** Read declared own data fields without executing accessors from foreign state. */
export function playerDataField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && Object.hasOwn(field, "value") ? field.value : undefined;
}
function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function positiveOrNull(value: unknown): number | null {
  return positiveInteger(value) ? value : null;
}
function stock(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function rows(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (field && Object.hasOwn(field, "value")) result.push(field.value);
  }
  return result;
}
function nullableTarget(value: unknown): value is number | null {
  return value === null || positiveInteger(value);
}
function inspection(value: unknown) {
  const kind = playerDataField(value, "kind");
  return readInspectionResult(
    kind === "camp"
      ? { kind, camp: playerDataField(value, "camp") }
      : kind === "role"
        ? { kind, role: playerDataField(value, "role") }
        : kind === "combined"
          ? { kind, camp: playerDataField(value, "camp"), role: playerDataField(value, "role") }
          : null,
  );
}

export function projectGuardState(state: unknown): PlayerGuardState {
  const policy = playerDataField(state, "repeatPolicy");
  return {
    lastTarget: positiveOrNull(playerDataField(state, "lastTarget")),
    ...(policy === "awa_last_action_v1" || policy === "netease_consecutive_nights_v1"
      ? { repeatPolicy: policy }
      : {}),
  };
}
export function projectHunterState(state: unknown): PlayerHunterState {
  return { canShoot: playerDataField(state, "canShoot") === true };
}
export function projectWolfKingState(state: unknown): PlayerWolfKingState {
  return { canShoot: playerDataField(state, "canShoot") === true };
}
export function projectWhiteWolfKingState(state: unknown): PlayerWhiteWolfKingState {
  return { canDetonate: playerDataField(state, "canDetonate") === true };
}
export function projectKnightState(state: unknown): PlayerKnightState {
  return { canDuel: playerDataField(state, "canDuel") === true };
}
export function projectIdiotState(state: unknown): PlayerIdiotState {
  return { revealed: playerDataField(state, "revealed") === true };
}
export function projectDreamerState(state: unknown): PlayerDreamerState {
  return {
    lastTarget: positiveOrNull(playerDataField(state, "lastTarget")),
    lastDay: positiveOrNull(playerDataField(state, "lastDay")),
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        targetId = playerDataField(row, "targetId");
      return positiveInteger(day) && positiveInteger(targetId) ? [{ day, targetId }] : [];
    }),
  };
}
export function projectWolfBeautyState(state: unknown): PlayerWolfBeautyState {
  return {
    targetId: positiveOrNull(playerDataField(state, "targetId")),
    lastActedDay: positiveOrNull(playerDataField(state, "lastActedDay")),
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        targetId = playerDataField(row, "targetId");
      return positiveInteger(day) && nullableTarget(targetId) ? [{ day, targetId }] : [];
    }),
  };
}
export function projectBearState(state: unknown): PlayerBearState {
  return {
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        roared = playerDataField(row, "roared");
      return positiveInteger(day) && typeof roared === "boolean" ? [{ day, roared }] : [];
    }),
  };
}
export function projectSeerState(state: unknown): PlayerSeerState {
  const targetPolicy = playerDataField(state, "targetPolicy"),
    actionPolicy = playerDataField(state, "actionPolicy");
  const lastIsWerewolf = playerDataField(state, "lastIsWerewolf"),
    lastResult = playerDataField(state, "lastResult");
  return {
    ...(targetPolicy === "awa_alive_v1" || targetPolicy === "awa_fresh_others_v1"
      ? { targetPolicy }
      : {}),
    ...(actionPolicy === "awa_optional_v1" || actionPolicy === "awa_required_when_legal_v1"
      ? { actionPolicy }
      : {}),
    lastTarget: positiveOrNull(playerDataField(state, "lastTarget")),
    lastIsWerewolf: typeof lastIsWerewolf === "boolean" ? lastIsWerewolf : null,
    ...(lastResult === undefined
      ? {}
      : { lastResult: lastResult === null ? null : inspection(lastResult) }),
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const targetId = playerDataField(row, "targetId"),
        isWerewolf = playerDataField(row, "isWerewolf"),
        result = inspection(playerDataField(row, "result"));
      return positiveInteger(targetId) && typeof isWerewolf === "boolean"
        ? [{ targetId, isWerewolf, ...(result ? { result } : {}) }]
        : [];
    }),
  };
}
export function projectWitchState(state: unknown): PlayerWitchState {
  const rule = playerDataField(state, "selfHealRule");
  return {
    heal: stock(playerDataField(state, "heal")),
    poison: stock(playerDataField(state, "poison")),
    selfHealRule:
      rule === WitchSelfHealRule.Always || rule === WitchSelfHealRule.FirstNightOnly
        ? rule
        : WitchSelfHealRule.Disabled,
    canSelfHeal: playerDataField(state, "canSelfHeal") === true,
    healUsedThisNight: playerDataField(state, "healUsedThisNight") === true,
    poisonUsedThisNight: playerDataField(state, "poisonUsedThisNight") === true,
  };
}
export function projectRoleInspectionState(state: unknown): PlayerRoleInspectionState {
  const policy = playerDataField(state, "policy");
  return {
    ...(policy === "gargoyle" || policy === "psychic" || policy === "mirror" ? { policy } : {}),
    lastTarget: positiveOrNull(playerDataField(state, "lastTarget")),
    lastDay: positiveOrNull(playerDataField(state, "lastDay")),
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        targetId = playerDataField(row, "targetId"),
        result = inspection(playerDataField(row, "result"));
      return positiveInteger(day) && positiveInteger(targetId) && result?.kind === "role"
        ? [{ day, targetId, result }]
        : [];
    }),
  };
}
