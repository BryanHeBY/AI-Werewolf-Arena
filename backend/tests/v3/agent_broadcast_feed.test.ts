import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
import { GameEvent } from "../../src/domain/model";
import { buildAgentBroadcastFeed } from "../../src/engine/agent_broadcast_feed";
import { sixPlayerMvpConfig } from "../../src/scenarios/six_player_mvp";

describe("buildAgentBroadcastFeed", () => {
  test("voting should expose merged vote lineup publicly while keeping wolf kill votes wolf-only", () => {
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

    const wolfId = context.world
      .entityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === "wolf";
      })!;
    const villagerId = context.world
      .entityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === "villager";
      })!;

    const wolfFeed = buildAgentBroadcastFeed(context.world, events, wolfId);
    const villagerFeed = buildAgentBroadcastFeed(context.world, events, villagerId);

    expect(wolfFeed.some((line) => line.includes("狼刀票"))).toBe(true);
    expect(wolfFeed.some((line) => line.includes("放逐结果"))).toBe(true);
    expect(wolfFeed.some((line) => line.includes("放逐票型"))).toBe(true);
    expect(wolfFeed.some((line) => line.includes("4号->1号"))).toBe(true);

    expect(villagerFeed.some((line) => line.includes("狼刀票"))).toBe(false);
    expect(villagerFeed.some((line) => line.includes("放逐结果"))).toBe(true);
    expect(villagerFeed.some((line) => line.includes("放逐票型"))).toBe(true);
    expect(villagerFeed.some((line) => line.includes("4号->1号"))).toBe(true);
    expect(villagerFeed.some((line) => line.includes("开局"))).toBe(false);
    expect(villagerFeed.some((line) => line.includes("role"))).toBe(false);
  });

  test("vote/sheriff actions should be private to actor while summaries stay public", () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const events: GameEvent[] = [
      {
        timestamp: 1,
        type: "vote_cast",
        payload: { actorId: 4, targetId: 1, abstain: false, weight: 1 },
      },
      {
        timestamp: 2,
        type: "sheriff_candidate_declared",
        payload: { actorId: 4, run: true },
      },
      {
        timestamp: 3,
        type: "sheriff_vote_cast",
        payload: { actorId: 4, targetId: 2, abstain: false },
      },
      {
        timestamp: 4,
        type: "sheriff_nomination_summary",
        payload: { candidates: [4, 2] },
      },
      {
        timestamp: 5,
        type: "sheriff_vote_summary",
        payload: {
          votes: [
            { actorId: 4, targetId: 2, abstain: false },
            { actorId: 2, targetId: null, abstain: true },
          ],
          winnerId: 2,
        },
      },
      {
        timestamp: 6,
        type: "voted_out",
        payload: { target: 1 },
      },
    ];

    const actorFeed = buildAgentBroadcastFeed(context.world, events, 4);
    const otherFeed = buildAgentBroadcastFeed(context.world, events, 5);

    expect(actorFeed.some((line) => line.includes("[行动][投票] 4号投给1号"))).toBe(true);
    expect(actorFeed.some((line) => line.includes("[行动][上警]"))).toBe(true);
    expect(actorFeed.some((line) => line.includes("[行动][警长投票]"))).toBe(true);

    expect(otherFeed.some((line) => line.includes("[行动][投票]"))).toBe(false);
    expect(otherFeed.some((line) => line.includes("[行动][上警]"))).toBe(false);
    expect(otherFeed.some((line) => line.includes("[行动][警长投票]"))).toBe(false);

    expect(actorFeed.some((line) => line.includes("放逐票型"))).toBe(true);
    expect(otherFeed.some((line) => line.includes("放逐票型"))).toBe(true);
    expect(actorFeed.some((line) => line.includes("警长投票票型"))).toBe(true);
    expect(otherFeed.some((line) => line.includes("警长投票票型"))).toBe(true);
  });
});
