/**
 * 单元与纯组件测试负责名册显隐后的自适应几何。输入是整局已裁剪资料与手写生死／镜头，输出独立字面列宽、舞台和SVG锚点断言。
 * 不按当前帧猜姓名或模型，不通过CSS缩卡掩盖坐标差异；完整资料旧几何与左右独立紧凑分支均保留明确预期。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import type { PlayerPresentationConfig } from "../../../src/presentation";
import { createVideoLayout, cameraTargetPose } from "../../../src/video/layout";
import { buildVideoFrame, videoWorldToScreen } from "../../../src/video/frame";
import { compileVideoPlan } from "../../../src/video/compiler";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { VideoLayers } from "../../../src/video/VideoLayers";
import type { CustomVideoLayerProps, VideoLayer } from "../../../src/video/types";

const ids = Array.from({ length: 12 }, (_, index) => index + 1);
test("omitted presentation geometry stays compatible and complete visible metadata keeps the full columns", () => {
  const original = createVideoLayout(ids, 1920, 1080, "broadcast-v1");
  const supplied = createVideoLayout(ids, 1920, 1080, "broadcast-v1", {
    playersPresentation: ids.map((playerId) => ({ playerId, displayName: `P${playerId}` })),
  });
  expect(supplied).toEqual(original);
  expect(original.rosterColumns.left.width).toBeCloseTo(328.32, 8);
  expect(original.rosterColumns.right.width).toBeCloseTo(328.32, 8);
  expect(original.rosterColumns.left.hasMetadata).toBe(true);
  expect(original.rosterColumns.right.hasMetadata).toBe(true);
  expect(original.stage.x).toBeCloseTo(393.6, 8);
  expect(original.stage.width).toBeCloseTo(1132.8, 8);
  expect(
    createVideoLayout(ids, 1920, 1080, "legacy-ellipse-v1", { playersPresentation: [] }),
  ).toEqual(createVideoLayout(ids, 1920, 1080, "legacy-ellipse-v1"));
});

test("left and right metadata columns shrink independently and return their width to the stage and caption", () => {
  for (const count of [6, 12]) {
    const players = ids.slice(0, count),
      rightId = players[Math.ceil(count / 2)]!;
    const leftCompact = createVideoLayout(players, 1920, 1080, "broadcast-v1", {
      playersPresentation: [{ playerId: rightId, modelLabel: "Visible model" }],
    });
    expect(leftCompact.rosterColumns.left).toEqual({ width: 240, hasMetadata: false });
    expect(leftCompact.rosterColumns.right.width).toBeCloseTo(328.32, 8);
    expect(leftCompact.rosterColumns.right.hasMetadata).toBe(true);
    expect(leftCompact.rosterLeft[0]!.x).toBeCloseTo(157.44, 8);
    expect(leftCompact.rosterRight[0]!.x).toBeCloseTo(1718.4, 8);
    expect(leftCompact.stage.x).toBeCloseTo(305.28, 8);
    expect(leftCompact.stage.width).toBeCloseTo(1221.12, 8);
    expect(cameraTargetPose("table", 1, leftCompact).x).toBeCloseTo(915.84, 8);
    expect(leftCompact.table.x).toBeCloseTo(915.84, 8);
    const rightCompact = createVideoLayout(players, 1920, 1080, "broadcast-v1", {
      playersPresentation: [{ playerId: 1, displayName: "Visible name" }],
    });
    expect(rightCompact.rosterColumns.left.width).toBeCloseTo(328.32, 8);
    expect(rightCompact.rosterColumns.left.hasMetadata).toBe(true);
    expect(rightCompact.rosterColumns.right).toEqual({ width: 240, hasMetadata: false });
    expect(rightCompact.rosterRight[0]!.x).toBeCloseTo(1762.56, 8);
    expect(rightCompact.stage.x).toBeCloseTo(393.6, 8);
    expect(rightCompact.stage.width).toBeCloseTo(1221.12, 8);
    expect(cameraTargetPose("table", 1, rightCompact).x).toBeCloseTo(1004.16, 8);
    const both = createVideoLayout(players, 1920, 1080, "broadcast-v1", {
      playersPresentation: [
        { playerId: 1, displayName: " " },
        { playerId: rightId, modelLabel: "\t" },
      ],
    });
    expect(both.rosterColumns).toEqual({
      left: { width: 240, hasMetadata: false },
      right: { width: 240, hasMetadata: false },
    });
    expect(both.stage.x).toBeCloseTo(305.28, 8);
    expect(both.stage.width).toBeCloseTo(1309.44, 8);
    expect(both.caption.x).toBeCloseTo(357.6576, 8);
    expect(both.caption.width).toBeCloseTo(1204.6848, 8);
    for (const layout of [leftCompact, rightCompact, both]) {
      expect(layout.rosterLeft[0]!.x - layout.rosterLeft[0]!.width / 2).toBeCloseTo(37.44, 8);
      expect(layout.rosterRight[0]!.x + layout.rosterRight[0]!.width / 2).toBeCloseTo(1882.56, 8);
      expect(
        layout.stage.x - layout.rosterLeft[0]!.x - layout.rosterLeft[0]!.width / 2,
      ).toBeCloseTo(27.84, 8);
      expect(
        layout.rosterRight[0]!.x -
          layout.rosterRight[0]!.width / 2 -
          layout.stage.x -
          layout.stage.width,
      ).toBeCloseTo(27.84, 8);
    }
  }
});

function compiled(presentation: PlayerPresentationConfig, layers: VideoLayer[] = []) {
  const replay: ReplayDocument = {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "adaptive-layout",
    meta: { board: "test", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: ids.map((player_id) => ({
      player_id,
      name: `Raw name ${player_id}`,
      ...(player_id === 7 ? { model: "Recorded model" } : {}),
      role: "villager",
      camp: "good",
    })),
    events: [
      {
        seq: 1,
        day: 1,
        phase: "day",
        type: "day_speech",
        timestamp: "2026-01-01T00:00:00Z",
        payload: { actorId: 1, text: "Do not derive layout from this speech." },
      },
      {
        seq: 2,
        day: 1,
        phase: "voting",
        type: "voted_out",
        timestamp: "2026-01-01T00:00:01Z",
        payload: { target: 1 },
      },
    ],
  };
  return compileVideoPlan(replay, {
    source: getVideoSourceIdentity(replay),
    layout: "broadcast-v1",
    presentation,
    edits: [
      {
        anchor: { seq: 1, type: "day_speech" },
        camera: [
          { frame: 0, target: { playerIds: [12] }, zoom: 1.8, easing: "hold" },
          { frame: 30, target: "table" },
        ],
        layers,
      },
    ],
  });
}
test("frame geometry reads only the cropped whole-game presentation and never jumps with deaths or camera focus", () => {
  const both = compiled({ showNames: false, showModels: false });
  const first = buildVideoFrame(both, 0);
  expect(first.currentView.players[0]!.name).toBe("Raw name 1");
  expect(first.layout.rosterColumns.left.hasMetadata).toBe(false);
  expect(first.layout.rosterColumns.right.hasMetadata).toBe(false);
  expect(first.layout.stage.width).toBeCloseTo(1309.44, 8);
  for (const frame of [29, 30, 89, 90, 114, 179])
    expect(buildVideoFrame(both, frame).layout).toEqual(first.layout);
  expect(buildVideoFrame(both, 114).currentView.players[0]!.alive).toBe(false);
  const mixed = compiled({ showNames: false });
  expect(buildVideoFrame(mixed, 0).layout.rosterColumns.left.hasMetadata).toBe(false);
  expect(buildVideoFrame(mixed, 0).layout.rosterColumns.right.hasMetadata).toBe(true);
  const anonymous = compiled({ anonymous: true });
  expect(buildVideoFrame(anonymous, 0).layout).toEqual(first.layout);
});

test("adaptive anchors, projected world endpoints and custom layers all consume the same asymmetric layout", () => {
  const plan = compiled({ showNames: false }, [
    {
      id: "arrow",
      kind: "arrow",
      space: "world",
      fromTarget: { playerId: 1 },
      toTarget: { x: 1100, y: 600 },
    },
    { id: "highlight", kind: "highlight", space: "screen", playerIds: [1] },
    { id: "custom", kind: "custom", space: "screen", component: "Example" },
  ]);
  const view = buildVideoFrame(plan, 0);
  const Example = ({ view }: CustomVideoLayerProps) => (
    <div
      data-custom-stage={view?.layout.stage.width}
      data-custom-left={view?.layout.rosterColumns.left.width}
    />
  );
  const world = renderToStaticMarkup(<VideoLayers view={view} plan={plan} space="world" />);
  const d = world
    .match(/<path[^>]+\bd="([^"]+)"/)![1]!
    .match(/-?\d+(?:\.\d+)?/g)!
    .slice(0, 4)
    .map(Number);
  expect(d[0]).toBeCloseTo(157.44, 8);
  expect(d[1]).toBeCloseTo(238.68, 8);
  expect(d[2]).toBeCloseTo(1247.328, 8);
  expect(d[3]).toBeCloseTo(619.92, 8);
  expect(videoWorldToScreen({ x: 1100, y: 600 }, view).x).toBeCloseTo(1247.328, 8);
  const screen = renderToStaticMarkup(
    <VideoLayers view={view} plan={plan} space="screen" layerRegistry={{ Example }} />,
  );
  const ellipse = screen.match(/<ellipse[^>]+>/)![0];
  expect(Number(ellipse.match(/\bcx="([^"]+)"/)![1])).toBeCloseTo(157.44, 8);
  expect(Number(ellipse.match(/\brx="([^"]+)"/)![1])).toBeCloseTo(148.8, 8);
  const custom = screen.match(/<div[^>]*data-custom-stage[^>]+>/)![0];
  expect(Number(custom.match(/data-custom-stage="([^"]+)"/)![1])).toBeCloseTo(1221.12, 8);
  expect(custom).toContain('data-custom-left="240"');
});
