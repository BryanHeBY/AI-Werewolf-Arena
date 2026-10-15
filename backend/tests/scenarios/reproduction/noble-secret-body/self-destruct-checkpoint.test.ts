/**
 * 复现场景验证夜之贵族真实投票前自爆在重启前对已完成夜晚和待处理夜仆契约写 checkpoint。
 * 输入为原受控夜之贵族录制计划及声明的 Night2 自爆日。
 * 输出与预期为字面下一夜快照、没有投票、保留契约及终局重放断言，与来源对局保持因果对应；归档 fixture 不变。
 */
import { expect, test } from "bun:test";
import { recordNobleLiteral } from "../../../support/features/noble-secret-body/drivers/recording";
import { Phase, Camp } from "../../../../src/domain";
test("actual Noble pre-vote blast checkpoint uses completed night and preserves pending contract", async () => {
  const { record, replay } = await recordNobleLiteral("blast_skips_vote", "en", { blastDay: 2 }),
    cp = record.checkpoints[2]!;
  expect(cp.snapshot).toEqual({ day: 3, phase: Phase.Night, gameOver: false, result: null });
  expect(record.decisions.some((d) => d.day === 2 && d.stage === "voting")).toBe(false);
  expect(
    record.events.filter((e) => e.type === "wolf_self_destruct").map((e) => e.payload.wolfId),
  ).toEqual([1]);
  expect(cp.nobleBody!.noble.contracts).toEqual([
    {
      id: "servant:night:2",
      targetId: 6,
      createdNight: 2,
      expiresNight: 3,
      status: { kind: "pending" },
    },
  ]);
  expect(record.checkpoints[3]!.nobleBody!.noble.contracts[0]!.status).toEqual({
    kind: "expired",
    day: 3,
  });
  expect(record.checkpoints[3]!.nobleBody!.knowledge.noble.contracts[0]!.status).toEqual({
    kind: "pending",
  });
  expect(replay.snapshot.result!.winner).toBe(Camp.Good);
}, 30000);
