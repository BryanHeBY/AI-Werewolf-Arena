// Independent readonly reviewer cases; original inputs retained.
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Role,
  Phase,
  Camp,
  COMPONENT,
  PotionType,
  type ActionRequest,
  type ToolCall,
} from "../../../src/core/index";
import { nobleSecretBodyTwelveConfig } from "../../../src/runtime/scenarios/noble_secret_body_twelve";
import { demonNightChoice } from "../../support/demon_hunter_scenarios";
import { snapshotNobleBodyAuthority } from "../../../src/game/mechanisms/roles/noble_secret_body/authority";
const game = () => {
  const c = nobleSecretBodyTwelveConfig();
  return bootstrapGame(c, {
    fixedRoles: c.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
  });
};
type Plan = {
  body?: number | null;
  servant?: number | null;
  knife?: number | null;
  hunt?: number | null;
  potion?: { target: number; type: PotionType };
  exile?: number | null;
};
function call(r: ActionRequest, p: Plan): ToolCall | null {
  if (r.allowedTools.includes("protect_secret_body"))
    return { name: "protect_secret_body", args: { target_id: p.body ?? null } };
  if (r.allowedTools.includes("choose_servant"))
    return { name: "choose_servant", args: { target_id: p.servant ?? null } };
  if (r.allowedTools.includes("check_identity"))
    return { name: "check_identity", args: { target_id: 7 } };
  if (r.allowedTools.includes("vote"))
    return { name: "vote", args: { target_id: p.exile ?? null, abstain: p.exile == null } };
  if (r.allowedTools.includes("speak"))
    return { name: "speak", args: { text: "A literal independent test speech." } };
  if (r.allowedTools.includes("self_destruct"))
    return { name: "self_destruct", args: { confirm: false } } as unknown as ToolCall;
  return demonNightChoice(r, 3, p);
}
const nights = (g: ReturnType<typeof game>) =>
  g.phaseManager
    .getEvents()
    .filter((e) => e.type === "night_resolved")
    .map((e) => e.payload.deaths);
const live = (g: ReturnType<typeof game>, id: number) =>
  g.world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)!.alive;
async function cycles(plans: Plan[]) {
  const g = game(),
    seen: ActionRequest[] = [];
  for (let i = 0; i < plans.length; i++)
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          seen.push(r);
          return call(r, plans[r.context.day - 1]!);
        },
      },
      10,
    );
  return { g, seen };
}

test("real PM toxin immunity filters before Body, which remains intact", async () => {
  const { g } = await cycles([
    { body: 7 },
    { body: 4, potion: { target: 4, type: PotionType.Poison } },
  ]);
  expect(nights(g)).toEqual([[], []]);
  expect(snapshotNobleBodyAuthority(g.world).body.body).toEqual({ kind: "intact" });
  expect(
    g.phaseManager.getEvents().filter((e) => e.type === "demon_hunter_poison_immune"),
  ).toHaveLength(1);
});
test("real PM immunity plus mis-hunt: Body removes backlash, not already-immune toxin", async () => {
  const { g } = await cycles([
    { body: 7 },
    { body: 4, potion: { target: 4, type: PotionType.Poison }, hunt: 6 },
  ]);
  expect(nights(g)).toEqual([[], []]);
  expect(snapshotNobleBodyAuthority(g.world).body.body).toEqual({
    kind: "night_spent",
    day: 2,
    targetId: 4,
    cause: "demon_hunt_backlash",
  });
  expect(live(g, 4)).toBe(true);
  expect(live(g, 6)).toBe(true);
});
test("real N3 A knife+poison and Body expiry remove only A knife, no second fallback", async () => {
  const { g } = await cycles([
    { body: 7 },
    { body: 8, servant: 5 },
    { body: 6, knife: 6, potion: { target: 6, type: PotionType.Poison } },
  ]);
  expect(nights(g)).toEqual([[], [], [5, 6]]);
  expect(snapshotNobleBodyAuthority(g.world).body.body).toEqual({
    kind: "night_spent",
    day: 3,
    targetId: 6,
    cause: "wolf_kill",
  });
  expect(snapshotNobleBodyAuthority(g.world).noble.contracts[0]!.status).toEqual({
    kind: "expired",
    day: 3,
  });
  expect(live(g, 5)).toBe(false);
  expect(live(g, 6)).toBe(false);
});
test("real N3 saved chosen A has no effective source so Body protects itself from expiry", async () => {
  const { g } = await cycles([
    { body: 7 },
    { body: 8, servant: 5 },
    { body: 6, knife: 6, potion: { target: 6, type: PotionType.Heal } },
  ]);
  expect(nights(g)).toEqual([[], [], []]);
  expect(snapshotNobleBodyAuthority(g.world).body.body).toEqual({
    kind: "night_spent",
    day: 3,
    targetId: 5,
    cause: "servant_expiry",
  });
  expect(snapshotNobleBodyAuthority(g.world).noble.contracts[0]!.status).toEqual({
    kind: "expired",
    day: 3,
  });
  expect(live(g, 5)).toBe(true);
  expect(live(g, 6)).toBe(true);
});
test("dead Noble retains original pending servant until actual N3 expiry; true final wolf ends game", async () => {
  const { g, seen } = await cycles([
    { body: 7, exile: 10 },
    { body: 8, servant: 6, exile: 1 },
    { body: 7, exile: 11 },
    { body: 8, exile: 12 },
  ]);
  expect(nights(g)).toEqual([[], [], [6], []]);
  expect(snapshotNobleBodyAuthority(g.world).noble.contracts[0]!.status).toEqual({
    kind: "expired",
    day: 3,
  });
  expect(g.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  expect(seen.filter((r) => r.context.stage === "night_noble").map((r) => r.context.day)).toEqual([
    2,
  ]);
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "noble_night_notified")
      .map((e) => e.payload.day),
  ).toEqual([1, 2]);
});
test("night deaths before first sheriff; last Noble ends D2 with still-pending contract and no N3 notification", async () => {
  const g = game(),
    plans: Plan[] = [
      { body: 7, knife: 10, exile: 11 },
      { body: 8, servant: 6, knife: 12, exile: 1 },
    ];
  let nominations = 0;
  const result = await g.phaseManager.runUntilGameOver(
    {
      async getAction(r) {
        if (r.context.stage === "sheriff_nomination") {
          nominations++;
          expect(nights(g)).toEqual([[10]]);
          expect(live(g, 10)).toBe(false);
          expect(r.actorId).not.toBe(10);
        }
        return call(r, plans[r.context.day - 1]!);
      },
    },
    10,
  );
  expect(nominations).toBe(11);
  expect(result.result?.winner).toBe(Camp.Good);
  expect(result.day).toBe(2);
  expect(nights(g)).toEqual([[10], [12]]);
  expect(snapshotNobleBodyAuthority(g.world).noble.contracts[0]!.status).toEqual({
    kind: "pending",
  });
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "noble_night_notified")
      .map((e) => e.payload.day),
  ).toEqual([1, 2]);
});
for (const bad of ["chat-null", "chat-invalid", "knife-null", "knife-invalid"] as const)
  test(`real strict board rejects ${bad}`, async () => {
    const g = game();
    let injected = false;
    const run = g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          if (
            !injected &&
            r.actorId === 1 &&
            r.allowedTools.includes(bad.startsWith("chat") ? "speak_to_wolves" : "kill_vote")
          ) {
            injected = true;
            if (bad.endsWith("null")) return null;
            return bad.startsWith("chat")
              ? ({ name: "speak_to_wolves", args: { text: "bad" } } as any)
              : { name: "kill_vote", args: { target_id: 999, abstain: false } };
          }
          return call(r, {});
        },
      },
      10,
    );
    await expect(run).rejects.toThrow();
    expect(injected).toBe(true);
    expect(nights(g)).toEqual([]);
  });

test("actual target death closure precedes last words, stays hidden in current Noble DTO, next N3 can choose", async () => {
  const g = game();
  let observed = false;
  const plans: Plan[] = [{ body: 7 }, { body: 8, servant: 6, exile: 6 }, { body: 7, servant: 9 }];
  for (let d = 1; d <= 3; d++)
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          if (r.actorId === 6 && r.context.day === 2 && r.context.stage === "last_words") {
            observed = true;
            expect(live(g, 6)).toBe(false);
            expect(snapshotNobleBodyAuthority(g.world).noble.contracts[0]!.status).toEqual({
              kind: "target_dead",
              day: 2,
            });
            expect(
              snapshotNobleBodyAuthority(g.world).knowledge.noble.contracts[0]!.status,
            ).toEqual({ kind: "pending" });
            expect(
              g.phaseManager
                .getEvents()
                .some(
                  (e) => e.type === "noble_contract_closed" && e.payload.status === "target_dead",
                ),
            ).toBe(true);
          }
          return call(r, plans[r.context.day - 1]!);
        },
      },
      10,
    );
  expect(observed).toBe(true);
  expect(
    snapshotNobleBodyAuthority(g.world).noble.contracts.map((c) => [
      c.createdNight,
      c.targetId,
      c.status.kind,
    ]),
  ).toEqual([
    [2, 6, "target_dead"],
    [3, 9, "pending"],
  ]);
});

test("real old servant cleared before N3 expiry with same target knife independent", async () => {
  const { g, seen } = await cycles([
    { body: 7 },
    { body: 8, servant: 6 },
    { body: 7, knife: 6, hunt: 6 },
  ]);
  expect(nights(g)).toEqual([[], [], [6]]);
  expect(live(g, 4)).toBe(true);
  expect(snapshotNobleBodyAuthority(g.world).noble.contracts[0]!.status).toEqual({
    kind: "cleared",
    day: 3,
  });
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "noble_contract_closed")
      .map((e) => e.payload.status),
  ).toEqual(["cleared"]);
  expect(seen.filter((r) => r.context.stage === "night_noble").map((r) => r.context.day)).toEqual([
    2,
  ]);
});

for (const policy of ["standard", "no_blast_no_self_knife"] as const)
  test(`actual ${policy} blast eligibility only changes Noble; ordinary wolf still can blast`, async () => {
    const c = nobleSecretBodyTwelveConfig(policy),
      g = bootstrapGame(c, {
        fixedRoles: c.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
      });
    const asked: number[] = [];
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          if (r.context.stage === "on_pre_election" && r.allowedTools.includes("self_destruct")) {
            asked.push(r.actorId);
            return {
              name: "self_destruct",
              args: { confirm: r.actorId === (policy === "standard" ? 1 : 10) },
            } as unknown as ToolCall;
          }
          return call(r, {});
        },
      },
      10,
    );
    expect(asked.sort((a, b) => a - b)).toEqual(
      policy === "standard" ? [1, 10, 11, 12] : [10, 11, 12],
    );
    expect(live(g, policy === "standard" ? 1 : 10)).toBe(false);
    expect(live(g, policy === "standard" ? 10 : 1)).toBe(true);
    expect(g.phaseManager.getEvents().filter((e) => e.type === "wolf_self_destruct")).toHaveLength(
      1,
    );
  });

test("failed strict reveal preserves public reveal, alive sheriff and vote but no completed speech/death", async () => {
  const g = game();
  let revealed = false;
  const run = g.phaseManager.runSingleCycle(
    {
      async getAction(r) {
        if (r.context.stage === "sheriff_nomination" || r.context.stage === "sheriff_withdraw")
          return { name: "run_for_sheriff", args: { run: r.actorId === 5 } };
        if (r.context.stage === "awakened_idiot_reveal_speech") {
          revealed = true;
          expect(live(g, 5)).toBe(true);
          expect(g.world.getComponent(5, COMPONENT.VotingRight)).toMatchObject({
            canVote: true,
            weight: 1.5,
          });
          expect(g.world.getComponent(5, COMPONENT.Badge)).toMatchObject({ isSheriff: true });
          return null;
        }
        return call(r, { body: 7, exile: 5 });
      },
    },
    10,
  );
  await expect(run).rejects.toThrow("secret_body_reveal_speech_required");
  expect(revealed).toBe(true);
  const events = g.phaseManager.getEvents();
  expect(events.filter((e) => e.type === "secret_body_revealed")).toHaveLength(1);
  expect(events.filter((e) => e.type === "secret_body_reveal_speech")).toHaveLength(0);
  expect(events.filter((e) => e.type === "voted_out")).toHaveLength(0);
  expect(snapshotNobleBodyAuthority(g.world).body.body).toEqual({ kind: "exile_revealed", day: 1 });
  expect(live(g, 5)).toBe(true);
});
