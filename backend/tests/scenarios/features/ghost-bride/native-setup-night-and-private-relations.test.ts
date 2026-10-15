/**
 * 场景测试驱动鬼新娘原择婚、完整阶段与伴侣死亡交互。输入为固定新郎／证婚人阵容、实际请求工厂和受控选择；预期来自原字面角色／库存引用、目标、死亡名单和私密提示排除。原生库存仍由实际 owner 持有，不调用模型。
 */
import { expect, test, spyOn } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { COMPONENT, Camp, Phase, PotionType, type ActionRequest, type ToolCall, type GameEvent, type RoleComponent, type AliveComponent } from "../../../../src/domain";
import { ghostBrideBoard, ghostBrideDeck } from "../../../support/features/ghost-bride/builders/scenario";
import { GhostBrideSetupWindow } from "../../../../src/game/mechanisms/roles/ghost_bride/setup";
import {
  ghostBrideReady,
  hasActiveGhostBride,
  weddingGroup,
  weddingSetup,
} from "../../../../src/game/mechanisms/roles/ghost_bride/authority";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { knownWolfTeammates, wolfKnifeHolders } from "../../../../src/game/mechanisms/roles/wolf_team";
import { getDefaultRoleCatalog, getDefaultTargetHintRegistry, getDefaultPhaseStageLocalizationRegistry, getDefaultConfigRenderRegistry, getDefaultToolSpecRegistry } from "../../../../src/game/mechanisms";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { resolveInspection } from "../../../../src/game/mechanisms/roles/inspection";

function fixture(locale: "zh-CN" | "en" = "zh-CN") {
  const config = ghostBrideBoard();
  return {
    ...bootstrapGame(config, { fixedRoles: ghostBrideDeck, locale }),
    config,
    events: [] as GameEvent[],
  };
}

function choices(groom = 2, witness = 3) {
  return async (request: ActionRequest): Promise<ToolCall | null> => {
    if (request.allowedTools.includes("choose_bridegroom"))
      return { name: "choose_bridegroom", args: { target_id: groom } };
    if (request.allowedTools.includes("speak_to_partner"))
      return { name: "speak_to_partner", args: { text: "" } };
    if (request.allowedTools.includes("choose_wedding_witness"))
      return { name: "choose_wedding_witness", args: { target_id: witness } };
    return null;
  };
}

function neutral(request: ActionRequest): ToolCall | null {
  if (request.allowedTools.includes("guard"))
    return { name: "guard", args: { target_id: null, abstain: true } };
  if (request.allowedTools.includes("speak_to_wolves"))
    return { name: "speak_to_wolves", args: { text: "", end_chat: true } };
  if (request.allowedTools.includes("kill_vote"))
    return { name: "kill_vote", args: { target_id: null, abstain: true } };
  if (request.allowedTools.includes("use_potion"))
    return { name: "use_potion", args: { target_id: 10, potion_type: PotionType.None } };
  if (request.allowedTools.includes("check_identity"))
    return { name: "check_identity", args: { target_id: 5 } };
  if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "" } };
  if (request.allowedTools.includes("run_for_sheriff"))
    return { name: "run_for_sheriff", args: { run: false } };
  if (request.allowedTools.includes("vote"))
    return { name: "vote", args: { target_id: null, abstain: true } };
  return null;
}

for (const [groom, witness] of [
  [2, 3],
  [9, 10],
  [10, 11],
  [12, 9],
])
  test(`actual bootstrap/factory/setup preserves native ${groom}/${witness} and final independent goals`, async () => {
    const g = fixture(),
      seen: ActionRequest[] = [],
      reception = new ActionReception(g.world);
    const originalRoles = g.world
      .entityIds()
      .map((id) => g.world.getComponent(id, COMPONENT.Role)!);
    const originalStocks = originalRoles.map((role) => role.privateState);
    await new GhostBrideSetupWindow(g.world, new ToolGateway(), g.events, { get requestFactory() { return GameActionRequestFactory; } }).execute(
      g.boardConfig,
      {
        getAction: async (request) => {
          seen.push(request);
          const call = await choices(groom, witness)(request);
          expect(call).not.toBeNull();
          expect(reception.validate(request, call!.name, call!.args).ok).toBe(true);
          return call;
        },
      },
      1,
      () => true,
    );
    expect(ghostBrideReady(g.world)).toBe(true);
    expect(weddingGroup(g.world)?.witnessId).toBe(witness);
    expect(seen).toHaveLength(5);
    expect(seen[4]!.context.proposedWitnessId).toBe(witness);
    expect(seen[3]!.context.proposedWitnessId).toBeUndefined();
    for (let i = 0; i < 12; i++) {
      expect(g.world.getComponent(i + 1, COMPONENT.Role)).toBe(originalRoles[i]);
      expect(originalRoles[i]!.privateState).toBe(originalStocks[i]);
      expect(originalRoles[i]!.role).toBe(ghostBrideDeck[i]!);
    }
    expect(resolveInspection(g.world, 1, "camp", getDefaultRoleCatalog())).toEqual({
      kind: "camp",
      camp: Camp.Good,
    });
    expect(wolfKnifeHolders(g.world, getDefaultRoleCatalog())).toEqual(
      [2, 3, 4].filter((id) => ![groom, witness].includes(id)),
    );
    expect(knownWolfTeammates(g.world, 4, getDefaultRoleCatalog())).toEqual(
      [2, 3].filter((id) => ![groom, witness].includes(id)),
    );
    expect(buildAgentVisibleEventFeed(g.world, g.events, witness).map((e) => e.type)).toEqual([
      "ghost_bride_group_chosen",
    ]);
    expect(buildAgentVisibleEventFeed(g.world, g.events, 4)).toEqual([]);
    expect(
      buildAgentVisibleEventFeed(g.world, g.events, 1).filter(
        (e) => e.type === "ghost_bride_partner_chat",
      ),
    ).toHaveLength(2);
  });

test("actual first-night factory order keeps Guard before ordinary chat and native skills; relation settles inside Night", async () => {
  const g = fixture(),
    stages: string[] = [];
  await g.phaseManager.runSingleCycle(
    {
      getAction: async (request) => {
        stages.push(request.context.stage);
        const choice = await choices()(request);
        if (choice) return choice;
        if (request.allowedTools.includes("guard"))
          return { name: "guard", args: { target_id: null, abstain: true } };
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 2, abstain: false } };
        if (request.allowedTools.includes("use_potion"))
          return { name: "use_potion", args: { target_id: 10, potion_type: PotionType.None } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 1 } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "" } };
        if (request.allowedTools.includes("run_for_sheriff"))
          return { name: "run_for_sheriff", args: { run: false } };
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: 4, abstain: false } };
        return null;
      },
    },
    10,
  );
  expect(stages.slice(0, 5)).toEqual([
    "ghost_bride_groom",
    "ghost_bride_chat",
    "ghost_bride_chat",
    "ghost_bride_witness",
    "ghost_bride_witness",
  ]);
  expect(stages.indexOf("guard")).toBeLessThan(stages.indexOf("wolf_discussion"));
  expect(stages.indexOf("wolf_vote")).toBeLessThan(stages.indexOf("witch"));
  expect(stages.indexOf("witch")).toBeLessThan(stages.indexOf("seer"));
  const events = g.phaseManager.getEvents(),
    nightResolved = events.findIndex((e) => e.type === "night_resolved"),
    grief = events.findIndex((e) => e.type === "ghost_bride_partner_death");
  expect(events.find((e) => e.type === "night_resolved")!.payload).toEqual({ deaths: [2, 1] });
  expect(grief).toBeGreaterThan(0);
  expect(grief).toBeLessThan(nightResolved);
  expect(g.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(false);
  expect(g.world.getComponent(2, COMPONENT.Alive)!.alive).toBe(false);
  expect(g.phaseManager.getSnapshot().gameOver).toBe(false);
});

test("setup failure blocks ordinary actions and cycle rescue", async () => {
  const g = fixture();
  await expect(g.phaseManager.runSingleCycle({ getAction: async () => null }, 1)).rejects.toThrow(
    "ghost_bride_required_action_missing",
  );
  expect(weddingSetup(g.world)?.status).toBe("failed");
  await expect(g.phaseManager.runSingleCycle({ getAction: async () => null }, 0)).rejects.toThrow(
    "ghost_bride_cycle_reentry",
  );
  expect(() => g.phaseManager.jumpTo(Phase.Day)).toThrow("ghost_bride_phase_reentry");
});

for (const poison of [false, true])
  test(`handoff revokes WolfKill before actual death and preserves independent poison=${poison}`, async () => {
    const g = fixture();
    const original = NightPipeline.prototype.execute;
    const intercepted = spyOn(NightPipeline.prototype, "execute").mockImplementation(
      async function (this: NightPipeline, ...args) {
        const result = await original.apply(this, args);
        // Exact cross-await gap: captured pack owner dies after pipeline result, before PM commits.
        g.world.getComponent(4, COMPONENT.Alive)!.alive = false;
        return result;
      },
    );
    try {
      await g.phaseManager.runSingleCycle(
        {
          getAction: async (request) => {
            const setup = await choices()(request);
            if (setup) return setup;
            if (request.allowedTools.includes("kill_vote"))
              return { name: "kill_vote", args: { target_id: 5, abstain: false } };
            if (poison && request.allowedTools.includes("use_potion"))
              return { name: "use_potion", args: { target_id: 5, potion_type: PotionType.Poison } };
            return neutral(request);
          },
        },
        10,
      );
      expect(g.world.getComponent(5, COMPONENT.Alive)!.alive).toBe(!poison);
      expect(g.phaseManager.getEvents().find((e) => e.type === "night_resolved")!.payload).toEqual({
        deaths: poison ? [5] : [],
      });
      expect(hasActiveGhostBride(g.world)).toBe(false);
    } finally {
      intercepted.mockRestore();
    }
  });

test("day exile publishes partner death IDs without exposing marriage metadata", async () => {
  const g = fixture();
  await g.phaseManager.runSingleCycle(
    {
      getAction: async (request) => {
        const setup = await choices()(request);
        if (setup) return setup;
        if (request.allowedTools.includes("vote"))
          return {
            name: "vote",
            args: { target_id: request.actorId === 2 ? null : 2, abstain: request.actorId === 2 },
          };
        return neutral(request);
      },
    },
    10,
  );
  const events = g.phaseManager.getEvents();
  expect(events.find((e) => e.type === "additional_deaths")?.payload).toEqual({ deaths: [1] });
  expect(
    buildAgentVisibleEventFeed(g.world, events, 4).filter((e) => e.type.startsWith("ghost_bride_")),
  ).toEqual([]);
  expect(g.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(false);
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: post-knife ordinary wolf request, observation and both prompts contain no marriage fact`, async () => {
    const g = fixture(locale);
    const policy = new PlayerPromptPolicy(g.world, {
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      roleCatalog: getDefaultRoleCatalog(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
      boardConfig: g.config,
    });
    let checked = false;
    await g.phaseManager.runSingleCycle(
      {
        getAction: async (request) => {
          const setup = await choices()(request);
          if (setup) return setup;
          if (request.actorId === 4 && request.context.stage === "voting") {
            const observation = policy.buildObservation(request);
            const system = policy.buildSystem(request, {
              supportsDebugReporting: false,
            }).systemPrompt;
            const user = policy.buildUser(request, {
              turnId: "t1",
              allowedTools: request.allowedTools,
              actionSubmissionHint: "submit_action",
            });
            expect(
              request.context.visible_events.some((e) => e.type.startsWith("ghost_bride_")),
            ).toBe(false);
            expect(
              request.context.visible_events.some((e) => e.type === "wolf_kill_vote_cast"),
            ).toBe(true);
            expect(observation.ownState.wedding).toBeUndefined();
            expect(observation.ownState.ghostBride).toBeUndefined();
            expect(JSON.stringify(observation)).not.toContain("ghost-bride:1:");
            expect(system).not.toContain("ghost-bride:1:");
            expect(user).not.toContain("ghost-bride:1:");
            checked = true;
          }
          return neutral(request);
        },
      },
      10,
    );
    expect(checked).toBe(true);
  });
