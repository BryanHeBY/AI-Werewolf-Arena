/**
 * 单元测试验证隐狼方向性知识、生命／许可变化和有序死亡提议。单个狼聊阶段、只读交付／查验／提示及继承查询检查独立权利；原回执、引用、getter、错误、事实和状态为预期，不运行完整阶段或付费模型。
 */
import { renderRolePrompt } from "../../../../src/agents/observation/role-presentation";
import { nightStageContext } from "../../../support/builders/night-stage-context";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  WinCondition,
  COMPONENT,
  type BoardConfig,
  type RoleComponent,
  type ActionRequest,
  type GameEvent,
} from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { getHiddenWolfState } from "../../../../src/features/hidden-wolf/state";
import { refreshHiddenWolfInheritance } from "../../../../src/features/hidden-wolf/inheritance";
import {
  knownWolfTeammates,
  wolfChatParticipants,
  wolfKnifeHolders,
  wolfTeamPermissions,
} from "../../../../src/features/wolf-team/permissions";
import { RoleCatalog } from "../../../../src/rulesets/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/rulesets/roles/role-catalog-assembly";
import { resolveInspection } from "../../../../src/engine/inspection";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { ActionReception } from "../../../../src/engine/actions/action-reception";
import { PlayerPromptPolicy } from "../../../../src/agents/player/player-prompt-policy";
import {
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/rulesets/mechanism-api";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { WOLF_NIGHT_STAGES } from "../../../../src/features/wolf/night-stages";

const deck = [Role.HiddenWolf, Role.Wolf, Role.Seer, Role.Bear, Role.Villager, Role.Villager];

const config = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  winConditions: [WinCondition.SlaughterSide],
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  selfDestruct: { enabledWindows: [] },
});

const role = (game: ReturnType<typeof bootstrapGame>, id: number) =>
  game.world.getComponent(id, COMPONENT.Role)!;

const catalog = getDefaultRoleCatalog();

for (const change of ["camp", "permission"] as const)
  test(`${change}: a real successful gateway cannot publish chat after its actor loses current pack permission`, async () => {
    const game = bootstrapGame(config(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      base = new ToolGateway();
    let chat = true;
    const custom = createRoleCatalog({
      contributions: getDefaultRoleContributions().map((p) =>
        p.metadata.role === Role.Wolf
          ? {
              ...p,
              runtime: {
                ...p.runtime,
                wolfTeam: () => ({
                  recognizedByPack: true,
                  recognizes: "pack" as const,
                  canChat: chat,
                  canVoteForKill: true,
                }),
              },
            }
          : p,
      ),
    });
    const gateway = new ToolGateway();
    gateway.validateAndSanitize = (world, actor, action, context) => {
      const result = base.validateAndSanitize(world, actor, action, context);
      if (change === "camp") game.world.getComponent(actor, COMPONENT.Camp)!.camp = Camp.Good;
      else chat = false;
      return result;
    };
    await WOLF_NIGHT_STAGES[0]!.execute(
      nightStageContext({
        world: game.world,
        roleCatalog: custom,
        toolGateway: gateway,
        events,
        actionProvider: {
          async getAction() {
            return { name: "speak_to_wolves", args: { text: "Late", end_chat: true } };
          },
        },
        isCurrent: () => true,
        currentDay: () => 1,
        makeRequest: (actorId) => ({
          actorId,
          phase: Phase.Night,
          allowedTools: ["speak_to_wolves"],
          context: { day: 1, stage: "wolf_discussion", visible_events: [], turn_constraints: {} },
        }),
        getAliveByRole: () => [],
        ensureMarks: () => {
          throw new Error("unused");
        },
        pickMajorityTarget: () => null,
        shuffleWolves: (ids) => ids,
        state: {
          wolfChatOrder: [],
          endedWolves: new Set(),
          wolfVotes: {},
          wolfTarget: null,
          seerChecks: [],
        },
      }),
    );
    expect(
      events.some((e) => e.type === "wolf_discussion" || e.type === "wolf_discussion_ended"),
    ).toBe(false);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: single-direction ID knowledge does not grant chat, knife, blast or other-role state, and all preflights are read-only`, () => {
    const game = bootstrapGame(config(), { fixedRoles: deck, locale }),
      before = structuredClone(role(game, 1).privateState),
      request: ActionRequest = {
        actorId: 1,
        phase: Phase.Night,
        allowedTools: ["kill_vote"],
        context: { day: 1, stage: "wolf_vote", visible_events: [], turn_constraints: {} },
      },
      reception = new ActionReception(game.world),
      policy = new PlayerPromptPolicy(game.world, {
        boardConfig: config(),
        roleCatalog: catalog,
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
      });
    expect(knownWolfTeammates(game.world, 1, catalog)).toEqual([2]);
    expect(knownWolfTeammates(game.world, 2, catalog)).toEqual([]);
    expect(wolfChatParticipants(game.world, catalog)).toEqual([2]);
    expect(wolfKnifeHolders(game.world, catalog)).toEqual([2]);
    expect(
      reception.validate(request, "kill_vote", { target_id: 5, abstain: false }),
    ).toMatchObject({ ok: false, error: "wolf_kill_permission" });
    expect(
      reception.validate({ ...request, allowedTools: ["speak_to_wolves"] }, "speak_to_wolves", {
        text: "Raw",
        end_chat: true,
      }),
    ).toMatchObject({ ok: false, error: "wolf_chat_permission" });
    expect(
      reception.validate(
        { ...request, phase: Phase.Day, allowedTools: ["self_destruct"] },
        "self_destruct",
        { confirm: true, reason: "Raw" },
      ).ok,
    ).toBe(false);
    expect(resolveInspection(game.world, 1, "camp", catalog)).toEqual({
      kind: "camp",
      camp: Camp.Good,
    });
    expect(resolveInspection(game.world, 1, "role", catalog)).toEqual({
      kind: "role",
      role: Role.Villager,
    });
    expect(policy.buildObservation(request).ownState.hiddenWolf).toEqual({
      hasInheritedKnife: false,
      canVoteForKill: false,
    });
    expect(policy.buildObservation({ ...request, actorId: 2 }).ownState.hiddenWolf).toBeUndefined();
    expect(renderRolePrompt(role(game, 1), locale)).toContain(
      locale === "en"
        ? "Personally inherited the knife: No; currently able to attack: No."
        : "本人曾获得刀权：否；当前可出刀：否。",
    );
    expect(role(game, 1).privateState).toEqual(before);
  });

test("opening sole Hidden Wolf inherits once, has only the basic knife and no chat, with conservative world-less compatibility", () => {
  const fixed = [Role.HiddenWolf, Role.Seer, Role.Bear, Role.Hunter, Role.Villager, Role.Villager],
    game = bootstrapGame(config(fixed), { fixedRoles: fixed });
  expect(getHiddenWolfState(role(game, 1))).toEqual({ hasInheritedKnife: true });
  expect(wolfKnifeHolders(game.world, catalog)).toEqual([1]);
  expect(wolfChatParticipants(game.world, catalog)).toEqual([]);
  expect(
    wolfTeamPermissions(role(game, 1), catalog, () => game.world.getComponent(1, COMPONENT.Camp))
      .canVoteForKill,
  ).toBe(false);
  expect(resolveInspection(game.world, 1, "role", catalog)).toEqual({
    kind: "role",
    role: Role.HiddenWolf,
  });
  const events = game.phaseManager.getEvents(),
    before = events.length;
  refreshHiddenWolfInheritance(game.world, events, 1);
  expect(events).toHaveLength(before);
  expect(events.filter((e) => e.type === "hidden_wolf_awakened").map((e) => e.payload)).toEqual([
    { actorId: 1, day: 1 },
  ]);
  for (const actor of game.world.entityIds())
    expect(
      buildAgentVisibleEventFeed(game.world, events, actor).some(
        (e) => e.type === "hidden_wolf_awakened",
      ),
    ).toBe(actor === 1);
});
