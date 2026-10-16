/**
 * 负责 God 录像权威事实的纯数据契约和逐条读取。输入为提交 owner 捕获的字段；
 * 输出为独立 seq／afterSeq 流，不插入领域事件、不授予玩家知识或重跑结算规则。
 * 保护事实只证明指定伤害被阻止或守救相消，不证明最终存活；缺省库存与效果不得推断。
 */
export type ReplayFactPayload =
  | {
      kind: "wolf_knife_revoked";
      day: number;
      targetId: number;
      reason: "stale_target" | "wedding_permission_revoked";
    }
  | {
      kind: "wolf_knife_committed";
      day: number;
      participantIds: number[];
      requestedTargetId: number | null;
      effectiveTargetId: number | null;
    }
  | {
      kind: "potion_stock";
      day: number;
      actorId: number;
      abilityId: string;
      heal: number;
      poison: number;
    }
  | {
      kind: "night_protection_resolved";
      day: number;
      targetId: number;
      interaction: "guard_heal_cancelled";
      protection?: never;
    }
  | {
      kind: "night_protection_resolved";
      day: number;
      targetId: number;
      interaction: "wolf_attack_blocked";
      protection: "guard" | "heal";
    }
  | { kind: "life_committed"; day: number; playerId: number; alive: false; causes: string[] };

export type ReplayFact = ReplayFactPayload & { seq: number; afterSeq: number };
/** 只有完整采用 DeathCommitter 的新局声明该覆盖；空 facts 仍明确表示尚无死亡提交。 */
export interface ReplayFactCoverage {
  committedDeaths: 1;
}
export interface ReplayFactLog {
  factCoverage: ReplayFactCoverage;
  facts: ReplayFact[];
}

const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const target = (v: unknown): v is number | null => v === null || positive(v);
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200 && !/[\u0000-\u001f\u007f]/.test(v);

/** 只消费平坦数组的自有数据元素，不执行索引 getter、迭代器或自定义原型。 */
function flatArray(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const fields = Object.getOwnPropertyDescriptors(value) as unknown as Record<
      string,
      PropertyDescriptor
    >,
    length = fields.length?.value;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > 128 ||
    Reflect.ownKeys(fields).length !== length + 1
  )
    return null;
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const field = fields[String(index)];
    if (!field || !field.enumerable || !("value" in field)) return null;
    result.push(field.value);
  }
  return result;
}

/** 只读已序列化值，不执行字段 getter；未知种类、额外键和不完整归因均拒绝。 */
export function readReplayFact(value: unknown): ReplayFact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).some(
        (key) =>
          typeof key !== "string" ||
          !descriptors[key]!.enumerable ||
          !("value" in descriptors[key]!),
      )
    )
      return null;
    const v: Record<string, unknown> = Object.fromEntries(
      Object.entries(descriptors).map(([key, d]) => [key, d.value]),
    );
    if (!positive(v.seq) || !natural(v.afterSeq) || !natural(v.day)) return null;
    let keys: string[];
    switch (v.kind) {
      case "wolf_knife_committed": {
        const participants = flatArray(v.participantIds);
        if (
          !participants ||
          !participants.every(positive) ||
          new Set(participants).size !== participants.length ||
          !target(v.requestedTargetId) ||
          !target(v.effectiveTargetId)
        )
          return null;
        v.participantIds = participants;
        keys = ["participantIds", "requestedTargetId", "effectiveTargetId"];
        break;
      }
      case "wolf_knife_revoked":
        if (
          !positive(v.targetId) ||
          (v.reason !== "stale_target" && v.reason !== "wedding_permission_revoked")
        )
          return null;
        keys = ["targetId", "reason"];
        break;
      case "potion_stock":
        if (!positive(v.actorId) || !text(v.abilityId) || !natural(v.heal) || !natural(v.poison))
          return null;
        keys = ["actorId", "abilityId", "heal", "poison"];
        break;
      case "night_protection_resolved":
        if (!positive(v.targetId)) return null;
        keys = ["targetId", "interaction"];
        if (v.interaction === "wolf_attack_blocked") {
          if (v.protection !== "guard" && v.protection !== "heal") return null;
          keys.push("protection");
        } else if (v.interaction !== "guard_heal_cancelled") return null;
        break;
      case "life_committed": {
        const causes = flatArray(v.causes);
        if (!positive(v.playerId) || v.alive !== false || !causes || !causes.every(text))
          return null;
        v.causes = causes;
        keys = ["playerId", "alive", "causes"];
        break;
      }
      default:
        return null;
    }
    if (
      Object.keys(v).sort().join(",") !==
      ["seq", "afterSeq", "day", "kind", ...keys].sort().join(",")
    )
      return null;
    return structuredClone(v) as ReplayFact;
  } catch {
    return null;
  }
}
