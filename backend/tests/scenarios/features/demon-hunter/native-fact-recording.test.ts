/**
 * 猎魔人场景验证真实两夜事实、晚取消和持久化上帝／玩家证据保留精确来源。输入为原受控
 * 药瓶／狩猎计划、伤害 spy 恢复与真实临时记录 scope；手写来源、audience／sequence 与记录
 * 输出是预期，完整因果周期属于场景覆盖，不被称为传输集成。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test, spyOn } from "bun:test";
import { DEMON_HUNTER_POLICY, DEMON_HUNTER_EVENT_TYPES } from "@ai-werewolf-arena/game-text";
import { COMPONENT, PotionType, type ActionRequest, type RoleComponent, type GameEvent } from "../../../../src/core";
import { demonHunterFixture } from "../../../support/features/demon-hunter/builders/candidate-world";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/game/mechanisms";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const chosen = { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 2, targetId: 1 },
  own = { policy: DEMON_HUNTER_POLICY, day: 2, targetId: 1 };

const isDemon = (type: string) => (DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(type);

type DemonEvent = Extract<
  GameEvent,
  { type: "demon_hunter_chosen" | "demon_hunter_cancelled" | "demon_hunter_poison_immune" }
>;

const isDemonEvent = (event: GameEvent): event is DemonEvent => isDemon(event.type);

function provider(witch: number) {
  return { getAction: async (request: ActionRequest) => demonNightChoice(request, witch) };
}

for (const locale of ["zh-CN", "en"] as const)
  test(`actual first and second Night ${locale}: only God knows source immunity; owner receives exact choice`, async () => {
    const f = demonHunterFixture(6, undefined, locale);
    await f.phaseManager.runSingleCycle(
      {
        getAction: async (request) =>
          demonNightChoice(request, 5, { potion: { target: 6, type: PotionType.Poison } }),
      },
      10,
    );
    await f.phaseManager.runSingleCycle(
      { getAction: async (request) => demonNightChoice(request, 5, { hunt: 1 }) },
      10,
    );
    const facts = f.phaseManager.getEvents().filter(isDemonEvent);
    expect(facts.map((e) => [e.type, e.payload, "audience" in e ? e.audience : null])).toEqual([
      [
        "demon_hunter_poison_immune",
        { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 1, witchId: 5 },
        [],
      ],
      ["demon_hunter_chosen", chosen, [6]],
    ]);
    const renderer = getDefaultScriptEventRenderRegistry();
    for (const fact of facts) {
      expect(renderer.toJudgeLine(fact, locale)).not.toBeNull();
      expect(renderer.toLiveRender(fact, false, locale)).toEqual([]);
      expect(renderer.toLiveRender(fact, true, locale)).toHaveLength(1);
    }
    for (const id of f.world.entityIds()) {
      const feed = buildAgentVisibleEventFeed(f.world, f.phaseManager.getEvents(), id);
      expect(feed.map((e) => e.seq)).toEqual(feed.map((_, index) => index + 1));
      expect(feed.filter((e) => isDemon(e.type)).map((e) => e.payload)).toEqual(
        id === 6 ? [own] : [],
      );
    }
  });

test("actual late cancellation is God-only, actual submitted choice remains visible without inferred outcome", async () => {
  const f = demonHunterFixture();
  await f.phaseManager.runSingleCycle(provider(5), 10);
  const original = f.damage.resolve.bind(f.damage),
    calls = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
      const damage = original(world, effects);
      world.addComponent(1, COMPONENT.Alive, createAliveComponent());
      return damage;
    });
  try {
    await f.phaseManager.runSingleCycle(
      { getAction: async (request) => demonNightChoice(request, 5, { hunt: 1 }) },
      10,
    );
    expect(
      f.phaseManager
        .getEvents()
        .filter(isDemonEvent)
        .map((e): [string, unknown] => [e.type, e.payload]),
    ).toEqual([
      ["demon_hunter_chosen", chosen],
      ["demon_hunter_cancelled", { ...chosen, reason: "authority_revoked", faultId: null }],
    ]);
    expect(
      buildAgentVisibleEventFeed(f.world, f.phaseManager.getEvents(), 6)
        .filter((e) => isDemon(e.type))
        .map((e) => e.payload),
    ).toEqual([own]);
  } finally {
    calls.mockRestore();
  }
});

test("actual event recorder keeps complete God facts and source operations; all player archives keep only exact own choice", async () => {
  const f = demonHunterFixture(),
    root = await createTestTempDirectory("awa-demon-facts-"),
    manager = await SessionRecordManager.create(
      {
        sessionId: "demon-facts-candidate",
        board: "private-candidate",
        startedAtIso: new Date(0).toISOString(),
      },
      root,
    ),
    recorder = new GameEventRecorder({ world: f.world, replayManager: manager }, "night");
  await runWithSessionRecorder(manager, async () => {
    await f.phaseManager.runSingleCycle(
      {
        getAction: async (request) =>
          demonNightChoice(request, 5, { potion: { target: 6, type: PotionType.Poison } }),
      },
      10,
    );
    recorder.flush(f.phaseManager.getEvents());
    await f.phaseManager.runSingleCycle(
      { getAction: async (request) => demonNightChoice(request, 5, { hunt: 1 }) },
      10,
    );
    recorder.flush(f.phaseManager.getEvents());
    expect(recorder.flush(f.phaseManager.getEvents())).toEqual([]);
  });
  const summary = await manager.finalize({
    endedAtIso: new Date(100).toISOString(),
    winner: null,
    finishReason: "candidate-test",
    players: f.world.entityIds().map((id) => {
      const role = f.world.getComponent(id, COMPONENT.Role)!;
      return {
        player_id: id,
        role: role.role,
        camp: role.camp,
        alive: f.world.getAliveEntityIds().includes(id),
      };
    }),
  });
  expect(summary.publicEvents.filter((e) => isDemon(e.type)).map((e) => e.payload)).toEqual([
    { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 1, witchId: 5 },
    chosen,
  ]);
  const frozen = summary.logicOps?.filter((op) => op.op === "demon_hunter_sources_frozen") ?? [];
  expect(frozen).toHaveLength(2);
  expect(frozen[0]!.output?.poison_immunities).toEqual([
    { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 1, witchId: 5 },
  ]);
  expect(frozen[1]!.output?.death_sources).toEqual({ 1: ["demon_hunt"] });
  for (const view of summary.playerViews) {
    const facts = view.timeline.filter(
      (entry) => entry.kind === "event" && isDemon(entry.event.type),
    );
    expect(facts.map((entry) => (entry.kind === "event" ? entry.event.payload : null))).toEqual(
      view.player_id === 6 ? [own] : [],
    );
  }
});
