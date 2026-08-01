import {
  getDefaultAgentEventVisibilityRegistry,
  getDefaultRealtimeEventRegistry,
  getDefaultScriptEventRenderRegistry,
} from "../../src/game/mechanisms";
import { GameEvent } from "../../src/core/domain/model";
import { World } from "../../src/core/domain/world";

describe("idiot_revealed event presenters", () => {
  test("should be visible to agents and render in script/realtime outputs", () => {
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

    const realtime = getDefaultRealtimeEventRegistry().translate(event, {
      nowState: {
        phase: "Sequential_Speech",
        round: 2,
        players: [],
        deadPlayerIds: [],
        history: [],
        witchHasAntidote: false,
        witchHasPoison: false,
        currentSpeechIndex: 0,
        alive_count: 10,
        pending_marks: [],
        last_action_id: "2-day-0",
      },
      getPlayerName: (id) => `玩家${id}`,
      getPlayerRole: () => "idiot",
    });
    expect(realtime.some((item) => item.type === "player.idiot_revealed")).toBe(true);
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
