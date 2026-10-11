// Independent readonly reviewer cases; original inputs retained.
import { expect, test } from "bun:test";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
import { NOBLE_SECRET_BODY_POLICY as policy } from "@ai-werewolf-arena/game-text";
const row = (type: string, payload: any, phase = "night", day = payload.day, seq = 1) => ({
  seq,
  type,
  payload,
  day,
  phase,
  timestamp: "2026-10-12T00:00:00.000Z",
  stage: type,
});
const reveal = row("secret_body_revealed", { policy, actorId: 5, day: 1 }, "voting");
const speech = row(
  "secret_body_reveal_speech",
  { policy, actorId: 5, day: 1, text: "I remain alive." },
  "voting",
);
const facts = [
  row("noble_servant_chosen", {
    policy,
    actorId: 1,
    day: 2,
    targetId: 6,
    contractId: "servant:night:2",
  }),
  row("secret_body_chosen", { policy, actorId: 5, day: 1, targetId: 6 }),
  row("noble_contract_closed", {
    policy,
    actorId: 1,
    day: 3,
    contractId: "servant:night:2",
    targetId: 6,
    createdNight: 2,
    expiresNight: 3,
    status: "expired",
    proposedCause: "servant_expiry",
  }),
  row(
    "noble_contract_closed",
    {
      policy,
      actorId: 1,
      day: 2,
      contractId: "servant:night:2",
      targetId: 6,
      createdNight: 2,
      expiresNight: 3,
      status: "target_dead",
    },
    "day",
  ),
  row("secret_body_blocked", { policy, actorId: 5, day: 1, targetId: 6, cause: "wolf_kill" }),
  row("noble_night_notified", {
    policy,
    actorId: 1,
    day: 3,
    wolfActionPolicy: "standard",
    lastNotifiedNight: 3,
    lastChoice: { day: 2, targetId: 6 },
    contracts: [
      {
        id: "servant:night:2",
        targetId: 6,
        createdNight: 2,
        expiresNight: 3,
        status: { kind: "cleared", day: 2 },
      },
    ],
  }),
  row("secret_body_night_notified", {
    policy,
    actorId: 5,
    day: 2,
    protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
    lastNotifiedNight: 2,
    lastChoice: { day: 1, targetId: 6 },
    resource: "spent",
    publicRevealDay: null,
  }),
  speech,
];
test("public living reveal decoder produces role-only effect", () => {
  expect(readReplayEvent(reveal as any, [1, 5, 6])?.effects).toEqual([
    { kind: "role_revealed", playerId: 5, role: "awakened_idiot" },
  ]);
});
test("public living reveal gets Chinese and English labels", () => {
  expect(eventLabel(reveal as any, "zh-CN", [1, 5, 6])).toContain("觉醒愚者");
  expect(eventLabel(reveal as any, "en", [1, 5, 6])).toContain("Awakened Village Idiot");
});
test("living reveal preserves alive and badge while showing public identity", () => {
  const doc = {
    players: [1, 5, 6].map((player_id) => ({
      player_id,
      name: `Player ${player_id}`,
      role: "unknown",
      camp: "unknown",
    })),
    events: [
      row("sheriff_elected", { winnerId: 5, candidates: [5] }, "day", 1, 1),
      { ...reveal, seq: 2 },
    ],
  };
  const before = buildReplaySnapshot(doc as any, 0),
    after = buildReplaySnapshot(doc as any, 1);
  expect(before.players.find((p) => p.playerId === 5)).toMatchObject({
    alive: true,
    isSheriff: true,
  });
  expect(after.players.find((p) => p.playerId === 5)).toMatchObject({
    alive: true,
    isSheriff: true,
    publicRole: "awakened_idiot",
  });
});
test("choices/closed/block/notices/speech are legal yet never mutate death or badge", () => {
  for (const fact of facts) expect(readReplayEvent(fact as any, [1, 5, 6])?.effects).toEqual([]);
});
test("all strict known facts reject wrong public phase or extra fields with no partial effects", () => {
  for (const e of [...facts, reveal]) {
    expect(
      readReplayEvent({ ...e, payload: { ...e.payload, camp: "wolf" } } as any, [1, 5, 6]),
    ).toBeNull();
    expect(readReplayEvent({ ...e, day: e.day + 1 } as any, [1, 5, 6])).toBeNull();
  }
  expect(readReplayEvent({ ...reveal, phase: "night" } as any, [1, 5, 6])).toBeNull();
});
