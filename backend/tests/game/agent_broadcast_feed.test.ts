import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
import { GameEvent } from "../../src/domain/model";
import { buildAgentBroadcastFeed } from "../../src/engine/agent_broadcast_feed";
import { sixPlayerMvpConfig } from "../../src/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

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

  test("projects the same event log into stable player-specific views", () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const findRole = (roleName: string) =>
      context.world.entityIds().find(
        (id) =>
          context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === roleName,
      )!;
    const wolfId = findRole("wolf");
    const witchId = findRole("witch");
    const seerId = findRole("seer");
    const villagerId = findRole("villager");
    const events: GameEvent[] = [
      {
        timestamp: 0,
        type: "god_private_game_info",
        payload: { players: [{ seat: witchId, role: "witch" }] },
      },
      {
        timestamp: 1,
        type: "wolf_discussion",
        payload: { actorId: wolfId, text: "今晚先听队友意见" },
      },
      {
        timestamp: 2,
        type: "witch_potion_used",
        payload: { actorId: witchId, targetId: seerId, potionType: "heal" },
      },
      {
        timestamp: 3,
        type: "seer_checked",
        payload: { actorId: seerId, targetId: wolfId, isWerewolf: true },
      },
      {
        timestamp: 4,
        type: "night_resolved",
        payload: { deaths: [] },
      },
    ];

    const wolfFeed = buildAgentBroadcastFeed(context.world, events, wolfId);
    const witchFeed = buildAgentBroadcastFeed(context.world, events, witchId);
    const seerFeed = buildAgentBroadcastFeed(context.world, events, seerId);
    const villagerFeed = buildAgentBroadcastFeed(context.world, events, villagerId);

    expect(buildAgentBroadcastFeed(context.world, events, wolfId)).toEqual(wolfFeed);
    expect(wolfFeed.join("\n")).toContain("今晚先听队友意见");
    expect(wolfFeed.join("\n")).not.toContain("女巫");
    expect(wolfFeed.join("\n")).not.toContain("查验");
    expect(witchFeed.join("\n")).toContain(`${witchId}号对${seerId}号使用`);
    expect(witchFeed.join("\n")).not.toContain("查验");
    expect(seerFeed.join("\n")).toContain(`${seerId}号查验${wolfId}号`);
    expect(villagerFeed.join("\n")).not.toContain("今晚先听队友意见");

    for (const feed of [wolfFeed, witchFeed, seerFeed, villagerFeed]) {
      expect(feed.join("\n")).not.toContain("god_private_game_info");
      expect(feed.join("\n")).not.toContain(`seat: ${witchId}`);
      expect(feed.join("\n")).toContain("昨夜平安夜");
    }
  });
});
