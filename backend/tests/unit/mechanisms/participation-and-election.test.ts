/**
 * 单元测试验证白痴参与和有界警长选举 API 的原资格、候选及平票规则。输入保留全部 locale／模式矩阵、受控本地角色 profile 及直接选举／警徽／死亡操作；精确接收、提名／投票／候选／生命周期和晚资格断言是预期，不推进完整白天／PhaseManager 或记录器。
 */
import {
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../src/game/mechanisms/roles/role-catalog-assembly";

import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  type ActionRequest,
  type GameEvent,
  type RoleComponent,
} from "../../../src/core";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { ActionReception } from "../../../src/game/gateway/action-reception";
import { ActionTurn } from "../../../src/ai/agents/player/action-turn";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import {
  canBeExiled,
  canBeSheriff,
  canVote,
} from "../../../src/game/mechanisms/common/participation";
import {
  assignSheriff,
  transferOrDestroySheriffBadge,
  findSheriffId,
} from "../../../src/game/mechanisms/sheriff/badge";
import { electSheriffIfNeeded } from "../../../src/game/mechanisms/sheriff/election";
import {
  RoleCatalog,
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../src/game/mechanisms";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { getIdiotState } from "../../../src/game/mechanisms/roles/idiot/ports";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { DeathCause } from "../../../src/core/domain/deaths";

const roles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];

const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: roles });

function request(
  actorId: number,
  tool: ActionRequest["allowedTools"][number],
  stage: ActionRequest["context"]["stage"],
): ActionRequest {
  return {
    actorId,
    phase: tool === "vote" ? Phase.Voting : Phase.Day,
    allowedTools: [tool],
    context: {
      day: 1,
      stage,
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
}

function policy(world: ReturnType<typeof fixture>["world"], catalog = getDefaultRoleCatalog()) {
  return new PlayerPromptPolicy(world, {
    roleCatalog: catalog,
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
    boardConfig: twelvePlayerStandardConfig,
  });
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Idiot reveals once, retains speech, and permanently loses public vote, exile and sheriff eligibility`, async () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [],
      registry = new EventRegistry();
    expect([canVote(world, 8), canBeExiled(world, 8), canBeSheriff(world, 8)]).toEqual([
      true,
      true,
      true,
    ]);
    expect(
      assignSheriff(world, 8, { ...twelvePlayerStandardConfig, sheriff: { voteWeight: 2.75 } }),
    ).toBe(true);
    expect(registry.onVotedOut(world, 8, events)).toEqual({
      prevented: true,
      removed: [],
      reason: "idiot_revealed",
    });
    expect(world.getComponent<{ alive: boolean }>(8, COMPONENT.Alive)!.alive).toBe(true);
    expect(
      world.getComponent<{ weight: number; canVote: boolean }>(8, COMPONENT.VotingRight),
    ).toMatchObject({ weight: 0, canVote: false });
    expect(getIdiotState(world.getComponent<RoleComponent>(8, COMPONENT.Role)!)!.revealed).toBe(
      true,
    );
    expect([canVote(world, 8), canBeExiled(world, 8), canBeSheriff(world, 8)]).toEqual([
      false,
      false,
      false,
    ]);
    expect(findSheriffId(world)).toBe(1);
    expect(world.getComponent<{ weight: number }>(1, COMPONENT.VotingRight)!.weight).toBe(2.75);
    const before = structuredClone(events),
      ownBefore = structuredClone(
        world.getComponent<RoleComponent>(8, COMPONENT.Role)!.privateState,
      );
    expect(registry.onVotedOut(world, 8, events)).toEqual({
      prevented: true,
      removed: [],
      reason: "idiot_already_revealed",
    });
    expect(events).toEqual(before);
    expect(world.getComponent<RoleComponent>(8, COMPONENT.Role)!.privateState).toEqual(ownBefore);
    const reception = new ActionReception(world);
    expect(reception.validate(request(8, "speak", "day_speech"), "speak", { text: "raw" }).ok).toBe(
      true,
    );
    expect(
      reception.validate(request(8, "vote", "voting"), "vote", { target_id: null, abstain: true }),
    ).toMatchObject({ ok: false, error: "vote_right" });
    expect(
      reception.validate(request(8, "run_for_sheriff", "sheriff_nomination"), "run_for_sheriff", {
        run: true,
      }),
    ).toMatchObject({ ok: false, error: "sheriff_nomination_eligibility" });
    const sheriffVote = request(8, "vote_for_sheriff", "sheriff_vote");
    sheriffVote.context.sheriff_candidates = [9];
    expect(
      reception.validate(sheriffVote, "vote_for_sheriff", { target_id: null, abstain: true }),
    ).toMatchObject({ ok: false, error: "sheriff_vote_eligibility" });
    const turn = new ActionTurn(reception, request(9, "vote", "voting"), "t1");
    expect(turn.submit("t1", "vote", { target_id: 8, abstain: false })).toMatchObject({
      ok: false,
      error: "vote_target",
    });
    expect(turn.submit("t1", "vote", { target_id: 1, abstain: false })).toMatchObject({
      ok: true,
      accepted: true,
      applied: false,
    });
    expect(assignSheriff(world, 8)).toBe(false);
    expect(findSheriffId(world)).toBe(1);
    const bot = new BaselineBotActionProvider(world);
    expect(await bot.getAction(request(8, "vote", "voting"))).toBeNull();
    expect(await bot.getAction(request(8, "run_for_sheriff", "sheriff_nomination"))).toBeNull();
    expect(await bot.getAction(request(8, "speak", "day_speech"))).toMatchObject({ name: "speak" });
    // An unrelated component edit cannot grant back this public role restriction.
    world.getComponent<{ canVote: boolean }>(8, COMPONENT.VotingRight)!.canVote = true;
    expect(canVote(world, 8)).toBe(false);
    expect(canBeSheriff(world, 8)).toBe(false);
    const prompt = policy(world).buildUser(request(9, "vote", "voting"), {
      turnId: "t2",
      allowedTools: ["vote"],
      actionSubmissionHint: "submit",
    });
    expect(prompt).not.toContain("1, 2, 3, 4, 5, 6, 7, 8,");
    if (locale === "en") expect(prompt).not.toMatch(/\p{Script=Han}/u);
    // Poison is still a real death, rather than exile immunity.
    await new DeathResolution(world, events, new ToolGateway(), registry, {
      day: 2,
      phase: Phase.Day,
      gameOver: false,
      result: null,
    }).resolve(
      [8],
      { 8: [DeathCause.Poison] },
      {
        async getAction() {
          throw new Error("unexpected-idiot-death-action");
        },
      },
      Phase.Night,
      Phase.Day,
    );
    expect(world.getComponent<{ alive: boolean }>(8, COMPONENT.Alive)!.alive).toBe(false);
    expect(events.filter((event) => event.type === "idiot_revealed")).toHaveLength(1);
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const mode of ["no_nominations", "all_withdraw", "zero_votes", "all_candidates"] as const)
    test(`${locale}: ${mode} produces no sheriff without inventing or restoring candidates`, async () => {
      const { world } = fixture(locale),
        events: GameEvent[] = [],
        requests: ActionRequest[] = [];
      const winner = await electSheriffIfNeeded({
        world,
        events,
        day: 1,
        enableSheriff: true,
        config: twelvePlayerStandardConfig,
        toolGateway: new ToolGateway(),
        actionProvider: {
          async getAction(input) {
            requests.push(input);
            if (input.allowedTools.includes("run_for_sheriff"))
              return {
                name: "run_for_sheriff",
                args: {
                  run:
                    input.context.stage === "sheriff_withdraw"
                      ? mode !== "all_withdraw"
                      : mode === "all_candidates" ||
                        (mode !== "no_nominations" && [9, 10].includes(input.actorId)),
                },
              };
            if (input.allowedTools.includes("speak"))
              return { name: "speak", args: { text: "raw" } };
            if (input.allowedTools.includes("vote_for_sheriff"))
              return { name: "vote_for_sheriff", args: { target_id: null, abstain: true } };
            throw new Error("unexpected-election-request");
          },
        },
      });
      expect(winner).toBeNull();
      expect(findSheriffId(world)).toBeNull();
      expect(events.filter((event) => event.type === "sheriff_elected")).toEqual([]);
      expect(
        events.find((event) => event.type === "sheriff_vote_summary")!.payload.winnerId,
      ).toBeNull();
      if (mode === "no_nominations" || mode === "all_withdraw") {
        expect(
          events.find((event) => event.type === "sheriff_candidates_finalized")!.payload.candidates,
        ).toEqual([]);
        expect(requests.filter((input) => input.allowedTools.includes("vote_for_sheriff"))).toEqual(
          [],
        );
      }
      if (mode === "no_nominations")
        expect(requests.map((input) => input.context.stage)).toEqual(
          Array(12).fill("sheriff_nomination"),
        );
      if (mode === "all_candidates")
        expect(requests.filter((input) => input.allowedTools.includes("vote_for_sheriff"))).toEqual(
          [],
        );
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: withdrawn eligible candidates vote, invalid targets are never retargeted, and positive ties follow the configured strategy`, async () => {
    for (const strategy of ["min_id", "min_seat", "no_elimination"] as const) {
      const { world } = fixture(locale),
        events: GameEvent[] = [],
        voteActors: number[] = [];
      world.getComponent<{ seat: number }>(9, COMPONENT.Identity)!.seat = 10;
      world.getComponent<{ seat: number }>(10, COMPONENT.Identity)!.seat = 9;
      const winner = await electSheriffIfNeeded({
        world,
        events,
        day: 1,
        enableSheriff: true,
        config: {
          ...twelvePlayerStandardConfig,
          tieBreaker: { sheriffVote: strategy },
          sheriff: { voteWeight: 2.75 },
        },
        toolGateway: new ToolGateway(),
        actionProvider: {
          async getAction(input) {
            if (input.context.stage === "sheriff_nomination")
              return {
                name: "run_for_sheriff",
                args: { run: [9, 10, 11].includes(input.actorId) },
              };
            if (input.context.stage === "sheriff_withdraw")
              return { name: "run_for_sheriff", args: { run: input.actorId !== 11 } };
            if (input.allowedTools.includes("speak"))
              return { name: "speak", args: { text: "raw" } };
            if (input.allowedTools.includes("vote_for_sheriff")) {
              voteActors.push(input.actorId);
              return {
                name: "vote_for_sheriff",
                args: {
                  target_id:
                    input.actorId === 1
                      ? 9
                      : input.actorId === 11
                        ? 10
                        : input.actorId === 2
                          ? 11
                          : null,
                  abstain: ![1, 2, 11].includes(input.actorId),
                },
              };
            }
            throw new Error("unexpected-election-request");
          },
        },
      });
      expect(voteActors).toContain(11);
      expect(voteActors).not.toContain(9);
      expect(voteActors).not.toContain(10);
      expect(
        events
          .filter((event) => event.type === "sheriff_vote_cast")
          .some((event) => event.payload.actorId === 2),
      ).toBe(false);
      expect(winner).toBe(strategy === "min_id" ? 9 : strategy === "min_seat" ? 10 : null);
      if (winner !== null)
        expect(world.getComponent<{ weight: number }>(winner, COMPONENT.VotingRight)!.weight).toBe(
          2.75,
        );
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: revealed Idiot is excluded from nominations, sheriff votes and future badge transfer`, async () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [],
      requests: ActionRequest[] = [];
    new EventRegistry().onVotedOut(world, 8, events);
    const winner = await electSheriffIfNeeded({
      world,
      events,
      day: 1,
      enableSheriff: true,
      config: twelvePlayerStandardConfig,
      toolGateway: new ToolGateway(),
      actionProvider: {
        async getAction(input) {
          requests.push(input);
          if (input.allowedTools.includes("run_for_sheriff"))
            return { name: "run_for_sheriff", args: { run: input.actorId === 9 } };
          if (input.allowedTools.includes("speak")) return { name: "speak", args: { text: "raw" } };
          return { name: "vote_for_sheriff", args: { target_id: 9, abstain: false } };
        },
      },
    });
    expect(winner).toBe(9);
    expect(requests.some((input) => input.actorId === 8)).toBe(false);
    for (const id of [1, 2, 3, 4, 5, 6, 7])
      world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)!.alive = false;
    transferOrDestroySheriffBadge(world, 9, "test", events);
    expect(findSheriffId(world)).toBe(10);
    expect(world.getComponent<{ isSheriff: boolean }>(8, COMPONENT.Badge)!.isSheriff).toBe(false);
  });

test("candidate snapshots cannot be changed by one provider; late loss of eligibility cannot elect or record a vote", async () => {
  const { world } = fixture("en"),
    events: GameEvent[] = [];
  const winner = await electSheriffIfNeeded({
    world,
    events,
    day: 1,
    enableSheriff: true,
    config: twelvePlayerStandardConfig,
    toolGateway: new ToolGateway(),
    actionProvider: {
      async getAction(input) {
        if (input.context.stage === "sheriff_nomination")
          return { name: "run_for_sheriff", args: { run: input.actorId === 8 } };
        if (input.context.stage === "sheriff_withdraw")
          return { name: "run_for_sheriff", args: { run: true } };
        if (input.allowedTools.includes("speak")) return { name: "speak", args: { text: "raw" } };
        if (input.actorId === 1) input.context.sheriff_candidates!.push(9);
        if (input.actorId === 12) {
          await Promise.resolve();
          new EventRegistry().onVotedOut(world, 8, events);
        }
        return { name: "vote_for_sheriff", args: { target_id: 8, abstain: false } };
      },
    },
  });
  expect(winner).toBeNull();
  expect(findSheriffId(world)).toBeNull();
  expect(
    events.find((event) => event.type === "sheriff_candidates_finalized")!.payload.candidates,
  ).toEqual([8]);
  expect(events.filter((event) => event.type === "sheriff_vote_cast")).toEqual([]);
});

test("injected participation profiles govern reception, baseline targets, hints and election assignment", async () => {
  const { world } = fixture("en");
  const catalog = createRoleCatalog({
    contributions: getDefaultRoleContributions().map((profile) =>
      profile.metadata.role === Role.Villager
        ? {
            ...profile,
            runtime: {
              ...profile.runtime,
              participation: { canVote: true, canBeExiled: false, canBeSheriff: false },
            },
          }
        : profile,
    ),
  });
  const rules = new ToolValidationRuleRegistry(undefined, catalog),
    reception = new ActionReception(world, undefined, undefined, rules);
  expect(
    reception.validate(request(1, "vote", "voting"), "vote", { target_id: 9, abstain: false }),
  ).toMatchObject({ ok: false, error: "vote_target" });
  expect(
    reception.validate(request(9, "run_for_sheriff", "sheriff_nomination"), "run_for_sheriff", {
      run: true,
    }),
  ).toMatchObject({ ok: false, error: "sheriff_nomination_eligibility" });
  expect(assignSheriff(world, 9, undefined, catalog)).toBe(false);
  const fallback = await new BaselineBotActionProvider(world, catalog).getAction(
    request(12, "vote", "voting"),
  );
  expect(fallback).toEqual({ name: "vote", args: { target_id: 1, abstain: false } });
  const hint = policy(world, catalog).buildUser(request(1, "vote", "voting"), {
    turnId: "t1",
    allowedTools: ["vote"],
    actionSubmissionHint: "submit",
  });
  expect(hint).toContain("2, 3, 4, 5, 6, 7, 8");
  expect(hint).not.toContain("9, 10, 11, 12");
  const noProfile = createRoleCatalog([]);
  expect(canVote(world, 1, noProfile)).toBe(false);
  expect(canBeSheriff(world, 1, noProfile)).toBe(false);
  expect(canBeExiled(world, 1, noProfile)).toBe(false);
});
