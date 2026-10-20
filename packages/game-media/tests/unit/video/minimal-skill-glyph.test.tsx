/**
 * 单元组件测试负责简约技能语义与未知去图边界。输入为手写typed意图和揭晓帧，输出独立工具、报告与空回退断言。
 * 不从角色、台词或当前阵营推工具和答案；哥特材质继续独立由其主题组件拥有。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneHero, RecordMark } from "../../../src/video/SceneVisual";
import { resolveTheme } from "../../../src/themes";
import type { VideoScene, VideoVisualIntent } from "../../../src/video/types";
const intent: VideoVisualIntent = {
  family: "inspection_camp",
  template: "inspection_camp/recorded_report_reveal",
  process: "reported",
  requestedTargetIds: [2],
  effectiveTargetIds: [],
  recipientIds: [1],
  source: { eventSeqs: [1], factSeqs: [] },
};
function html(visual: VideoVisualIntent, frame = 24) {
  const scene: VideoScene = {
    kind: "action",
    title: "Literal",
    body: "Literal report",
    bodySource: "event",
    targetIds: [2],
    emphasis: [],
    cues: { establish: 0, travel: 8, impact: 24, settled: 40 },
    visual,
  };
  return renderToStaticMarkup(
    <SceneHero
      scene={scene}
      frame={frame}
      size={300}
      theme={resolveTheme({ id: "minimal-v1" })}
      gothic={false}
      color="#274f85"
    />,
  );
}
test("minimal known actions have mechanism glyphs and report tint waits for impact", () => {
  const visual = { ...intent, report: { kind: "camp", camp: "wolf" } as const };
  expect(html(visual, 23)).toContain('data-minimal-skill="inspection_camp"');
  expect(html(visual, 23)).not.toContain("data-minimal-report");
  expect(html(visual, 24)).toContain('data-minimal-report="wolf"');
  expect(html(visual)).not.toContain("data-neutral-record");
  expect(html(visual)).not.toContain("data-gothic-skill-art");
});
test("explicit tools win over mechanism family without publishing a native identity", () => {
  for (const family of ["pack_attack", "copy_resource"] as const) {
    const result = html({ ...intent, family, deathTool: "gun" });
    expect(result).toContain('data-minimal-skill="gun"');
    expect(result).not.toContain('data-role-crest="hunter"');
  }
  const demon = html({ ...intent, family: "duel", duelKind: "demon_hunter" });
  expect(demon).toContain('data-minimal-skill="demon_hunter"');
  expect(demon).not.toContain("dueling-blades");
});
test("unknown fallback and old record export render no decorative file", () => {
  expect(html({ ...intent, process: "unknown", fallbackReason: "unknown_or_invalid_event" })).toBe(
    "",
  );
  expect(renderToStaticMarkup(<RecordMark size={80} color="#000" />)).toBe("");
});
