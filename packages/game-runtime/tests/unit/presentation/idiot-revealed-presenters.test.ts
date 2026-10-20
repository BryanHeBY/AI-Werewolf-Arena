/**
 * 单元测试用规范公开事实核对白痴翻牌展示；字面玩家 feed、脚本及实时行预期验证明确翻牌措辞一致。预期仍为既有字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import {
  getDefaultAgentEventVisibilityRegistry,
  getDefaultScriptEventRenderRegistry,
} from "../../../src/rulesets/mechanism-api";
import { GameEvent } from "../../../src/domain/model";
import { World } from "../../../src/domain/world";

describe("idiot_revealed event presenters", () => {
  test("should be visible to agents and render in script output", () => {
    const event: GameEvent = {
      timestamp: 123,
      type: "idiot_revealed",
      payload: { targetId: 2 },
    };

    expect(getDefaultAgentEventVisibilityRegistry().canView(new World(), event, 1)).toBe(true);

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
