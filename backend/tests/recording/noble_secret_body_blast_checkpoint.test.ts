import { expect, test } from "bun:test";
import { recordNobleLiteral } from "../support/noble_secret_body_recording";
import { Phase, Camp } from "../../src/core";
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
