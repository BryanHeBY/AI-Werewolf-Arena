/**
 * 单元测试以内存 World 和可见事件为输入，用精确 day、stage、约束及投影字段核对规范请求所有权和唯一行动阶段标签。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
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
    // 运行时输入可伪造规范字段；工厂必须覆盖这些字段。
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
