/**
 * 录制集成测试验证狼队访问。输入为原方向性狼聊／刀权、在途回复和事实时点受众；字面回执、引用／getter／错误、事实和状态为预期。真实临时 Recorder 写读逐席 JSON，事实发生时冻结的受众不随后续身份变化；不读私有配置／认证或调用计费模型。
 */
import { readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Phase,
  Role,
  type AliveComponent,
  type GameEvent,
  type RoleComponent,
  type World,
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { RoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../src/game/mechanisms/roles/role-catalog-assembly";
import { wolfTeamEvent } from "../../../src/game/mechanisms/roles/wolf_team";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { AgentEventVisibilityRegistry } from "../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { GameEventRecorder } from "../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

const fixedRoles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

const role = (world: World, id: number) => world.getComponent(id, COMPONENT.Role)!;

const alive = (world: World, id: number) =>
  world.getComponent(id, COMPONENT.Alive)!;

function fixture(locale: "zh-CN" | "en") {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale, fixedRoles });
  const catalog = createRoleCatalog({
    contributions: getDefaultRoleContributions().map((profile) => {
      if (profile.metadata.role === Role.Seer)
        return {
          ...profile,
          runtime: {
            ...profile.runtime,
            nightStages: [],
            wolfTeam: (state: RoleComponent) => ({
              recognizedByPack: false,
              recognizes: "all" as const,
              canChat: false,
              canVoteForKill: (state.privateState as { readonly knife?: unknown }).knife === true,
            }),
          },
        };
      if (profile.metadata.role === Role.Guard)
        return {
          ...profile,
          runtime: {
            ...profile.runtime,
            nightStages: [],
            wolfTeam: {
              recognizedByPack: true,
              recognizes: "none" as const,
              canChat: true,
              canVoteForKill: false,
            },
          },
        };
      if (profile.metadata.role === Role.Villager)
        return {
          ...profile,
          runtime: {
            ...profile.runtime,
            wolfTeam: {
              recognizedByPack: false,
              recognizes: [Role.Seer],
              canChat: false,
              canVoteForKill: false,
            },
          },
        };
      return profile;
    }),
  });
  for (const id of [3, 4, 5]) role(game.world, id).camp = Camp.Wolf;
  return { ...game, catalog };
}

for (const locale of ["zh-CN", "en"] as const) {
  test(`${locale}: event-time audiences survive death/camp changes and never appear in player wire or delayed recording`, async () => {
    const { world, catalog } = fixture(locale);
    const events: GameEvent[] = [
      { timestamp: 0, type: "phase_changed", payload: { phase: Phase.Night, day: 1 } },
      wolfTeamEvent(world, catalog, {
        timestamp: 1,
        type: "wolf_tactical_order",
        payload: { order: [1, 2, 4] },
      }),
      wolfTeamEvent(world, catalog, {
        timestamp: 2,
        type: "wolf_discussion",
        payload: { actorId: 1, text: "secret-before", endChat: false, round: 1 },
      }),
      wolfTeamEvent(world, catalog, {
        timestamp: 3,
        type: "wolf_discussion_ended",
        payload: { actorId: 4, reason: "end", round: 1 },
      }),
      wolfTeamEvent(world, catalog, {
        timestamp: 4,
        type: "wolf_kill_vote_cast",
        payload: { actorId: 1, abstain: false, targetId: 6 },
      }),
    ];
    for (const event of events.slice(1)) {
      if (!("audience" in event)) throw new Error("missing_wolf_audience_fixture");
      expect(event.audience).toEqual([1, 2, 4]);
      expect(Object.isFrozen(event.audience)).toBe(true);
    }
    // Admission after emission cannot reveal any previous private event. Exit
    // cannot erase past knowledge. A knife-only grant is independent of chat.
    role(world, 1).camp = Camp.Good;
    alive(world, 2).alive = false;
    role(world, 6).role = Role.Wolf;
    role(world, 6).camp = Camp.Wolf;
    (role(world, 3).privateState as Record<string, unknown>).knife = true;
    events.push(
      wolfTeamEvent(world, catalog, {
        timestamp: 5,
        type: "wolf_discussion",
        payload: { actorId: 4, text: "secret-after", endChat: false, round: 2 },
      }),
    );
    events.push(
      wolfTeamEvent(world, catalog, {
        timestamp: 6,
        type: "wolf_kill_vote_cast",
        payload: { actorId: 3, abstain: true, targetId: null },
      }),
    );
    if (!("audience" in events[5]) || !("audience" in events[6]))
      throw new Error("missing_wolf_audience_fixture");
    expect(events[5].audience).toEqual([4, 6]);
    expect(events[6].audience).toEqual([3, 4, 6]);
    const expected = [
      [
        1,
        [
          "phase_changed",
          "wolf_tactical_order",
          "wolf_discussion",
          "wolf_discussion_ended",
          "wolf_kill_vote_cast",
        ],
      ],
      [
        2,
        [
          "phase_changed",
          "wolf_tactical_order",
          "wolf_discussion",
          "wolf_discussion_ended",
          "wolf_kill_vote_cast",
        ],
      ],
      [3, ["phase_changed", "wolf_kill_vote_cast"]],
      [
        4,
        [
          "phase_changed",
          "wolf_tactical_order",
          "wolf_discussion",
          "wolf_discussion_ended",
          "wolf_kill_vote_cast",
          "wolf_discussion",
          "wolf_kill_vote_cast",
        ],
      ],
      [5, ["phase_changed"]],
      [6, ["phase_changed", "wolf_discussion", "wolf_kill_vote_cast"]],
    ] as const;
    const root = await createTestTempDirectory("awa-wolf-audience-"),
      record = await SessionRecordManager.create(
        {
          sessionId: "audience",
          board: "six_player_mvp",
          locale,
          startedAtIso: new Date().toISOString(),
        },
        root,
      );
    new GameEventRecorder({ world, replayManager: record }, Phase.Night).flush(events);
    await record.flushNow();
    for (const [actor, types] of expected) {
      const projected = buildAgentVisibleEventFeed(world, events, actor);
      expect(projected.map((item) => item.type)).toEqual([...types]);
      expect(projected.map((item) => item.seq)).toEqual(types.map((_, index) => index + 1));
      expect(JSON.stringify(projected)).not.toContain('"audience"');
      const saved = readReplayPlayerView(JSON.parse(
        await readFile(path.join(record.sessionDir, `players/player_${actor}.json`), "utf8"),
      ));
      expect(
        saved.timeline.filter((item: any) => item.kind === "event").map((item: any) => item.event),
      ).toEqual(projected);
    }
    const override = new AgentEventVisibilityRegistry({ wolf_discussion: () => true });
    expect(override.canView(world, events[2], 6)).toBe(false);
    const missing = {
      timestamp: 7,
      type: "wolf_discussion",
      payload: { actorId: 4, text: "legacy-missing" },
    } as GameEvent;
    for (const id of world.entityIds())
      expect(buildAgentVisibleEventFeed(world, [missing], id)).toEqual([]);
    const publicReplay = readReplayDocument(JSON.parse(
      await readFile(path.join(record.sessionDir, "replay.json"), "utf8"),
    ));
    for (const event of publicReplay.events) {
      expect(event).not.toHaveProperty("audience");
      expect(event.payload).not.toHaveProperty("audience");
    }
  });
}
