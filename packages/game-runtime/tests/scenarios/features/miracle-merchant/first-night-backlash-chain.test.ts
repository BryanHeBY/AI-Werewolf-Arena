/**
 * 奇迹商人场景测试：验证完整首夜反噬、最后狼人死亡、遗言和警徽先于判胜。输入为固定角色和受控完整 PM 请求；死亡、事件次序及好人成员为手写预期，不读取新 fixture 或调用模型。
 */
import { PotionType } from "../../../../src/domain";
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
  type ToolCall,
} from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";

const deck = [Role.MiracleMerchant, Role.Wolf, Role.WolfKing, Role.Seer, Role.Witch, Role.Villager];

const board = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterCity],
  selfDestruct: { enabledWindows: [] },
});

const fixture = (roles = deck, locale: "zh-CN" | "en" = "en") => {
  const config = board(roles),
    game = bootstrapGame(config, { fixedRoles: roles, locale });
  return { ...game, config };
};

const role = (game: ReturnType<typeof fixture>, actor = 1) =>
  game.world.getComponent(actor, COMPONENT.Role)!;

test("full actual first-night Wolf backlash grants last words and settles initial deaths before later voting", async () => {
  const game = fixture(),
    requests: ActionRequest[] = [];
  const result = await game.phaseManager.runSingleCycle({
    async getAction(request): Promise<ToolCall | null> {
      requests.push(request);
      if (request.allowedTools.includes("bestow_ability"))
        return { name: "bestow_ability", args: { target_id: 2, skill: "check" } };
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 6, abstain: false } };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 2 } };
      if (request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 5, potion_type: PotionType.None } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (request.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: 2, abstain: false } };
      return null;
    },
  });
  expect(requests.filter((r) => r.context.stage === "last_words").map((r) => r.actorId)).toEqual([
    1, 6, 2,
  ]);
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5]);
  expect(result.gameOver).toBe(false);
  expect(
    game.phaseManager.getEvents().filter((e) => e.type === "merchant_trade_resolved"),
  ).toHaveLength(1);
});

test("a terminal first-night backlash and last-Wolf death still finish both last words and sheriff badge before Good judgment", async () => {
  const roles = [
      Role.MiracleMerchant,
      Role.Wolf,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.Villager,
    ],
    config = {
      ...board(roles),
      winConditions: [WinCondition.SlaughterSide],
      enableSheriff: true,
      initialSheriffSeat: 1,
    },
    game = bootstrapGame(config, { fixedRoles: roles }),
    asks: ActionRequest[] = [];
  const result = await game.phaseManager.runSingleCycle({
    async getAction(request) {
      asks.push(request);
      if (request.allowedTools.includes("bestow_ability"))
        return { name: "bestow_ability", args: { target_id: 2, skill: "guard" } };
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 2, abstain: false } };
      if (request.context.stage === "last_words") return { name: "speak", args: { text: "Raw" } };
      throw new Error(`unexpected:${request.context.stage}`);
    },
  });
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]);
  expect(asks.filter((r) => r.context.stage === "last_words").map((r) => r.actorId)).toEqual([
    1, 2,
  ]);
  const events = game.phaseManager.getEvents();
  expect(
    events.filter((e) => e.type === "sheriff_badge_transferred").map((e) => e.payload),
  ).toEqual([{ fromId: 1, toId: 3, reason: "night_death" }]);
  expect(events.map((e) => e.type).lastIndexOf("last_words_spoken")).toBeLessThan(
    events.findIndex((e) => e.type === "sheriff_badge_transferred"),
  );
  expect(events.findIndex((e) => e.type === "sheriff_badge_transferred")).toBeLessThan(
    events.findIndex((e) => e.type === "game_over"),
  );
  expect(result.result?.winner).toBe(Camp.Good);
  expect(result.result?.decidedAt).toEqual({
    day: 1,
    phase: Phase.Day,
    checkpoint: "night_settled",
  });
  expect(game.world.activeDeathActionCount).toBe(0);
});
