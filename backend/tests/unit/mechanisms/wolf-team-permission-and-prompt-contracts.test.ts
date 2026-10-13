/**
 * Unit tests for wolf team access. Inputs are original directional chat/knife policies, in-flight replies
 * and event-time audiences. Original literal receipts, reference/getter/error traces, facts and expected
 * state remain the oracle. Bounded directional knowledge/reception/gateway/prompt and SDK/ACP fallback
 * clients are inert; no spawned MCP or HTTP. No complete game phase or paid model runs; existing local
 * windows and denied entry probes remain bounded.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Phase, Role, type ActionRequest, type AliveComponent, type RoleComponent, type ToolCall, type World } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { knownWolfTeammates, wolfChatParticipants, wolfKnifeHolders } from "../../../src/game/mechanisms/roles/wolf_team";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { ActionValidator } from "../../../src/game/gateway/action_validator";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/game/mechanisms";

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
    (role(world, 3).privateState as Record<string, unknown>).knife = true;
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
    (role(world, 3).privateState as Record<string, unknown>).knife = true;
    expect(reception.validate(request(3, "kill_vote"), knife.name, knife.args).ok).toBe(true);
    (role(world, 3).privateState as Record<string, unknown>).knife = false;
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
}

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
