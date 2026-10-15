/**
 * 黯月借用各原能力 kind 的独立安装数据 reader。输入为未知 source payload、kind 与日期；
 * 输出保留原库存、政策及 fresh history 的复制形状和 own-field／Proxy 拒绝集合。
 * 此 reader 不修改 live 能力、转移授权或退回来源库存；只有庇护 reader 的导入归属改变。
 */

import type {
  SeerState,
  WitchState,
  DreamerState,
  ShelterState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { WitchSelfHealRule } from "../../domain/identity";
import { readShelterState } from "./shelter-state";

interface BorrowedStates {
  seer_check: SeerState;
  potion: WitchState;
  dream: DreamerState;
  shelter: ShelterState;
}
export type BorrowedKind = keyof BorrowedStates;
function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value))
    throw new Error("eclipse_borrow_state_invalid");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("eclipse_borrow_state_invalid");
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!("value" in descriptor)) throw new Error("eclipse_borrow_state_invalid");
  return descriptor.value;
}
function stock(value: unknown): number {
  if (value !== 0 && value !== 1) throw new Error("eclipse_borrow_stock_invalid");
  return value;
}
function optionalPolicy(value: unknown, expected: string): void {
  if (value !== undefined && value !== expected) throw new Error("eclipse_borrow_policy_invalid");
}
export function snapshotBorrowedState<K extends BorrowedKind>(
  kind: K,
  raw: unknown,
  day: number,
): BorrowedStates[K];
export function snapshotBorrowedState(
  kind: BorrowedKind,
  raw: unknown,
  day: number,
): BorrowedStates[BorrowedKind] {
  if (!Number.isSafeInteger(day) || day < 2) throw new Error("eclipse_borrow_day_invalid");
  switch (kind) {
    case "seer_check":
      optionalPolicy(field(raw, "targetPolicy"), "awa_alive_v1");
      optionalPolicy(field(raw, "actionPolicy"), "awa_required_when_legal_v1");
      return {
        targetPolicy: "awa_alive_v1",
        actionPolicy: "awa_required_when_legal_v1",
        lastTarget: null,
        lastIsWerewolf: null,
        lastResult: null,
        history: [],
      };
    case "potion":
      if (field(raw, "selfHealRule") !== WitchSelfHealRule.Disabled)
        throw new Error("eclipse_borrow_policy_invalid");
      optionalPolicy(field(raw, "knifeVisibility"), "awa_with_heal_v1");
      optionalPolicy(field(raw, "potionPolicy"), "awa_one_native_v1");
      return {
        heal: stock(field(raw, "heal")),
        poison: stock(field(raw, "poison")),
        selfHealRule: WitchSelfHealRule.Disabled,
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      };
    case "dream": {
      if (field(raw, "protectionPolicy") !== "netease_2026_night_immunity_v1")
        throw new Error("eclipse_borrow_policy_invalid");
      const lastTarget = field(raw, "lastTarget"),
        lastDay = field(raw, "lastDay");
      if (!(
        (lastTarget === null && lastDay === null) ||
        (typeof lastTarget === "number" &&
          Number.isSafeInteger(lastTarget) &&
          lastTarget > 0 &&
          typeof lastDay === "number" &&
          Number.isSafeInteger(lastDay) &&
          lastDay >= 1 &&
          lastDay < day)
      ))
        throw new Error("eclipse_borrow_dream_state_invalid");
      return {
        lastTarget: lastTarget as number | null,
        lastDay: lastDay as number | null,
        protectionPolicy: "netease_2026_night_immunity_v1",
        history: [],
      };
    }
    case "shelter": {
      const source = readShelterState(raw);
      if (!source || (source.lastDay !== null && source.lastDay >= day))
        throw new Error("eclipse_borrow_shelter_state_invalid");
      return source;
    }
  }
}
