/**
 * 熊场景测试：验证整夜死亡连锁和阶段修订先于公开感知与判胜。输入为原死因／时点／语言计划、固定身份和警徽／枪／自爆链；安静／咆哮、事件次序及终局采用精确预期，不重生 fixture。
 */
import { PotionType } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  WinCondition,
  COMPONENT,
  ActionWindow,
  type BoardConfig,
  type RoleComponent,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { getBearState } from "../../../../src/features/bear/ports";

const deck = [Role.Bear, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Villager];

const config = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterSide],
  selfDestruct: { enabledWindows: [] },
});

const role = (game: ReturnType<typeof bootstrapGame>, id: number) =>
  game.world.getComponent(id, COMPONENT.Role)!;

const passive = (request: ActionRequest): ToolCall | null => {
  if (request.allowedTools.includes("speak_to_wolves"))
    return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
  if (request.allowedTools.includes("use_potion"))
    return {
      name: "use_potion",
      args: { target_id: request.actorId, potion_type: PotionType.None },
    };
  if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
  if (request.allowedTools.includes("vote"))
    return { name: "vote", args: { target_id: null, abstain: true } };
  if (request.allowedTools.includes("duel")) return null;
  throw new Error(`unexpected:${request.context.stage}`);
};

test("real night last wolf death keeps its original positive sample, publishes after original words, and only then seals the victory", async () => {
  const game = bootstrapGame(config(), { fixedRoles: deck });
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 2, abstain: false } };
      return passive(request);
    },
  });
  const events = game.phaseManager.getEvents();
  expect(events.filter((e) => e.type === "bear_roared").map((e) => e.payload)).toEqual([
    { day: 1, roared: true },
  ]);
  expect(events.findIndex((e) => e.type === "last_words_spoken")).toBeLessThan(
    events.findIndex((e) => e.type === "bear_roared"),
  );
  expect(events.findIndex((e) => e.type === "bear_roared")).toBeLessThan(
    events.findIndex((e) => e.type === "game_over"),
  );
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
});

for (const cause of ["knife", "poison", "dream", "charm", "night_shot"] as const)
  test(`${cause}: a Bear killed anywhere in the real night wave announces quiet after the whole chain`, async () => {
    const fixed =
        cause === "dream"
          ? [Role.Bear, Role.Wolf, Role.Witch, Role.Dreamer, Role.Villager, Role.Villager]
          : cause === "charm"
            ? [Role.Bear, Role.WolfBeauty, Role.Witch, Role.Hunter, Role.Villager, Role.Villager]
            : deck,
      game = bootstrapGame(config(fixed), { fixedRoles: fixed });
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("kill_vote"))
          return {
            name: "kill_vote",
            args: {
              target_id:
                cause === "knife" ? 1 : cause === "dream" || cause === "night_shot" ? 4 : null,
              abstain: cause === "poison" || cause === "charm",
            },
          };
        if (request.allowedTools.includes("dream"))
          return { name: "dream", args: { target_id: 1 } };
        if (request.allowedTools.includes("charm"))
          return { name: "charm", args: { target_id: 1 } };
        if (request.allowedTools.includes("shoot"))
          return { name: "shoot", args: { target_id: 1 } };
        if (
          request.allowedTools.includes("use_potion") &&
          (cause === "poison" || cause === "charm")
        )
          return {
            name: "use_potion",
            args: { target_id: cause === "charm" ? 2 : 1, potion_type: PotionType.Poison },
          };
        return passive(request);
      },
    });
    const events = game.phaseManager.getEvents(),
      report = events.findIndex((e) => e.type === "bear_roared");
    expect(events.filter((e) => e.type === "bear_roared").map((e) => e.payload)).toEqual([
      { day: 1, roared: false },
    ]);
    expect(game.world.getAliveEntityIds()).not.toContain(1);
    expect(getBearState(role(game, 1))!.history).toEqual([{ day: 1, roared: false }]);
    for (const e of events.filter((e) =>
      [
        "last_words_spoken",
        "hunter_shot",
        "dream_death",
        "charm_death",
        "additional_deaths",
      ].includes(e.type),
    ))
      expect(events.indexOf(e)).toBeLessThan(report);
  });

for (const point of [
  "wolf_discussion",
  "last_words",
  "sheriff_nomination",
  "sheriff_campaign_speech",
  "sheriff_withdraw",
  "sheriff_vote",
] as const)
  test(`${point}: real asynchronous same-phase revision prevents all late announcements/history`, async () => {
    const game = bootstrapGame(
      { ...config(), enableSheriff: point.startsWith("sheriff_") },
      { fixedRoles: deck },
    );
    let revoked = false;
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        expect(revoked).toBe(false);
        if (request.context.stage === point) {
          revoked = true;
          game.phaseManager.jumpTo(request.phase);
          return request.allowedTools.includes("speak_to_wolves")
            ? { name: "speak_to_wolves", args: { text: "Late", end_chat: true } }
            : request.allowedTools.includes("run_for_sheriff")
              ? { name: "run_for_sheriff", args: { run: true } }
              : request.allowedTools.includes("vote_for_sheriff")
                ? { name: "vote_for_sheriff", args: { target_id: 1, abstain: false } }
                : { name: "speak", args: { text: "Late" } };
        }
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        if (request.allowedTools.includes("run_for_sheriff"))
          return { name: "run_for_sheriff", args: { run: request.actorId === 1 } };
        if (request.allowedTools.includes("vote_for_sheriff"))
          return { name: "vote_for_sheriff", args: { target_id: 1, abstain: false } };
        return passive(request);
      },
    });
    const events = game.phaseManager.getEvents();
    expect(
      events.some(
        (e) =>
          e.type === "bear_roared" ||
          e.type === "sheriff_elected" ||
          (e.type === "day_speech" && e.payload.text === "Late"),
      ),
    ).toBe(false);
    expect(getBearState(role(game, 1))!.history).toEqual([]);
    expect(game.world.activeDeathActionCount).toBe(0);
    expect(revoked).toBe(true);
  });

test("first-day early White blast announces quiet after merged Night/Day deaths before interrupted judgment", async () => {
  const fixed = [Role.Bear, Role.WhiteWolfKing, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager],
    board = {
      ...config(fixed),
      enableSheriff: true,
      hooks: { onDaybreak: true, onPreElection: true, onPreVote: true, onPerSpeechGap: true },
      selfDestruct: { enabledWindows: [ActionWindow.OnPreElection] },
    },
    game = bootstrapGame(board, { fixedRoles: fixed });
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 6, abstain: false } };
      if (request.allowedTools.includes("self_destruct_with_target"))
        return {
          name: "self_destruct_with_target",
          args: { target_id: 1, confirm: true, reason: "Public" },
        };
      if (request.allowedTools.includes("self_destruct")) return null;
      return passive(request);
    },
  });
  const events = game.phaseManager.getEvents(),
    report = events.findIndex((e) => e.type === "bear_roared");
  expect(events.filter((e) => e.type === "bear_roared").map((e) => e.payload)).toEqual([
    { day: 1, roared: false },
  ]);
  expect(report).toBeLessThan(events.findIndex((e) => e.type === "game_over"));
  expect(game.phaseManager.getSnapshot().result?.decidedAt.checkpoint).toBe("day_interrupted");
  expect(events.some((e) => e.type === "sheriff_nomination_summary")).toBe(false);
});

test("night Wolf King gun kills the only good special role: complete its badge chain, announce quiet, then ordinary Good victory", async () => {
  const fixed = [
      Role.Bear,
      Role.WolfKing,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.Villager,
    ],
    game = bootstrapGame(
      { ...config(fixed), enableSheriff: true, initialSheriffSeat: 1 },
      { fixedRoles: fixed },
    );
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 2, abstain: false } };
      if (request.allowedTools.includes("shoot")) return { name: "shoot", args: { target_id: 1 } };
      return passive(request);
    },
  });
  const events = game.phaseManager.getEvents(),
    gun = events.findIndex((e) => e.type === "wolf_king_shot"),
    badge = events.findIndex((e) => e.type === "sheriff_badge_transferred"),
    report = events.findIndex((e) => e.type === "bear_roared");
  expect(gun).toBeGreaterThan(-1);
  expect(gun).toBeLessThan(badge);
  expect(badge).toBeLessThan(report);
  expect(events.filter((e) => e.type === "bear_roared").map((e) => e.payload)).toEqual([
    { day: 1, roared: false },
  ]);
  expect(report).toBeLessThan(events.findIndex((e) => e.type === "game_over"));
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]);
});
