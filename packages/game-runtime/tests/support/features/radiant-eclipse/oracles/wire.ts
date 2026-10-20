/**
 * 持有传输预期检查：比较实际序列化事件前缀与独立验证的请求账本，不调用生产观察算法。输入为实际消息、请求前缀、快照或原本地端点及显式预期，输出为原断言与拒绝诊断；各层测试沿用独立标记和已录前缀，不从生产身份、观察或板子算法生成结果预期。
 */
import type { ReproductionRecord } from "../../../../../src/recording/reproduction/format";
type Tuple = [number, string, Record<string, unknown>];
/**
 * 将实际序列化的传输事件与独立且已严格验证账本的请求前缀比较；最终档案本身不能证明更早回合实际发送了什么。
 */
export function assertRadiantWireEvents(
  record: ReproductionRecord,
  actor: number,
  ordinal: number,
  events: Tuple[],
) {
  const decision = record.decisions.filter((d) => d.actorId === actor)[ordinal - 1];
  if (!decision) throw Error("fixture_radiant_wire_request_missing");
  const expected = decision.request.context.visible_events;
  const seen = new Set<number>();
  for (const [seq, type, payload] of events) {
    if (!Number.isSafeInteger(seq) || seq < 1 || seen.has(seq))
      throw Error("fixture_radiant_wire_sequence_invalid");
    seen.add(seq);
    const source = expected[seq - 1];
    if (
      !source ||
      source.seq !== seq ||
      source.type !== type ||
      JSON.stringify(source.payload) !== JSON.stringify(payload)
    )
      throw Error("fixture_radiant_wire_prefix_mismatch");
  }
}
export function radiantEventTuples(text: string): Tuple[] {
  return text.split("\n").flatMap((line) => {
    const index = line.indexOf('{"events":');
    return index < 0 ? [] : (JSON.parse(line.slice(index)).events as Tuple[]);
  });
}
export function assertRadiantTransportWire(run: {
  record: ReproductionRecord;
  sdkWireMessages: Array<{ actor: number; ordinal: number; messages: unknown[] }>;
  acpTraces: Array<{
    actor: number;
    trace: { prompts: string[]; arrivals: Array<{ actorOrdinal: number }> };
  }>;
}) {
  const privateText = (actor: number, content: string) => {
    const authorized = `SOURCE_HISTORY_PRIVATE_ACTOR_${actor}`;
    if (content.replaceAll(authorized, "").includes("SOURCE_HISTORY_PRIVATE"))
      throw Error("fixture_radiant_source_history_text_exposed");
  };
  for (const actor of [4, 7, 8, 9]) {
    const sdk = run.sdkWireMessages.filter((w) => w.actor === actor);
    const acp = run.acpTraces.find((t) => t.actor === actor);
    if (!sdk.length && !acp) continue;
    if (
      !JSON.stringify([sdk, acp?.trace.prompts]).includes(`SOURCE_HISTORY_PRIVATE_ACTOR_${actor}`)
    )
      throw Error("fixture_radiant_source_marker_missing");
  }
  for (const wire of run.sdkWireMessages) {
    privateText(wire.actor, JSON.stringify(wire.messages));
    const events = wire.messages.flatMap((message) => {
      const content = (message as { content?: unknown }).content;
      return typeof content === "string" && content.startsWith('{"event":')
        ? [JSON.parse(content).event as Tuple]
        : [];
    });
    assertRadiantWireEvents(run.record, wire.actor, wire.ordinal, events);
  }
  for (const { actor, trace } of run.acpTraces) {
    for (const prompt of trace.prompts) privateText(actor, prompt);
    const prompts = trace.prompts.filter((p) => /(?:Current turn ID: |当前回合 ID：)t\d+/.test(p));
    if (prompts.length !== trace.arrivals.length)
      throw Error("fixture_radiant_wire_arrival_missing");
    for (const [index, prompt] of prompts.entries())
      assertRadiantWireEvents(
        run.record,
        actor,
        trace.arrivals[index]!.actorOrdinal,
        radiantEventTuples(prompt),
      );
  }
}
