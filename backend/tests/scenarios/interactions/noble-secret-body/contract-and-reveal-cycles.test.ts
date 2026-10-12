/**
 * Interaction scenarios verify Noble and Secret Body actual cycles preserve servant creation, expiry, hunt clearing and reveal authority.
 * Input: Original wolf/body policies, deterministic choices, pending contracts and real reveal/exile cycles.
 * Output and oracle: Explicit contract, knife, last-word, badge/vote and natural terminal assertions remain causal; original expected policies and archived formats are unchanged.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Phase,
  Role,
  Camp,
  COMPONENT,
  PotionType,
  type ActionRequest,
  type ToolCall,
  type RoleComponent,
} from "../../../../src/core";
import { nobleSecretBodyTwelveConfig } from "../../../../src/runtime/scenarios/noble_secret_body_twelve";
import { isNobleSecretBodyPreset } from "../../../../src/rulesets";
import { demonNightChoice } from "../../../support/demon_hunter_scenarios";
import {
  snapshotNobleBodyAuthority,
  getNobleBodyPlayerState,
} from "../../../../src/game/mechanisms/roles/noble_secret_body/authority";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
function game(
  wolf: "standard" | "no_blast_no_self_knife" = "standard",
  body: "awa_nonconsecutive_nights_v1" | "awa_repeat_v1" = "awa_nonconsecutive_nights_v1",
) {
  const config = nobleSecretBodyTwelveConfig(wolf, body);
  expect(isNobleSecretBodyPreset(config)).toBe(true);
  return bootstrapGame(config, {
    fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
  });
}
function act(
  r: ActionRequest,
  body: number | null = null,
  servant: number | null = null,
  knife: number | null = null,
  hunt: number | null = null,
): ToolCall | null {
  if (r.allowedTools.includes("protect_secret_body"))
    return { name: "protect_secret_body", args: { target_id: body } };
  if (r.allowedTools.includes("choose_servant"))
    return { name: "choose_servant", args: { target_id: servant } };
  if (r.allowedTools.includes("vote"))
    return {
      name: "vote",
      args: {
        target_id:
          r.context.day === 1 ? 10 : r.context.day === 2 ? 11 : r.context.day === 3 ? 12 : 1,
        abstain: false,
      },
    };
  if (r.allowedTools.includes("check_identity"))
    return { name: "check_identity", args: { target_id: 6 } };
  return demonNightChoice(r, 5, { knife, hunt });
}
for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
  for (const body of ["awa_nonconsecutive_nights_v1", "awa_repeat_v1"] as const)
    test(`${wolf}/${body}: real N2 creation, occupied N3 expiry/block, N4 new contract, natural Good finish`, async () => {
      const g = game(wolf, body),
        seen: ActionRequest[] = [];
      const result = await g.phaseManager.runUntilGameOver(
        {
          async getAction(r) {
            seen.push(r);
            return act(
              r,
              [6, 7, 6, null][r.context.day - 1] ?? null,
              r.context.day === 2 ? 6 : r.context.day === 4 ? 7 : null,
            );
          },
        },
        8,
      );
      expect(result.gameOver).toBe(true);
      expect(result.result?.winner).toBe(Camp.Good);
      const events = g.phaseManager.getEvents(),
        owned = snapshotNobleBodyAuthority(g.world);
      expect(
        events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
      ).toEqual([[], [], [], []]);
      expect(
        seen.filter((r) => r.context.stage === "night_noble").map((r) => r.context.day),
      ).toEqual([2, 4]);
      expect(
        seen.filter((r) => r.context.stage === "secret_body").map((r) => r.context.day),
      ).toEqual([1, 2, 3]);
      expect(owned.noble.contracts).toMatchObject([
        { targetId: 6, status: { kind: "expired", day: 3 } },
        { targetId: 7, status: { kind: "pending" } },
      ]);
      expect(owned.body.body).toEqual({
        kind: "night_spent",
        day: 3,
        targetId: 6,
        cause: "servant_expiry",
      });
      expect(events.filter((e) => e.type === "noble_night_notified")).toHaveLength(4);
      expect(events.filter((e) => e.type === "secret_body_night_notified")).toHaveLength(4);
      const viewer = buildAgentVisibleEventFeed(g.world, events, 5);
      expect(
        viewer.some((e) => e.type === "secret_body_blocked" || e.type === "noble_contract_closed"),
      ).toBe(false);
      expect(getNobleBodyPlayerState(g.world, 5, Phase.GameOver)?.state).toMatchObject({
        resource: "spent",
        lastNotifiedNight: 4,
      });
    });
for (const target of [6, 12])
  test(`real N2 hunt clears new ${target === 6 ? "good" : "wolf"} servant without hunt/backlash, knife remains`, async () => {
    const g = game();
    const seen: ActionRequest[] = [];
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          seen.push(r);
          return act(r, null, null);
        },
      },
      8,
    );
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          seen.push(r);
          return act(r, null, target, target, target);
        },
      },
      8,
    );
    const events = g.phaseManager.getEvents(),
      nights = events.filter((e) => e.type === "night_resolved");
    expect(nights[1]!.payload.deaths).toEqual([target]);
    expect(snapshotNobleBodyAuthority(g.world).noble.contracts[0]!.status).toEqual({
      kind: "cleared",
      day: 2,
    });
    expect(events.some((e) => e.type === "demon_hunter_cancelled")).toBe(false);
    expect(g.world.getComponent<{ alive: boolean }>(4, COMPONENT.Alive)!.alive).toBe(true);
    expect(events.filter((e) => e.type === "demon_hunter_chosen").at(-1)?.payload.targetId).toBe(
      target,
    );
  });
test("real intact Body exile reveals alive, speaks once, retains vote and badge; next exile kills", async () => {
  const g = game();
  const provider = {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      if (r.context.stage === "awakened_idiot_reveal_speech")
        return { name: "speak", args: { text: "I remain alive with my badge." } };
      if (r.allowedTools.includes("choose_badge_successor"))
        return { name: "choose_badge_successor", args: { target_id: 2 } };
      if (r.allowedTools.includes("run_for_sheriff"))
        return { name: "run_for_sheriff", args: { run: r.actorId === 5 } };
      if (r.allowedTools.includes("vote_for_sheriff"))
        return { name: "vote_for_sheriff", args: { target_id: 5, abstain: false } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: 5, abstain: false } };
      return act(r, 6);
    },
  };
  await g.phaseManager.runSingleCycle(provider, 8);
  const events = g.phaseManager.getEvents();
  expect(events.filter((e) => e.type === "secret_body_revealed")).toHaveLength(1);
  expect(events.filter((e) => e.type === "secret_body_reveal_speech")).toHaveLength(1);
  expect(g.world.getComponent<{ alive: boolean }>(5, COMPONENT.Alive)!.alive).toBe(true);
  expect(
    g.world.getComponent<{ weight: number; canVote: boolean }>(5, COMPONENT.VotingRight),
  ).toMatchObject({ weight: 1.5, canVote: true });
  expect(g.world.getComponent<{ isSheriff: boolean }>(5, COMPONENT.Badge)!.isSheriff).toBe(true);
  expect(events.some((e) => e.type === "player_role_revealed" && e.payload.playerId === 5)).toBe(
    false,
  );
  await g.phaseManager.runSingleCycle(provider, 8);
  expect(g.world.getComponent<{ alive: boolean }>(5, COMPONENT.Alive)!.alive).toBe(false);
  expect(g.phaseManager.getEvents().filter((e) => e.type === "secret_body_revealed")).toHaveLength(
    1,
  );
  expect(
    g.phaseManager.getEvents().some((e) => e.type === "voted_out" && e.payload.target === 5),
  ).toBe(true);
});
