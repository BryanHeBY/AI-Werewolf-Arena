/**
 * 自爆场景测试：验证实际 pipeline 开启点、门禁、已提交死亡及提前／夜晚终局顺序。输入为原语言／窗口／毒政策矩阵和受控 DayPipeline／PM 行动；阶段、死亡／事件、警徽／枪及结果为精确字面预期，不创建新 oracle。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  ActionWindow,
  Camp,
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  PotionType,
  WinCondition,
  type ActionRequest,
  type GameEvent,
  type ToolCall,
} from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { DayPipeline } from "../../../src/game/engine/phase_pipeline/day_pipeline";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { createDefaultRoleRegistry } from "../../../src/game/mechanisms";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";

const windowHooks = {
  [ActionWindow.OnPreElection]: "onPreElection",
  [ActionWindow.OnDaybreak]: "onDaybreak",
  [ActionWindow.OnPreVote]: "onPreVote",
  [ActionWindow.OnPerSpeechGap]: "onPerSpeechGap",
} as const;

const deck = [Role.Wolf, Role.Hunter, Role.Villager, Role.Villager, Role.Villager, Role.Villager];

function board(window: ActionWindow, initialSheriff = false) {
  return {
    ...sixPlayerMvpConfig,
    enableSheriff: true,
    ...(initialSheriff ? { initialSheriffSeat: 1 } : {}),
    sheriff: { voteWeight: 2.25 },
    winConditions: [WinCondition.SlaughterCity],
    hooks: { onDaybreak: true, onPreElection: true, onPreVote: true, onPerSpeechGap: true },
    selfDestruct: { enabledWindows: [window] },
    roleSetups: [
      { role: Role.Wolf, count: 1 },
      { role: Role.Hunter, count: 1 },
      { role: Role.Villager, count: 4 },
    ],
  };
}

function ordinary(request: ActionRequest): ToolCall | null {
  if (request.allowedTools.includes("speak_to_wolves"))
    return { name: "speak_to_wolves", args: { text: "raw", end_chat: true } };
  if (request.allowedTools.includes("kill_vote"))
    return { name: "kill_vote", args: { target_id: null, abstain: true } };
  if (request.allowedTools.includes("run_for_sheriff"))
    return { name: "run_for_sheriff", args: { run: request.actorId === 3 } };
  if (request.allowedTools.includes("vote_for_sheriff"))
    return { name: "vote_for_sheriff", args: { target_id: 3, abstain: false } };
  if (request.allowedTools.includes("choose_direction"))
    return { name: "choose_direction", args: { direction: "clockwise" } };
  if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "raw" } };
  if (request.allowedTools.includes("vote"))
    return { name: "vote", args: { target_id: null, abstain: true } };
  return null;
}

for (const locale of ["zh-CN", "en"] as const)
  for (const window of Object.values(ActionWindow))
    test(`${locale}/${window}: actual cycle opens at its declared point, interrupts and ends naturally`, async () => {
      const game = bootstrapGame(board(window), { locale, fixedRoles: deck }),
        requests: ActionRequest[] = [];
      const result = await game.phaseManager.runSingleCycle({
        async getAction(request) {
          requests.push(request);
          if (request.actionWindow === window) {
            expect(request.phase).toBe(
              window === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day,
            );
            expect(request.context.turn_constraints.min_valid_actions).toBe(0);
            return { name: "self_destruct", args: { confirm: true, reason: "raw" } };
          }
          return ordinary(request);
        },
      });
      expect(result.result).toEqual({
        winner: Camp.Good,
        reason: "all_wolves_eliminated",
        outcome: {
          kind: "victory",
          primary: { kind: "faction", faction: "good", winningPlayerIds: [2, 3, 4, 5, 6] },
          additional: [],
          winningPlayerIds: [2, 3, 4, 5, 6],
        },
        decidedAt: {
          day: 1,
          phase: window === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day,
          checkpoint: "day_interrupted",
        },
      });
      expect(game.world.getAliveEntityIds()).toEqual([2, 3, 4, 5, 6]);
      expect(game.world.activeDeathActionCount).toBe(0);
      const events = game.phaseManager.getEvents(),
        blast = events.findIndex((event) => event.type === "wolf_self_destruct");
      expect(
        events.filter((event) => event.type === "wolf_self_destruct").map((event) => event.payload),
      ).toEqual([{ wolfId: 1, window }]);
      expect(blast).toBeLessThan(events.findIndex((event) => event.type === "game_over"));
      const stages = requests.map((request) => request.context.stage);
      if (window === ActionWindow.OnPreElection) {
        expect(stages).not.toContain("sheriff_nomination");
        expect(stages).not.toContain("day_speech");
        expect(blast).toBeLessThan(events.findIndex((event) => event.type === "night_resolved"));
      } else {
        expect(events.findIndex((event) => event.type === "night_resolved")).toBeLessThan(blast);
        expect(events.findIndex((event) => event.type === "sheriff_elected")).toBeLessThan(blast);
      }
      if (window === ActionWindow.OnDaybreak) {
        expect(stages).not.toContain("sheriff_choose_direction");
        expect(stages).not.toContain("day_speech");
      }
      if (window === ActionWindow.OnPerSpeechGap)
        expect(stages.filter((stage) => stage === "day_speech")).toHaveLength(1);
      if (window === ActionWindow.OnPreVote)
        expect(stages.filter((stage) => stage === "day_speech")).toHaveLength(6);
      expect(stages).not.toContain("voting");
      expect(stages).not.toContain("last_words");
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const poisonedBlast of [false, true])
    test(`${locale}: pre-election blast settles pending night deaths and last-god gun before winning, even with compound poison`, async () => {
      const config = poisonedBlast
        ? {
            ...board(ActionWindow.OnPreElection),
            roleSetups: [
              { role: Role.Wolf, count: 1 },
              { role: Role.Hunter, count: 1 },
              { role: Role.Witch, count: 1 },
              { role: Role.Villager, count: 3 },
            ],
          }
        : board(ActionWindow.OnPreElection);
      const game = bootstrapGame(config, {
          locale,
          fixedRoles: poisonedBlast
            ? [Role.Wolf, Role.Hunter, Role.Witch, Role.Villager, Role.Villager, Role.Villager]
            : deck,
        }),
        requests: ActionRequest[] = [];
      const result = await game.phaseManager.runSingleCycle({
        async getAction(request) {
          requests.push(request);
          if (request.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: 2, abstain: false } };
          if (request.allowedTools.includes("use_potion"))
            return { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } };
          if (request.actionWindow === ActionWindow.OnPreElection) {
            expect(
              request.context.visible_events.some((event) => event.type === "night_resolved"),
            ).toBe(false);
            return { name: "self_destruct", args: { confirm: true, reason: "raw" } };
          }
          if (request.allowedTools.includes("shoot")) {
            expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
            expect(request.context.death_phase).toBe(Phase.Night);
            expect(request.context.death_sources).toEqual([DeathCause.WolfKill]);
            return { name: "shoot", args: { target_id: 3 } };
          }
          return ordinary(request);
        },
      });
      expect(result.result).toEqual({
        winner: Camp.Good,
        reason: "all_wolves_eliminated",
        outcome: {
          kind: "victory",
          primary: { kind: "faction", faction: "good", winningPlayerIds: [2, 3, 4, 5, 6] },
          additional: [],
          winningPlayerIds: [2, 3, 4, 5, 6],
        },
        decidedAt: { day: 1, phase: Phase.Day, checkpoint: "day_interrupted" },
      });
      expect(game.world.getAliveEntityIds()).toEqual([4, 5, 6]);
      const events = game.phaseManager.getEvents();
      expect(
        events
          .filter((event) => event.type === "night_resolved")
          .map((event) => event.payload.deaths),
      ).toEqual([poisonedBlast ? [1, 2] : [2]]);
      expect(
        events
          .filter((event) => event.type === "last_words_spoken")
          .map((event) => event.payload.playerId),
      ).toEqual([2]);
      expect(
        events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
      ).toEqual([{ hunterId: 2, targetId: 3 }]);
      expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
      expect(events.findIndex((event) => event.type === "hunter_shot")).toBeLessThan(
        events.findIndex((event) => event.type === "game_over"),
      );
      expect(
        requests.some((request) =>
          ["sheriff_nomination", "day_speech", "voting"].includes(request.context.stage),
        ),
      ).toBe(false);
      expect(game.world.activeDeathActionCount).toBe(0);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: pre-election window is skipped when no election occurs`, async () => {
    for (const mode of ["sheriff_disabled", "initial_sheriff", "later_day"] as const) {
      const config = {
        ...board(ActionWindow.OnPreElection, mode === "initial_sheriff"),
        ...(mode === "sheriff_disabled" ? { enableSheriff: false } : {}),
      };
      const { world } = bootstrapGame(config, { locale, fixedRoles: deck }),
        events: GameEvent[] = [],
        windows: ActionWindow[] = [];
      await new DayPipeline({
        world,
        events,
        roleRegistry: createDefaultRoleRegistry(),
        toolGateway: new ToolGateway(),
      }).execute(
        config,
        {
          async getAction(request) {
            if (request.actionWindow) windows.push(request.actionWindow);
            return ordinary(request);
          },
        },
        { day: mode === "later_day" ? 2 : 1 },
      );
      expect(windows).toEqual([]);
      expect(events.some((event) => event.type === "wolf_self_destruct")).toBe(false);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const window of Object.values(ActionWindow))
    test(`${locale}/${window}: hooks and explicit empty configuration gate execution and wrong phases reject`, async () => {
      const config = board(window),
        definition = boardDefinitionFromConfig("window_test", config);
      expect(parseBoardDefinition(definition).config.selfDestruct!.enabledWindows).toEqual([
        window,
      ]);
      definition.rules.hooks[windowHooks[window]] = false;
      expect(() => parseBoardDefinition(definition)).toThrow("board_config_window_hook_disabled");
      const game = bootstrapGame(
        { ...config, selfDestruct: { enabledWindows: [] } },
        { locale, fixedRoles: deck },
      );
      let windows = 0;
      await game.phaseManager.runSingleCycle({
        async getAction(request) {
          if (request.actionWindow) windows++;
          return ordinary(request);
        },
      });
      expect(windows).toBe(0);
      const wrongPhase = window === ActionWindow.OnPreVote ? Phase.Day : Phase.Voting;
      expect(
        new ToolGateway().validateAndSanitize(
          game.world,
          1,
          { name: "self_destruct", args: { confirm: true, reason: "raw" } },
          { phase: wrongPhase, actionWindow: window, allowSelfDestruct: true },
        ),
      ).toMatchObject({ ok: false, error: "blast_phase" });
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: a public committed blast is already a real death before another microtask can change the phase`, async () => {
    const game = bootstrapGame(board(ActionWindow.OnPreElection), { locale, fixedRoles: deck });
    let observed = false,
      checks = 0;
    const watch = () => {
      if (game.phaseManager.getEvents().some((event) => event.type === "wolf_self_destruct")) {
        observed = true;
        expect(game.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(false);
        game.phaseManager.jumpTo(Phase.Voting);
      } else if (++checks < 50) queueMicrotask(watch);
    };
    const result = await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 2, abstain: false } };
        if (request.actionWindow === ActionWindow.OnPreElection) {
          queueMicrotask(watch);
          return { name: "self_destruct", args: { confirm: true, reason: "raw" } };
        }
        return ordinary(request);
      },
    });
    expect(observed).toBe(true);
    expect(result.phase).toBe(Phase.Voting);
    expect(result.gameOver).toBe(false);
    expect(game.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(false);
    expect(game.world.activeDeathActionCount).toBe(0);
    expect(
      game.phaseManager.getEvents().filter((event) => event.type === "wolf_self_destruct"),
    ).toHaveLength(1);
    expect(game.phaseManager.getEvents().filter((event) => event.type === "game_over")).toEqual([]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: declining earlier speech gaps still permits a blast after the final speech`, async () => {
    const game = bootstrapGame(board(ActionWindow.OnPerSpeechGap), { locale, fixedRoles: deck });
    let speeches = 0,
      gaps = 0;
    const result = await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.context.stage === "day_speech") speeches++;
        if (request.actionWindow === ActionWindow.OnPerSpeechGap) {
          gaps++;
          return speeches === 6
            ? { name: "self_destruct", args: { confirm: true, reason: "last gap" } }
            : null;
        }
        return ordinary(request);
      },
    });
    expect(speeches).toBe(6);
    expect(gaps).toBe(6);
    expect(result.result).toEqual({
      winner: Camp.Good,
      reason: "all_wolves_eliminated",
      outcome: {
        kind: "victory",
        primary: { kind: "faction", faction: "good", winningPlayerIds: [2, 3, 4, 5, 6] },
        additional: [],
        winningPlayerIds: [2, 3, 4, 5, 6],
      },
      decidedAt: { day: 1, phase: Phase.Day, checkpoint: "day_interrupted" },
    });
    const events = game.phaseManager.getEvents();
    const night = events.findIndex((event) => event.type === "night_resolved");
    expect(night).toBeGreaterThanOrEqual(0);
    expect(
      events
        .slice(night + 1)
        .filter((event) => event.type === "day_speech")
        .map((event) => event.payload.actorId),
    ).toEqual([4, 5, 6, 1, 2, 3]);
    expect(
      events.reduce((last, event, index) => (event.type === "day_speech" ? index : last), -1),
    ).toBeLessThan(events.findIndex((event) => event.type === "wolf_self_destruct"));
    expect(events.filter((event) => event.type === "vote_cast")).toEqual([]);
  });
