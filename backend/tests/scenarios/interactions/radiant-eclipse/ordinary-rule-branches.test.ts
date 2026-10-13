/**
 * Interaction scenarios verify ordinary wolf chat, abstention, self-destruct and exile PK branches remain valid inside a Radiant Eclipse recorded game.
 * Input: Original controlled providers, chat-round/window matrices and existing recording plans.
 * Output and oracle: Literal request/event counts, death sequences and next-night/terminal checkpoints retain actual causal execution; no unrelated unit or generic vote engine replaces these branches.
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
for (const rounds of [2, 3])
  test(`ordinary wolves continue ${rounds} real chat rounds and retain Tape`, async () => {
    const r = await radiantRecording({
      planName: "last-wolf-borrow-backlash",
      provider: (_game, manual) => ({
        getAction: (q) =>
          q.context.day === 1 && q.context.stage === "wolf_discussion"
            ? Promise.resolve({
                name: "speak_to_wolves",
                args: { text: "Continue", end_chat: rounds === 2 && q.context.round === 2 },
              })
            : manual.getAction(q),
      }),
    });
    expect(r.decisions.filter((d) => d.day === 1 && d.stage === "wolf_discussion")).toHaveLength(
      rounds * 3,
    );
    expect(r.events.filter((e) => e.type === "wolf_discussion").length).toBe(rounds === 2 ? 3 : 9);
    expect(r.checkpoints.at(-1)!.snapshot.result?.reason).toBe("all_wolves_eliminated");
  }, 120000);
test("an ordinary wolf abstains with an unused nonnull target", async () => {
  const r = await radiantRecording({
    planName: "borrowed-dream-death-badge-words",
    provider: (_game, manual) => ({
      getAction: (q) =>
        q.context.day === 1 && q.context.stage === "wolf_vote" && q.actorId === 10
          ? Promise.resolve({ name: "kill_vote", args: { target_id: 10, abstain: true } })
          : manual.getAction(q),
    }),
  });
  expect(
    r.events.find((e) => e.type === "wolf_kill_vote_cast" && e.payload.actorId === 10)?.payload,
  ).toEqual({ actorId: 10, targetId: 10, abstain: true });
  expect(r.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
}, 120000);
for (const window of ["on_pre_election", "on_pre_vote"] as const)
  test(`real ordinary self-blast at ${window} preserves queued next-night checkpoint`, async () => {
    const r = await radiantRecording({
      planName: "last-wolf-borrow-backlash",
      provider: (_game, manual) => ({
        getAction: (q) =>
          q.context.day === 1 && q.context.stage === window && q.actorId === 11
            ? Promise.resolve({
                name: "self_destruct",
                args: { reason: "Synthetic blast", confirm: true },
              })
            : manual.getAction(q),
      }),
    });
    expect(
      r.events.filter((e) => e.type === "wolf_self_destruct").map((e) => e.payload.wolfId),
    ).toEqual([11]);
    expect(
      r.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
    ).toEqual([[10], [12], [1, 6]]);
    expect(r.checkpoints[1]!.snapshot).toMatchObject({ day: 2, phase: "night", gameOver: false });
    expect(r.checkpoints.at(-1)!.snapshot.result?.reason).toBe("all_wolves_eliminated");
  }, 120000);
test("real one-round exile PK releases the primary tally before PK speeches", async () => {
  const r = await radiantRecording({
    planName: "last-wolf-borrow-backlash",
    provider: (_game, manual) => ({
      getAction: (q) => {
        if (q.context.day === 1 && q.context.stage === "voting")
          return Promise.resolve({
            name: "vote",
            args: {
              target_id: q.actorId === 12 ? null : q.actorId <= 5 ? 11 : 12,
              abstain: q.actorId === 12,
            },
          });
        if (q.context.day === 1 && q.context.stage === "exile_pk_vote")
          return Promise.resolve({ name: "vote", args: { target_id: 11, abstain: false } });
        return manual.getAction(q);
      },
    }),
  });
  expect(
    r.events.filter((e) => e.type === "exile_pk_started").map((e) => e.payload.candidates),
  ).toEqual([[11, 12]]);
  expect(r.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
}, 120000);
