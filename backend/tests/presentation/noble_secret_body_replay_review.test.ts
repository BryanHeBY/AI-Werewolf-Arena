import { expect, test } from "bun:test";
import { ScriptEventRenderRegistry } from "../../src/game/mechanisms/script/event_render_registry";
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
test("live rendering hides owner and God facts unless private display enabled; public reveal remains", () => {
  const registry = new ScriptEventRenderRegistry();
  for (const e of [...facts, reveal])
    for (const locale of ["zh-CN", "en"] as const) {
      const event = { type: e.type, payload: e.payload, timestamp: 1 } as any,
        isPublic = e.type === "secret_body_revealed" || e.type === "secret_body_reveal_speech",
        isGod = e.type === "noble_contract_closed" || e.type === "secret_body_blocked";
      const judge = registry.toJudgeLine(event, locale);
      expect(judge).not.toBeNull();
      if (judge === null) throw Error("noble_label_missing");
      expect(registry.toLiveRender(event, false, locale)).toEqual(
        isPublic ? [{ kind: "system", text: judge }] : [],
      );
      expect(registry.toLiveRender(event, true, locale)).toEqual([
        { kind: isPublic ? "system" : isGod ? "god" : "private", text: judge },
      ]);
    }
});
