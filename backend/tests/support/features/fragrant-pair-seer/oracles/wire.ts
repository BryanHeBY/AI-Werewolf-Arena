/**
 * Owns test oracle support: Independent Fragrant Pair serialized request-prefix, schema and knowledge checks from original literal status markers and parsed decisions.
 * Inputs are actual wire messages, request prefixes, snapshots or a former
 * local endpoint plus explicit expectations; outputs are the original assertions
 * and rejection diagnostics. Unit/integration/scenario tests retain their
 * independent literal markers and recorded prefixes as the oracle. No expected
 * result is regenerated from production role, observation or board algorithms.
 */
import { isDeepStrictEqual as equal } from "node:util";
import type { RecordedDecision, ReproductionRecord } from "../../../../../src/recording/reproduction";
type Tuple = [number, string, Record<string, unknown>];
export type FragrantWireRun = {
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
const policy = "awa_fragrant_pair_seer_v1";
const statusMarker = {
  en: "Your authorized fragrance knowledge, binding history and knife permission: ",
  "zh-CN": "你的已授权寻香知识、绑定历史和刀权状态：",
};
const name = {
  en: { fragrant_phantom: "Fragrant Phantom", awakened_seer: "Awakened Seer" },
  "zh-CN": { fragrant_phantom: "寻香魅影", awakened_seer: "觉醒预言家" },
};
const schema = {
  en: {
    get_game_schema: "{}; query the fixed tool protocol without returning game state.",
    submit_action:
      "{ turn_id, action, arguments }; select one validated action. accepted=true, applied=false means it awaits final engine validation; result events determine its effect.",
    report_bug:
      "{ turn_id, category, severity, message }; report a confirmed engine contradiction.",
  },
  "zh-CN": {
    get_game_schema: "{}；查询固定工具协议，不返回局内状态。",
    submit_action:
      "{ turn_id, action, arguments }；选择一个通过校验的行动。accepted=true、applied=false 表示尚待引擎最终校验，生效以结果事件为准。",
    report_bug: "{ turn_id, category, severity, message }；上报明确的引擎矛盾。",
  },
};
function fail(code: string): never {
  throw Error("fixture_fragrant_wire_" + code);
}
function must(ok: unknown, code: string): asserts ok {
  if (!ok) fail(code);
}
export function jsonAt(prompt: string, marker: string): any | null {
  const offset = prompt.indexOf(marker);
  if (offset < 0) return null;
  must(prompt.indexOf(marker, offset + marker.length) < 0, "duplicate_status");
  const start = offset + marker.length;
  must(prompt[start] === "{", "invalid_status");
  for (let end = start + 1; end <= prompt.length; end++)
    if (prompt[end - 1] === "}") {
      try {
        return JSON.parse(prompt.slice(start, end));
      } catch {}
    }
  fail("invalid_status");
}
/** Requires a record previously accepted by the independent public parser.
 * Expected feed is its decision prefix tied to openedAtEventCount. No runtime projector,
 * production role/knowledge reducer or checkpoint inventory is used here. */
export function fragrantKnownAt(d: RecordedDecision): Record<string, any> {
  let known: any = {
    knownWolfId: null,
    lastOpenedNight: 0,
    lastChoice: null,
    activeBinding: null,
    used: false,
    knifeNotices: [],
  };
  let day = 0,
    dead = false;
  for (const e of d.request.context.visible_events) {
    const p: any = e.payload;
    if (e.type === "phase_changed") day = p.day;
    if (e.type === "fragrant_night_notified" && p.actorId === d.actorId)
      known = structuredClone(p.known);
    if (e.type === "fragrant_pair_chosen" && p.actorId === d.actorId) {
      known.lastChoice = { day: p.day, pairIds: structuredClone(p.pairIds) };
      known.activeBinding =
        p.pairIds === null
          ? null
          : { createdNight: p.day, expiresNight: p.day + 1, pairIds: structuredClone(p.pairIds) };
    }
    const deaths: number[] =
      e.type === "night_resolved" || e.type === "additional_deaths"
        ? p.deaths
        : e.type === "voted_out"
          ? [p.target]
          : e.type === "player_shot"
            ? [p.targetId]
            : e.type === "wolf_self_destruct"
              ? [p.wolfId]
              : [];
    if (deaths.includes(d.actorId)) dead = true;
    if (
      known.activeBinding?.createdNight === day &&
      known.activeBinding.pairIds.some((id: number) => deaths.includes(id))
    ) {
      known.activeBinding = null;
      known.used = true;
    }
  }
  return {
    actorId: d.actorId,
    ...known,
    hasInheritedKnife: known.knifeNotices.some((n: any) => n.eligible),
    canVoteForKill:
      !dead &&
      d.request.phase === "night" &&
      known.knifeNotices.at(-1)?.day === d.day &&
      known.knifeNotices.at(-1)?.eligible === true,
  };
}
function pairAt(d: RecordedDecision) {
  return {
    policy,
    history: d.request.context.visible_events
      .filter((e) => e.type === "fragrant_pair_inspected" && e.payload.actorId === d.actorId)
      .map((e) => ({
        day: e.payload.day,
        targetIds: structuredClone(e.payload.targetIds),
        containsWerewolf: e.payload.containsWerewolf,
      })),
  };
}
function ordinal(prompt: string) {
  const m = /(?:turn_id (?:必须为|must be) |Current turn ID: |当前回合 ID：)t(\d+)/.exec(prompt);
  must(m, "turn_missing");
  return Number(m[1]);
}
export function assertFragrantTransportWire(run: FragrantWireRun) {
  const locale = run.record.metadata.locale ?? "en",
    en = locale === "en";
  const role = (actor: number) => run.record.metadata.players.find((p) => p.id === actor)?.role;
  const byActor = new Map<number, RecordedDecision[]>();
  for (const d of run.record.decisions) {
    const ds = byActor.get(d.actorId) ?? [];
    ds.push(d);
    byActor.set(d.actorId, ds);
  }
  const covered = new Set<string>();
  const decision = (actor: number, ord: number) => {
    const d = byActor.get(actor)?.[ord - 1];
    must(d, "request_missing");
    return d;
  };
  const privacy = (actor: number, text: string) => {
    for (const fact of [
      "fragrant_night_opened",
      "fragrant_wave_committed",
      "fragrant_binding_expired",
      "fragrant_link_triggered",
    ])
      must(!text.includes(fact), "god_fact_exposed");
    for (const key of ["trigger", "bindings", "rootId", "addedTargetId", "originalWolfIds"])
      must(!new RegExp('"' + key + '"\\s*:').test(text), "actual_state_exposed");
    if (role(actor) !== "fragrant_phantom")
      must(
        !text.includes('"knownWolfId"') && !text.includes(statusMarker[locale]),
        "foreign_state_exposed",
      );
    if (role(actor) !== "awakened_seer")
      must(
        !text.includes("Ability native:pair_check:") && !text.includes("能力 native:pair_check："),
        "foreign_pair_state_exposed",
      );
  };
  const init = (actor: number, text: string) => {
    privacy(actor, text);
    const r = role(actor);
    if (r !== "fragrant_phantom" && r !== "awakened_seer") return;
    const identity = en
      ? `Your seat is ${actor}. At session creation, your true role is ${name[locale][r]}.`
      : `你的编号是${actor}号。本会话建立时，你的真实身份是${name[locale][r]}。`;
    must(text.includes(identity), "initial_identity");
    const m = (
      en ? /established, excluding yourself: ([^.]+)\./ : /队友（不含你自己）的编号：([^。]+)。/
    ).exec(text);
    must(m, "initial_teammates_missing");
    const none = en ? "None" : "无";
    if (r === "awakened_seer") must(m[1] === none, "initial_teammates");
    else {
      const first = byActor.get(actor)?.[0],
        known = first ? fragrantKnownAt(first).knownWolfId : null;
      must(m[1] === none || (known !== null && m[1] === String(known)), "initial_teammates");
    }
  };
  const current = (actor: number, ord: number, prompt: string, mark = false) => {
    privacy(actor, prompt);
    const d = decision(actor, ord),
      r = role(actor);
    must(ordinal(prompt) === ord, "ordinal");
    must(
      prompt.includes(en ? `[Action prompt] Player ${actor},` : `[行动提示] ${actor}号玩家`),
      "actor",
    );
    must(prompt.includes(en ? `Current game day: ${d.day}.` : `当前日次：第${d.day}天。`), "day");
    if (r === "fragrant_phantom" || r === "awakened_seer") {
      const identity = en
        ? `Current role: ${name[locale][r]}; alignment: ${r === "fragrant_phantom" ? "Werewolves" : "Good"}.`
        : `本轮身份：${name[locale][r]}；阵营：${r === "fragrant_phantom" ? "狼人" : "好人"}。`;
      must(prompt.includes(identity), "current_identity");
      const known = r === "fragrant_phantom" ? fragrantKnownAt(d) : null;
      const mate =
        known?.knownWolfId === null || !known ? (en ? "None" : "无") : String(known.knownWolfId);
      must(
        prompt.includes(
          en
            ? `Wolf teammate identities revealed for this turn, excluding yourself: ${mate}.`
            : `本轮规则告知你的狼人队友编号（不含本人）：${mate}。`,
        ),
        "current_teammates",
      );
      if (r === "fragrant_phantom")
        must(equal(jsonAt(prompt, statusMarker[locale]), known), "known_state");
      else {
        const state = pairAt(d),
          used = state.history.at(-1)?.day === d.day;
        const prefix = en
          ? `Ability native:pair_check: Pair inspection; status=${used ? "This night's opportunity has ended" : "Effective"}; uses remaining=Unlimited; your resources and records=`
          : `能力 native:pair_check：双目标查验；状态=${used ? "本夜机会已结束" : "已生效"}；剩余使用次数=不限次数；本人资源与记录=`;
        must(equal(jsonAt(prompt, prefix), state), "pair_state");
      }
      if (d.stage === "fragrant_bind")
        must(
          prompt.includes('bind_fragrant_pair args: {"target_ids":[number,number]|null}'),
          "bind_hint",
        );
      if (d.stage === "pair_inspection")
        must(prompt.includes('check_pair args: {"target_ids":[number,number]}'), "pair_hint");
    }
    if (mark) covered.add(`${actor}/${ord}`);
  };
  const events = (actor: number, ord: number, actual: Tuple[], kind: "sdk" | "acp") => {
    const all = decision(actor, ord).request.context.visible_events,
      before = byActor.get(actor)?.[ord - 2]?.request.context.visible_events.length ?? 0;
    const tuples = all.map((e) => [e.seq, e.type, e.payload] as Tuple),
      delta = tuples.slice(before);
    must(delta.length <= 96, "test_window");
    if (kind === "acp") must(equal(actual, delta), "delta");
    else {
      const start = actual[0]?.[0] ?? all.length + 1;
      if (actual.length) must(equal(actual, tuples.slice(start - 1)), "suffix");
      if (delta.length) must(actual.length && start <= before + 1, "missing_delta");
    }
    for (const [, type, p] of actual)
      if (type.startsWith("fragrant_")) {
        must(
          ["fragrant_pair_chosen", "fragrant_pair_inspected", "fragrant_night_notified"].includes(
            type,
          ),
          "god_fact_exposed",
        );
        must(p.actorId === actor, "foreign_fact");
        must(
          role(actor) ===
            (type === "fragrant_pair_inspected" ? "awakened_seer" : "fragrant_phantom"),
          "foreign_fact",
        );
      }
  };
  for (const wire of run.sdkWireMessages) {
    const messages = wire.messages as Array<{ role: string; content: unknown }>;
    const system = messages.filter((m) => m.role === "system");
    must(system.length === 1 && typeof system[0]!.content === "string", "initial_missing");
    init(wire.actor, system[0]!.content as string);
    const prompts = messages.filter(
      (m) =>
        m.role === "user" &&
        typeof m.content === "string" &&
        /\[Action prompt\]|\[行动提示\]/.test(m.content),
    );
    must(prompts.length, "current_missing");
    current(wire.actor, wire.ordinal, prompts.at(-1)!.content as string, true);
    for (const m of messages) {
      if (typeof m.content === "string") privacy(wire.actor, m.content);
    }
    for (const m of prompts) {
      const p = m.content as string;
      must(ordinal(p) <= wire.ordinal, "future_history");
      current(wire.actor, ordinal(p), p);
    }
    const tuples = messages.flatMap((m) =>
      typeof m.content === "string" && m.content.startsWith('{"event":')
        ? [JSON.parse(m.content).event as Tuple]
        : [],
    );
    events(wire.actor, wire.ordinal, tuples, "sdk");
  }
  for (const { actor, trace } of run.acpTraces) {
    const prompts = trace.prompts.filter((p) => /(?:Current turn ID: |当前回合 ID：)t\d+/.test(p));
    const initials = trace.prompts.filter(
      (p) => !/(?:Current turn ID: |当前回合 ID：)t\d+/.test(p),
    );
    must(initials.length === 1, "initial_missing");
    init(actor, initials[0]!);
    must(
      prompts.length === trace.arrivals.length && prompts.length === trace.activeSchemas.length,
      "arrivals_missing",
    );
    for (const [i, prompt] of prompts.entries()) {
      const ord = trace.arrivals[i]!.actorOrdinal;
      current(actor, ord, prompt, true);
      const tuples = prompt.split("\n").flatMap((line) => {
        const n = line.indexOf('{"events":');
        return n < 0 ? [] : (JSON.parse(line.slice(n)).events as Tuple[]);
      });
      events(actor, ord, tuples, "acp");
      must(trace.activeSchemas[i]!.actorOrdinal === ord, "schema_ordinal");
      must(
        equal(trace.activeSchemas[i]!.body, { protocol_version: "1", tools: schema[locale] }),
        "schema",
      );
    }
  }
  for (const [actor, ds] of byActor)
    for (let ord = 1; ord <= ds.length; ord++) must(covered.has(`${actor}/${ord}`), "coverage");
}
