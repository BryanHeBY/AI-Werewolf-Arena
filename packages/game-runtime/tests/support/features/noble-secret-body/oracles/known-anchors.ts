/**
 * 持有真实 Noble／Body 当前提示中的手写跨夜知识锚点，与生产投影分开。输入为实际消息、请求前缀、快照或原本地端点及显式预期，输出为原断言与拒绝诊断；各层测试沿用独立标记和已录前缀，不从生产身份、观察或板子算法生成结果预期。
 */
import { expect } from "bun:test";
import { noblePromptStatus, type NobleWireRun } from "./wire";
import { type nobleTransportScenario } from "../builders/transport-plan";
/**
 * 真实当前提示中的跨夜检查点由手写提供，与 feed 折叠相互独立。
 */
export function assertNobleKnownAnchors(
  run: NobleWireRun,
  s: ReturnType<typeof nobleTransportScenario>,
) {
  const map = (old: number) => s.mapping.get(old)!,
    rows: Array<{ actor: number; ordinal: number; prompt: string }> = [];
  for (const w of run.sdkWireMessages) {
    const prompt = [...w.messages]
      .reverse()
      .map((m) => m as { role: string; content: unknown })
      .find(
        (m) =>
          m.role === "user" &&
          typeof m.content === "string" &&
          /\[Action prompt\]|\[行动提示\]/.test(m.content),
      )!.content as string;
    rows.push({ actor: w.actor, ordinal: w.ordinal, prompt });
  }
  for (const { actor, trace } of run.acpTraces) {
    const prompts = trace.prompts.filter((p) => /(?:Current turn ID: |当前回合 ID：)t\d+/.test(p));
    for (const [i, prompt] of prompts.entries())
      rows.push({ actor, ordinal: trace.arrivals[i]!.actorOrdinal, prompt });
  }
  const anchor = (old: number, day: number, stage: string, state: Record<string, unknown>) => {
    let hits = 0;
    for (const r of rows) {
      if (r.actor !== map(old)) continue;
      const d = run.record.decisions.filter((d) => d.actorId === r.actor)[r.ordinal - 1]!;
      if (d.day !== day || d.stage !== stage) continue;
      expect(noblePromptStatus(r.prompt)).toEqual(state);
      hits++;
    }
    expect(hits).toBeGreaterThan(0);
  };
  const body = (
    night: number,
    resource: string,
    awaiting: boolean,
    publicRevealDay: number | null = null,
  ) => ({
    protectionRepeatPolicy: s.board.config.awakenedIdiot!.protectionRepeatPolicy,
    lastNotifiedNight: night,
    lastChoice: { day: s.name === "badge_reveal" ? 1 : 3, targetId: map(6) },
    resource,
    publicRevealDay,
    awaitingNightReport: awaiting,
  });
  const noble = (night: number, status: "pending" | "expired" | "cleared", terminal?: number) => ({
    wolfActionPolicy: s.board.config.nightNoble!.wolfActionPolicy,
    lastNotifiedNight: night,
    lastChoice: { day: 2, targetId: map(6) },
    contracts: [
      {
        id: "servant:night:2",
        targetId: map(6),
        createdNight: 2,
        expiresNight: 3,
        status: status === "pending" ? { kind: status } : { kind: status, day: terminal },
      },
    ],
    awaitingNightReport: false,
  });
  if (s.name === "expiry") {
    anchor(5, 3, "day_speech", body(3, "intact", true));
    anchor(5, 4, "day_speech", body(4, "spent", true));
    anchor(1, 3, "wolf_discussion", noble(3, "pending"));
    anchor(1, 4, "wolf_discussion", noble(4, "expired", 3));
  }
  if (s.name === "new_and_old_clear") {
    anchor(1, 2, "day_speech", { ...noble(2, "pending"), awaitingNightReport: true });
    anchor(1, 3, "wolf_discussion", noble(3, "cleared", 2));
  }
  if (s.name === "badge_reveal") {
    anchor(5, 1, "awakened_idiot_reveal_speech", body(1, "exile_revealed", false, 1));
    anchor(5, 2, "day_speech", body(2, "exile_revealed", false, 1));
  }
}
