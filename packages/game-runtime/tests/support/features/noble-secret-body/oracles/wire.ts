/**
 * 持有绑定严格解析档案的独立 Noble／Body 序列化请求前缀和已发表知识检查。输入为实际消息、请求前缀、快照或原本地端点及显式预期，输出为原断言与拒绝诊断；各层测试沿用独立标记和已录前缀，不从生产身份、观察或板子算法生成结果预期。
 */
import { isDeepStrictEqual } from "node:util";
import type {
  RecordedDecision,
  ReproductionRecord,
} from "../../../../../src/recording/reproduction/format";
type Tuple = [number, string, Record<string, unknown>];
// 独立字面协议包含自爆确认约定；仍逐值比较完整响应，不从生产格式器生成预期。
const protocolDescriptions = {
  en: {
    get_game_schema: "{}; query the fixed tool protocol without returning game state.",
    submit_action:
      "{ turn_id, action, arguments, confirmation_id? }; select one validated action. Self-destruction first proposes only; read the warning and resubmit unchanged with its confirmation ID. No confirmation means skip. accepted=true, applied=false means it awaits final engine validation; result events determine its effect.",
    report_bug:
      "{ turn_id, category, severity, message }; report a confirmed engine contradiction.",
  },
  "zh-CN": {
    get_game_schema: "{}；查询固定工具协议，不返回局内状态。",
    submit_action:
      "{ turn_id, action, arguments, confirmation_id? }；选择一个通过校验的行动。自爆首次只提案，必须阅读警示，再带确认编号原样提交；不确认即跳过。accepted=true、applied=false 表示尚待引擎最终校验，生效以结果事件为准。",
    report_bug: "{ turn_id, category, severity, message }；上报明确的引擎矛盾。",
  },
} as const;
export type NobleWireRun = {
  record: ReproductionRecord;
  sdkWireMessages: Array<{ actor: number; ordinal: number; messages: unknown[] }>;
  acpTraces: Array<{
    actor: number;
    trace: {
      prompts: string[];
      arrivals: Array<{ actorOrdinal: number }>;
      activeSchemas: Array<{ actorOrdinal: number; body: unknown }>;
    };
  }>;
};
export function noblePromptStatus(prompt: string): Record<string, unknown> | null {
  const lines = prompt
    .split("\n")
    .filter((line) =>
      /Your last announced (?:body|servant) state|你的已告知(?:夜仆|身体)状态/.test(line),
    );
  if (!lines.length) return null;
  if (lines.length !== 1) throw Error("fixture_noble_wire_duplicate_status");
  const line = lines[0]!;
  const i = line.indexOf("{");
  if (i < 0) throw Error("fixture_noble_wire_status_invalid");
  for (let end = i + 1; end <= line.length; end++) {
    if (line[end - 1] !== "}") continue;
    try {
      return JSON.parse(line.slice(i, end)) as Record<string, unknown>;
    } catch {}
  }
  throw Error("fixture_noble_wire_status_invalid");
}
/**
 * 独立折叠获准公开的历史事实，绝不使用生产玩家投影或 CP。
 */
function knownAt(record: ReproductionRecord, d: RecordedDecision): Record<string, unknown> | null {
  const role = record.metadata.players.find((p) => p.id === d.actorId)!.role,
    body = role === "awakened_idiot";
  if (!body && role !== "night_noble") return null;
  let state: Record<string, unknown> = body
    ? {
        protectionRepeatPolicy:
          record.metadata.normalizedBoard.awakenedIdiot!.protectionRepeatPolicy,
        lastNotifiedNight: 0,
        lastChoice: null,
        resource: "intact",
        publicRevealDay: null,
      }
    : {
        wolfActionPolicy: record.metadata.normalizedBoard.nightNoble!.wolfActionPolicy,
        lastNotifiedNight: 0,
        lastChoice: null,
        contracts: [],
      };
  for (const e of d.request.context.visible_events) {
    const p = e.payload;
    if (p.actorId !== d.actorId) continue;
    if (e.type === (body ? "secret_body_night_notified" : "noble_night_notified")) {
      const { policy: _, actorId: __, day: ___, ...known } = p;
      state = structuredClone(known);
    }
    if (e.type === (body ? "secret_body_chosen" : "noble_servant_chosen")) {
      state.lastChoice = { day: p.day, targetId: p.targetId };
      if (!body && p.targetId !== null)
        (state.contracts as unknown[]).push({
          id: p.contractId,
          targetId: p.targetId,
          createdNight: p.day,
          expiresNight: Number(p.day) + 1,
          status: { kind: "pending" },
        });
    }
    if (body && e.type === "secret_body_revealed") {
      state.resource = "exile_revealed";
      state.publicRevealDay = p.day;
    }
  }
  state.awaitingNightReport =
    d.request.phase !== "night" && (!body || state.resource !== "exile_revealed");
  return state;
}
/**
 * 真实行动者／序号的消息必须保留完整增量与字面 owner 知识。
 */
export function assertNobleTransportWire(run: NobleWireRun) {
  const byActor = new Map<number, RecordedDecision[]>();
  for (const d of run.record.decisions) {
    const ds = byActor.get(d.actorId) ?? [];
    ds.push(d);
    byActor.set(d.actorId, ds);
  }
  const covered = new Set<string>();
  const privacy = (actor: number, content: string, requireCanary = false) => {
    for (const f of [
      "noble_body_night_opened",
      "noble_body_knife_committed",
      "noble_body_native_damage_committed",
      "noble_body_sources_committed",
      "noble_body_death_committed",
      "noble_contract_closed",
      "secret_body_blocked",
      "night_spent",
      "bodyResolved",
      "expiryProcessed",
    ])
      if (content.includes(f)) throw Error("fixture_noble_actual_state_exposed:" + f);
    const markers = [...content.matchAll(/NOBLE_PRIVATE_ACTOR_(\d+)/g)];
    if (markers.some((m) => Number(m[1]) !== actor))
      throw Error("fixture_noble_foreign_history_exposed");
    if (requireCanary && !markers.some((m) => Number(m[1]) === actor))
      throw Error("fixture_noble_private_canary_missing");
  };
  const current = (actor: number, ordinal: number, prompt: string) => {
    const d = byActor.get(actor)?.[ordinal - 1];
    if (!d) throw Error("fixture_noble_wire_request_missing");
    const known = knownAt(run.record, d),
      actual = noblePromptStatus(prompt);
    if (!isDeepStrictEqual(actual, known)) throw Error("fixture_noble_wire_known_state_mismatch");
    covered.add(`${actor}/${ordinal}`);
  };
  const history = (actor: number, prompt: string): number => {
    const turn = /(?:turn_id (?:必须为|must be) |Current turn ID: |当前回合 ID：)t(\d+)/.exec(
      prompt,
    );
    if (!turn) throw Error("fixture_noble_wire_history_turn_missing");
    const ordinal = Number(turn[1]),
      d = byActor.get(actor)?.[ordinal - 1];
    if (!d || !isDeepStrictEqual(noblePromptStatus(prompt), knownAt(run.record, d)))
      throw Error("fixture_noble_wire_history_state_mismatch");
    return ordinal;
  };
  const events = (actor: number, ordinal: number, actual: Tuple[], kind: "sdk" | "acp") => {
    const ds = byActor.get(actor),
      d = ds?.[ordinal - 1];
    if (!d) throw Error("fixture_noble_wire_request_missing");
    const all = d.request.context.visible_events,
      before = ds?.[ordinal - 2]?.request.context.visible_events.length ?? 0,
      delta = all.slice(before).map((e) => [e.seq, e.type, e.payload] as Tuple);
    if (delta.length > 96) throw Error("fixture_noble_wire_delta_exceeds_test_window");
    if (kind === "acp") {
      if (!isDeepStrictEqual(actual, delta)) throw Error("fixture_noble_wire_delta_mismatch");
    } else {
      const start = actual[0]?.[0] ?? all.length + 1;
      if (
        actual.length &&
        !isDeepStrictEqual(
          actual,
          all.slice(start - 1).map((e) => [e.seq, e.type, e.payload] as Tuple),
        )
      )
        throw Error("fixture_noble_wire_suffix_mismatch");
      if (delta.length && (start > before + 1 || !actual.length))
        throw Error("fixture_noble_wire_missing_delta");
    }
    for (const [, type, p] of actual) {
      if (
        type.startsWith("noble_body_") ||
        ["noble_contract_closed", "secret_body_blocked"].includes(type)
      )
        throw Error("fixture_noble_god_fact_exposed");
      if (
        [
          "noble_servant_chosen",
          "noble_night_notified",
          "secret_body_chosen",
          "secret_body_night_notified",
        ].includes(type) &&
        p.actorId !== actor
      )
        throw Error("fixture_noble_foreign_owner_fact_exposed");
    }
  };
  for (const wire of run.sdkWireMessages) {
    privacy(wire.actor, JSON.stringify(wire.messages), true);
    const messages = wire.messages as Array<{ role: string; content: unknown }>,
      tuples = messages.flatMap((m) =>
        typeof m.content === "string" && m.content.startsWith('{"event":')
          ? [JSON.parse(m.content).event as Tuple]
          : [],
      ),
      prompt = [...messages]
        .reverse()
        .find(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            /\[Action prompt\]|\[行动提示\]/.test(m.content),
        )?.content;
    if (typeof prompt !== "string") throw Error("fixture_noble_wire_current_missing");
    current(wire.actor, wire.ordinal, prompt);
    for (const m of messages)
      if (
        m.role === "user" &&
        typeof m.content === "string" &&
        /\[Action prompt\]|\[行动提示\]/.test(m.content)
      )
        if (history(wire.actor, m.content) > wire.ordinal)
          throw Error("fixture_noble_wire_future_history");
    if (history(wire.actor, prompt) !== wire.ordinal)
      throw Error("fixture_noble_wire_current_ordinal");
    events(wire.actor, wire.ordinal, tuples, "sdk");
  }
  for (const { actor, trace } of run.acpTraces) {
    for (const prompt of trace.prompts) privacy(actor, prompt);
    privacy(actor, JSON.stringify(trace.prompts), true);
    const prompts = trace.prompts.filter((p) => /(?:Current turn ID: |当前回合 ID：)t\d+/.test(p));
    if (prompts.length !== trace.arrivals.length || trace.activeSchemas.length !== prompts.length)
      throw Error("fixture_noble_wire_arrivals_missing");
    for (const [i, prompt] of prompts.entries()) {
      const ordinal = trace.arrivals[i]!.actorOrdinal;
      current(actor, ordinal, prompt);
      events(
        actor,
        ordinal,
        prompt.split("\n").flatMap((line) => {
          const i = line.indexOf('{"events":');
          return i < 0 ? [] : (JSON.parse(line.slice(i)).events as Tuple[]);
        }),
        "acp",
      );
      if (trace.activeSchemas[i]!.actorOrdinal !== ordinal)
        throw Error("fixture_noble_active_schema_ordinal");
      privacy(actor, JSON.stringify(trace.activeSchemas[i]!.body));
      if (
        !isDeepStrictEqual(trace.activeSchemas[i]!.body, {
          protocol_version: "1",
          tools: protocolDescriptions[run.record.metadata.locale ?? "en"],
        })
      )
        throw Error("fixture_noble_active_schema_invalid");
      if (!isDeepStrictEqual(trace.activeSchemas[i]!.body, trace.activeSchemas[0]!.body))
        throw Error("fixture_noble_active_schema_changed");
    }
  }
  for (const [actor, ds] of byActor)
    for (let i = 1; i <= ds.length; i++)
      if (!covered.has(`${actor}/${i}`)) throw Error("fixture_noble_wire_coverage_missing");
}
