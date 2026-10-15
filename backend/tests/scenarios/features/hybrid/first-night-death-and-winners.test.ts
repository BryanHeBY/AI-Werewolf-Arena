/**
 * 混血儿场景测试：验证首夜归属、自刀、警徽与原终局成员一起结算。输入为原跟随狼人矩阵及固定 PM 回复；死亡、独立归属和获胜玩家采用手写预期，不用新代码生成结果。
 */
import { PotionType } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Camp, COMPONENT, Phase, Role, WinCondition, type ActionRequest, type BoardConfig, type RoleComponent, type ToolCall } from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";

const deck = [Role.Hybrid, Role.Wolf, Role.HiddenWolf, Role.Seer, Role.Witch, Role.Villager];

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
  const config = board(roles);
  return { ...bootstrapGame(config, { fixedRoles: roles, locale }), config };
};

const role = (game: ReturnType<typeof fixture>, id = 1) =>
  game.world.getComponent(id, COMPONENT.Role)!;

const choose = (target_id: number): ToolCall => ({ name: "choose_exemplar", args: { target_id } });

for (const followWolf of [false, true])
  test(`${followWolf}: actual first-night Hybrid death, last-Wolf self-knife and badge settle before final Good membership`, async () => {
    const roles = [Role.Hybrid, Role.Wolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager],
      config = { ...board(roles), enableSheriff: true, initialSheriffSeat: 1 },
      game = bootstrapGame(config, { fixedRoles: roles }),
      asks: ActionRequest[] = [];
    const result = await game.phaseManager.runSingleCycle({
      async getAction(request): Promise<ToolCall | null> {
        asks.push(request);
        if (request.allowedTools.includes("choose_exemplar")) return choose(followWolf ? 2 : 3);
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 2, abstain: false } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 1 } };
        if (request.allowedTools.includes("use_potion"))
          return { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } };
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
    expect(result.result).toMatchObject({
      winner: Camp.Good,
      decidedAt: { day: 1, phase: Phase.Day, checkpoint: "night_settled" },
      outcome: { winningPlayerIds: followWolf ? [3, 4, 5, 6] : [1, 3, 4, 5, 6] },
    });
    expect(game.world.activeDeathActionCount).toBe(0);
  });
