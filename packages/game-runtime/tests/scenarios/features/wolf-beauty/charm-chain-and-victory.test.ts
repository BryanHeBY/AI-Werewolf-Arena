/**
 * 场景测试验证狼美人关系链与判胜。输入保留魅惑／死因／locale／胜利参数及受控迟到提案；原字面回执、引用／getter／错误轨迹、事实和状态是预期。实际中心 DeathResolution（含异步撤销 hook）及 PhaseManager 周期结算复合死因、枪、魅惑、警徽与有序胜利；模型由受控 provider 替代，生产输出不生成新 golden。
 */
import { invokeDeathHook } from "../../../../src/engine/hooks/registry";
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { PotionType } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  COMPONENT,
  WinCondition,
  KnightDuelWindow,
  type BoardConfig,
  type ActionRequest,
  type RoleComponent,
} from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { getWolfBeautyState } from "../../../../src/features/wolf-beauty/ports";
import { ActionReception } from "../../../../src/engine/actions/action-reception";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { bindCharm } from "../../../../src/features/wolf-beauty/relation";
import { DeathCause, type GameEvent } from "../../../../src/domain";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";

import { DeathResolution } from "../../../../src/engine/death-resolution";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { HookRegistry } from "../../../../src/engine/hooks/registry";
import { wolfBeautyDeathHook } from "../../../../src/features/wolf-beauty/death-hook";

const deck = [Role.WolfBeauty, Role.Wolf, Role.Witch, Role.Knight, Role.Villager, Role.Villager];

const board = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  winConditions: [WinCondition.SlaughterSide],
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((item) => item === role).length,
  })),
  knight: { enabledWindows: [KnightDuelWindow.AfterSpeeches] },
});

const role = (game: ReturnType<typeof bootstrapGame>, id: number) =>
  game.world.getComponent(id, COMPONENT.Role)!;

for (const mutation of [
  "replace_life",
  "revive",
  "clear_binding",
  "replace_state",
  "change_policy",
] as const)
  test(`${mutation}: a revoked real hook proposal cannot kill or add sources/public facts after its await`, async () => {
    const game = bootstrapGame(board(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      state = getWolfBeautyState(role(game, 1))!;
    (state as { targetId: number | null }).targetId = 5;
    bindCharm(game.world, 1, 5);
    const original = game.world.getComponent(5, COMPONENT.Alive)!;
    const registry = new EventRegistry(
      new HookRegistry(
        [],
        [
          async (...args) => {
            const result = await invokeDeathHook(
              wolfBeautyDeathHook,
              game.world,
              args[1],
              args[2],
              args[3],
              events,
              args[4],
            );
            queueMicrotask(() => {
              if (mutation === "replace_life")
                game.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
              if (mutation === "revive") {
                original.alive = false;
                original.alive = true;
              }
              if (mutation === "change_policy")
                (
                  state as {
                    deathLinkPolicy:
                      "awa_exile_poison_v1" | "heroes_s7_2017_exile_hunter_v1" | undefined;
                  }
                ).deathLinkPolicy = "heroes_s7_2017_exile_hunter_v1";
              if (mutation === "clear_binding") bindCharm(game.world, 1, null);
              if (mutation === "replace_state")
                (role(game, 1).privateState as Record<string, unknown>).wolf_beauty = {
                  targetId: null,
                  lastActedDay: null,
                  history: [],
                };
            });
            return result;
          },
        ],
      ),
    );
    const resolution = new DeathResolution(game.world, events, new ToolGateway(), registry, {
      day: 1,
      phase: Phase.Voting,
      gameOver: false,
      result: null,
    });
    await resolution.resolve(
      [1],
      { 1: [DeathCause.Exile] },
      {
        async getAction() {
          return { name: "speak", args: { text: "Original words" } };
        },
      },
      Phase.Voting,
      Phase.Voting,
    );
    expect(game.world.getComponent(5, COMPONENT.Alive)!.alive).toBe(true);
    expect(original.alive).toBe(true);
    expect(
      events.some((event) =>
        ["additional_deaths", "charm_death", "charm_blocked"].includes(event.type),
      ),
    ).toBe(false);
  });

test("same-wave knife Hunter retains already valid initial words, while a later charm cause suppresses its pending gun", async () => {
  const fixed = [Role.WolfBeauty, Role.Wolf, Role.Witch, Role.Knight, Role.Hunter, Role.Villager],
    game = bootstrapGame(board(fixed), { fixedRoles: fixed });
  let guns = 0;
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 5, abstain: false } };
      if (request.allowedTools.includes("charm")) return { name: "charm", args: { target_id: 5 } };
      if (request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (request.allowedTools.includes("duel")) return null;
      if (request.allowedTools.includes("shoot")) {
        guns++;
        throw new Error("charm_forbids_pending_gun");
      }
      if (request.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: 2, abstain: false } };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  });
  const events = game.phaseManager.getEvents();
  expect(guns).toBe(0);
  expect(
    events
      .filter((event) => event.type === "last_words_spoken")
      .map((event) => event.payload.playerId),
  ).toEqual([1, 5, 2]);
  expect(
    events.filter((event) => event.type === "charm_death").map((event) => event.payload),
  ).toEqual([{ actorId: 1, targetId: 5 }]);
  expect(events.some((event) => event.type === "additional_deaths")).toBe(false);
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 6]);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
});

for (const lastVillager of [false, true])
  test(`last Beauty villager side/${lastVillager}: actual side completion is required for the special victory`, async () => {
    const fixed = lastVillager
        ? [Role.WolfBeauty, Role.Witch, Role.Knight, Role.Knight, Role.Seer, Role.Villager]
        : [Role.WolfBeauty, Role.Witch, Role.Knight, Role.Villager, Role.Villager, Role.Villager],
      game = bootstrapGame(board(fixed), { fixedRoles: fixed });
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 3, abstain: false } };
        if (request.allowedTools.includes("charm"))
          return { name: "charm", args: { target_id: lastVillager ? 6 : 4 } };
        if (request.allowedTools.includes("use_potion"))
          return { name: "use_potion", args: { target_id: 2, potion_type: PotionType.None } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 1 } };
        if (request.allowedTools.includes("duel")) return null;
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: 1, abstain: false } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    expect(game.phaseManager.getSnapshot().result).toMatchObject({
      winner: lastVillager ? Camp.Wolf : Camp.Good,
      reason: lastVillager ? "wolf_beauty_last_exile" : "all_wolves_eliminated",
    });
    expect(game.world.getAliveEntityIds()).toEqual(lastVillager ? [2, 4, 5] : [2, 5, 6]);
  });

for (const cycle of [false, true])
  test(`multiple Beauties/${cycle}: independent bindings terminate and Charm alone cannot recursively trigger another Beauty`, async () => {
    const fixed = cycle
        ? [Role.WolfBeauty, Role.WolfBeauty, Role.Witch, Role.Witch, Role.Villager, Role.Villager]
        : [Role.WolfBeauty, Role.WolfBeauty, Role.Witch, Role.Knight, Role.Hunter, Role.Villager],
      game = bootstrapGame(board(fixed), { fixedRoles: fixed });
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: cycle ? null : 6, abstain: cycle } };
        if (request.allowedTools.includes("charm"))
          return { name: "charm", args: { target_id: request.actorId === 1 ? 2 : cycle ? 1 : 5 } };
        if (request.allowedTools.includes("use_potion"))
          return {
            name: "use_potion",
            args: { target_id: request.actorId === 3 ? 1 : 2, potion_type: PotionType.Poison },
          };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    const events = game.phaseManager.getEvents();
    expect(
      events
        .filter((event) => event.type === "charm_death")
        .map((event) => [event.payload.actorId, event.payload.targetId]),
    ).toEqual(
      cycle
        ? [
            [1, 2],
            [2, 1],
          ]
        : [[1, 2]],
    );
    expect(
      events
        .filter((event) => event.type === "additional_deaths")
        .map((event) => event.payload.deaths),
    ).toEqual(cycle ? [] : [[2]]);
    expect(events.some((event) => event.type === "hunter_shot")).toBe(false);
    expect(game.world.getAliveEntityIds()).toEqual(cycle ? [3, 4, 5, 6] : [3, 4, 5]);
    expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  });

for (const heal of [false, true])
  test(`Night guard/heal/${heal}: ordinary protection never blocks the charm cause or grants the dying Hunter a gun`, async () => {
    const fixed = [
        Role.WolfBeauty,
        Role.Wolf,
        Role.Witch,
        Role.Guard,
        Role.Witch,
        Role.Hunter,
        Role.Villager,
        Role.Villager,
      ],
      game = bootstrapGame({ ...board(fixed), boardSize: 8 }, { fixedRoles: fixed });
    let guns = 0;
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 6, abstain: false } };
        if (request.allowedTools.includes("guard"))
          return { name: "guard", args: { target_id: 6, abstain: false } };
        if (request.allowedTools.includes("charm"))
          return { name: "charm", args: { target_id: 6 } };
        if (request.allowedTools.includes("use_potion"))
          return request.actorId === 5
            ? { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } }
            : {
                name: "use_potion",
                args: {
                  target_id: heal ? 6 : 3,
                  potion_type: heal ? PotionType.Heal : PotionType.None,
                },
              };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("shoot")) {
          guns++;
          throw new Error("charm_forbids_gun");
        }
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: 2, abstain: false } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    expect(guns).toBe(0);
    expect(
      game.phaseManager
        .getEvents()
        .filter((event) => event.type === "charm_death")
        .map((event) => event.payload.targetId),
    ).toEqual([6]);
    expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 7, 8]);
    expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const mode of ["exile", "poison", "duel", "night_dream_block", "night_dream_chain"] as const)
    test(`${locale}/${mode}: actual death chains obey Charm causes, protection, suppression and public/private boundaries`, async () => {
      const fixed = [
          Role.WolfBeauty,
          Role.Wolf,
          Role.Witch,
          mode.startsWith("night_dream") ? Role.Dreamer : Role.Knight,
          Role.Villager,
          Role.Villager,
        ],
        game = bootstrapGame(board(fixed), { locale, fixedRoles: fixed });
      await game.phaseManager.runSingleCycle({
        async getAction(request) {
          if (request.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (request.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: 6, abstain: false } };
          if (request.allowedTools.includes("dream"))
            return { name: "dream", args: { target_id: 5 } };
          if (request.allowedTools.includes("charm"))
            return {
              name: "charm",
              args: { target_id: mode === "night_dream_chain" ? 4 : mode === "duel" ? 3 : 5 },
            };
          if (request.allowedTools.includes("use_potion"))
            return {
              name: "use_potion",
              args: {
                target_id: mode === "poison" || mode.startsWith("night_dream") ? 1 : 3,
                potion_type:
                  mode === PotionType.Poison || mode.startsWith("night_dream")
                    ? PotionType.Poison
                    : PotionType.None,
              },
            };
          if (request.allowedTools.includes("duel"))
            return mode === "duel" ? { name: "duel", args: { target_id: 1, confirm: true } } : null;
          if (request.allowedTools.includes("speak"))
            return { name: "speak", args: { text: "Raw" } };
          if (request.allowedTools.includes("vote"))
            return {
              name: "vote",
              args: { target_id: mode === "night_dream_block" ? 2 : 1, abstain: false },
            };
          throw new Error(`unexpected:${request.context.stage}`);
        },
      });
      const events = game.phaseManager.getEvents();
      expect(
        events
          .filter((event) => event.type === "charm_death")
          .map((event) => event.payload.targetId),
      ).toEqual(
        mode === "duel" || mode === "night_dream_block"
          ? []
          : [mode === "night_dream_chain" ? 4 : 5],
      );
      expect(
        events
          .filter((event) => event.type === "charm_blocked")
          .map((event) => event.payload.targetId),
      ).toEqual(mode === "night_dream_block" ? [5] : []);
      expect(
        events
          .filter((event) => event.type === "additional_deaths")
          .map((event) => event.payload.deaths),
      ).toEqual(
        mode === "duel" || mode === "night_dream_block"
          ? []
          : mode === "night_dream_chain"
            ? [[4, 5]]
            : [[5]],
      );
      expect(
        events.some((event) => event.type === "hunter_shot" || event.type === "wolf_king_shot"),
      ).toBe(false);
      expect(
        events
          .filter((event) => event.type === "last_words_spoken")
          .map((event) => event.payload.playerId),
      ).toEqual(
        mode === "exile"
          ? [6, 1]
          : mode === "duel"
            ? [6]
            : mode === "night_dream_block"
              ? [1, 6, 2]
              : [1, 6],
      );
      if (mode === "night_dream_block") {
        expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5]);
        expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
      } else if (mode === "duel") {
        expect(game.world.getAliveEntityIds()).toEqual([2, 3, 4, 5]);
        expect(game.phaseManager.getSnapshot()).toEqual({
          day: 2,
          phase: Phase.Night,
          gameOver: false,
          result: null,
        });
      } else
        expect(game.phaseManager.getSnapshot().result).toMatchObject({
          winner: Camp.Wolf,
          reason: "slaughter_side_completed",
        });
      for (const actor of game.world.entityIds()) {
        const feed = buildAgentVisibleEventFeed(game.world, events, actor);
        expect(feed.some((event) => event.type === "charm_applied")).toBe(actor === 1);
        expect(
          feed.some((event) => event.type === "charm_death" || event.type === "charm_blocked"),
        ).toBe(false);
      }
    });

for (const conditions of [
  [WinCondition.SlaughterSide],
  [WinCondition.SlaughterCity],
  [WinCondition.SlaughterCity, WinCondition.SlaughterSide],
  [WinCondition.SlaughterSide, WinCondition.SlaughterCity],
])
  test(`last Beauty god side/${conditions.join("+")}: complete charm and badge chain first, then obey ordered victory conditions`, async () => {
    const fixed = [
        Role.WolfBeauty,
        Role.Witch,
        Role.Knight,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ],
      game = bootstrapGame(
        { ...board(fixed), winConditions: conditions, enableSheriff: true, initialSheriffSeat: 1 },
        { fixedRoles: fixed },
      );
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 3, abstain: false } };
        if (request.allowedTools.includes("charm"))
          return { name: "charm", args: { target_id: 2 } };
        if (request.allowedTools.includes("use_potion"))
          return { name: "use_potion", args: { target_id: 2, potion_type: PotionType.None } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: 1, abstain: false } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    const wolf = conditions[0] === WinCondition.SlaughterSide,
      winners = wolf ? [1] : [2, 3, 4, 5, 6];
    expect(game.phaseManager.getSnapshot().result).toEqual({
      winner: wolf ? Camp.Wolf : Camp.Good,
      reason: wolf ? "wolf_beauty_last_exile" : "all_wolves_eliminated",
      outcome: {
        kind: "victory",
        primary: { kind: "faction", faction: wolf ? "wolf" : "good", winningPlayerIds: winners },
        additional: [],
        winningPlayerIds: winners,
      },
      decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" },
    });
    expect(game.world.getAliveEntityIds()).toEqual([4, 5, 6]);
    const events = game.phaseManager.getEvents();
    expect(events.findIndex((event) => event.type === "additional_deaths")).toBeLessThan(
      events.findIndex((event) => event.type === "game_over"),
    );
    const badges = events.filter((event) => event.type === "sheriff_badge_transferred");
    expect(badges.map((event) => [event.payload.fromId, event.payload.toId])).toEqual([
      [1, 2],
      [2, 4],
    ]);
    expect(events.findIndex((event) => event === badges.at(-1))).toBeLessThan(
      events.findIndex((event) => event.type === "game_over"),
    );
  });

test("skip clears current charm and adjacent-night duplicate rejection never mutates the old state", async () => {
  const game = bootstrapGame(board(), { fixedRoles: deck });
  let cycle = 1;
  const provider = {
    async getAction(request: ActionRequest) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves" as const, args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote" as const, args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("charm"))
        return cycle === 1 ? { name: "charm" as const, args: { target_id: 5 } } : null;
      if (request.allowedTools.includes("use_potion"))
        return {
          name: "use_potion" as const,
          args: { target_id: 3, potion_type: PotionType.None as const },
        };
      if (request.allowedTools.includes("speak"))
        return { name: "speak" as const, args: { text: "Raw" } };
      if (request.allowedTools.includes("duel")) return null;
      if (request.allowedTools.includes("vote"))
        return { name: "vote" as const, args: { target_id: null, abstain: true } };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  };
  await game.phaseManager.runSingleCycle(provider);
  const state = getWolfBeautyState(role(game, 1))!,
    before = structuredClone(state);
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Night,
    allowedTools: ["charm"],
    context: { day: 2, stage: "wolf_beauty", visible_events: [], turn_constraints: {} },
  };
  expect(
    new ActionReception(game.world).validate(request, "charm", { target_id: 5 }),
  ).toMatchObject({ ok: false, error: "charm_repeat" });
  expect(state).toEqual(before);
  cycle = 2;
  await game.phaseManager.runSingleCycle(provider);
  expect(state).toEqual({
    targetId: null,
    lastActedDay: 2,
    history: [
      { day: 1, targetId: 5 },
      { day: 2, targetId: null },
    ],
  });
  expect(
    new ActionReception(game.world).validate(
      { ...request, context: { ...request.context, day: 3 } },
      "charm",
      { target_id: 5 },
    ).ok,
  ).toBe(true);
});
