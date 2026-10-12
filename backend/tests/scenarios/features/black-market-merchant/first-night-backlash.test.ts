/**
 * Black Market Merchant scenario verifies actual first-night backlash receives original last words before day voting.
 * Input: Original fixed roster and controlled complete PM trade/knife/potion/vote responses.
 * Output and oracle: Handwritten death causes, stock and public request/event ordering remain unchanged; no model or regenerated expectation is involved.
 */
import { PotionType } from "../../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Role, Phase, DeathCause, WinCondition, type RoleComponent } from "../../../../src/core";
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

const role = (game: Game, id = 3) => game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

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
