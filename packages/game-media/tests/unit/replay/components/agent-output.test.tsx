/** 显式私有文件入口的渲染测试；独立字面档案检查分类、双语、转义和不触碰游戏回放的边界。 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerAgentOutput, PlayerAgentOutputView } from "../../../../src/replay/PlayerAgentOutput";
import { parsePlayerAgentArchive } from "../../../../src/replay/agent-output-loader";

const raw = JSON.stringify({
  schemaVersion: 2,
  player_id: 7,
  role: "witch",
  camp: "good",
  timeline: [
    {
      seq: 1,
      kind: "turn",
      day: 1,
      phase: "night",
      stage: "witch",
      request_id: "only-private-7",
      turn_seq: 1,
      delta_messages: [
        {
          role: "assistant",
          kind: "assistant_output",
          name: "thinking",
          content: "私有思考 <script>alert(1)</script>",
        },
        { role: "assistant", kind: "assistant_output", name: "message", content: "模型消息" },
        { role: "user", kind: "prompt", content: "私有提示" },
        {
          role: "assistant",
          kind: "tool_call",
          name: "submit_action",
          args: { turn_id: "synthetic" },
          accepted: true,
        },
        {
          role: "tool",
          kind: "tool_result",
          name: "submit_action",
          result: { ok: true, applied: false },
        },
      ],
    },
  ],
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: 私有内容需显式导入，思考灰色且原文安全转义`, () => {
    const empty = renderToStaticMarkup(<PlayerAgentOutput locale={locale} />);
    expect(empty).toContain('type="file"');
    expect(empty).not.toContain("only-private-7");
    const view = parsePlayerAgentArchive(raw),
      before = JSON.stringify(view);
    const html = renderToStaticMarkup(
      <PlayerAgentOutputView
        view={view}
        locale={locale}
        display={{ printThinking: true, printLlmIo: false, trace: false }}
      />,
    );
    expect(html).toContain("agent-output-muted");
    expect(html).toContain(locale === "en" ? "Thought" : "思考");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("私有提示");
    expect(html).toContain("applied");
    expect(JSON.stringify(view)).toBe(before);
    const hidden = renderToStaticMarkup(
      <PlayerAgentOutputView
        view={view}
        locale={locale}
        display={{ printThinking: false, printLlmIo: true, trace: false }}
      />,
    );
    expect(hidden).not.toContain("私有思考");
    expect(hidden).not.toContain("submit_action");
    expect(hidden).toContain("模型消息");
    expect(hidden).toContain("私有提示");
  });

test("游戏回放或坏文件不能冒充玩家私有档案", () => {
  expect(() => parsePlayerAgentArchive("not-json")).toThrow();
  expect(() =>
    parsePlayerAgentArchive(JSON.stringify({ players: [], events: [], meta: {}, result: {} })),
  ).toThrow();
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: 私有回执在关闭详细输出时仍标明未确认与已确认，不当作已生效事件`, () => {
    const value = JSON.parse(raw);
    value.timeline[0].delta_messages = [
      {
        role: "tool",
        kind: "tool_result",
        name: "submit_action",
        result: {
          ok: true,
          accepted: false,
          applied: false,
          status: "confirmation_required",
          confirmation_id: "only-private",
          action: "self_destruct",
          arguments: { reason: "placeholder", confirm: true },
          warning: "Not selected <script>danger</script>",
        },
      },
      {
        role: "tool",
        kind: "tool_result",
        name: "submit_action",
        result: {
          ok: true,
          accepted: true,
          applied: false,
          status: "confirmed",
          action: "self_destruct",
        },
      },
    ];
    const html = renderToStaticMarkup(
      <PlayerAgentOutputView
        view={parsePlayerAgentArchive(JSON.stringify(value))}
        locale={locale}
        display={{ printThinking: false, printLlmIo: false, trace: false }}
      />,
    );
    expect(html).toContain(
      locale === "en" ? "Second confirmation required (not selected)" : "需要二次确认（尚未选定）",
    );
    expect(html).toContain(
      locale === "en" ? "Confirmed (not yet applied)" : "已二次确认（尚未生效）",
    );
    expect(html).toContain("agent-output-warn");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
