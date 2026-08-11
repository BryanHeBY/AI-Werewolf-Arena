import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../src/core/domain/action_request_context";
import { Phase } from "../../../src/core/domain/model";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

describe("GameActionRequestFactory", () => {
  test("owns canonical day, stage, visibility and constraint fields", () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
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
      context: {
        trigger: "test",
        day: 99,
        stage: "forged_stage",
        current_day: 99,
        phase: "legacy_stage",
        window: "legacy_window",
        visible_events: [],
        turn_constraints: { min_valid_actions: 0 },
      },
    });

    expect(request.context.day).toBe(3);
    expect(request.context.stage).toBe("day_speech");
    expect(request.context.trigger).toBe("test");
    expect(request.context.current_day).toBeUndefined();
    expect(request.context.phase).toBeUndefined();
    expect(request.context.window).toBeUndefined();
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

  test("reads a legacy context without changing its historical meaning", () => {
    const stage = getActionRequestStage({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { current_day: 2, phase: "hunter_shot" },
    });

    expect(stage).toBe("hunter_shot");
  });
});
