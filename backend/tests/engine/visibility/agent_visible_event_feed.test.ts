import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { RoleComponent } from "../../../src/core/domain/components/role";
import { GameEvent } from "../../../src/core/domain/model";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";

describe("buildAgentVisibleEventFeed", () => {
  test("keeps wolf and role actions private while public results stay visible", () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const findRole = (roleName: string) => context.world.entityIds().find(
      (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === roleName,
    )!;
    const wolfId = findRole("wolf");
    const witchId = findRole("witch");
    const seerId = findRole("seer");
    const villagerId = findRole("villager");
    const events: GameEvent[] = [
      { timestamp: 0, type: "god_private_game_info", payload: { players: [{ seat: witchId, role: "witch" }] } },
      { timestamp: 1, type: "wolf_discussion", payload: { actorId: wolfId, text: "今晚先听队友意见" } },
      { timestamp: 2, type: "witch_potion_used", payload: { actorId: witchId, targetId: seerId, potionType: "heal" } },
      { timestamp: 3, type: "seer_checked", payload: { actorId: seerId, targetId: wolfId, isWerewolf: true } },
      { timestamp: 4, type: "night_resolved", payload: { deaths: [] } },
    ];

    const wolfFeed = buildAgentVisibleEventFeed(context.world, events, wolfId);
    const witchFeed = buildAgentVisibleEventFeed(context.world, events, witchId);
    const seerFeed = buildAgentVisibleEventFeed(context.world, events, seerId);
    const villagerFeed = buildAgentVisibleEventFeed(context.world, events, villagerId);

    expect(wolfFeed.map((event) => event.type)).toEqual(["wolf_discussion", "night_resolved"]);
    expect(witchFeed.map((event) => event.type)).toEqual(["witch_potion_used", "night_resolved"]);
    expect(seerFeed.map((event) => event.type)).toEqual(["seer_checked", "night_resolved"]);
    expect(villagerFeed.map((event) => event.type)).toEqual(["night_resolved"]);
    expect(seerFeed[0]).toEqual({
      seq: 1,
      type: "seer_checked",
      payload: { actorId: seerId, targetId: wolfId, isWerewolf: true },
    });
    for (const feed of [wolfFeed, witchFeed, seerFeed, villagerFeed]) {
      expect(feed.some((event) => event.type === "god_private_game_info")).toBe(false);
    }
  });

  test("exposes structured vote summaries but not intermediate individual votes", () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const events: GameEvent[] = [
      { timestamp: 1, type: "vote_cast", payload: { actorId: 4, targetId: 1, abstain: false, weight: 1 } },
      {
        timestamp: 2,
        type: "vote_summary",
        payload: {
          votes: [{ actorId: 4, targetId: 1, abstain: false, weight: 1 }],
          tally: { 1: 1 },
          target: 1,
        },
      },
      { timestamp: 3, type: "voted_out", payload: { target: 1 } },
    ];

    for (const playerId of context.world.entityIds()) {
      const feed = buildAgentVisibleEventFeed(context.world, events, playerId);
      expect(feed.map((event) => event.type)).toEqual(["vote_summary", "voted_out"]);
      expect(feed[0].payload).toEqual({
        votes: [{ actorId: 4, targetId: 1, abstain: false, weight: 1 }],
        target: 1,
      });
      expect(feed[0].payload).not.toHaveProperty("tally");
    }
  });

  test("defaults unknown events to invisible", () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const feed = buildAgentVisibleEventFeed(context.world, [
      { timestamp: 1, type: "future_private_mechanic", payload: { secret: "never leak" } },
      { timestamp: 2, type: "phase_changed", payload: { day: 1, phase: "day" } },
    ], context.world.entityIds()[0]);

    expect(feed).toEqual([
      { seq: 1, type: "phase_changed", payload: { day: 1, phase: "day" } },
    ]);
  });

  test("preserves player-local seq beyond eighty events without truncation", () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const events: GameEvent[] = Array.from({ length: 100 }, (_, index) => ({
      timestamp: index,
      type: "day_speech",
      payload: { actorId: 1, text: `speech-${index + 1}` },
    }));

    const feed = buildAgentVisibleEventFeed(context.world, events, context.world.entityIds()[0]);
    expect(feed).toHaveLength(100);
    expect(feed[0].seq).toBe(1);
    expect(feed[99].seq).toBe(100);
  });

  test("hidden events neither consume seq values nor reveal their count", () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const villagerId = context.world.entityIds().find(
      (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "villager",
    )!;
    const wolfId = context.world.entityIds().find(
      (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "wolf",
    )!;
    const publicEvents: GameEvent[] = [
      { timestamp: 1, type: "phase_changed", payload: { day: 1, phase: "night" } },
      { timestamp: 5, type: "phase_changed", payload: { day: 1, phase: "day" } },
    ];
    const eventsWithHiddenWolfActions: GameEvent[] = [
      publicEvents[0],
      { timestamp: 2, type: "wolf_discussion", payload: { actorId: wolfId, text: "隐藏狼聊" } },
      { timestamp: 3, type: "wolf_kill_vote_cast", payload: { actorId: wolfId, targetId: villagerId } },
      { timestamp: 4, type: "future_private_mechanic", payload: { secret: true } },
      publicEvents[1],
    ];

    expect(buildAgentVisibleEventFeed(context.world, publicEvents, villagerId)).toEqual(
      buildAgentVisibleEventFeed(context.world, eventsWithHiddenWolfActions, villagerId),
    );
    expect(buildAgentVisibleEventFeed(context.world, eventsWithHiddenWolfActions, villagerId))
      .toEqual([
        { seq: 1, type: "phase_changed", payload: { day: 1, phase: "night" } },
        { seq: 2, type: "phase_changed", payload: { day: 1, phase: "day" } },
      ]);
  });
});
