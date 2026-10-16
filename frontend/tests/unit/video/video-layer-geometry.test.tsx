/**
 * 纯组件单元测试负责广播图层的实际SVG/CSS几何。输入为1920×1080手写对局、1.8倍镜头和固定HUD锚点，输出独立字面坐标断言。
 * 不用实现重新生成预期；中心(960,575.1)、席位(201.6,238.68)与目标投影按画幅手算，旧布局由已有精确矩阵测试继续约束。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame } from "../../../src/video/frame";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { VideoLayers } from "../../../src/video/VideoLayers";
import type {
  CustomVideoLayerProps,
  VideoLayer,
  VideoLayerRegistry,
  VideoPlan,
} from "../../../src/video/types";

function plan(layers: VideoLayer[]): VideoPlan {
  const replay: ReplayDocument = {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "geometry",
    meta: { board: "handwritten", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, index) => ({
      player_id: index + 1,
      role: "villager",
      camp: "good",
    })),
    events: [
      {
        seq: 1,
        type: "day_speech",
        day: 1,
        phase: "day",
        timestamp: "2026-01-01T00:00:00Z",
        payload: { actorId: 1, text: "Geometry only" },
      },
    ],
  };
  return compileVideoPlan(replay, {
    source: getVideoSourceIdentity(replay),
    layout: "broadcast-v1",
    edits: [
      {
        anchor: { seq: 1, type: "day_speech" },
        durationFrames: 60,
        camera: [
          { frame: 0, target: { playerIds: [12] }, zoom: 1.8, easing: "hold" },
          { frame: 30, target: "table", zoom: 1 },
        ],
        layers,
      },
    ],
  });
}
function render(
  compiled: VideoPlan,
  space: "screen" | "world",
  frame = 0,
  registry?: VideoLayerRegistry,
) {
  return renderToStaticMarkup(
    <VideoLayers
      view={buildVideoFrame(compiled, frame)}
      plan={compiled}
      space={space}
      layerRegistry={registry}
      mediaBaseUrl="https://example.test/assets/"
    />,
  );
}
function tags(markup: string, name: string): string[] {
  return [...markup.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((match) => match[0]);
}
function numeric(tag: string, attribute: string): number {
  return Number(tag.match(new RegExp(`\\b${attribute}="([^"]+)"`))?.[1]);
}
function pathStart(markup: string): number[] {
  const d = tags(markup, "path")[0]!.match(/\bd="([^"]+)"/)![1]!;
  return d
    .match(/-?\d+(?:\.\d+)?/g)!
    .slice(0, 4)
    .map(Number);
}

test("screen and world seat highlights and spotlight masks keep literal HUD position and size at zoom1.8", () => {
  for (const space of ["screen", "world"] as const) {
    const compiled = plan([{ id: "highlight", kind: "highlight", space, playerIds: [1] }]);
    const focused = tags(render(compiled, space), "ellipse")[0]!;
    const wide = tags(render(compiled, space, 30), "ellipse")[0]!;
    for (const ellipse of [focused, wide]) {
      expect(numeric(ellipse, "cx")).toBeCloseTo(201.6, 8);
      expect(numeric(ellipse, "cy")).toBeCloseTo(238.68, 8);
      expect(numeric(ellipse, "rx")).toBeCloseTo(203.5584, 8);
      expect(numeric(ellipse, "ry")).toBeCloseTo(92.232, 8);
    }
  }
  const spotlight = plan([{ id: "spotlight", kind: "spotlight", space: "screen", playerIds: [1] }]);
  const mask = tags(render(spotlight, "screen"), "ellipse")[0]!;
  expect(numeric(mask, "cx")).toBeCloseTo(201.6, 8);
  expect(numeric(mask, "cy")).toBeCloseTo(238.68, 8);
  expect(numeric(mask, "rx")).toBeCloseTo(223.2576, 8);
  expect(numeric(mask, "ry")).toBeCloseTo(98.82, 8);
});

test("world mixed arrows transform only the explicit world endpoint around the central stage", () => {
  const compiled = plan([
    {
      id: "arrow",
      kind: "arrow",
      space: "world",
      fromTarget: { playerId: 1 },
      toTarget: { x: 1100, y: 600 },
    },
  ]);
  const view = buildVideoFrame(compiled, 0);
  expect(view.camera.x).toBe(960);
  expect(view.camera.y).toBeCloseTo(575.1, 8);
  expect(view.translation.x).toBe(-768);
  expect(view.translation.y).toBeCloseTo(-460.08, 8);
  const points = pathStart(render(compiled, "world"));
  expect(points[0]).toBeCloseTo(201.6, 8);
  expect(points[1]).toBeCloseTo(238.68, 8);
  expect(points[2]).toBeCloseTo(1212, 8);
  expect(points[3]).toBeCloseTo(619.92, 8);
  const screen = plan([
    {
      id: "arrow",
      kind: "arrow",
      space: "screen",
      fromTarget: { x: 1100, y: 600 },
      toTarget: { playerId: 1 },
    },
  ]);
  const fixed = pathStart(render(screen, "screen"));
  expect(fixed).toEqual([1100, 600, 201.6, 238.68]);
});

test("world text and custom layers inherit the same matrix while screen content stays unscaled", () => {
  const compiled = plan([
    {
      id: "text-world",
      kind: "text",
      space: "world",
      x: 1100,
      y: 600,
      width: 200,
      text: "World text",
    },
    {
      id: "text-screen",
      kind: "text",
      space: "screen",
      x: 1100,
      y: 600,
      width: 200,
      text: "Screen text",
    },
    { id: "custom", kind: "custom", space: "world", component: "Example" },
  ]);
  const Example = ({
    view,
    sourceSeq,
    currentView,
    scene,
    mediaBaseUrl,
  }: CustomVideoLayerProps) => (
    <div
      data-custom-source={sourceSeq}
      data-custom-actor={scene?.actorId}
      data-custom-state={currentView?.snapshot.day}
      data-custom-scale={view?.camera.scale}
      data-custom-media={mediaBaseUrl}
      style={{ position: "absolute", left: 1100, top: 600 }}
    >
      Custom world
    </div>
  );
  const world = render(compiled, "world", 0, { Example });
  const positioned = tags(world, "div").find((tag) => tag.includes("left:1212px"))!;
  expect(Number(positioned.match(/top:([\d.-]+)px/)?.[1])).toBeCloseTo(619.92, 8);
  expect(positioned).toContain("transform:scale(1.8)");
  expect(positioned).toContain("transform-origin:0 0");
  const custom = tags(world, "div").find((tag) => tag.includes("data-video-custom-world"))!;
  const matrix = custom.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/)!;
  expect(Number(matrix[1])).toBe(-768);
  expect(Number(matrix[2])).toBeCloseTo(-460.08, 8);
  expect(Number(matrix[3])).toBe(1.8);
  expect(world).toContain('data-custom-source="1"');
  expect(world).toContain('data-custom-actor="1"');
  expect(world).toContain('data-custom-state="1"');
  expect(world).toContain('data-custom-scale="1.8"');
  expect(world).toContain('data-custom-media="https://example.test/assets/"');
  const screen = render(compiled, "screen");
  expect(screen).toContain("left:1100px;top:600px");
  expect(screen).not.toContain("transform:scale(1.8)");
});

test("shake moves world endpoints and central stage by the same literal offset while HUD stays fixed", () => {
  const compiled = plan([
    { id: "shake", kind: "shake", durationFrames: 10, intensity: 10 },
    {
      id: "arrow",
      kind: "arrow",
      space: "world",
      fromTarget: { playerId: 1 },
      toTarget: { x: 1100, y: 600 },
    },
  ]);
  const view = buildVideoFrame(compiled, 0);
  const shifted = pathStart(render(compiled, "world"));
  expect(shifted[0]).toBeCloseTo(201.6, 8);
  expect(shifted[1]).toBeCloseTo(238.68, 8);
  expect(shifted[2]).toBeCloseTo(1212, 8);
  expect(shifted[3]).toBeCloseTo(629.5555818542, 8);
  const matrix = view.stageTransform.match(
    /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/,
  )!;
  expect(Number(matrix[1])).toBe(0);
  expect(Number(matrix[2])).toBeCloseTo(9.6355818542, 8);
  expect(Number(matrix[3])).toBe(1.8);
});
