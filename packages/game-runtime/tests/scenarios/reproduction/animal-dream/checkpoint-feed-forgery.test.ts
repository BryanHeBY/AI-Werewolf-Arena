/**
 * 复现场景验证动物梦境 checkpoint 与信息流伪造不能违背真实已终结录制对局。
 * 输入为原 beforeAll 对局生成归档，以及独立受众、终局 checkpoint 或警徽副本篡改。
 * 输出与预期为字面原记录接收和伪造拒绝，保留共享因果设置；生成记录是测试输入，不是独立计算的预期状态。
 */
import { beforeAll, expect, test } from "bun:test";
import { recordAnimalLiteral } from "../../../support/features/animal-dream/drivers/recording";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
let baseline: any;
beforeAll(async () => {
  baseline = (await recordAnimalLiteral("fox_beauty", "en")).record;
}, 10000);
const copy = () => structuredClone(baseline);
const reject = (r: any) =>
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
test("A original finalized natural archive remains accepted before CP/feed mutants", () =>
  expect(() => {
    parseReproductionRecord(copy());
  }).not.toThrow());
test("A full feed cannot authorize villager wolf-team order through co-tampered original audience", () => {
  const r = copy(),
    i = r.events.findIndex((e: any) => e.type === "wolf_tactical_order"),
    event = r.events[i];
  expect(event).toBeDefined();
  expect(event.audience.includes(5)).toBe(false);
  expect(r.metadata.players.find((p: any) => p.id === 5).role).toBe("villager");
  event.audience.push(5);
  event.audience.sort((a: number, b: number) => a - b);
  let copies = 0;
  for (const d of r.decisions)
    if (d.actorId === 5 && d.openedAtEventCount > i) {
      const feed = d.request.context.visible_events;
      expect(feed[0]).toMatchObject({ type: "phase_changed", payload: { phase: "night", day: 1 } });
      // 在首夜首次战术顺序处，此前唯一公开事实是初始 Night1。
      feed.splice(1, 0, { seq: 2, type: event.type, payload: structuredClone(event.payload) });
      feed.forEach((e: any, n: number) => (e.seq = n + 1));
      copies++;
    }
  expect(copies).toBeGreaterThan(0);
  reject(r);
});
test("A terminal complete CP cannot disagree with actual game_over and termination", () => {
  const r = copy(),
    cp = r.checkpoints.at(-1);
  expect(cp.snapshot.gameOver).toBe(true);
  cp.snapshot = { day: 55, phase: "night", gameOver: false, result: null };
  reject(r);
});
test("A final CP cannot fabricate a living sheriff badge and vote weight absent election", () => {
  const r = copy(),
    p = r.checkpoints.at(-1).players.find((p: any) => p.id === 5);
  expect(p.badge.isSheriff).toBe(false);
  p.badge.isSheriff = true;
  p.vote.weight = 1.5;
  reject(r);
});
