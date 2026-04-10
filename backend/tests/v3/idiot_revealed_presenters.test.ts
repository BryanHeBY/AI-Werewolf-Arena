import {
  getDefaultAgentEventLineRegistry,
  getDefaultRealtimeEventRegistry,
  getDefaultScriptEventRenderRegistry,
} from "../../src/mechanisms";
import { GameEvent } from "../../src/domain/model";

describe("idiot_revealed event presenters", () => {
  test("should render in agent/script/realtime outputs", () => {
    const event: GameEvent = {
      timestamp: 123,
      type: "idiot_revealed",
      payload: { targetId: 2 },
    };

    const agentLine = getDefaultAgentEventLineRegistry().toLine(event, {
      actorId: 1,
      isWolf: false,
    });
    expect(agentLine).toContain("2号翻牌为白痴");
    expect(agentLine).toContain("失去投票权");

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
    expect(realtime.some((item) => item.type === "idiot_revealed")).toBe(true);
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
