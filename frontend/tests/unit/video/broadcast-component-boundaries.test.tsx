/**
 * 单元组件测试负责广播拆分后的显式帧、字幕切片与主题槽顺序契约。输入为手写公开复盘和独立字幕片段，输出字面DOM及身份相等断言。
 * 预期来自固定文本、节点顺序与提供的帧对象，不用新组件生成事实答案；像素一致另以拆分前图库DOM及真实画面核验。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { buildVideoFrame, type VideoFrameView } from "../../../src/video/frame";
import { BroadcastVideoFrame } from "../../../src/video/BroadcastVideoFrame";
import { SceneText } from "../../../src/video/render/broadcast/SceneText";
import type { VideoThemeSlotRegistry } from "../../../src/video/theme-renderers";

function replay(): ReplayDocument {
  return {
    schemaVersion: 2,
    sessionId: "broadcast-components",
    perspective: "god",
    meta: { board: "component-test", locale: "en", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: [
      { player_id: 1, role: "wolf", camp: "wolf" },
      { player_id: 2, role: "seer", camp: "good" },
    ],
    events: [
      {
        seq: 1,
        type: "seer_checked",
        day: 1,
        phase: "night",
        timestamp: "time",
        payload: { actorId: 2, targetId: 1, result: { kind: "camp", camp: "good" } },
      },
    ],
  };
}
function plan() {
  const document = replay();
  return compileVideoPlan(
    document,
    { source: getVideoSourceIdentity(document), layout: "broadcast-v1" },
    { locale: "en", timeZone: "UTC" },
  );
}

test("the broadcast compatibility entry consumes a supplied frame without projecting it again", () => {
  const video = plan();
  const view = buildVideoFrame(video, 24);
  const original = JSON.stringify({ video, view });
  // 负帧只有重新调用投影器才会抛错；显式view是宿主已经求值的唯一渲染输入。
  const html = renderToStaticMarkup(<BroadcastVideoFrame plan={video} frame={-1} view={view} />);
  expect(html).toContain('data-report-camp="good"');
  expect(html).toContain('data-state-seq="1"');
  expect(html.match(/data-player-alive="true"/g)).toHaveLength(2);
  expect(JSON.stringify({ video, view })).toBe(original);
  expect(() => renderToStaticMarkup(<BroadcastVideoFrame plan={video} frame={-1} />)).toThrow(
    "video_frame_invalid",
  );
});

test("the extracted text component clips explicit emphasis against the supplied original offset", () => {
  const html = renderToStaticMarkup(
    <SceneText
      caption={{
        text: "DEF😀G",
        offset: 3,
        pageIndex: 1,
        pages: ["ABC", "DEF😀G"],
        scheduled: true,
      }}
      emphasis={[
        { text: "BCDE", start: 1, end: 5 },
        { text: "F😀", start: 5, end: 8 },
      ]}
      accent="#123456"
    />,
  );
  expect(html).toBe(
    '<mark style="background:transparent;color:#123456;font-weight:700">DE</mark><mark style="background:transparent;color:#123456;font-weight:700">F😀</mark>G',
  );
});

test("existing theme slots keep their palette, shared frame and DOM order around fixed layers", () => {
  const video = plan();
  video.shots[0]!.layers.push(
    {
      id: "world",
      kind: "custom",
      component: "world",
      space: "world",
      from: 0,
      durationFrames: 60,
      zIndex: 1,
      props: {},
    },
    {
      id: "screen",
      kind: "custom",
      component: "screen",
      space: "screen",
      from: 0,
      durationFrames: 60,
      zIndex: 2,
      props: {},
    },
  );
  const view = buildVideoFrame(video, 24);
  const observed: VideoFrameView[] = [];
  const slots: VideoThemeSlotRegistry = Object.fromEntries(
    ["background", "sceneHeading", "actionEffect", "frame", "transition", "seatBadge"].map(
      (key) => [
        `gothic-v1/${key}`,
        ({ view, playerId, palette, mediaBaseUrl }) => {
          observed.push(view);
          return (
            <i
              data-slot={key}
              data-slot-player={playerId}
              data-slot-ink={palette.text}
              data-base={mediaBaseUrl}
            />
          );
        },
      ],
    ),
  );
  const html = renderToStaticMarkup(
    <BroadcastVideoFrame
      plan={video}
      frame={24}
      view={view}
      themeSlots={slots}
      mediaBaseUrl="/prepared/"
      layerRegistry={{
        world: () => <b data-fixed-layer="world" />,
        screen: () => <b data-fixed-layer="screen" />,
      }}
    />,
  );
  const ordered = [
    'data-slot="background"',
    "<header",
    'data-composition-player="1"',
    "data-video-stage",
    'data-slot="sceneHeading"',
    'data-slot="actionEffect"',
    'data-surface="result"',
    'data-slot="frame"',
    'data-fixed-layer="world"',
    'data-fixed-layer="screen"',
    'data-slot="transition"',
    'data-testid="composition-caption"',
  ].map((marker) => html.indexOf(marker));
  expect(ordered.every((position) => position >= 0)).toBe(true);
  expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
  expect(observed).toHaveLength(7);
  expect(observed.every((actual) => actual === view)).toBe(true);
  expect(html).toContain(
    'data-slot="seatBadge" data-slot-player="1" data-slot-ink="#e4e9ed" data-base="/prepared/"',
  );
  expect(html).toContain('data-slot="actionEffect" data-slot-ink="#e4e9ed" data-base="/prepared/"');
});
