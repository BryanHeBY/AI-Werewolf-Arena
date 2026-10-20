/**
 * 提供迷雾／渡鸦真实 wire 可见性、序号与授权的测试断言。调用方提供字面预期和独立状态；这里保留原 DTO／断言关系，不以生产结算制造新预期。
 */
// 这条导入的原始绑定文本受历史夹具程序合同保护；其余源码仍执行正常格式检查。
// prettier-ignore
import { MIST_RAVEN_EVENT_TYPES, readMistRavenFact } from "@ai-werewolf-arena/game-contract/facts/mist-raven";
export interface MistExpectedWireChoice {
  type: string;
  payload: Record<string, unknown>;
  afterOrdinal?: number;
  sourceDay?: number;
}
export interface MistWireExpectations {
  unseal?: { day: number; knownTeammateIds: number[] };
  draw?: { day: number; candidates: number[]; targetId: number | null; afterOrdinal?: number };
  choices?: MistExpectedWireChoice[];
  packFacts?: MistExpectedWireChoice[];
}
/** fixture 按玩家持有此记录，跨 SDK 历史窗口或 ACP 增量保留。 */
export interface MistWireState {
  unsealSeq?: number;
  currentDay?: number;
  currentRequestOrdinal?: number;
  extraUsedSeq?: number;
  seenFacts?: Map<number, string>;
  factSlots?: Map<string, number>;
}
const pack = new Set([
  "wolf_tactical_order",
  "wolf_discussion",
  "wolf_discussion_ended",
  "wolf_kill_vote_cast",
  "mist_knife_drawn",
]);
const signature = (type: string, payload: Record<string, unknown>) =>
  JSON.stringify([type, Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))]);
export function assertMistTransportEvents(
  role: string,
  actorId: number,
  events: Array<[number, string, Record<string, unknown>]>,
  expected: MistWireExpectations = {},
  state: MistWireState = {},
): void {
  for (const [seq, type, payload] of events) {
    if (role === "raven_claw_wolf" && pack.has(type)) {
      const members = [actorId, ...(expected.unseal?.knownTeammateIds ?? [])];
      if (
        type === "wolf_tactical_order"
          ? !Array.isArray(payload.order) ||
            payload.order.some((id) => !members.includes(id)) ||
            !payload.order.includes(actorId) ||
            new Set(payload.order).size !== payload.order.length
          : type !== "mist_knife_drawn" &&
            (typeof payload.actorId !== "number" || !members.includes(payload.actorId))
      )
        throw new Error("fixture_raven_unknown_pack_member");
      if (type !== "wolf_tactical_order" && type !== "mist_knife_drawn" && expected.packFacts) {
        const choice = expected.packFacts.find(
          (c) => signature(c.type, c.payload) === signature(type, payload),
        );
        if (!choice || state.currentDay === undefined || choice.sourceDay! > state.currentDay)
          throw new Error("fixture_raven_pack_fact_mismatch");
        if (
          choice.afterOrdinal !== undefined &&
          (state.currentRequestOrdinal === undefined ||
            state.currentRequestOrdinal <= choice.afterOrdinal)
        )
          throw new Error("fixture_raven_unsettled_pack_fact");
      }
    }
    if ((MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(type)) {
      const fact = readMistRavenFact(type, payload);
      if (!fact || !Number.isSafeInteger(seq) || seq < 1)
        throw new Error("fixture_mist_fact_invalid");
      if (state.currentDay === undefined || fact.day > state.currentDay)
        throw new Error("fixture_mist_future_fact_exposed");
      const sig = signature(type, payload),
        seen = state.seenFacts?.get(seq),
        slot = `${type}:${fact.day}`;
      if (
        (seen !== undefined && seen !== sig) ||
        (state.factSlots?.has(slot) && state.factSlots.get(slot) !== seq)
      )
        throw new Error("fixture_mist_sequence_changed");
      let after: number | undefined;
      if (type === "mist_knife_drawn") {
        const draw = expected.draw;
        if (
          !["wolf", "raven_claw_wolf"].includes(role) ||
          !draw ||
          !("candidates" in fact) ||
          fact.day !== draw.day ||
          fact.targetId !== draw.targetId ||
          JSON.stringify(fact.candidates) !== JSON.stringify(draw.candidates)
        )
          throw new Error("fixture_mist_draw_exposed");
        after = draw.afterOrdinal;
        if (role === "raven_claw_wolf" && (!expected.unseal || fact.day < expected.unseal.day))
          throw new Error("fixture_raven_historical_pack_exposed");
      } else {
        if (
          !("actorId" in fact) ||
          fact.actorId !== actorId ||
          role !== (type.startsWith("alchemist_") ? "alchemist" : "raven_claw_wolf")
        )
          throw new Error("fixture_mist_private_fact_exposed");
        if (expected.choices) {
          const choice = expected.choices.find((c) => signature(c.type, c.payload) === sig);
          if (!choice) throw new Error("fixture_mist_choice_mismatch");
          after = choice.afterOrdinal;
        }
        if (
          after !== undefined &&
          (state.currentRequestOrdinal === undefined || state.currentRequestOrdinal <= after)
        )
          throw new Error("fixture_mist_unsettled_fact_exposed");
        if (type === "raven_unsealed") {
          const unseal = expected.unseal;
          if (
            !unseal ||
            !("knownTeammateIds" in fact) ||
            fact.day !== unseal.day ||
            JSON.stringify(fact.knownTeammateIds) !== JSON.stringify(unseal.knownTeammateIds) ||
            (state.unsealSeq !== undefined && state.unsealSeq !== seq)
          )
            throw new Error("fixture_raven_unseal_mismatch");
          state.unsealSeq = seq;
        }
        if (type === "raven_knife_chosen") {
          if (
            !("targetId" in fact) ||
            state.unsealSeq === undefined ||
            seq <= state.unsealSeq ||
            !expected.unseal ||
            fact.day < expected.unseal.day ||
            (seen === undefined && state.extraUsedSeq !== undefined)
          )
            throw new Error("fixture_raven_extra_unavailable");
          if (fact.targetId !== null && seen === undefined) state.extraUsedSeq = seq;
        }
        if (
          type === "raven_knife_skipped" &&
          "reason" in fact &&
          fact.reason === "spent" &&
          (state.extraUsedSeq === undefined || seq <= state.extraUsedSeq)
        )
          throw new Error("fixture_raven_extra_unavailable");
      }
      if (
        after !== undefined &&
        (state.currentRequestOrdinal === undefined || state.currentRequestOrdinal <= after)
      )
        throw new Error("fixture_mist_unsettled_fact_exposed");
      (state.seenFacts ??= new Map()).set(seq, sig);
      (state.factSlots ??= new Map()).set(slot, seq);
    }
    if (
      role === "raven_claw_wolf" &&
      pack.has(type) &&
      (!Number.isSafeInteger(seq) || state.unsealSeq === undefined || seq <= state.unsealSeq)
    )
      throw new Error("fixture_raven_historical_pack_exposed");
  }
}

/** 两种传输在真实 wire 上均提供同一三字段提交包。 */
export function assertSubmitActionWireSchema(value: unknown): void {
  if (!value || typeof value !== "object") throw new Error("fixture_submission_schema_missing");
  const schema = value as Record<string, unknown>,
    properties = schema.properties as Record<string, Record<string, unknown>> | undefined,
    required = schema.required;
  if (
    schema.type !== "object" ||
    !Array.isArray(required) ||
    !["turn_id", "action", "arguments"].every((k) => required.includes(k)) ||
    properties?.turn_id?.type !== "string" ||
    properties?.action?.type !== "string" ||
    properties?.arguments?.type !== "object"
  )
    throw new Error("fixture_submission_schema_invalid");
}
