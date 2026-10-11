import { types } from "node:util";
import type { SecretBodyCause } from "./damage";
export const NOBLE_SECRET_BODY_POLICY = "awa_noble_secret_body_v1" as const;
export type NobleWolfPolicy = "standard" | "no_blast_no_self_knife";
export type BodyRepeatPolicy = "awa_nonconsecutive_nights_v1" | "awa_repeat_v1";
export interface NightChoice {
  day: number;
  targetId: number | null;
}
export type BodyResource =
  | { kind: "intact" }
  | { kind: "night_spent"; day: number; targetId: number; cause: SecretBodyCause }
  | { kind: "exile_revealed"; day: number };
export interface SecretBodyState {
  policy: typeof NOBLE_SECRET_BODY_POLICY;
  protectionRepeatPolicy: BodyRepeatPolicy;
  lastChoice: NightChoice | null;
  body: BodyResource;
}
export interface ServantContract {
  id: string;
  targetId: number;
  createdNight: number;
  expiresNight: number;
  status: { kind: "pending" } | { kind: "cleared" | "expired" | "target_dead"; day: number };
}
export interface NobleState {
  policy: typeof NOBLE_SECRET_BODY_POLICY;
  wolfActionPolicy: NobleWolfPolicy;
  lastChoice: NightChoice | null;
  contracts: ServantContract[];
}
function positive(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER - 1
  );
}
function data(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value)) return;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== keys.length) return;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const field = fields[key];
    if (!field || !("value" in field)) return;
    result[key] = field.value;
  }
  return result;
}
function dense(value: unknown): unknown[] | undefined {
  if (
    types.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    return;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
      value as object,
    ),
    length: unknown = fields.length?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(fields).length !== length + 1
  )
    return;
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const field = fields[String(i)];
    if (!field || !("value" in field)) return;
    result.push(field.value);
  }
  return result;
}
function livingSnapshot(value: unknown): number[] {
  const ids = dense(value);
  if (!ids || ids.some((id) => !positive(id)) || new Set(ids).size !== ids.length)
    throw Error("noble_secret_body_roster_invalid");
  return ids as number[];
}
function choice(value: unknown): NightChoice | null | undefined {
  if (value === null) return null;
  const row = data(value, ["day", "targetId"]);
  if (!row || !positive(row.day) || (row.targetId !== null && !positive(row.targetId))) return;
  return { day: row.day, targetId: row.targetId as number | null };
}
export function createSecretBodyState(
  policy: BodyRepeatPolicy = "awa_nonconsecutive_nights_v1",
): SecretBodyState {
  if (policy !== "awa_nonconsecutive_nights_v1" && policy !== "awa_repeat_v1")
    throw Error("secret_body_policy_invalid");
  return {
    policy: NOBLE_SECRET_BODY_POLICY,
    protectionRepeatPolicy: policy,
    lastChoice: null,
    body: { kind: "intact" },
  };
}
export function readSecretBodyState(value: unknown): SecretBodyState | undefined {
  const row = data(value, ["policy", "protectionRepeatPolicy", "lastChoice", "body"]);
  if (
    !row ||
    row.policy !== NOBLE_SECRET_BODY_POLICY ||
    !["awa_nonconsecutive_nights_v1", "awa_repeat_v1"].includes(
      row.protectionRepeatPolicy as string,
    )
  )
    return;
  const last = choice(row.lastChoice);
  if (last === undefined) return;
  let body: BodyResource | undefined;
  const intact = data(row.body, ["kind"]);
  if (intact?.kind === "intact") body = { kind: "intact" };
  const night = data(row.body, ["kind", "day", "targetId", "cause"]);
  if (
    night?.kind === "night_spent" &&
    positive(night.day) &&
    positive(night.targetId) &&
    ["wolf_kill", "poison", "demon_hunt", "demon_hunt_backlash", "servant_expiry"].includes(
      night.cause as string,
    ) &&
    last?.day === night.day
  )
    body = {
      kind: "night_spent",
      day: night.day,
      targetId: night.targetId,
      cause: night.cause as SecretBodyCause,
    };
  const exile = data(row.body, ["kind", "day"]);
  if (exile?.kind === "exile_revealed" && positive(exile.day) && (!last || last.day <= exile.day))
    body = { kind: "exile_revealed", day: exile.day };
  if (!body) return;
  return {
    policy: NOBLE_SECRET_BODY_POLICY,
    protectionRepeatPolicy: row.protectionRepeatPolicy as BodyRepeatPolicy,
    lastChoice: last,
    body,
  };
}
export function chooseBodyTarget(
  raw: SecretBodyState,
  day: number,
  targetId: number | null,
  livingIds: readonly number[],
): SecretBodyState {
  const state = readSecretBodyState(raw),
    living = livingSnapshot(livingIds);
  if (
    !state ||
    state.body.kind !== "intact" ||
    !positive(day) ||
    (state.lastChoice && state.lastChoice.day >= day)
  )
    throw Error("secret_body_unavailable");
  if (
    targetId !== null &&
    (!positive(targetId) ||
      !living.includes(targetId) ||
      (state.protectionRepeatPolicy === "awa_nonconsecutive_nights_v1" &&
        state.lastChoice?.day === day - 1 &&
        state.lastChoice.targetId === targetId))
  )
    throw Error("secret_body_target");
  return { ...state, lastChoice: { day, targetId } };
}
/** Caller owns original-life authorization and synchronously pairs this consumption with the FINAL block. */
export function spendBodyForNight(
  raw: SecretBodyState,
  day: number,
  actorId: number,
  block: { targetId: number; cause: SecretBodyCause },
): SecretBodyState {
  const state = readSecretBodyState(raw);
  if (
    !state ||
    state.body.kind !== "intact" ||
    !positive(day) ||
    !positive(actorId) ||
    state.lastChoice?.day !== day
  )
    throw Error("secret_body_unavailable");
  const proposed = data(block, ["targetId", "cause"]);
  if (
    !proposed ||
    !positive(proposed.targetId) ||
    !["wolf_kill", "poison", "demon_hunt", "demon_hunt_backlash", "servant_expiry"].includes(
      proposed.cause as string,
    ) ||
    (proposed.targetId !== actorId && proposed.targetId !== state.lastChoice.targetId)
  )
    throw Error("secret_body_block_invalid");
  return {
    ...state,
    body: {
      kind: "night_spent",
      day,
      targetId: proposed.targetId,
      cause: proposed.cause as SecretBodyCause,
    },
  };
}
export function revealBodyByExile(raw: SecretBodyState, day: number): SecretBodyState {
  const state = readSecretBodyState(raw);
  if (
    !state ||
    state.body.kind !== "intact" ||
    !positive(day) ||
    (state.lastChoice && state.lastChoice.day > day)
  )
    throw Error("secret_body_unavailable");
  return { ...state, body: { kind: "exile_revealed", day } };
}
export function createNobleState(policy: NobleWolfPolicy = "standard"): NobleState {
  if (policy !== "standard" && policy !== "no_blast_no_self_knife")
    throw Error("night_noble_policy_invalid");
  return {
    policy: NOBLE_SECRET_BODY_POLICY,
    wolfActionPolicy: policy,
    lastChoice: null,
    contracts: [],
  };
}
export function readNobleState(value: unknown): NobleState | undefined {
  const row = data(value, ["policy", "wolfActionPolicy", "lastChoice", "contracts"]);
  if (
    !row ||
    row.policy !== NOBLE_SECRET_BODY_POLICY ||
    !["standard", "no_blast_no_self_knife"].includes(row.wolfActionPolicy as string)
  )
    return;
  const last = choice(row.lastChoice),
    rows = dense(row.contracts);
  if (last === undefined || !rows || (last && last.day < 2)) return;
  const contracts: ServantContract[] = [];
  for (const raw of rows) {
    const contract = data(raw, ["id", "targetId", "createdNight", "expiresNight", "status"]);
    if (
      !contract ||
      !positive(contract.targetId) ||
      !positive(contract.createdNight) ||
      contract.createdNight < 2 ||
      contract.id !== `servant:night:${contract.createdNight}` ||
      contract.expiresNight !== contract.createdNight + 1
    )
      return;
    const previous = contracts.at(-1);
    if (
      previous &&
      (previous.status.kind === "pending" || contract.createdNight <= previous.status.day)
    )
      return;
    let status: ServantContract["status"] | undefined;
    if (data(contract.status, ["kind"])?.kind === "pending") status = { kind: "pending" };
    const ended = data(contract.status, ["kind", "day"]);
    if (
      ended &&
      ["cleared", "expired", "target_dead"].includes(ended.kind as string) &&
      positive(ended.day) &&
      ended.day >= contract.createdNight &&
      ended.day <= Number(contract.expiresNight) &&
      (ended.kind !== "expired" || ended.day === contract.expiresNight)
    )
      status = { kind: ended.kind as "cleared" | "expired" | "target_dead", day: ended.day };
    if (!status) return;
    contracts.push({
      id: contract.id as string,
      targetId: contract.targetId,
      createdNight: contract.createdNight,
      expiresNight: Number(contract.expiresNight),
      status,
    });
  }
  const latest = contracts.at(-1);
  if (
    latest &&
    (!last ||
      last.day < latest.createdNight ||
      (last.day === latest.createdNight && last.targetId !== latest.targetId) ||
      (last.day > latest.createdNight &&
        (last.targetId !== null ||
          latest.status.kind === "pending" ||
          last.day <= latest.status.day)) ||
      (latest.status.kind === "pending" && last.day !== latest.createdNight))
  )
    return;
  if (!latest && last?.targetId !== null && last !== null) return;
  return {
    policy: NOBLE_SECRET_BODY_POLICY,
    wolfActionPolicy: row.wolfActionPolicy as NobleWolfPolicy,
    lastChoice: last,
    contracts,
  };
}
export function chooseServant(
  raw: NobleState,
  day: number,
  targetId: number | null,
  actorId: number,
  livingIds: readonly number[],
): NobleState {
  const state = readNobleState(raw),
    living = livingSnapshot(livingIds),
    latest = state?.contracts.at(-1);
  if (
    !state ||
    !positive(day) ||
    day < 2 ||
    !positive(actorId) ||
    (state.lastChoice && state.lastChoice.day >= day) ||
    state.contracts.some((c) => c.status.kind === "pending") ||
    (latest && latest.status.kind !== "pending" && day <= latest.status.day)
  )
    throw Error("night_noble_unavailable");
  if (
    targetId !== null &&
    (!positive(targetId) || targetId === actorId || !living.includes(targetId))
  )
    throw Error("night_noble_target");
  return {
    ...state,
    lastChoice: { day, targetId },
    contracts:
      targetId === null
        ? state.contracts
        : [
            ...state.contracts,
            {
              id: `servant:night:${day}`,
              targetId,
              createdNight: day,
              expiresNight: day + 1,
              status: { kind: "pending" },
            },
          ],
  };
}
/** One terminal transition. Original owner/target-life checks and expiry source commit belong to the controller. */
export function endServant(
  raw: NobleState,
  id: string,
  day: number,
  kind: "cleared" | "expired" | "target_dead",
): NobleState {
  const state = readNobleState(raw),
    contract = state?.contracts.find((c) => c.id === id);
  if (
    !state ||
    !contract ||
    contract.status.kind !== "pending" ||
    !positive(day) ||
    day < contract.createdNight ||
    day > contract.expiresNight ||
    !["cleared", "expired", "target_dead"].includes(kind) ||
    (kind === "expired" && day !== contract.expiresNight)
  )
    throw Error("night_noble_contract_unavailable");
  return {
    ...state,
    contracts: state.contracts.map((c) => (c.id === id ? { ...c, status: { kind, day } } : c)),
  };
}
