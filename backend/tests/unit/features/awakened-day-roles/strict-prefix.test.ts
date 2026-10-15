/**
 * 单元测试负责真实SDK整局及续窗缺失Tape的严格解析反例。输入合成传输driver原字节档，输出实际parser接受与精确篡改拒绝。
 * 原样本保存运行时WIP source身份；这里不改fingerprint、不声称当前源码同构建执行，仅核归档规则和失败前缀。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
const load = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../../support/features/awakened-day-roles/fixtures/${name}.reproduction.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
function erase(r: any, type: string) {
  for (let i = 0; i < r.events.length; i++)
    if (r.events[i].type === type) {
      r.events[i] = {
        type: "phase_changed",
        timestamp: r.events[i].timestamp,
        payload: { day: r.events[i].payload.day, phase: "day" },
      };
      break;
    }
  for (const d of r.decisions)
    d.request.context.visible_events = d.request.context.visible_events
      .filter((e: any) => e.type !== type)
      .map((e: any, i: number) => ({ ...e, seq: i + 1 }));
}
test("两份真实原字节normal/error可经完整schema与所有独立verifier", () => {
  for (const name of ["body-shield-complete", "continuation-missing"])
    expect(() => parseReproductionRecord(load(name))).not.toThrow();
});
for (const [name, mutate] of [
  ["不能藏亮牌", (r: any) => erase(r, "awakened_protection_revealed")],
  ["不能藏公开阻挡", (r: any) => erase(r, "awakened_protection_blocked")],
  [
    "延期词顺序不能互换",
    (r: any) => {
      const swap = (id: number) => (id === 8 ? 12 : id === 12 ? 8 : id);
      for (const e of r.events)
        if (
          ["last_words_granted", "last_words_spoken"].includes(e.type) &&
          [8, 12].includes(e.payload.playerId)
        )
          e.payload.playerId = swap(e.payload.playerId);
      for (const d of r.decisions) {
        if (d.stage === "last_words" && [8, 12].includes(d.actorId)) {
          d.actorId = swap(d.actorId);
          d.request.actorId = d.actorId;
        }
        for (const e of d.request.context.visible_events)
          if (
            ["last_words_granted", "last_words_spoken"].includes(e.type) &&
            [8, 12].includes(e.payload.playerId)
          )
            e.payload.playerId = swap(e.payload.playerId);
      }
    },
  ],
  [
    "成功链不能漏实际词",
    (r: any) => {
      const e = r.events.find(
        (e: any) => e.type === "last_words_spoken" && e.payload.playerId === 8,
      );
      e.type = "phase_changed";
      e.payload = { day: 1, phase: "day" };
      for (const d of r.decisions)
        d.request.context.visible_events = d.request.context.visible_events
          .filter((e: any) => !(e.type === "last_words_spoken" && e.payload.playerId === 8))
          .map((e: any, i: number) => ({ ...e, seq: i + 1 }));
    },
  ],
  [
    "失败不能复活已发表死亡",
    (r: any) => {
      const cp = r.checkpoints.at(-1);
      cp.complete = false;
      cp.players.find((p: any) => p.id === 8).alive = true;
    },
  ],
  [
    "失败无提案不能杀新目标",
    (r: any) => {
      const cp = r.checkpoints.at(-1);
      cp.complete = false;
      cp.players.find((p: any) => p.id === 4).alive = false;
    },
  ],
  [
    "失败不能退款已付盾",
    (r: any) => {
      const cp = r.checkpoints.at(-1);
      cp.complete = false;
      cp.players.find((p: any) => p.id === 5).privateState.awakenedGuard.cycles[0] = {
        day: 1,
        status: "unused",
      };
    },
  ],
  [
    "不能把God细因纳入玩家feed",
    (r: any) => {
      const d = r.decisions.find((d: any) => d.stage === "awakened_duel_continue");
      const god = r.events.find((e: any) => e.type === "awakened_protection_block_detail");
      d.request.context.visible_events.push({
        seq: d.request.context.visible_events.length + 1,
        type: god.type,
        payload: god.payload,
      });
    },
  ],
] as const)
  test(name, () => {
    const r = load("body-shield-complete");
    mutate(r);
    expect(() => parseReproductionRecord(r)).toThrow();
  });
test("真实missing续窗不补链末、延期词或退款已付尝试", () => {
  const r = load("continuation-missing"),
    last = r.checkpoints.at(-1),
    k = last.players.find((p: any) => p.id === 7);
  expect(last.complete).toBe(false);
  expect(k.privateState.awakenedKnight.attempts).toHaveLength(1);
  expect(r.events.some((e: any) => e.type === "awakened_duel_chain_ended")).toBe(false);
  k.privateState.awakenedKnight.attempts = [];
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("真实Good同波按原提案Knight→target定序，不能连死亡和词一起倒置", () => {
  const r = load("good-dual-commit-chain-end-error");
  expect(() => parseReproductionRecord(r)).not.toThrow();
  expect(r.events.find((e: any) => e.type === "awakened_duel_resolved").payload.deaths).toEqual([
    7, 6,
  ]);
  const swap = (id: number) => (id === 7 ? 6 : id === 6 ? 7 : id);
  for (const e of r.events) {
    if (e.type === "awakened_duel_resolved") e.payload.deaths.reverse();
    if (
      ["last_words_granted", "last_words_spoken"].includes(e.type) &&
      [7, 6].includes(e.payload.playerId)
    )
      e.payload.playerId = swap(e.payload.playerId);
  }
  for (const d of r.decisions) {
    if (d.stage === "last_words" && [7, 6].includes(d.actorId)) {
      d.actorId = swap(d.actorId);
      d.request.actorId = d.actorId;
    }
    for (const e of d.request.context.visible_events) {
      if (e.type === "awakened_duel_resolved") e.payload.deaths.reverse();
      if (
        ["last_words_granted", "last_words_spoken"].includes(e.type) &&
        [7, 6].includes(e.payload.playerId)
      )
        e.payload.playerId = swap(e.payload.playerId);
    }
  }
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_awakened_day_roles_invalid");
});
test("真实黎明合波自爆必须有已接受confirm与实际空结果，不能跨正常次夜隐藏", () => {
  const base = load("dawn-blast-shield-complete");
  expect(() => parseReproductionRecord(base)).not.toThrow();
  const noAction = structuredClone(base),
    d = noAction.decisions.find(
      (d: any) => d.outcome.kind === "action" && d.outcome.action?.name === "self_destruct",
    );
  d.outcome.action = null;
  expect(() => parseReproductionRecord(noAction)).toThrow(
    "reproduction_awakened_day_roles_invalid",
  );
  const noResult = structuredClone(base);
  erase(noResult, "awakened_self_destruct_resolved");
  expect(() => parseReproductionRecord(noResult)).toThrow(
    "reproduction_awakened_day_roles_invalid",
  );
  const fakeNight = structuredClone(base);
  fakeNight.events.find((e: any) => e.type === "night_resolved").payload.deaths.push(8);
  expect(() => parseReproductionRecord(fakeNight)).toThrow(
    "reproduction_awakened_day_roles_invalid",
  );
});
test("自爆原窗口须绑定Day/Voting映射及板子enabledWindows", () => {
  const base = load("dawn-blast-shield-complete");
  const wrongPhase = structuredClone(base);
  for (const d of wrongPhase.decisions) {
    if (d.outcome.kind === "action" && d.outcome.action?.name === "self_destruct") {
      d.stage = "on_pre_vote";
      d.request.context.stage = "on_pre_vote";
    }
    for (const e of d.request.context.visible_events)
      if (e.type.startsWith("awakened_self_destruct_")) e.payload.window = "on_pre_vote";
  }
  for (const e of wrongPhase.events)
    if (e.type.startsWith("awakened_self_destruct_")) e.payload.window = "on_pre_vote";
  expect(() => parseReproductionRecord(wrongPhase)).toThrow(
    "reproduction_awakened_day_roles_invalid",
  );
  const disabled = structuredClone(base);
  disabled.metadata.normalizedBoard.selfDestruct.enabledWindows = ["on_pre_vote"];
  expect(() => parseReproductionRecord(disabled)).toThrow(
    "reproduction_awakened_day_roles_invalid",
  );
});
