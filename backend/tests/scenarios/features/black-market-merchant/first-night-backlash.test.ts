/**
 * 黑市商人场景测试：验证首夜反噬先获得原遗言再进入白天投票。输入为固定名单和完整 PM 交易／狼刀／药瓶／投票回复；死因、库存及公开请求／事件次序为手写预期，不调用模型或重生预期。
 */
import { PotionType } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Role, Phase, DeathCause, WinCondition, type RoleComponent } from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { LastWordsMechanism } from "../../../../src/game/mechanisms/last_words/last_words_mechanism";

const deck = [Role.Wolf, Role.Wolf, Role.BlackMarketMerchant, Role.Seer, Role.Witch, Role.Villager];

function fixture() {
  const config = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(deck)].map((role) => ({
      role,
      count: deck.filter((r) => r === role).length,
    })),
    winConditions: [WinCondition.SlaughterSide],
    enableSheriff: false,
    selfDestruct: { enabledWindows: [] },
  };
  return { ...bootstrapGame(config, { fixedRoles: deck }), config };
}

type Game = ReturnType<typeof fixture>;

const role = (game: Game, id = 3) => game.world.getComponent(id, COMPONENT.Role)!;

test("a pure first-night Black backlash gets actual last words before day voting", async () => {
  const game = fixture();
  expect(
    new LastWordsMechanism().shouldGrantLastWords(Phase.Night, 1, [DeathCause.BlackMarketBacklash]),
  ).toBe(true);
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("black_market_trade"))
        return { name: "black_market_trade", args: { target_id: 1, skill: "check" } };
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "Raw", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 3, abstain: false } };
      if (request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 3, potion_type: PotionType.Heal } };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 1 } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (request.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: 1, abstain: false } };
      throw new Error("unexpected_request");
    },
  });
  expect(
    game.phaseManager
      .getEvents()
      .filter((e) => e.type === "last_words_spoken")
      .map((e) => e.payload.playerId),
  ).toEqual([3, 1]);
});
