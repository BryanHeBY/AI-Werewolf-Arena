import {
  getDefaultAgentEventVisibilityRegistry,
  getDefaultScriptEventRenderRegistry,
} from "../../src/game/mechanisms";
import { GameEvent } from "../../src/core/domain/model";
import { World } from "../../src/core/domain/world";

describe("idiot_revealed event presenters", () => {
  test("should be visible to agents and render in script output", () => {
    const event: GameEvent = {
      timestamp: 123,
      type: "idiot_revealed",
      payload: { targetId: 2 },
    };

    expect(
      getDefaultAgentEventVisibilityRegistry().canView(new World(), event, 1),
    ).toBe(true);

    const judgeLine = getDefaultScriptEventRenderRegistry().toJudgeLine(event);
    expect(judgeLine).toContain("2号翻牌为白痴");

  });

  test("live render should include explicit idiot reveal line", () => {
    const event: GameEvent = {
      timestamp: 123,
      type: "idiot_revealed",
      payload: { targetId: 2 },
    };
    const rendered = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(rendered.some((item) => item.text.includes("翻牌为白痴"))).toBe(true);
  });
});
