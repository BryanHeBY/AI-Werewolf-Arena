/**
 * 单元测试验证白狼王选择与提示契约。输入保留 locale／窗口／死因矩阵及受控目标／库存撤权；原字面回执、引用／getter／错误轨迹、事实和状态是预期。严格接收／提交／提示及有界 SelfDestructWindow 迟到原体撤权保留已选库存和拒绝效果，不推进 PhaseManager 周期、完整阶段或付费模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Role,
  Phase,
  ActionWindow,
  DeathCause,
  WinCondition,
  type ActionRequest,
  type RoleComponent,
  type GameEvent,
} from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { ActionReception } from "../../../../src/engine/actions/action-reception";
import {
  getWhiteWolfKingState,
  setWhiteWolfKingState,
} from "../../../../src/features/white-wolf-king/state";
import { SelfDestructWindow } from "../../../../src/rulesets/self-destruct-window";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { createDefaultRoleRegistry, getDefaultRoleCatalog } from "../../../../src/rulesets/mechanism-api";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { PlayerPromptPolicy } from "../../../../src/agents/player/player-prompt-policy";
import {
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
} from "../../../../src/rulesets/mechanism-api";
import { commitSelfDestructSelection } from "../../../../src/features/self-destruct/commit";

const deck = [Role.WhiteWolfKing, Role.Wolf, Role.Seer, Role.Hunter, Role.Villager, Role.Villager];

const board = (window: ActionWindow) => ({
  ...sixPlayerMvpConfig,
  enableSheriff: true,
  sheriff: { voteWeight: 2.25 },
  winConditions: [WinCondition.SlaughterSide],
  hooks: { onDaybreak: true, onPreElection: true, onPreVote: true, onPerSpeechGap: true },
  selfDestruct: { enabledWindows: [window] },
  roleSetups: [
    { role: Role.WhiteWolfKing, count: 1 },
    { role: Role.Wolf, count: 1 },
    { role: Role.Seer, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Villager, count: 2 },
  ],
});

const role = (world: ReturnType<typeof bootstrapGame>["world"], id: number) =>
  world.getComponent(id, COMPONENT.Role)!;

const call = (target_id: number | null) => ({
  name: "self_destruct_with_target" as const,
  args: { reason: "Raw", confirm: true, target_id },
});

const req = (target: ActionWindow = ActionWindow.OnPreVote): ActionRequest => ({
  actorId: 1,
  phase: target === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day,
  actionWindow: target,
  allowedTools: ["self_destruct_with_target"],
  context: { day: 1, stage: target, visible_events: [], turn_constraints: {} },
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: take-target receipt is strict, independent and readonly until the chosen commit`, () => {
    const { world } = bootstrapGame(board(ActionWindow.OnPreVote), { locale, fixedRoles: deck }),
      reception = new ActionReception(world),
      state = getWhiteWolfKingState(role(world, 1))!;
    for (const target of [2, 3, 4, 5, null])
      expect(reception.validate(req(), "self_destruct_with_target", call(target).args).ok).toBe(
        true,
      );
    for (const target of [1, 999, -1, 3.5])
      expect(
        reception.validate(req(), "self_destruct_with_target", call(target).args),
      ).toMatchObject({ ok: false, error: "white_wolf_blast_target" });
    expect(
      reception.validate(req(), "self_destruct_with_target", { reason: "Raw", confirm: true }),
    ).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
    expect(
      reception.validate(req(), "self_destruct_with_target", {
        reason: "Raw",
        confirm: "true",
        target_id: 3,
      }).ok,
    ).toBe(false);
    expect(
      reception.validate({ ...req(), actorId: 2 }, "self_destruct_with_target", call(3).args).ok,
    ).toBe(false);
    expect(reception.validate(req(), "self_destruct", { reason: "Raw", confirm: true }).ok).toBe(
      false,
    );
    expect(
      new ToolGateway().validateAndSanitize(world, 1, call(3), {
        phase: Phase.Night,
        actionWindow: ActionWindow.OnPreVote,
        allowSelfDestruct: true,
      }).ok,
    ).toBe(false);
    expect(state.canDetonate).toBe(true);
    const events: GameEvent[] = [],
      committed = commitSelfDestructSelection(
        world,
        { kind: "white_wolf_king", actorId: 1, targetId: 3 },
        ActionWindow.OnPreVote,
        Phase.Voting,
        events,
      );
    expect(committed).toEqual({
      deaths: [1, 3],
      sources: { 1: [DeathCause.SelfDestruct], 3: [DeathCause.WhiteWolfBlast] },
    });
    expect(state.canDetonate).toBe(false);
    expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(events.map((event) => [event.type, event.payload])).toEqual([
      [
        "white_wolf_king_self_destruct",
        { actorId: 1, targetId: 3, window: ActionWindow.OnPreVote },
      ],
    ]);
    expect(
      commitSelfDestructSelection(
        world,
        { kind: "white_wolf_king", actorId: 1, targetId: 4 },
        ActionWindow.OnPreVote,
        Phase.Voting,
        events,
      ),
    ).toBeNull();
    expect(events).toHaveLength(1);
    expect(getDefaultRoleCatalog().requireRuntime(Role.WhiteWolfKing).deathHook).toBeUndefined();
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: target death/revival/replacement or resource/identity changes discard late choices without consumption`, async () => {
    for (const change of [
      "target_life",
      "target_component",
      "resource",
      "role",
      "phase",
    ] as const) {
      const { world } = bootstrapGame(board(ActionWindow.OnDaybreak), { locale, fixedRoles: deck }),
        events: GameEvent[] = [],
        original = getWhiteWolfKingState(role(world, 1))!;
      let current = true;
      const result = await new SelfDestructWindow(
        world,
        createDefaultRoleRegistry(),
        new ToolGateway(),
      ).execute(
        new GameActionRequestFactory(world, events, 1),
        {
          async getAction(request) {
            if (request.actorId === 2) {
              if (change === "target_life") {
                const alive = world.getComponent(3, COMPONENT.Alive)!;
                alive.alive = false;
                alive.alive = true;
              }
              if (change === "target_component")
                world.addComponent(3, COMPONENT.Alive, { alive: true });
              if (change === "resource")
                setWhiteWolfKingState(role(world, 1), { canDetonate: true });
              if (change === "role") role(world, 1).role = Role.Wolf;
              if (change === "phase") current = false;
              return null;
            }
            return call(3);
          },
        },
        ActionWindow.OnDaybreak,
        Phase.Day,
        () => current,
      );
      expect(result).toBeNull();
      expect(original.canDetonate).toBe(true);
      expect(events).toEqual([]);
      expect(world.getAliveEntityIds()).toHaveLength(6);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: the actual allowed detonation tool and shared last-words rules never contradict the role prompt`, () => {
    const config = board(ActionWindow.OnPreVote),
      { world } = bootstrapGame(config, { locale, fixedRoles: deck });
    const policy = new PlayerPromptPolicy(world, {
      boardConfig: config,
      roleCatalog: getDefaultRoleCatalog(),
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    });
    const prompt = policy.buildUser(req(), {
      turnId: "t1",
      allowedTools: ["self_destruct_with_target"],
      actionSubmissionHint: "submit",
    });
    expect(prompt).toContain(
      locale === "en"
        ? "Only self_destruct_with_target changes the game"
        : "只有 self_destruct_with_target 会改变对局",
    );
    expect(prompt).not.toContain(
      locale === "en" ? "Only self_destruct changes the game" : "只有 self_destruct 会改变对局",
    );
    const normal = {
      ...req(),
      actorId: 2,
      allowedTools: ["self_destruct"] as ActionRequest["allowedTools"],
    };
    expect(
      policy.buildUser(normal, {
        turnId: "t1",
        allowedTools: ["self_destruct"],
        actionSubmissionHint: "submit",
      }),
    ).toContain(
      locale === "en" ? "Only self_destruct changes the game" : "只有 self_destruct 会改变对局",
    );
    const system = policy.buildSystem(req(), { supportsDebugReporting: false }).systemPrompt;
    expect(system).toContain(
      locale === "en" ? "White Wolf King blast targets receive none" : "白狼王带走的目标均无遗言",
    );
    if (locale === "en") expect(prompt + system).not.toMatch(/\p{Script=Han}/u);
  });
