/**
 * 单元测试以原安装后的 World、显式 setup 选择及带记录的 World／event getter 为输入，核对具体 Demon／Wedding acquisition 和清理所有权。实时 scope 授权、字面轨迹及原开窗事实为预期；begin 失败和 capture 失败保留各自不同清理政策。不运行阶段循环、模型、录制或传输。
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { World, Phase, type GameEvent } from "../../../src/domain";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { DemonNightUnit, demonNightTerminal } from "../../../src/features/demon-hunter/ports";
import { WeddingNightUnit, weddingNightTerminal } from "../../../src/features/ghost-bride/ports";
import {
  authorizedDemonHunter,
  bindDemonHunterRequest,
  type DemonHunterRequest,
  openDemonHunterTurn,
} from "../../../src/features/demon-hunter/authority";
import {
  beginWeddingSetup,
  bindGhostBrideRequest,
  openWeddingTurn,
  commitWeddingTool,
  closeWeddingTurn,
  takeWeddingChat,
  ghostBrideReady,
  authorizedWeddingTurn,
  weddingNightCapture,
} from "../../../src/features/ghost-bride/authority";
import { demonHunterFixture } from "../../support/features/demon-hunter/builders/candidate-world";
import {
  ghostBrideBoard,
  ghostBrideDeck,
} from "../../support/features/ghost-bride/builders/scenario";

function boundWeddingTurn(
  world: World,
  kind: "bridegroom" | "chat" | "witness" | "knife",
  actorId: number,
) {
  const scope = openWeddingTurn(world, kind, actorId, 1, () => true);
  const tool =
    kind === "bridegroom"
      ? "choose_bridegroom"
      : kind === "chat"
        ? "speak_to_partner"
        : kind === "witness"
          ? "choose_wedding_witness"
          : "kill_vote";
  const stage =
    kind === "bridegroom"
      ? "ghost_bride_groom"
      : kind === "chat"
        ? "ghost_bride_chat"
        : kind === "witness"
          ? "ghost_bride_witness"
          : "wolf_vote";
  const request = {
    actorId,
    phase: Phase.Night,
    allowedTools: [tool],
    context: {
      day: 1,
      stage,
      allow_fallback: false,
      action_failure_policy: "error",
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1, required_any_tools: [tool] },
    },
  };
  bindGhostBrideRequest(world, request);
  return scope;
}

function weddingWorld() {
  const config = ghostBrideBoard();
  const { world, boardConfig } = bootstrapGame(config, { fixedRoles: ghostBrideDeck });
  beginWeddingSetup(world, boardConfig, () => true);
  const choose = (kind: "bridegroom" | "chat" | "witness", actor: number, call: unknown) => {
    const scope = boundWeddingTurn(world, kind, actor);
    expect(commitWeddingTool(scope, call)).toBe(true);
    if (kind === "chat") expect(takeWeddingChat(scope)).not.toBeNull();
    closeWeddingTurn(scope);
  };
  choose("bridegroom", 1, { name: "choose_bridegroom", args: { target_id: 2 } });
  for (const actor of [1, 2])
    choose("chat", actor, { name: "speak_to_partner", args: { text: "" } });
  for (const actor of [1, 2])
    choose("witness", actor, { name: "choose_wedding_witness", args: { target_id: 3 } });
  expect(ghostBrideReady(world)).toBe(true);
  return world;
}

function boundDemonTurn(world: World, actorId: number) {
  const scope = openDemonHunterTurn(world);
  const request: DemonHunterRequest = {
    actorId,
    phase: Phase.Night,
    allowedTools: ["demon_hunt"],
    context: {
      day: 2,
      stage: "demon_hunter",
      requiresAction: true,
      allow_fallback: false,
      action_failure_policy: "error",
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["demon_hunt"],
      },
    },
  };
  bindDemonHunterRequest(world, request);
  return scope;
}

test("failed Demon opening never acquires cleanup or rereads World", () => {
  const world = new World(),
    trace: string[] = [];
  const unit = new DemonNightUnit({
    get world() {
      trace.push("world");
      return world;
    },
  });
  expect(() => unit.open(2, () => true)).toThrow("demon_hunter_night_unavailable");
  unit.abortIfOwned();
  expect(trace).toEqual(["world"]);
});

test("Demon retains its acquired scope until late transfer or original terminal close", () => {
  const { world, demonId } = demonHunterFixture(),
    trace: string[] = [];
  const unit = new DemonNightUnit({
    get world() {
      trace.push("world");
      return world;
    },
  });
  unit.open(2, () => true);
  const scope = boundDemonTurn(world, demonId);
  expect(authorizedDemonHunter(world, demonId, Phase.Night, 2, scope)).toBe(true);
  unit.transferToManager(true);
  unit.abortIfOwned();
  expect(trace).toEqual(["world"]);
  expect(authorizedDemonHunter(world, demonId, Phase.Night, 2, scope)).toBe(true);
  demonNightTerminal.close(world);
  expect(authorizedDemonHunter(world, demonId, Phase.Night, 2, scope)).toBe(false);
  demonNightTerminal.close(world);
});

test("acquired Demon without transfer closes through the original second World read", () => {
  const { world, demonId } = demonHunterFixture(),
    trace: string[] = [];
  const unit = new DemonNightUnit({
    get world() {
      trace.push("world");
      return world;
    },
  });
  unit.open(2, () => true);
  const scope = boundDemonTurn(world, demonId);
  unit.abortIfOwned();
  expect(trace).toEqual(["world", "world"]);
  expect(authorizedDemonHunter(world, demonId, Phase.Night, 2, scope)).toBe(false);
});

test("owned Wedding failed capture still closes while unowned cleanup reads nothing", () => {
  const world = new World(),
    trace: string[] = [],
    events: GameEvent[] = [];
  const runtime = {
    get world() {
      trace.push("world");
      return world;
    },
    get events() {
      trace.push("events");
      return events;
    },
  };
  const owned = new WeddingNightUnit(runtime, true);
  expect(() => owned.open(1, () => true)).toThrow("ghost_bride_night_unavailable");
  owned.abortIfOwned();
  expect(trace).toEqual(["world", "world"]);
  expect(events).toEqual([]);
  const unowned = new WeddingNightUnit(runtime, false);
  unowned.abortIfOwned();
  expect(trace).toEqual(["world", "world"]);
});

test("Wedding opening preserves World-before-events and the original copied capture fact", () => {
  const world = weddingWorld(),
    trace: string[] = [],
    events: GameEvent[] = [];
  const unit = new WeddingNightUnit(
    {
      get world() {
        trace.push("world");
        return world;
      },
      get events() {
        trace.push("events");
        return events;
      },
    },
    true,
  );
  unit.open(1, () => true);
  const capture = weddingNightCapture(world, 1)!;
  expect(trace).toEqual(["world", "events"]);
  expect(events).toHaveLength(1);
  expect(events[0]!.type).toBe("ghost_bride_knife_captured");
  expect(events[0]!.payload).toEqual({ ...capture, actorIds: [...capture.actorIds] });
  expect((events[0]!.payload as { actorIds: readonly number[] }).actorIds).not.toBe(
    capture.actorIds,
  );
  expect(
    (events[0]! as Extract<GameEvent, { type: "ghost_bride_knife_captured" }>).audience,
  ).toEqual([]);
  expect(
    Object.isFrozen(
      (events[0]! as Extract<GameEvent, { type: "ghost_bride_knife_captured" }>).audience,
    ),
  ).toBe(true);
  unit.abortIfOwned();
  expect(trace).toEqual(["world", "events", "world"]);
});

test("Wedding late transfer retains the pending native scope until manager close", () => {
  const world = weddingWorld(),
    trace: string[] = [],
    events: GameEvent[] = [];
  const unit = new WeddingNightUnit(
    {
      get world() {
        trace.push("world");
        return world;
      },
      get events() {
        trace.push("events");
        return events;
      },
    },
    true,
  );
  unit.open(1, () => true);
  const scope = boundWeddingTurn(world, "knife", 4);
  expect(authorizedWeddingTurn(world, 4, Phase.Night, 1, scope)).toBe(true);
  unit.transferToManager(true);
  unit.abortIfOwned();
  expect(trace).toEqual(["world", "events"]);
  expect(authorizedWeddingTurn(world, 4, Phase.Night, 1, scope)).toBe(true);
  weddingNightTerminal.close(world);
  expect(authorizedWeddingTurn(world, 4, Phase.Night, 1, scope)).toBe(false);
  weddingNightTerminal.close(world);
});
