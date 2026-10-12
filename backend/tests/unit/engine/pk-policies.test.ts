/**
 * Unit tests: Sheriff and exile PK policies use fixed nominees and ballots; handwritten
 * eligibility, withdrawal, tie-break and no-ballot results check each public
 * election/exile module independently. Inputs and expected outcomes remain the original
 * literal or immutable-fixture oracle; these module assertions invoke no model or
 * complete-game driver.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import type { AliveComponent } from "../../../src/core/domain/components/alive";
import type { VotingRightComponent } from "../../../src/core/domain/components/voting_right";
import {
  Phase,
  Role,
  type ActionRequest,
  type BoardConfig,
  type GameEvent,
  type ToolCall,
} from "../../../src/core/domain/model";
import { VotingPipeline } from "../../../src/game/engine/phase_pipeline/voting_pipeline";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { createDefaultRoleRegistry } from "../../../src/game/mechanisms";
import { electSheriffIfNeeded } from "../../../src/game/mechanisms/sheriff/election";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";

const roles = [Role.Wolf, Role.Seer, Role.Villager, Role.Villager, Role.Villager, Role.Villager];
function fixture(pk = true) {
  const config: BoardConfig = {
    boardSize: 6,
    enableSheriff: true,
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    sheriff: { electionPolicy: pk ? "awa_nomination_offstage_pk_v1" : "awa_final_candidates_v1" },
    voting: { exilePolicy: pk ? "awa_one_pk_v1" : "awa_direct_v1" },
    tieBreaker: { sheriffVote: "min_seat", exileVote: "min_id" },
  };
  const { world } = bootstrapGame(config, { fixedRoles: roles });
  const events: GameEvent[] = [];
  const gateway = new ToolGateway();
  const voting = new VotingPipeline({
    world,
    events,
    toolGateway: gateway,
    eventRegistry: new EventRegistry(),
    roleRegistry: createDefaultRoleRegistry(),
  });
  return { config, world, events, gateway, voting };
}
function vote(target: number | null): ToolCall {
  return { name: "vote", args: { target_id: target, abstain: target === null } };
}
function sheriffVote(target: number | null): ToolCall {
  return { name: "vote_for_sheriff", args: { target_id: target, abstain: target === null } };
}
function provider(handler: (r: ActionRequest) => ToolCall | null) {
  const requests: ActionRequest[] = [];
  return {
    requests,
    async getAction(r: ActionRequest) {
      requests.push(r);
      return handler(r);
    },
  };
}
function electionHandler(
  r: ActionRequest,
  second: (actor: number) => number | null,
  nominees = [1, 2, 3],
): ToolCall | null {
  switch (r.context.stage) {
    case "sheriff_nomination":
      return { name: "run_for_sheriff", args: { run: nominees.includes(r.actorId) } };
    case "sheriff_withdraw":
      return { name: "run_for_sheriff", args: { run: r.actorId !== 3 } };
    case "sheriff_campaign_speech":
    case "sheriff_pk_speech":
      return { name: "speak", args: { text: `candidate ${r.actorId}` } };
    case "sheriff_vote":
      return sheriffVote(r.actorId === 4 ? 1 : r.actorId === 5 ? 2 : null);
    case "sheriff_pk_vote":
      return sheriffVote(second(r.actorId));
    default:
      return null;
  }
}
for (const [name, second, winner] of [
  ["majority", (id: number) => (id === 6 ? 2 : 1), 1],
  ["second tie", (id: number) => (id <= 4 ? 1 : 2), null],
  ["second abstentions", () => null, null],
] as const)
  test(`sheriff PK: ${name}, withdrawn nominees can vote only in PK`, async () => {
    const f = fixture();
    const p = provider((r) => electionHandler(r, second));
    const result = await electSheriffIfNeeded({
      world: f.world,
      events: f.events,
      toolGateway: f.gateway,
      actionProvider: p,
      day: 1,
      enableSheriff: true,
      config: f.config,
    });
    expect(result).toBe(winner);
    expect(
      p.requests.filter((r) => r.context.stage === "sheriff_vote").map((r) => r.actorId),
    ).toEqual([4, 5, 6]);
    expect(
      p.requests.filter((r) => r.context.stage === "sheriff_pk_vote").map((r) => r.actorId),
    ).toEqual([3, 4, 5, 6]);
    expect(
      p.requests.filter((r) => r.context.stage === "sheriff_pk_speech").map((r) => r.actorId),
    ).toEqual([1, 2]);
    expect(f.events.filter((e) => e.type === "sheriff_pk_started")).toHaveLength(1);
    expect(
      f.events.filter((e) => e.type === "sheriff_vote_summary").map((e) => e.payload.round),
    ).toEqual([1, 2]);
    expect(() => structuredClone(f.events)).not.toThrow();
    expect(JSON.stringify(f.events)).not.toContain('"life"');
  });
test("sheriff default retains withdrawn voter and direct configured tie break", async () => {
  const f = fixture(false);
  const p = provider((r) => electionHandler(r, () => null));
  expect(
    await electSheriffIfNeeded({
      world: f.world,
      events: f.events,
      toolGateway: f.gateway,
      actionProvider: p,
      day: 1,
      enableSheriff: true,
      config: f.config,
    }),
  ).toBe(1);
  expect(
    p.requests.filter((r) => r.context.stage === "sheriff_vote").map((r) => r.actorId),
  ).toEqual([3, 4, 5, 6]);
  expect(f.events.some((e) => e.type === "sheriff_pk_started")).toBe(false);
});
test("sheriff PK sole final candidate is elected without a ballot", async () => {
  const f = fixture();
  const p = provider((r) => electionHandler(r, () => null, [1]));
  expect(
    await electSheriffIfNeeded({
      world: f.world,
      events: f.events,
      toolGateway: f.gateway,
      actionProvider: p,
      day: 1,
      enableSheriff: true,
      config: f.config,
    }),
  ).toBe(1);
  expect(p.requests.some((r) => r.context.stage === "sheriff_vote")).toBe(false);
});
function exileHandler(r: ActionRequest, second: (actor: number) => number | null): ToolCall | null {
  if (r.context.stage === "voting") return vote([2, 1, 1, 1, 2, 2][r.actorId - 1]);
  if (r.context.stage === "exile_pk_speech")
    return { name: "speak", args: { text: `defense ${r.actorId}` } };
  if (r.context.stage === "exile_pk_vote") return vote(second(r.actorId));
  return null;
}
for (const [name, second, target] of [
  ["majority", (id: number) => (id === 6 ? 2 : 1), 1],
  ["second tie", (id: number) => (id <= 4 ? 1 : 2), null],
  ["second abstentions", () => null, null],
] as const)
  test(`exile PK: ${name}, only non-candidates revote`, async () => {
    const f = fixture();
    const p = provider((r) => exileHandler(r, second));
    const result = await f.voting.execute(f.config, p, { day: 2 });
    expect(result.summary.target).toBe(target);
    expect(result.removed).toEqual(target === null ? [] : [target]);
    expect(
      p.requests.filter((r) => r.context.stage === "exile_pk_vote").map((r) => r.actorId),
    ).toEqual([3, 4, 5, 6]);
    for (const r of p.requests.filter((r) => r.context.stage === "exile_pk_vote"))
      expect(r.context.exile_candidates).toEqual([1, 2]);
    expect(
      p.requests.filter((r) => r.context.stage === "exile_pk_speech").map((r) => r.actorId),
    ).toEqual([1, 2]);
    expect(f.events.filter((e) => e.type === "exile_pk_started")).toHaveLength(1);
    expect(f.events.filter((e) => e.type === "vote_summary").map((e) => e.payload.round)).toEqual([
      1, 2,
    ]);
    expect(() => structuredClone(f.events)).not.toThrow();
  });
test("exile all abstentions do not open a zero-score PK", async () => {
  const f = fixture();
  const p = provider(() => vote(null));
  expect((await f.voting.execute(f.config, p, { day: 2 })).summary.target).toBeNull();
  expect(f.events.some((e) => e.type === "exile_pk_started")).toBe(false);
});
test("exile default resolves first tie without PK", async () => {
  const f = fixture(false);
  const p = provider((r) => exileHandler(r, () => null));
  expect((await f.voting.execute(f.config, p, { day: 2 })).summary.target).toBe(1);
  expect(f.events.some((e) => e.type === "exile_pk_started")).toBe(false);
});
test("PK gateway rejects candidate voting and targets outside the tied list", () => {
  const f = fixture();
  for (const call of [vote(2), vote(null)])
    expect(
      f.gateway.validateAndSanitize(f.world, 1, call, {
        phase: Phase.Voting,
        exileCandidates: [1, 2],
      }).ok,
    ).toBe(false);
  expect(
    f.gateway.validateAndSanitize(f.world, 3, vote(4), {
      phase: Phase.Voting,
      exileCandidates: [1, 2],
    }).ok,
  ).toBe(false);
  expect(
    f.gateway.validateAndSanitize(f.world, 3, vote(2), {
      phase: Phase.Voting,
      exileCandidates: [1, 2],
    }).ok,
  ).toBe(true);
});
test("PK malformed targets get bounded retries and explicit abstention", async () => {
  const f = fixture();
  const p = provider((r) => exileHandler(r, () => 4));
  const result = await f.voting.execute(f.config, p, { day: 2 });
  expect(result.summary.target).toBeNull();
  expect(p.requests.filter((r) => r.context.stage === "exile_pk_vote")).toHaveLength(16);
  const last = f.events.filter((e) => e.type === "vote_summary").at(-1)!;
  expect(last.payload.votes).toHaveLength(4);
  expect(last.payload.votes.every((v) => v.abstain)).toBe(true);
});
for (const stage of ["sheriff_pk_speech", "sheriff_pk_vote"] as const)
  test(`sheriff phase revocation at ${stage} prevents election`, async () => {
    const f = fixture();
    let current = true;
    const p = provider((r) => {
      if (r.context.stage === stage) current = false;
      return electionHandler(r, () => 1);
    });
    expect(
      await electSheriffIfNeeded({
        world: f.world,
        events: f.events,
        toolGateway: f.gateway,
        actionProvider: p,
        day: 1,
        enableSheriff: true,
        config: f.config,
        isCurrent: () => current,
      }),
    ).toBeNull();
    expect(f.events.some((e) => e.type === "sheriff_elected")).toBe(false);
  });
for (const stage of ["exile_pk_speech", "exile_pk_vote"] as const)
  test(`exile phase revocation at ${stage} prevents final tally and exile`, async () => {
    const f = fixture();
    let current = true;
    const p = provider((r) => {
      if (r.context.stage === stage) current = false;
      return exileHandler(r, () => 1);
    });
    expect(
      (await f.voting.execute(f.config, p, { day: 2, isCurrent: () => current })).removed,
    ).toEqual([]);
    expect(f.events.some((e) => e.type === "voted_out")).toBe(false);
    expect(f.events.filter((e) => e.type === "vote_summary")).toHaveLength(1);
  });
test("late death and revival invalidates original voter and target life", async () => {
  const f = fixture();
  let once = false;
  const p = provider((r) => {
    if (r.context.stage === "exile_pk_vote" && !once) {
      once = true;
      for (const id of [1, 3]) {
        const life = f.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
        life.alive = false;
        life.alive = true;
      }
    }
    return exileHandler(r, () => 1);
  });
  const result = await f.voting.execute(f.config, p, { day: 2 });
  expect(result.summary.target).toBeNull();
  const last = f.events.filter((e) => e.type === "vote_summary").at(-1)!;
  expect(last.payload.votes.map((v) => v.actorId)).not.toContain(3);
  expect(last.payload.votes.every((v) => v.abstain)).toBe(true);
});
test("PK vote weights retain current sheriff weight", async () => {
  const f = fixture();
  const p = provider((r) => {
    if (r.context.stage === "exile_pk_speech")
      f.world.getComponent<VotingRightComponent>(6, COMPONENT.VotingRight)!.weight = 3;
    return exileHandler(r, (id) => (id === 6 ? 2 : 1));
  });
  const result = await f.voting.execute(f.config, p, { day: 2 });
  expect(result.summary.tally).toEqual({ 1: 3, 2: 3 });
  expect(result.summary.target).toBeNull();
});
test("sheriff/exile policies survive public and strict configuration round trips", () => {
  for (const pk of [false, true]) {
    const f = fixture(pk);
    const definition = boardDefinitionFromConfig("pk", f.config);
    const round = parseBoardDefinition(JSON.parse(JSON.stringify(definition))).config;
    expect(round.sheriff?.electionPolicy).toBe(f.config.sheriff?.electionPolicy);
    expect(round.voting).toEqual(f.config.voting);
    expect(boardDefinitionFromConfig("pk", round)).toEqual(definition);
  }
});
