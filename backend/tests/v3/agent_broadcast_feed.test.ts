import { bootstrapGame } from "../../src/app/bootstrap";
import { GameEvent } from "../../src/domain/model";
import { buildAgentBroadcastFeed } from "../../src/engine/agent_broadcast_feed";
import { sixPlayerMvpConfig } from "../../src/scenarios/six_player_mvp";

describe("buildAgentBroadcastFeed", () => {
  test("voting should only expose voted_out publicly while keeping wolf kill votes wolf-only", () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const events: GameEvent[] = [
      {
        timestamp: 0,
        type: "god_private_game_info",
        payload: {
          players: [
            { seat: 1, role: "wolf", camp: "wolf" },
            { seat: 2, role: "wolf", camp: "wolf" },
          ],
        },
      },
      {
        timestamp: 1,
        type: "vote_cast",
        payload: { actorId: 4, targetId: 1, weight: 1 },
      },
      {
        timestamp: 2,
        type: "wolf_kill_vote_cast",
        payload: { actorId: 1, targetId: 3 },
      },
      {
        timestamp: 3,
        type: "voted_out",
        payload: { target: 1 },
      },
    ];

    const wolfFeed = buildAgentBroadcastFeed(context.world, events, 1);
    const villagerFeed = buildAgentBroadcastFeed(context.world, events, 4);

    expect(wolfFeed.some((line) => line.includes("狼刀票"))).toBe(true);
    expect(wolfFeed.some((line) => line.includes("放逐结果"))).toBe(true);
    expect(wolfFeed.some((line) => line.includes("vote_cast"))).toBe(false);

    expect(villagerFeed.some((line) => line.includes("狼刀票"))).toBe(false);
    expect(villagerFeed.some((line) => line.includes("放逐结果"))).toBe(true);
    expect(villagerFeed.some((line) => line.includes("vote_cast"))).toBe(false);
    expect(villagerFeed.some((line) => line.includes("开局"))).toBe(false);
    expect(villagerFeed.some((line) => line.includes("role"))).toBe(false);
  });
});
