/**
 * Reproduction scenarios verify a real Noble pre-vote self-destruct checkpoints the completed night and pending servant contract before restart.
 * Input: The original controlled Noble recording plan and declared Night2 blast day.
 * Output and oracle: Literal next-night snapshot, absent vote, preserved contract and terminal replay assertions stay causal with the source game; archive fixtures are unchanged.
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
