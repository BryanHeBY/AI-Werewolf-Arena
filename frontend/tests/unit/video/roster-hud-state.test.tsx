/**
 * 单元组件测试负责左右HUD镜像、整卡死态及请求/真实空落点的揭晓边界。输入是手写当前状态和typed意图，预期为独立席位和状态标记。
 * 不调用规则或以场景目标推死亡；角色与生命仅来自当前view，材质可读性由真实PNG复核。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RosterHud } from "../../../src/video/render/broadcast/RosterHud";
import { resolveTheme, themePalette, themeSurface } from "../../../src/themes";
import { resolvePlayerPresentations } from "../../../src/presentation";
import type { VideoScene } from "../../../src/video/types";

const theme = resolveTheme();
const scene: VideoScene = {
  kind: "action",
  title: "Knife",
  body: "Literal",
  bodySource: "event",
  targetIds: [1],
  emphasis: [],
  cues: { establish: 0, travel: 8, impact: 24, settled: 40 },
  visual: {
    family: "pack_attack",
    template: "pack_attack/wolf_knife_committed",
    process: "resolved",
    requestedTargetIds: [1],
    effectiveTargetIds: [2],
    effectiveTargetKnown: true,
    recipientIds: [],
    source: { eventSeqs: [1], factSeqs: [] },
  },
};
const players = [
  {
    playerId: 1,
    role: "seer",
    roleLabel: "预言家",
    camp: "good",
    alive: false,
    isSheriff: true,
    sheriffLabel: "警长",
    isWinner: true,
  },
  {
    playerId: 2,
    role: "unknown",
    roleLabel: "unknown",
    camp: "unknown",
    alive: true,
    isSheriff: false,
    sheriffLabel: "",
    isWinner: false,
  },
];
function markup(revealed: boolean, currentScene = scene, currentPlayers = players) {
  return renderToStaticMarkup(
    <RosterHud
      players={currentPlayers}
      seats={[
        { playerId: 1, x: 150, y: 200, width: 240, height: 132 },
        { playerId: 2, x: 1770, y: 200, width: 240, height: 132 },
      ]}
      presentation={resolvePlayerPresentations([{ player_id: 1 }, { player_id: 2 }])}
      focusPlayerIds={[]}
      scene={currentScene}
      layout="action"
      revealed={revealed}
      scale={1}
      appearance={{
        theme,
        gothic: true,
        night: true,
        palette: themePalette(theme, "night"),
        cards: themePalette(theme, "night"),
        surface: themeSurface(theme, "night"),
      }}
      locale="zh-CN"
      media={[]}
      renderSlot={(_slot, fallback) => fallback}
    />,
  );
}
test("mirrors geometry without flipping text, fully grays dead winner and retains sheriff", () => {
  const html = markup(false);
  expect(html).toContain('data-roster-side="left"');
  expect(html).toContain('data-roster-side="right"');
  expect(html).toContain("flex-direction:row-reverse");
  expect(html).not.toContain("scaleX(-1)");
  expect(html).toContain("grayscale(1) brightness(0.78)");
  expect(html).toContain('data-eliminated-stamp="gothic-v1"');
  expect(html).toContain("rotate(-12deg)");
  expect(html).toContain("data-roster-winner");
  expect(html).toContain("警长");
  expect(html).toContain('data-sheriff-badge="gothic-v1"');
  expect(html).toContain("sheriff-badge-v1.png");
  expect(html.match(/data-sheriff-badge=/g)).toHaveLength(1);
  expect(html).toContain('data-identity-role="seer"');
  expect(html).toContain('data-avatar-auto="unknown"');
  expect(html).toContain('title="未知"');
  expect(html).not.toContain('title="unknown"');
  expect(html.match(/data-eliminated-stamp=/g)).toHaveLength(1);
  const rightDead = markup(
    false,
    scene,
    players.map((player) => ({ ...player, alive: false })),
  );
  expect(rightDead).toContain('data-eliminated-side="right"');
  expect(rightDead).toContain("rotate(12deg)");
});
test("actual targets appear only after reveal while requested is dashed; explicit null stays empty", () => {
  expect(markup(false)).not.toContain("data-effective-target");
  expect(markup(false)).toContain("border-style:dashed");
  const after = markup(true);
  expect(after).toContain('data-effective-target="true"');
  const explicitNull = { ...scene, visual: { ...scene.visual!, effectiveTargetIds: [] } };
  expect(markup(true, explicitNull)).not.toContain("data-effective-target");
  expect(markup(true, explicitNull)).toContain('data-requested-target="true"');
  // 行动目标不会改变传入当前生命状态，倒看/hold同样只读view。
  const alive = players.map((player) => ({ ...player, alive: true }));
  expect(markup(true, scene, alive)).not.toContain("data-eliminated-stamp");
});
