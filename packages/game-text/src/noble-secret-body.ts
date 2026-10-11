import { copyEventData } from "./event-data";
export const NOBLE_SECRET_BODY_POLICY = "awa_noble_secret_body_v1" as const;
export interface KnownNightChoice {
  day: number;
  targetId: number | null;
}
export interface KnownServantContract {
  id: string;
  targetId: number;
  createdNight: number;
  expiresNight: number;
  status: { kind: "pending" } | { kind: "cleared" | "expired" | "target_dead"; day: number };
}
export interface NobleKnowledge {
  readonly wolfActionPolicy: "standard" | "no_blast_no_self_knife";
  readonly lastNotifiedNight: number;
  readonly lastChoice: KnownNightChoice | null;
  readonly contracts: readonly KnownServantContract[];
}
export interface SecretBodyKnowledge {
  readonly protectionRepeatPolicy: "awa_nonconsecutive_nights_v1" | "awa_repeat_v1";
  readonly lastNotifiedNight: number;
  readonly lastChoice: KnownNightChoice | null;
  readonly resource: "intact" | "spent" | "exile_revealed";
  readonly publicRevealDay: number | null;
}
type Base = { policy: typeof NOBLE_SECRET_BODY_POLICY; actorId: number; day: number };
export type NobleContractClosedFact = Base & {
  contractId: string;
  targetId: number;
  createdNight: number;
  expiresNight: number;
} & (
    { status: "expired"; proposedCause: "servant_expiry" } | { status: "cleared" | "target_dead" }
  );
export interface NobleSecretBodyPayloadMap {
  noble_servant_chosen: Base & { targetId: number | null; contractId: string | null };
  secret_body_chosen: Base & { targetId: number | null };
  noble_contract_closed: NobleContractClosedFact;
  secret_body_blocked: Base & {
    targetId: number;
    cause: "wolf_kill" | "poison" | "demon_hunt" | "demon_hunt_backlash" | "servant_expiry";
  };
  noble_night_notified: Base & NobleKnowledge;
  secret_body_night_notified: Base & SecretBodyKnowledge;
  secret_body_revealed: Base;
  secret_body_reveal_speech: Base & { text: string };
}
export const NOBLE_SECRET_BODY_EVENT_TYPES = Object.freeze([
  "noble_servant_chosen",
  "secret_body_chosen",
  "noble_contract_closed",
  "secret_body_blocked",
  "noble_night_notified",
  "secret_body_night_notified",
  "secret_body_revealed",
  "secret_body_reveal_speech",
] as const);
export type NobleSecretBodyEventType = keyof NobleSecretBodyPayloadMap;
function id(v: unknown): v is number {
  return (
    typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER - 1
  );
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function keys(v: unknown, list: readonly string[]): v is Record<string, unknown> {
  return (
    record(v) && Object.keys(v).length === list.length && list.every((k) => Object.hasOwn(v, k))
  );
}
function choice(v: unknown, day: number): boolean {
  return (
    v === null ||
    (keys(v, ["day", "targetId"]) &&
      id(v.day) &&
      v.day < day &&
      (v.targetId === null || id(v.targetId)))
  );
}
function contract(v: unknown, day: number, actor: number): v is KnownServantContract {
  if (
    !keys(v, ["id", "targetId", "createdNight", "expiresNight", "status"]) ||
    !id(v.createdNight) ||
    v.createdNight < 2 ||
    v.createdNight >= day ||
    v.expiresNight !== v.createdNight + 1 ||
    v.id !== `servant:night:${v.createdNight}` ||
    !id(v.targetId) ||
    v.targetId === actor
  )
    return false;
  if (keys(v.status, ["kind"]) && v.status.kind === "pending") return v.expiresNight === day;
  return (
    keys(v.status, ["kind", "day"]) &&
    ["cleared", "expired", "target_dead"].includes(v.status.kind as string) &&
    id(v.status.day) &&
    v.status.day >= v.createdNight &&
    v.status.day < day &&
    (v.status.kind === "expired" ? v.status.day === v.expiresNight : v.status.day <= v.expiresNight)
  );
}
export function readNobleSecretBodyFact<T extends NobleSecretBodyEventType>(
  type: T,
  value: unknown,
): NobleSecretBodyPayloadMap[T] | null;
export function readNobleSecretBodyFact(
  type: string,
  value: unknown,
): NobleSecretBodyPayloadMap[NobleSecretBodyEventType] | null;
export function readNobleSecretBodyFact(
  type: string,
  value: unknown,
): NobleSecretBodyPayloadMap[NobleSecretBodyEventType] | null {
  if (!(NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(value),
      base = ["policy", "actorId", "day"];
    if (!record(p) || p.policy !== NOBLE_SECRET_BODY_POLICY || !id(p.actorId) || !id(p.day))
      return null;
    let valid = false;
    switch (type) {
      case "noble_servant_chosen":
        valid =
          keys(p, [...base, "targetId", "contractId"]) &&
          p.day >= 2 &&
          (p.targetId === null
            ? p.contractId === null
            : id(p.targetId) &&
              p.targetId !== p.actorId &&
              p.contractId === `servant:night:${p.day}`);
        break;
      case "secret_body_chosen":
        valid = keys(p, [...base, "targetId"]) && (p.targetId === null || id(p.targetId));
        break;
      case "noble_contract_closed":
        valid =
          keys(p, [
            ...base,
            "contractId",
            "targetId",
            "createdNight",
            "expiresNight",
            "status",
            ...(p.status === "expired" ? ["proposedCause"] : []),
          ]) &&
          id(p.createdNight) &&
          p.createdNight >= 2 &&
          p.day >= p.createdNight &&
          p.expiresNight === p.createdNight + 1 &&
          p.contractId === `servant:night:${p.createdNight}` &&
          id(p.targetId) &&
          p.targetId !== p.actorId &&
          (p.status === "expired"
            ? p.day === p.expiresNight && p.proposedCause === "servant_expiry"
            : ["cleared", "target_dead"].includes(p.status as string) &&
              p.day <= Number(p.expiresNight));
        break;
      case "secret_body_blocked":
        valid =
          keys(p, [...base, "targetId", "cause"]) &&
          id(p.targetId) &&
          ["wolf_kill", "poison", "demon_hunt", "demon_hunt_backlash", "servant_expiry"].includes(
            p.cause as string,
          );
        break;
      case "noble_night_notified":
        valid =
          keys(p, [...base, "wolfActionPolicy", "lastNotifiedNight", "lastChoice", "contracts"]) &&
          p.lastNotifiedNight === p.day &&
          ["standard", "no_blast_no_self_knife"].includes(p.wolfActionPolicy as string) &&
          choice(p.lastChoice, p.day) &&
          (p.lastChoice === null ||
            (record(p.lastChoice) &&
              Number(p.lastChoice.day) >= 2 &&
              p.lastChoice.targetId !== p.actorId)) &&
          Array.isArray(p.contracts) &&
          p.contracts.every((c) => contract(c, p.day as number, p.actorId as number)) &&
          new Set(p.contracts.map((c) => c.id)).size === p.contracts.length;
        break;
      case "secret_body_night_notified":
        valid =
          keys(p, [
            ...base,
            "protectionRepeatPolicy",
            "lastNotifiedNight",
            "resource",
            "publicRevealDay",
            "lastChoice",
          ]) &&
          p.lastNotifiedNight === p.day &&
          ["awa_nonconsecutive_nights_v1", "awa_repeat_v1"].includes(
            p.protectionRepeatPolicy as string,
          ) &&
          ["intact", "spent", "exile_revealed"].includes(p.resource as string) &&
          choice(p.lastChoice, p.day) &&
          (p.resource === "intact" || (p.day >= 2 && record(p.lastChoice))) &&
          (p.resource === "exile_revealed"
            ? id(p.publicRevealDay) &&
              p.publicRevealDay < p.day &&
              record(p.lastChoice) &&
              Number(p.lastChoice.day) <= p.publicRevealDay
            : p.publicRevealDay === null);
        break;
      case "secret_body_revealed":
        valid = keys(p, base);
        break;
      case "secret_body_reveal_speech":
        valid =
          keys(p, [...base, "text"]) &&
          typeof p.text === "string" &&
          p.text.trim().length > 0 &&
          p.text.length <= 8192;
        break;
    }
    return valid ? (p as unknown as NobleSecretBodyPayloadMap[NobleSecretBodyEventType]) : null;
  } catch {
    return null;
  }
}
export function nobleSecretBodyVisibility(type: string): "god" | "actor" | "public" | null {
  if (type === "noble_contract_closed" || type === "secret_body_blocked") return "god";
  if (type === "secret_body_revealed" || type === "secret_body_reveal_speech") return "public";
  return (NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(type) ? "actor" : null;
}
