/**
 * 单元测试验证杠精的存活投票分母、阈值、翻牌、拒绝与原生库存。输入为有限板子、显式票和受控请求 scope；预期为字面量或不变 fixture，不请求模型或完整对局。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { rolePresentationRenderer } from "../../../../src/agents/observation/role-presentation";
import { PlayerPromptPolicy } from "../../../../src/agents/player/player-prompt-policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../../src/rulesets/mechanism-api";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  ActionWindow,
  KnightDuelWindow,
  COMPONENT,
  Role,
  Camp,
  Phase,
  WinCondition,
  type RoleComponent,
  type AliveComponent,
  type BadgeComponent,
  type VotingRightComponent,
  type GameEvent,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { DebaterWindow } from "../../../../src/features/debater/window";
import {
  getDebaterState,
  projectDebaterState,
} from "../../../../src/features/debater/state";
import {
  debateVoteBlocked,
  hasDebateCommit,
  blockDebateVote,
  debateAuthority,
} from "../../../../src/features/debater/authority";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import {
  canVote,
  canVoteExile,
  canBeSheriff,
} from "../../../../src/engine/participation";
import { getDefaultRoleCatalog } from "../../../../src/rulesets/roles/role-catalog-assembly";
import { createDefaultRoleRegistry } from "../../../../src/rulesets/mechanism-api";
import { DayPipeline } from "../../../../src/engine/phases/day-pipeline";
import { VotingPipeline } from "../../../../src/engine/phases/voting-pipeline";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { DefaultTargetHintRegistry } from "../../../../src/agents/tool-repair/target-hint-registry";
import { setIdiotState } from "../../../../src/features/idiot/ports";
import { captureCheckpoint } from "../../../../src/app/simulation/reproduction-context";
import { text } from "@ai-werewolf-arena/game-text";
import { readDebateEventFact } from "@ai-werewolf-arena/game-contract/facts/debate";
import { debateEventLabel } from "@ai-werewolf-arena/game-presentation";
const deck = [Role.Debater, Role.Wolf, Role.Hunter, Role.Idiot, Role.Villager, Role.Villager];
const fixture = (roles = deck) => {
  const config = foxBoard(roles);
  return { ...bootstrapGame(config, { fixedRoles: roles }), config };
};
type Fixture = ReturnType<typeof fixture>;
const role = (g: Fixture, id: number) => g.world.getComponent(id, COMPONENT.Role)!;
const life = (g: Fixture, id: number) => g.world.getComponent(id, COMPONENT.Alive)!;
const challenge: ToolCall = { name: "challenge", args: { target_id: 2 } };
async function run(
  g: Fixture,
  events: GameEvent[],
  getAction: (request: ActionRequest) => Promise<ToolCall | null>,
  isCurrent = () => true,
  day = 1,
) {
  return new DebaterWindow(g.world, new ToolGateway(), events).execute(
    g.config,
    new GameActionRequestFactory(g.world, events, day),
    { getAction },
    2,
    day,
    isCurrent,
  );
}
function provider(
  votes: Array<boolean | null>,
  requests: ActionRequest[] = [],
  callback?: (r: ActionRequest) => void,
) {
  return async (r: ActionRequest): Promise<ToolCall | null> => {
    requests.push(r);
    callback?.(r);
    if (r.context.stage === "debate_challenge") return challenge;
    if (r.context.stage === "debate_speech")
      return { name: "speak", args: { text: "[God] Statement" } };
    if (r.context.stage === "debate_ballot")
      return { name: "debate_vote", args: { support: votes[r.actorId - 1]! } };
    return null;
  };
}
for (const [votes, success, blocked] of [
  [[true, true, true, true, false, false], true, 2],
  [[true, true, true, false, false, false], false, 1],
  [[true, true, true, false, null, null], false, 1],
  [[true, true, true, true, null, null], true, 2],
] as const)
  test(`strict living denominator ${JSON.stringify(votes)}`, async () => {
    const g = fixture(),
      events: GameEvent[] = [],
      requests: ActionRequest[] = [];
    setIdiotState(role(g, 4), { revealed: true });
    g.world.getComponent(4, COMPONENT.VotingRight)!.canVote = false;
    const result = await run(g, events, provider([...votes], requests));
    expect(result.skipSpeech).toBe(success);
    expect(getDebaterState(role(g, 1))).toEqual({
      policy: "awa_melbourne_2026_speech_gap_v1",
      remaining: 0,
      choice: { day: 1, targetId: 2 },
    });
    expect(hasDebateCommit(g.world, 1)).toBe(true);
    expect(requests.map((r) => [r.actorId, r.context.stage])).toEqual([
      [1, "debate_challenge"],
      [1, "debate_speech"],
      [2, "debate_speech"],
      ...[1, 2, 3, 4, 5, 6].map((id) => [id, "debate_ballot" as const]),
    ]);
    expect(events.map((e) => e.type)).toEqual([
      "debater_revealed",
      "debate_started",
      "debate_speech",
      "debate_speech",
      "debate_ballots_recorded",
      "debate_resolved",
    ]);
    expect(events.filter((e) => e.type === "debate_speech").map((e) => e.payload.text)).toEqual([
      "Statement",
      "Statement",
    ]);
    expect(events.find((e) => e.type === "debate_resolved")?.payload).toEqual({
      actorId: 1,
      targetId: 2,
      day: 1,
      eligibleCount: 6,
      supports: votes.filter((v) => v === true).length,
      rejects: votes.filter((v) => v === false).length,
      abstentions: votes.filter((v) => v === null).length,
      success,
      blockedId: blocked,
    });
    expect(debateVoteBlocked(g.world, blocked, 1)).toBe(true);
    expect(canVote(g.world, blocked)).toBe(true);
    expect(canVoteExile(g.world, blocked, 1)).toBe(false);
    expect(canBeSheriff(g.world, blocked)).toBe(true);
    expect(canVoteExile(g.world, blocked, 2)).toBe(true);
    expect(canVote(g.world, 4)).toBe(false);
    for (const request of requests.filter((r) => r.context.stage === "debate_ballot")) {
      expect(
        request.context.visible_events?.some(
          (e) => e.type === "debate_resolved" || e.type === "debate_ballots_recorded",
        ),
      ).toBe(false);
      expect(request.context.turn_constraints.min_valid_actions).toBe(1);
      expect(request.context.allow_fallback).toBe(false);
    }
    for (const id of [1, 2, 3, 4, 5, 6])
      expect(buildAgentVisibleEventFeed(g.world, events, id).map((e) => e.type)).not.toContain(
        "debate_ballots_recorded",
      );
  });
test("source configuration, finite roster and all supported AWA goals", () => {
  const g = fixture();
  expect(
    parseBoardDefinition(boardDefinitionFromConfig("debater", g.config)).config.debater,
  ).toEqual({ policy: "awa_melbourne_2026_speech_gap_v1" });
  expect(
    getDefaultRoleCatalog()
      .requireRuntime(Role.Debater)
      .configuration!.schema.safeParse({ policy: "other" }).success,
  ).toBe(false);
  expect(() => fixture([Role.Debater, Role.Debater, Role.Wolf])).toThrow(
    "role_count_exceeds_limit",
  );
  for (const forbidden of [
    Role.Cupid,
    Role.CursedFox,
    Role.Hybrid,
    Role.Dreamer,
    Role.WolfBeauty,
    Role.BlackMarketMerchant,
  ])
    expect(() => fixture([Role.Debater, forbidden, Role.Wolf])).toThrow(
      "role_combination_not_supported",
    );
  for (const win of [
    WinCondition.SlaughterCity,
    WinCondition.SlaughterSide,
    WinCondition.WolfReachHalf,
  ])
    expect(() => bootstrapGame({ ...g.config, winConditions: [win] })).not.toThrow();
});
for (const action of [
  null,
  { name: "challenge", args: { target_id: 1 } },
  { name: "challenge", args: { target_id: 3 } },
  { name: "challenge", args: { target_id: 2.5 } },
] as Array<ToolCall | null>)
  test(`preaccept skip/invalid ${JSON.stringify(action)} preserves stock`, async () => {
    const g = fixture(),
      events: GameEvent[] = [];
    expect(await run(g, events, async () => action)).toEqual({ skipSpeech: false });
    expect(getDebaterState(role(g, 1))!.remaining).toBe(1);
    expect(events).toEqual([]);
    expect(hasDebateCommit(g.world, 1)).toBe(false);
    expect(await run(g, events, provider([true, true, true, true, true, true]))).toEqual({
      skipSpeech: true,
    });
  });
for (const stage of ["debate_challenge", "debate_speech", "debate_ballot"])
  for (const change of [
    "target_revive",
    "target_replace",
    "actor_role",
    "actor_state",
    "actor_stock",
    "badge",
    "phase",
  ])
    test(`${stage} / ${change} revokes pending outcome`, async () => {
      const g = fixture(),
        events: GameEvent[] = [],
        requests: ActionRequest[] = [];
      let current = true,
        changed = false;
      await run(
        g,
        events,
        provider([true, true, true, true, true, true], requests, (r) => {
          if (changed || r.context.stage !== stage) return;
          changed = true;
          if (change === "target_revive") {
            life(g, 2).alive = false;
            life(g, 2).alive = true;
          }
          if (change === "target_replace")
            g.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
          if (change === "actor_role") role(g, 1).role = Role.Villager;
          if (change === "actor_state")
            (role(g, 1) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
          if (change === "actor_stock")
            (getDebaterState(role(g, 1))! as { remaining: 0 | 1 }).remaining =
              stage === "debate_challenge" ? 0 : 1;
          if (change === "badge")
            g.world.getComponent(2, COMPONENT.Badge)!.voteWeight = 9;
          if (change === "phase") current = false;
        }),
        () => current,
      );
      expect(events.some((e) => e.type === "debate_resolved")).toBe(false);
      expect(g.world.getComponent(1, COMPONENT.DebatePenalty)).toBeUndefined();
      expect(g.world.getComponent(2, COMPONENT.DebatePenalty)).toBeUndefined();
      expect(hasDebateCommit(g.world, 1)).toBe(stage !== "debate_challenge");
      if (stage !== "debate_challenge") {
        expect(events.some((e) => e.type === "debater_revealed")).toBe(true);
        if (change !== "phase") expect(events.at(-1)?.type).toBe("debate_canceled");
      } else expect(events).toEqual([]);
    });
test("revoked early ballot abstains against fixed denominator; no partial totals leak", async () => {
  const g = fixture(),
    events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  await run(
    g,
    events,
    provider([true, true, true, true, false, false], requests, (r) => {
      if (r.context.stage === "debate_ballot" && r.actorId === 6) {
        life(g, 3).alive = false;
        life(g, 3).alive = true;
      }
    }),
  );
  expect(events.find((e) => e.type === "debate_resolved")?.payload).toEqual({
    actorId: 1,
    targetId: 2,
    day: 1,
    eligibleCount: 6,
    supports: 3,
    rejects: 2,
    abstentions: 1,
    success: false,
    blockedId: 1,
  });
});
for (const stage of ["debate_challenge", "debate_speech", "debate_ballot"])
  test(`provider exception at ${stage}: close scope and preserve accepted debit`, async () => {
    const g = fixture(),
      events: GameEvent[] = [];
    let token: string | undefined;
    await expect(
      run(g, events, async (r) => {
        token = r.context.debate_id;
        if (r.context.stage === stage) throw new Error("transport_lost");
        return provider([true, true, true, true, true, true])(r);
      }),
    ).rejects.toThrow("transport_lost");
    expect(debateAuthority(g.world, token)).toBeNull();
    expect(hasDebateCommit(g.world, 1)).toBe(stage !== "debate_challenge");
    expect(events.some((e) => e.type === "debate_resolved")).toBe(false);
  });
test("committed stock cannot be reset by replacing private state or role instance", async () => {
  const g = fixture(),
    events: GameEvent[] = [];
  await run(g, events, provider([false, false, false, false, false, false]));
  (role(g, 1).privateState as Record<string, unknown>).debater = {
    policy: "awa_melbourne_2026_speech_gap_v1",
    remaining: 1,
    choice: null,
  };
  const reqs: ActionRequest[] = [];
  await run(g, events, provider([true, true, true, true, true, true], reqs));
  expect(reqs).toEqual([]);
  expect(
    projectDebaterState(getDebaterState(role(g, 1))!, hasDebateCommit(g.world, 1)).remaining,
  ).toBe(0);
});
test("same-body role change retains penalty; revival/replacement and next day revoke; permanent idiot ban retained", () => {
  const g = fixture();
  blockDebateVote(g.world, 2, 1, 1);
  role(g, 2).role = Role.Villager;
  expect(canVoteExile(g.world, 2, 1)).toBe(false);
  expect(canVoteExile(g.world, 2, 2)).toBe(true);
  life(g, 2).alive = false;
  life(g, 2).alive = true;
  expect(canVoteExile(g.world, 2, 1)).toBe(true);
  blockDebateVote(g.world, 2, 1, 1);
  g.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
  expect(canVoteExile(g.world, 2, 1)).toBe(true);
  g.world.getComponent(4, COMPONENT.VotingRight)!.canVote = false;
  blockDebateVote(g.world, 4, 1, 1);
  expect(canVoteExile(g.world, 4, 2)).toBe(false);
});
for (const success of [true, false])
  test(`sheriff target: success=${success} preserves configured badge`, async () => {
    const g = fixture(),
      events: GameEvent[] = [];
    g.config.enableSheriff = true;
    const badge = g.world.getComponent(2, COMPONENT.Badge)!;
    badge.isSheriff = true;
    badge.voteWeight = 2.25;
    badge.handoffPolicy = "awa_holder_choice_v1";
    g.world.getComponent(2, COMPONENT.VotingRight)!.weight = 2.25;
    const requests: ActionRequest[] = [];
    await run(
      g,
      events,
      provider(
        success ? [true, true, true, true, false, false] : [true, true, true, false, false, false],
        requests,
      ),
    );
    expect(g.world.getComponent(1, COMPONENT.Badge)!.isSheriff).toBe(success);
    expect(badge.isSheriff).toBe(!success);
    expect(requests.some((r) => r.allowedTools.includes("choose_badge_successor"))).toBe(false);
    if (success) {
      const own = g.world.getComponent(1, COMPONENT.Badge)!;
      expect(own.voteWeight).toBe(2.25);
      expect(own.handoffPolicy).toBe("awa_holder_choice_v1");
      expect(g.world.getComponent(1, COMPONENT.VotingRight)!.weight).toBe(
        2.25,
      );
      expect(events.filter((e) => e.type === "sheriff_badge_transferred")).toHaveLength(1);
    }
  });
test("failed Debater sheriff keeps badge and its weight", async () => {
  const g = fixture(),
    events: GameEvent[] = [];
  const b = g.world.getComponent(1, COMPONENT.Badge)!;
  b.isSheriff = true;
  b.voteWeight = 2;
  await run(g, events, provider([true, true, true, false, false, false]));
  expect(b.isSheriff).toBe(true);
  expect(b.voteWeight).toBe(2);
  expect(events.some((e) => e.type === "sheriff_badge_transferred")).toBe(false);
});
test("anonymous public projection invariant under swapping private voters", async () => {
  const feeds: unknown[] = [];
  for (const votes of [
    [true, true, true, true, false, false],
    [true, true, false, false, true, true],
  ]) {
    const g = fixture(),
      events: GameEvent[] = [];
    await run(g, events, provider(votes));
    feeds.push(buildAgentVisibleEventFeed(g.world, events, 5));
  }
  expect(feeds[0]).toEqual(feeds[1]);
});
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: strict facts allow false/null, reject extra/getter and preserve literal public text`, () => {
    const ballots = {
      actorId: 1,
      targetId: 2,
      day: 1,
      eligibleCount: 3,
      ballots: [
        { voterId: 1, support: true },
        { voterId: 2, support: false },
        { voterId: 3, support: null },
      ],
    };
    expect(readDebateEventFact("debate_ballots_recorded", ballots)).toEqual(ballots);
    expect(
      debateEventLabel("debate_speech", { actorId: 1, text: "User literal" }, locale),
    ).toContain("User literal");
    expect(
      readDebateEventFact("debate_started", { actorId: 1, targetId: 2, day: 1, secret: 9 }),
    ).toBeNull();
    let reads = 0;
    expect(
      readDebateEventFact("debater_revealed", {
        actorId: 1,
        get day() {
          reads++;
          return 1;
        },
      }),
    ).toBeNull();
    expect(reads).toBe(0);
    expect(
      readDebateEventFact("debate_resolved", {
        actorId: 1,
        targetId: 2,
        day: 1,
        eligibleCount: 6,
        supports: 3,
        rejects: 3,
        abstentions: 0,
        success: true,
        blockedId: 2,
      }),
    ).toBeNull();
    const g = fixture();
    expect(
      new DefaultTargetHintRegistry().buildActionableIdsHint({
        actorId: 1,
        actorRole: Role.Debater,
        debateTargetId: 2,
        allowedTools: ["challenge"],
        world: g.world,
      }),
    ).toBe(text(g.world.locale, "prompt.targets.debate", { target: 2 }));
  });
test("native tools fail outside their exact runtime window", () => {
  const g = fixture(),
    gateway = new ToolGateway();
  expect(gateway.validateAndSanitize(g.world, 1, challenge, { phase: Phase.Day, day: 1 }).ok).toBe(
    false,
  );
  expect(
    gateway.validateAndSanitize(
      g.world,
      3,
      { name: "debate_vote", args: { support: true } },
      { phase: Phase.Day, day: 1, debateId: "forged" },
    ).ok,
  ).toBe(false);
});
test("checkpoint persists public penalty only as inert versioned data", async () => {
  const g = fixture(),
    events: GameEvent[] = [];
  await run(g, events, provider([true, true, true, true, false, false]));
  const checkpoint = captureCheckpoint(
    g.world,
    { day: 1, phase: Phase.Day, gameOver: false, result: null },
    1,
    true,
    events.length,
  );
  expect(checkpoint.players.find((p) => p.id === 2)?.debatePenalty).toEqual({
    day: 1,
    sourceId: 1,
    lifeVersion: 0,
  });
});
test("ordinary Day success suppresses only one target speech and keeps original scheduled speakers", async () => {
  const g = fixture(),
    events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  const pipeline = new DayPipeline({
    world: g.world,
    roleRegistry: createDefaultRoleRegistry(),
    toolGateway: new ToolGateway(),
    events,
  });
  const action = provider([true, true, true, true, false, false], requests);
  const result = await pipeline.execute(
    g.config,
    {
      getAction: async (r) =>
        r.context.stage === "day_speech"
          ? (requests.push(r), { name: "speak", args: { text: "Ordinary" } })
          : action(r),
    },
    { day: 1 },
  );
  expect(result.summary.speeches.map((s) => s.actorId)).toEqual([1, 3, 4, 5, 6]);
  expect(events.filter((e) => e.type === "debate_speech").map((e) => e.payload.actorId)).toEqual([
    1, 2,
  ]);
  expect(requests.filter((r) => r.context.stage === "debate_challenge")).toHaveLength(1);
});
test("same-phase accepted cancellation restores target ordinary speech and cannot challenge later", async () => {
  const g = fixture(),
    events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  let changed = false;
  const action = provider([true, true, true, true, false, false], requests, (r) => {
    if (!changed && r.context.stage === "debate_speech") {
      changed = true;
      life(g, 2).alive = false;
      life(g, 2).alive = true;
    }
  });
  const p = new DayPipeline({
    world: g.world,
    roleRegistry: createDefaultRoleRegistry(),
    toolGateway: new ToolGateway(),
    events,
  });
  const result = await p.execute(
    g.config,
    {
      getAction: async (r) =>
        r.context.stage === "day_speech"
          ? (requests.push(r), { name: "speak", args: { text: "Ordinary" } })
          : action(r),
    },
    { day: 1 },
  );
  expect(result.summary.speeches.map((s) => s.actorId)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(requests.filter((r) => r.context.stage === "debate_challenge")).toHaveLength(1);
  expect(events.some((e) => e.type === "debate_canceled")).toBe(true);
});
test("regular and PK exile omit blocked voter while day two permits them", async () => {
  const g = fixture(),
    events: GameEvent[] = [];
  await run(g, events, provider([true, true, true, true, false, false]));
  g.config.voting = { exilePolicy: "awa_one_pk_v1" };
  const p = new VotingPipeline({
    world: g.world,
    roleRegistry: createDefaultRoleRegistry(),
    toolGateway: new ToolGateway(),
    eventRegistry: new EventRegistry(),
    events,
  });
  const requests: ActionRequest[] = [];
  await p.execute(
    g.config,
    {
      getAction: async (r) => {
        requests.push(r);
        if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "PK" } };
        return {
          name: "vote",
          args: {
            target_id:
              r.context.stage === "exile_pk_vote"
                ? 3
                : [1, 3].includes(r.actorId)
                  ? 3
                  : [4, 5].includes(r.actorId)
                    ? 5
                    : null,
            abstain: r.actorId === 6,
          },
        };
      },
    },
    { day: 1 },
  );
  expect(
    requests.filter((r) => r.allowedTools.includes("vote")).every((r) => r.actorId !== 2),
  ).toBe(true);
  expect(requests.some((r) => r.context.stage === "exile_pk_vote")).toBe(true);
  expect(events.filter((e) => e.type === "vote_cast").every((e) => e.payload.actorId !== 2)).toBe(
    true,
  );
});

for (const before of ["death", "revive"])
  test(`acceptance freezes current living denominator after unrelated ${before}`, async () => {
    const g = fixture(),
      events: GameEvent[] = [];
    if (before === "revive") life(g, 6).alive = false;
    const requests: ActionRequest[] = [];
    await run(
      g,
      events,
      provider([true, true, true, false, false, false], requests, (r) => {
        if (r.context.stage === "debate_challenge") life(g, 6).alive = before === "revive";
      }),
    );
    expect(events.find((e) => e.type === "debate_resolved")?.payload).toMatchObject({
      eligibleCount: before === "death" ? 5 : 6,
      supports: 3,
      success: before === "death",
      blockedId: before === "death" ? 2 : 1,
    });
    expect(
      requests.filter((r) => r.context.stage === "debate_ballot").map((r) => r.actorId),
    ).toEqual(before === "death" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6]);
  });
test("destroyed receiving badge cancels instead of destroying target badge", async () => {
  const g = fixture(),
    events: GameEvent[] = [];
  g.world.getComponent(1, COMPONENT.Badge)!.destroyed = true;
  const badge = g.world.getComponent(2, COMPONENT.Badge)!;
  badge.isSheriff = true;
  await run(g, events, provider([true, true, true, true, true, true]));
  expect(events.at(-1)?.type).toBe("debate_canceled");
  expect(
    events.some((e) => e.type === "debate_resolved" || e.type === "sheriff_badge_destroyed"),
  ).toBe(false);
  expect(badge.isSheriff).toBe(true);
  expect(badge.destroyed).toBe(false);
  expect(hasDebateCommit(g.world, 1)).toBe(true);
});
test("sequential provider startup stops sending ballots after party revocation", async () => {
  const g = fixture(),
    events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  await run(
    g,
    events,
    provider([true, true, true, true, true, true], requests, (r) => {
      if (r.context.stage === "debate_ballot" && r.actorId === 1) life(g, 2).alive = false;
    }),
  );
  expect(requests.filter((r) => r.context.stage === "debate_ballot").map((r) => r.actorId)).toEqual(
    [1],
  );
  expect(events.at(-1)?.type).toBe("debate_canceled");
});
test("invalid frozen third voter receives no ballot request but retains denominator", async () => {
  const g = fixture(),
    events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  await run(
    g,
    events,
    provider([true, true, true, true, false, false], requests, (r) => {
      if (r.context.stage === "debate_ballot" && r.actorId === 1) life(g, 3).alive = false;
    }),
  );
  expect(requests.filter((r) => r.context.stage === "debate_ballot").map((r) => r.actorId)).toEqual(
    [1, 2, 4, 5, 6],
  );
  expect(events.find((e) => e.type === "debate_resolved")?.payload).toMatchObject({
    eligibleCount: 6,
    supports: 3,
    abstentions: 1,
    success: false,
  });
});
test("canceling a dead target sends no ordinary speech but preserves other gaps", async () => {
  const g = fixture(),
    events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  const action = provider([true, true, true, true, true, true], requests, (r) => {
    if (r.context.stage === "debate_speech") life(g, 2).alive = false;
  });
  const p = new DayPipeline({
    world: g.world,
    roleRegistry: createDefaultRoleRegistry(),
    toolGateway: new ToolGateway(),
    events,
  });
  await p.execute(
    g.config,
    {
      getAction: async (r) =>
        r.context.stage === "day_speech"
          ? (requests.push(r), { name: "speak", args: { text: "Ordinary" } })
          : action(r),
    },
    { day: 1 },
  );
  expect(requests.some((r) => r.context.stage === "day_speech" && r.actorId === 2)).toBe(false);
});
test("Debater state slot getter does not run before prompt projection", () => {
  const g = fixture();
  let reads = 0;
  Object.defineProperty(role(g, 1).privateState, "debater", {
    get() {
      reads++;
      return {};
    },
  });
  expect(getDebaterState(role(g, 1))).toBeUndefined();
  expect(rolePresentationRenderer(role(g, 1))?.("en")).toContain('"remaining":0');
  expect(reads).toBe(0);
});

test("recursive window after acceptance throws and cannot emit late result", async () => {
  const g = fixture(),
    events: GameEvent[] = [];
  let entered = false;
  await expect(
    run(g, events, async (r) => {
      if (r.context.stage === "debate_speech" && !entered) {
        entered = true;
        await run(g, events, provider([true, true, true, true, true, true]));
      }
      return provider([true, true, true, true, true, true])(r);
    }),
  ).rejects.toThrow("debate_window_reentry");
  expect(hasDebateCommit(g.world, 1)).toBe(true);
  expect(events.some((e) => e.type === "debate_resolved")).toBe(false);
});
test("missing day cannot bypass a live temporary penalty, explicit next day expires", () => {
  const g = fixture();
  blockDebateVote(g.world, 2, 1, 1);
  const gateway = new ToolGateway(),
    vote: ToolCall = { name: "vote", args: { target_id: 3, abstain: false } };
  expect(gateway.validateAndSanitize(g.world, 2, vote, { phase: Phase.Voting }).ok).toBe(false);
  expect(gateway.validateAndSanitize(g.world, 2, vote, { phase: Phase.Voting, day: 1 }).ok).toBe(
    false,
  );
  expect(gateway.validateAndSanitize(g.world, 2, vote, { phase: Phase.Voting, day: 2 }).ok).toBe(
    true,
  );
});

for (const kind of ["wolf", "knight"] as const)
  test(`successful skipped target speech still runs ${kind} gap and ends day`, async () => {
    const g = fixture([
        Role.Villager,
        Role.Debater,
        Role.Wolf,
        kind === "knight" ? Role.Knight : Role.Witch,
        Role.Hunter,
        Role.Villager,
      ]),
      events: GameEvent[] = [],
      requests: ActionRequest[] = [];
    g.config.hooks.onPerSpeechGap = true;
    g.config.selfDestruct = {
      enabledWindows: kind === "wolf" ? [ActionWindow.OnPerSpeechGap] : [],
    };
    if (kind === "knight") g.config.knight = { enabledWindows: [KnightDuelWindow.BetweenSpeeches] };
    const pipeline = new DayPipeline({
      world: g.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      events,
    });
    const result = await pipeline.execute(
      g.config,
      {
        getAction: async (r) => {
          requests.push(r);
          if (r.allowedTools.includes("challenge"))
            return { name: "challenge", args: { target_id: r.context.debate_target_id! } };
          if (r.allowedTools.includes("debate_vote"))
            return { name: "debate_vote", args: { support: true } };
          if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "Debate" } };
          if (r.allowedTools.includes("self_destruct"))
            return { name: "self_destruct", args: { confirm: true, reason: "Gap" } };
          if (r.allowedTools.includes("duel"))
            return { name: "duel", args: { target_id: 3, confirm: true } };
          return null;
        },
      },
      { day: 1, commitKnightDuel: async () => "night" as const },
    );
    expect(result.interrupted).toBe(true);
    expect(events.some((e) => e.type === "debate_resolved")).toBe(true);
    expect(requests.some((r) => r.context.stage === "day_speech" && r.actorId === 1)).toBe(false);
    expect(requests.filter((r) => r.context.stage === "debate_challenge")).toHaveLength(1);
  });
test("success against sheriff retains original direction order and automatic configured handoff", async () => {
  const g = fixture(),
    events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  g.config.enableSheriff = true;
  const b = g.world.getComponent(2, COMPONENT.Badge)!;
  b.isSheriff = true;
  b.voteWeight = 2.25;
  b.handoffPolicy = "awa_holder_choice_v1";
  g.world.getComponent(2, COMPONENT.VotingRight)!.weight = 2.25;
  const pipeline = new DayPipeline({
    world: g.world,
    roleRegistry: createDefaultRoleRegistry(),
    toolGateway: new ToolGateway(),
    events,
  });
  const result = await pipeline.execute(
    g.config,
    {
      getAction: async (r) => {
        requests.push(r);
        if (r.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        if (r.allowedTools.includes("challenge"))
          return r.context.debate_target_id === 2 ? challenge : null;
        if (r.allowedTools.includes("debate_vote"))
          return { name: "debate_vote", args: { support: true } };
        if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "Speech" } };
        return null;
      },
    },
    { day: 1 },
  );
  expect(result.summary.speeches.map((s) => s.actorId)).toEqual([3, 4, 5, 6, 1]);
  expect(g.world.getComponent(1, COMPONENT.Badge)!.isSheriff).toBe(true);
  expect(g.world.getComponent(1, COMPONENT.VotingRight)!.weight).toBe(2.25);
  expect(requests.some((r) => r.allowedTools.includes("choose_badge_successor"))).toBe(false);
});

test("recursive DayPipeline during accepted debate rejects before sheriff or opening Knight requests", async () => {
  const innerRequests: ActionRequest[] = [];
  let inspected = false;
  const h = fixture([
      Role.Debater,
      Role.Wolf,
      Role.Knight,
      Role.Hunter,
      Role.Villager,
      Role.Villager,
    ]),
    history: GameEvent[] = [];
  h.config.enableSheriff = true;
  h.config.knight = { enabledWindows: [KnightDuelWindow.BeforeSpeeches] };
  const nested = new DayPipeline({
    world: h.world,
    roleRegistry: createDefaultRoleRegistry(),
    toolGateway: new ToolGateway(),
    events: history,
  });
  await run(h, history, async (r) => {
    if (r.context.stage === "debate_speech" && !inspected) {
      inspected = true;
      const count = history.length;
      await expect(
        nested.execute(
          h.config,
          {
            getAction: async (q) => {
              innerRequests.push(q);
              return null;
            },
          },
          { day: 1 },
        ),
      ).rejects.toThrow("debate_window_reentry");
      expect(innerRequests).toEqual([]);
      expect(history.length).toBe(count);
    }
    return provider([true, true, true, true, false, false])(r);
  });
  expect(inspected).toBe(true);
  expect(history.some((e) => e.type === "debate_resolved")).toBe(true);
});

test("strict debate facts reject impossible denominators and a ledger missing a party", () => {
  expect(
    readDebateEventFact("debate_resolved", {
      actorId: 1,
      targetId: 2,
      day: 1,
      eligibleCount: 1,
      supports: 1,
      rejects: 0,
      abstentions: 0,
      success: true,
      blockedId: 2,
    }),
  ).toBeNull();
  expect(
    readDebateEventFact("debate_ballots_recorded", {
      actorId: 1,
      targetId: 2,
      day: 1,
      eligibleCount: 2,
      ballots: [
        { voterId: 1, support: false },
        { voterId: 3, support: null },
      ],
    }),
  ).toBeNull();
});

test("player observation hides internal debate sequence token while reception keeps original authority", async () => {
  const g = fixture(),
    events: GameEvent[] = [],
    policy = new PlayerPromptPolicy(g.world, {
      roleCatalog: getDefaultRoleCatalog(),
      boardConfig: g.config,
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    });
  let checked = 0;
  await run(g, events, async (r) => {
    const observation = policy.buildObservation(r);
    expect(observation.request.context.debate_id).toBeUndefined();
    expect(r.context.debate_id).toMatch(/^debate:/);
    expect(observation.request.context.debate_target_id).toBe(2);
    checked++;
    return provider([true, true, true, true, false, false])(r);
  });
  expect(checked).toBe(9);
  expect(events.some((e) => e.type === "debate_resolved")).toBe(true);
});
