import type { ReproductionRecord } from "../../src/recording/reproduction";
type Tuple = [number, string, Record<string, unknown>];
/** Compare actual serialized transport events to the independent, strictly validated ledger's
 * request prefix. A final archive alone cannot prove what was sent during an earlier turn. */
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
