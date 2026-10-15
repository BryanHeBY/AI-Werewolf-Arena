/**
 * Unit tests: Action request construction uses an in-memory world and visible events;
 * exact day, stage, constraint and projection fields check canonical request ownership and
 * the sole action-stage label. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../src/domain/action-request-context";
import { Phase } from "../../../src/domain/model";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

describe("GameActionRequestFactory", () => {
  test("owns canonical day, stage, visibility and constraint fields", () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    // Runtime input can carry forged canonical fields; the factory must overwrite them.
    const forgedContext = {
      trigger: "test",
      day: 99,
      stage: "forged_stage",
      visible_events: [],
      turn_constraints: { min_valid_actions: 0 },
    };
    const request = new GameActionRequestFactory(
      context.world,
      context.phaseManager.getEvents(),
      3,
    ).create({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      stage: "day_speech",
      requiresAction: true,
      summary: "必须发言。",
      context: forgedContext,
    });

    expect(request.context.day).toBe(3);
    expect(request.context.stage).toBe("day_speech");
    expect(request.context.trigger).toBe("test");
    expect(request.context.turn_constraints).toEqual({
      min_valid_actions: 1,
      max_valid_actions: 1,
      required_any_tools: ["speak"],
      summary: "必须发言。",
    });
    expect(Array.isArray(request.context.visible_events)).toBe(true);
    expect(getActionRequestDay(request)).toBe(3);
    expect(getActionRequestStage(request)).toBe("day_speech");
  });

  test("uses stage as the sole fine-grained action label", () => {
    const stage = getActionRequestStage({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { day: 2, stage: "hunter_shot", visible_events: [], turn_constraints: {} },
    });

    expect(stage).toBe("hunter_shot");
  });
});
