import { completedNight } from "../night_stage_fixture";
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Phase,
  Role,
  type ActionRequest,
  type AliveComponent,
  type GameEvent,
  type RoleComponent,
  type ToolCall,
  type World,
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import {
  knownWolfTeammates,
  wolfChatParticipants,
  wolfKnifeHolders,
  wolfTeamEvent,
} from "../../../src/game/mechanisms/roles/wolf_team";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { ActionValidator } from "../../../src/game/gateway/action_validator";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { AgentEventVisibilityRegistry } from "../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/game/mechanisms";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { GameEventRecorder } from "../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../support/temp_directory";

const fixedRoles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
const role = (world: World, id: number) => world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
const alive = (world: World, id: number) =>
  world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
const request = (
  actorId: number,
  tool: "speak_to_wolves" | "kill_vote",
  phase = Phase.Night,
): ActionRequest => ({
  actorId,
  phase,
  allowedTools: [tool],
  context: {
    day: 1,
    stage: tool === "kill_vote" ? "wolf_vote" : "wolf_discussion",
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
});

/** Synthetic contributions exercise permissions, without registering a planned role. */
function fixture(locale: "zh-CN" | "en") {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale, fixedRoles });
  const catalog = new RoleCatalog(
    getDefaultRoleCatalog()
      .all()
      .map((profile) => {
        if (profile.role === Role.Seer)
          return {
            ...profile,
            nightStages: [],
            wolfTeam: (state: RoleComponent) => ({
              recognizedByPack: false,
              recognizes: "all" as const,
              canChat: false,
              canVoteForKill: state.privateState.knife === true,
            }),
          };
        if (profile.role === Role.Guard)
          return {
            ...profile,
            nightStages: [],
            wolfTeam: {
              recognizedByPack: true,
              recognizes: "none" as const,
              canChat: true,
              canVoteForKill: false,
            },
          };
        if (profile.role === Role.Villager)
          return {
            ...profile,
            wolfTeam: {
              recognizedByPack: false,
              recognizes: [Role.Seer],
              canChat: false,
              canVoteForKill: false,
            },
          };
        return profile;
      }),
  );
  for (const id of [3, 4, 5]) role(game.world, id).camp = Camp.Wolf;
  return { ...game, catalog };
}

for (const locale of ["zh-CN", "en"] as const) {
  test(`${locale}: explicit directional/partial knowledge, chat and knife are independent of faction and survival`, () => {
    const { world, catalog } = fixture(locale);
    expect(knownWolfTeammates(world, 1, catalog)).toEqual([2, 4]);
    expect(knownWolfTeammates(world, 3, catalog)).toEqual([1, 2, 4, 5]);
    expect(knownWolfTeammates(world, 4, catalog)).toEqual([]);
    expect(knownWolfTeammates(world, 5, catalog)).toEqual([3]);
    expect(knownWolfTeammates(world, 6, catalog)).toEqual([]);
    expect(wolfChatParticipants(world, catalog)).toEqual([1, 2, 4]);
    expect(wolfKnifeHolders(world, catalog)).toEqual([1, 2]);
    alive(world, 2).alive = false;
    expect(knownWolfTeammates(world, 1, catalog)).toEqual([2, 4]);
    expect(wolfChatParticipants(world, catalog)).toEqual([1, 4]);
    expect(wolfKnifeHolders(world, catalog)).toEqual([1]);
    role(world, 3).privateState.knife = true;
    expect(wolfKnifeHolders(world, catalog)).toEqual([1, 3]);
    const policy = new PlayerPromptPolicy(world, {
      roleCatalog: catalog,
      boardConfig: sixPlayerMvpConfig,
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    });
    expect(policy.buildObservation(request(3, "kill_vote")).teammateIds).toEqual([1, 2, 4, 5]);
    expect(policy.buildObservation(request(1, "kill_vote")).teammateIds).toEqual([2, 4]);
    expect(
      policy.buildSystem(request(1, "kill_vote"), { supportsDebugReporting: false }).systemPrompt,
    ).toContain("2, 4");
    const noPermission = new RoleCatalog(
      catalog.all().map((profile) => ({ ...profile, wolfTeam: undefined })),
    );
    expect(knownWolfTeammates(world, 1, noPermission)).toEqual([]);
    expect(wolfChatParticipants(world, noPermission)).toEqual([]);
    expect(wolfKnifeHolders(world, noPermission)).toEqual([]);
  });

  test(`${locale}: reception and final gateway share current permission/phase/death checks without consuming state`, () => {
    const { world, catalog } = fixture(locale),
      rules = new ToolValidationRuleRegistry(undefined, catalog);
    const gateway = new ToolGateway(new ActionValidator(rules, false)),
      reception = new ActionReception(world, undefined, undefined, rules);
    const chat: ToolCall = { name: "speak_to_wolves", args: { text: "private", end_chat: true } };
    const knife: ToolCall = { name: "kill_vote", args: { target_id: 6, abstain: false } };
    const cases = [
      { actor: 3, call: chat, phase: Phase.Night, error: "wolf_chat_permission" },
      { actor: 4, call: knife, phase: Phase.Night, error: "wolf_kill_permission" },
      { actor: 5, call: knife, phase: Phase.Night, error: "wolf_kill_permission" },
      { actor: 6, call: chat, phase: Phase.Night, error: "wolf_chat_permission" },
      { actor: 1, call: chat, phase: Phase.Day, error: "wolf_chat_phase" },
      { actor: 1, call: knife, phase: Phase.Day, error: "wolf_kill_phase" },
    ];
    const state = () =>
      world.entityIds().map((id) => ({
        camp: role(world, id).camp,
        state: structuredClone(role(world, id).privateState),
        alive: alive(world, id).alive,
      }));
    for (const item of cases) {
      const before = state(),
        input = request(item.actor, item.call.name as "speak_to_wolves" | "kill_vote", item.phase);
      const preflight = reception.validate(input, item.call.name, item.call.args);
      const applied = gateway.validateAndSanitize(world, item.actor, item.call, {
        phase: item.phase,
      });
      expect(preflight).toMatchObject({ ok: false, error: item.error });
      expect(applied).toMatchObject({ ok: false, error: item.error });
      if (
        preflight.ok ||
        applied.ok ||
        applied.error === undefined ||
        applied.message === undefined
      )
        throw new Error("expected_rejected_permission_fixture");
      expect(preflight).toEqual({
        ...applied,
        ok: false,
        error: applied.error,
        message: applied.message,
      });
      expect(state()).toEqual(before);
    }
    expect(reception.validate(request(4, "speak_to_wolves"), chat.name, chat.args).ok).toBe(true);
    role(world, 3).privateState.knife = true;
    expect(reception.validate(request(3, "kill_vote"), knife.name, knife.args).ok).toBe(true);
    role(world, 3).privateState.knife = false;
    expect(gateway.validateAndSanitize(world, 3, knife, { phase: Phase.Night })).toMatchObject({
      ok: false,
      error: "wolf_kill_permission",
    });
    alive(world, 2).alive = false;
    expect(reception.validate(request(2, "speak_to_wolves"), chat.name, chat.args)).toMatchObject({
      ok: false,
      error: "actor_dead",
    });
  });

  test(`${locale}: event-time audiences survive death/camp changes and never appear in player wire or delayed recording`, async () => {
    const { world, catalog } = fixture(locale);
    const events: GameEvent[] = [
      { timestamp: 0, type: "phase_changed", payload: { phase: Phase.Night, day: 1 } },
      wolfTeamEvent(world, catalog, {
        timestamp: 1,
        type: "wolf_tactical_order",
        payload: { order: [1, 2, 4] },
      }),
      wolfTeamEvent(world, catalog, {
        timestamp: 2,
        type: "wolf_discussion",
        payload: { actorId: 1, text: "secret-before", endChat: false, round: 1 },
      }),
      wolfTeamEvent(world, catalog, {
        timestamp: 3,
        type: "wolf_discussion_ended",
        payload: { actorId: 4, reason: "end", round: 1 },
      }),
      wolfTeamEvent(world, catalog, {
        timestamp: 4,
        type: "wolf_kill_vote_cast",
        payload: { actorId: 1, abstain: false, targetId: 6 },
      }),
    ];
    for (const event of events.slice(1)) {
      if (!("audience" in event)) throw new Error("missing_wolf_audience_fixture");
      expect(event.audience).toEqual([1, 2, 4]);
      expect(Object.isFrozen(event.audience)).toBe(true);
    }
    // Admission after emission cannot reveal any previous private event. Exit
    // cannot erase past knowledge. A knife-only grant is independent of chat.
    role(world, 1).camp = Camp.Good;
    alive(world, 2).alive = false;
    role(world, 6).role = Role.Wolf;
    role(world, 6).camp = Camp.Wolf;
    role(world, 3).privateState.knife = true;
    events.push(
      wolfTeamEvent(world, catalog, {
        timestamp: 5,
        type: "wolf_discussion",
        payload: { actorId: 4, text: "secret-after", endChat: false, round: 2 },
      }),
    );
    events.push(
      wolfTeamEvent(world, catalog, {
        timestamp: 6,
        type: "wolf_kill_vote_cast",
        payload: { actorId: 3, abstain: true, targetId: null },
      }),
    );
    if (!("audience" in events[5]) || !("audience" in events[6]))
      throw new Error("missing_wolf_audience_fixture");
    expect(events[5].audience).toEqual([4, 6]);
    expect(events[6].audience).toEqual([3, 4, 6]);
    const expected = [
      [
        1,
        [
          "phase_changed",
          "wolf_tactical_order",
          "wolf_discussion",
          "wolf_discussion_ended",
          "wolf_kill_vote_cast",
        ],
      ],
      [
        2,
        [
          "phase_changed",
          "wolf_tactical_order",
          "wolf_discussion",
          "wolf_discussion_ended",
          "wolf_kill_vote_cast",
        ],
      ],
      [3, ["phase_changed", "wolf_kill_vote_cast"]],
      [
        4,
        [
          "phase_changed",
          "wolf_tactical_order",
          "wolf_discussion",
          "wolf_discussion_ended",
          "wolf_kill_vote_cast",
          "wolf_discussion",
          "wolf_kill_vote_cast",
        ],
      ],
      [5, ["phase_changed"]],
      [6, ["phase_changed", "wolf_discussion", "wolf_kill_vote_cast"]],
    ] as const;
    const root = await createTestTempDirectory("awa-wolf-audience-"),
      record = await SessionRecordManager.create(
        {
          sessionId: "audience",
          board: "six_player_mvp",
          locale,
          startedAtIso: new Date().toISOString(),
        },
        root,
      );
    new GameEventRecorder({ world, replayManager: record }, Phase.Night).flush(events);
    await record.flushNow();
    for (const [actor, types] of expected) {
      const projected = buildAgentVisibleEventFeed(world, events, actor);
      expect(projected.map((item) => item.type)).toEqual([...types]);
      expect(projected.map((item) => item.seq)).toEqual(types.map((_, index) => index + 1));
      expect(JSON.stringify(projected)).not.toContain('"audience"');
      const saved = JSON.parse(
        await readFile(path.join(record.sessionDir, `players/player_${actor}.json`), "utf8"),
      );
      expect(
        saved.timeline.filter((item: any) => item.kind === "event").map((item: any) => item.event),
      ).toEqual(projected);
    }
    const override = new AgentEventVisibilityRegistry({ wolf_discussion: () => true });
    expect(override.canView(world, events[2], 6)).toBe(false);
    const missing = {
      timestamp: 7,
      type: "wolf_discussion",
      payload: { actorId: 4, text: "legacy-missing" },
    } as GameEvent;
    for (const id of world.entityIds())
      expect(buildAgentVisibleEventFeed(world, [missing], id)).toEqual([]);
    const publicReplay = JSON.parse(
      await readFile(path.join(record.sessionDir, "replay.json"), "utf8"),
    );
    for (const event of publicReplay.events) {
      expect(event).not.toHaveProperty("audience");
      expect(event.payload).not.toHaveProperty("audience");
    }
  });
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual night scheduling splits chat/knife and snapshots a mid-night grant/death`, async () => {
    const { world, catalog } = fixture(locale),
      events: GameEvent[] = [],
      asked: Array<[number, string]> = [];
    const dynamicCatalog = new RoleCatalog(
      catalog.all().map((profile) =>
        profile.role !== Role.Seer
          ? profile
          : {
              ...profile,
              nightStages: [
                {
                  id: "synthetic_grant",
                  priority: 350,
                  async execute() {
                    role(world, 3).privateState.knife = true;
                    alive(world, 2).alive = false;
                  },
                },
              ],
            },
      ),
    );
    const pipeline = new NightPipeline({
      world,
      events,
      toolGateway: new ToolGateway(
        new ActionValidator(new ToolValidationRuleRegistry(undefined, dynamicCatalog)),
      ),
      damageResolutionSystem: new DamageResolutionSystem(),
      stageRegistry: new NightStageRegistry(dynamicCatalog),
    });
    const result = await pipeline.execute(
      sixPlayerMvpConfig,
      {
        async getAction(input) {
          asked.push([input.actorId, input.context.stage]);
          if (input.context.stage === "wolf_discussion")
            return {
              name: "speak_to_wolves",
              args: { text: `chat-${input.actorId}`, end_chat: true },
            };
          if (input.context.stage === "wolf_vote")
            return { name: "kill_vote", args: { target_id: 6, abstain: false } };
          throw new Error("unexpected_stage");
        },
      },
      1,
    );
    expect(
      asked
        .filter(([, stage]) => stage === "wolf_discussion")
        .map(([id]) => id)
        .sort(),
    ).toEqual([1, 2, 4]);
    expect(asked.filter(([, stage]) => stage === "wolf_vote").map(([id]) => id)).toEqual([1, 3]);
    expect(completedNight(result).summary.wolfTarget).toBe(6);
    expect(completedNight(result).damage.deaths).toEqual([6]);
    expect(
      events
        .filter((event) => event.type === "wolf_discussion_ended")
        .every((event) => JSON.stringify(event.audience) === "[1,2,4]"),
    ).toBe(true);
    expect(
      events
        .filter((event) => event.type === "wolf_kill_vote_cast")
        .map((event) => ({ actor: event.payload.actorId, audience: event.audience })),
    ).toEqual([
      { actor: 1, audience: [1, 3, 4] },
      { actor: 3, audience: [1, 3, 4] },
    ]);
    expect(
      buildAgentVisibleEventFeed(world, events, 2).some(
        (event) => event.type === "wolf_kill_vote_cast",
      ),
    ).toBe(false);
    expect(buildAgentVisibleEventFeed(world, events, 3).map((event) => event.type)).toEqual([
      "wolf_kill_vote_cast",
      "wolf_kill_vote_cast",
    ]);
  });

test("a knife revoked during an in-flight decision is not applied, retried or recorded as a repaired vote", async () => {
  const { world, catalog } = fixture("en"),
    events: GameEvent[] = [],
    asks: number[] = [];
  const pipeline = new NightPipeline({
    world,
    events,
    toolGateway: new ToolGateway(
      new ActionValidator(new ToolValidationRuleRegistry(undefined, catalog)),
    ),
    damageResolutionSystem: new DamageResolutionSystem(),
    stageRegistry: new NightStageRegistry(catalog),
  });
  const result = await pipeline.execute(
    sixPlayerMvpConfig,
    {
      async getAction(input) {
        if (input.context.stage === "wolf_discussion")
          return { name: "speak_to_wolves", args: { text: "end", end_chat: true } };
        asks.push(input.actorId);
        role(world, input.actorId).camp = Camp.Good;
        return { name: "kill_vote", args: { target_id: 6, abstain: false } };
      },
    },
    1,
  );
  expect(asks.sort()).toEqual([1, 2]);
  expect(completedNight(result).summary.wolfTarget).toBeNull();
  expect(events.filter((event) => event.type === "wolf_kill_vote_cast")).toEqual([]);
  expect(completedNight(result).damage.deaths).toEqual([]);
});

for (const locale of ["zh-CN", "en"] as const)
  for (const configured of [false, true])
    test(`${locale}: public board composition is fixed before hidden role changes (${configured ? "configured" : "opening fallback"})`, () => {
      const { world, catalog } = fixture(locale),
        board = structuredClone(sixPlayerMvpConfig);
      const policy = new PlayerPromptPolicy(world, {
        roleCatalog: catalog,
        ...(configured ? { boardConfig: board } : {}),
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      });
      const before = policy.buildBoardInfo();
      role(world, 6).role = Role.Wolf;
      role(world, 6).camp = Camp.Wolf;
      role(world, 3).role = Role.Villager;
      board.roleSetups[0].count = 99;
      board.boardSize = 99;
      expect(policy.buildBoardInfo()).toBe(before);
      expect(
        policy.buildSystem(request(1, "kill_vote"), { supportsDebugReporting: false })
          .boardInfoPrompt,
      ).toBe(before);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const tool of ["speak_to_wolves", "kill_vote"] as const)
    test(`${locale}: default SDK/ACP fallback cannot regain revoked wolf permission (${tool})`, async () => {
      const { LlmActionProvider } = await import("../../../src/ai/agents/llm/llm_action_provider");
      const { AcpActionProvider } = await import("../../../src/ai/agents/acp/acp_action_provider");
      const { world } = fixture(locale);
      const catalog = new RoleCatalog(
        getDefaultRoleCatalog()
          .all()
          .map((profile) =>
            profile.role !== Role.Wolf
              ? profile
              : {
                  ...profile,
                  wolfTeam: {
                    recognizedByPack: true,
                    recognizes: "pack" as const,
                    canChat: false,
                    canVoteForKill: false,
                  },
                },
          ),
      );
      const sdk = new LlmActionProvider(
        world,
        {
          async chat() {
            return "";
          },
          async runToolLoop() {
            throw new Error("synthetic-unavailable");
          },
        },
        { roleCatalog: catalog, boardConfig: sixPlayerMvpConfig, llmTimeoutMs: 1000 },
      );
      const acp = new AcpActionProvider(world, {
        roleCatalog: catalog,
        boardConfig: sixPlayerMvpConfig,
        turnTimeoutMs: 1000,
        sessionFactory: {
          async createSession() {
            throw new Error("synthetic-unavailable");
          },
        },
      });
      try {
        expect(await sdk.getAction(request(1, tool))).toBeNull();
        expect(await acp.getAction(request(1, tool))).toBeNull();
      } finally {
        await sdk.close();
        await acp.close();
      }
    });
