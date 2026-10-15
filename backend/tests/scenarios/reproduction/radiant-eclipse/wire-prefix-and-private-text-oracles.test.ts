/**
 * 录制对局场景以独立预期检查当前协议前缀和提供者文本隐私。输入为原手写流光板录制计划，以及事件 tuple／SDK／ACP 提示数据篡改；字面前缀和隐私拒绝断言构成预期。
 * 真实阶段／Tape 录制及原文件系统清理保留，不调用模型。
 */
import { expect, test } from "bun:test";
import {
  assertRadiantWireEvents,
  assertRadiantTransportWire,
} from "../../../support/features/radiant-eclipse/oracles/wire";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";

test("actual serialized wire must be a current independently validated request prefix", async () => {
  const record = await radiantRecording({ planName: "independent-stock-card16-card17" });
  const decisions = record.decisions.filter((d) => d.actorId === 1),
    ordinal = decisions.findIndex((d) => d.day === 2 && d.stage === "witch") + 1;
  const visible = decisions[ordinal - 1]!.request.context.visible_events;
  const tuples = visible.map(
    (e) => [e.seq, e.type, e.payload] as [number, string, Record<string, unknown>],
  );
  expect(() => assertRadiantWireEvents(record, 1, ordinal, tuples)).not.toThrow();
  for (const change of [
    (t: typeof tuples) => {
      t[0]![0] = 0;
    },
    (t: typeof tuples) => {
      t[0]![1] = "game_over";
    },
    (t: typeof tuples) => {
      t.find((e) => e[1] === "eclipse_swallowed")![2].day = 3;
    },
    (t: typeof tuples) => {
      t.find((e) => e[1] === "eclipse_swallowed")![2].roleId = "seer";
    },
    (t: typeof tuples) => {
      t.find((e) => e[1] === "ability_changed")![2].sourceHistory = "SOURCE_HISTORY_PRIVATE";
    },
    (t: typeof tuples) => {
      t.push(t[0]!);
    },
    (t: typeof tuples) => {
      t.push([t.length + 1, "seer_checked", { actorId: 1, targetId: 2, isWerewolf: false }]);
    },
  ]) {
    const changed = structuredClone(tuples);
    change(changed);
    expect(() => assertRadiantWireEvents(record, 1, ordinal, changed)).toThrow();
  }
});

test("complete SDK history and ACP prompts reject donor private text outside event tuples", async () => {
  const record = await radiantRecording({ planName: "independent-stock-card16-card17" });
  const decisions = record.decisions.filter((d) => d.actorId === 1),
    ordinal = decisions.findIndex((d) => d.day === 2 && d.stage === "witch") + 1;
  const events = decisions[ordinal - 1]!.request.context.visible_events.map((e) => [
    e.seq,
    e.type,
    e.payload,
  ]);
  for (const kind of ["sdk", "acp"] as const) {
    const wire = (extra: string) => ({
      record,
      sdkWireMessages:
        kind === "sdk"
          ? [
              {
                actor: 1,
                ordinal,
                messages: [
                  ...events.map((event) => ({ role: "user", content: JSON.stringify({ event }) })),
                  { role: "user", content: extra },
                ],
              },
            ]
          : [],
      acpTraces:
        kind === "acp"
          ? [
              {
                actor: 1,
                trace: {
                  prompts: [`Current turn ID: t1\n${JSON.stringify({ events })}\n${extra}`],
                  arrivals: [{ actorOrdinal: ordinal }],
                },
              },
            ]
          : [],
    });
    expect(() => assertRadiantTransportWire(wire(""))).not.toThrow();
    expect(() =>
      assertRadiantTransportWire(
        wire('Original owner history: [{"canary":"SOURCE_HISTORY_PRIVATE","targetId":8}]'),
      ),
    ).toThrow();
    expect(() => assertRadiantTransportWire(wire("SOURCE_HISTORY_PRIVATE_ACTOR_7"))).toThrow();
  }
});
