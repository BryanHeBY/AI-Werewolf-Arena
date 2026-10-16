/**
 * 单元与纯组件测试负责核对剪辑时钟、原事件游标、镜头及字幕边界。输入为手写事实和脚本，输出独立字面预期与静态 markup 断言。
 * 预期从指定 seq 的死亡、徽章及局部帧关系推得，不从实现生成 golden，不启动真实对局或媒体渲染进程。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import {
  audioCueVolume,
  buildVideoFrame,
  compileVideoPlan,
  createVideoLayout,
  defineVideoScript,
  getVideoEventFrame,
  getVideoSourceIdentity,
  paginateVideoCaption,
  resolveVideoMediaSource,
  videoWorldToScreen,
  VideoFrame,
  type CustomVideoLayerProps,
  type VideoScript,
} from "../../../src/video";

function fixture(count = 6): ReplayDocument {
  const events: Omit<ReplayEvent, "seq" | "timestamp" | "day" | "phase">[] = [
    { type: "phase_changed", payload: { phase: "night" } },
    { type: "sheriff_vote_cast", payload: { actorId: 1, targetId: 2 } },
    { type: "sheriff_elected", payload: { winnerId: 2 } },
    { type: "day_speech", payload: { actorId: 1, text: "我认为二号是狼人。" } },
    { type: "voted_out", payload: { target: 2 } },
    { type: "phase_changed", payload: { phase: "night", day: 2 } },
    { type: "game_over", payload: { winner: "good", reason: "wolves_eliminated" } },
  ];
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: `video-${count}`,
    meta: { board: "video", locale: "zh-CN", startedAt: "t1", endedAt: "t2" },
    result: { winner: "good", reason: "wolves_eliminated" },
    players: Array.from({ length: count }, (_, index) => ({
      player_id: index + 1,
      name: `玩家${index + 1}`,
      role: index === 1 ? "wolf" : "villager",
      camp: index === 1 ? "wolf" : "good",
    })),
    events: events.map((event, index) => ({
      ...event,
      seq: index + 1,
      timestamp: "2026-07-29T00:00:00.000Z",
      day: index >= 5 ? 2 : 1,
      phase: index < 3 || index >= 5 ? "night" : "day",
    })),
  };
}
function script(replay: ReplayDocument, values: Omit<VideoScript, "source"> = {}): VideoScript {
  return defineVideoScript({ source: getVideoSourceIdentity(replay), ...values });
}

test("default plan keeps source seq and compiled timeline survives JSON transport", () => {
  const replay = fixture();
  const original = structuredClone(replay);
  const plan = compileVideoPlan(replay);
  // 新广播项目在缺少本轮summary时保留不完整逐票；不会用后续当选事件反推缺失票型。
  expect(plan.shots.map((shot) => shot.eventSeq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(getVideoEventFrame(plan, 2)).toBe(114);
  expect(getVideoEventFrame(plan, 4)).toBe(270);
  expect(buildVideoFrame(plan, 269).shot.eventSeq).toBe(3);
  expect(buildVideoFrame(plan, 270).shot.eventSeq).toBe(4);
  expect(buildVideoFrame(plan, 270).shot.speech).toEqual([
    { speaker: "player:1", text: "我认为二号是狼人。", from: 0, durationFrames: 90 },
  ]);
  expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  expect(replay).toEqual(original);
});

test("skip, inserted hold and retrospective hold read the complete original history", () => {
  const replay = fixture();
  const plan = compileVideoPlan(
    replay,
    script(replay, {
      edits: [
        { anchor: { seq: 4, type: "day_speech" }, durationFrames: 25 },
        { anchor: { seq: 5, type: "voted_out" }, skip: true },
      ],
      holds: [
        {
          id: "explain",
          after: { seq: 4, type: "day_speech" },
          durationFrames: 15,
          caption: "说明：暂停观察。",
        },
        {
          id: "recall",
          after: { seq: 6, type: "phase_changed" },
          stateAt: { seq: 4, type: "day_speech" },
          durationFrames: 20,
        },
      ],
    }),
  );
  expect(plan.shots.map((shot) => [shot.id, shot.from, shot.durationFrames])).toEqual([
    ["event:1", 0, 90],
    ["event:3", 90, 90],
    ["event:4", 180, 25],
    ["hold:explain", 205, 15],
    ["event:6", 220, 90],
    ["hold:recall", 310, 20],
    ["event:7", 330, 90],
  ]);
  expect(buildVideoFrame(plan, 220).shot.view.players[1].alive).toBe(false);
  expect(buildVideoFrame(plan, 310).shot.view.players[1].alive).toBe(true);
  expect(buildVideoFrame(plan, 330).shot.view.players[1].alive).toBe(false);
  expect(buildVideoFrame(plan, 180).shot.view.players[1].isSheriff).toBe(true);
  expect(buildVideoFrame(plan, 419).shot.eventSeq).toBe(7);
  expect(buildVideoFrame(plan, 10000).frame).toBe(419);
  // 顺序、倒序和重复查帧都不能改变已编译事实。
  const expected = buildVideoFrame(plan, 220);
  buildVideoFrame(plan, 0);
  buildVideoFrame(plan, 310);
  expect(buildVideoFrame(plan, 220)).toEqual(expected);
});

test("explicitly editing a default-hidden event still anchors its original seq and type", () => {
  const replay = fixture();
  const plan = compileVideoPlan(
    replay,
    script(replay, {
      edits: [{ anchor: { seq: 2, type: "sheriff_vote_cast" }, durationFrames: 1 }],
    }),
  );
  expect(plan.shots[1].eventSeq).toBe(2);
  expect(buildVideoFrame(plan, 90).localFrame).toBe(0);
  expect(buildVideoFrame(plan, 91).shot.eventSeq).toBe(3);
});

test("source guards catch a changed archive and anchors reject accidental type drift", () => {
  const replay = fixture();
  const edit = script(replay, {
    edits: [{ anchor: { seq: 4, type: "day_speech" }, durationFrames: 60 }],
  });
  const modified = structuredClone(replay);
  modified.events[3].payload.text = "changed";
  expect(() => compileVideoPlan(modified, edit)).toThrow("video_source_mismatch");
  expect(() =>
    compileVideoPlan(replay, { ...edit, source: { ...edit.source, sessionId: "other" } }),
  ).toThrow("video_source_mismatch");
  expect(() =>
    compileVideoPlan(
      replay,
      script(replay, { edits: [{ anchor: { seq: 4, type: "voted_out" } }] }),
    ),
  ).toThrow("video_anchor_mismatch:4");
  expect(() =>
    compileVideoPlan(
      replay,
      script(replay, {
        holds: [{ id: "bad", after: { seq: 100, type: "day_speech" }, durationFrames: 20 }],
      }),
    ),
  ).toThrow("video_anchor_mismatch:100");
  const reordered = {
    ...replay,
    meta: {
      endedAt: replay.meta.endedAt,
      startedAt: replay.meta.startedAt,
      locale: replay.meta.locale,
      board: replay.meta.board,
    },
  };
  expect(getVideoSourceIdentity(reordered)).toEqual(getVideoSourceIdentity(replay));
});

test("long speeches paginate without clipping and locale does not shift scene boundaries", () => {
  const replay = fixture(12);
  replay.events[3].payload.text = "这段内容用于验证长发言的安全字幕区域。".repeat(60);
  const zh = compileVideoPlan(replay, undefined, { locale: "zh-CN", timeZone: "UTC" });
  const en = compileVideoPlan(replay, undefined, { locale: "en", timeZone: "Asia/Shanghai" });
  expect(zh.shots.map((shot) => shot.durationFrames)).toEqual(
    en.shots.map((shot) => shot.durationFrames),
  );
  expect(zh.source).toEqual(en.source);
  const shot = zh.shots.find((item) => item.eventSeq === 4)!;
  expect(shot.durationFrames).toBeGreaterThan(90);
  expect(shot.captionPages.length).toBeGreaterThan(8);
  for (const page of shot.captionPages) {
    expect(page.split("\n").length).toBeLessThanOrEqual(3);
    expect(Array.from(page).length).toBeLessThanOrEqual(130);
  }
  // 广播发言模板把说话者放在标题区，字幕分页仅承载原话，不能重复塞入“某号发言”前缀。
  expect(shot.captionPages.join("")).toBe(replay.events[3].payload.text as string);
  const start = buildVideoFrame(zh, shot.from);
  const end = buildVideoFrame(zh, shot.from + shot.durationFrames - 1);
  expect(start.captionPageIndex).toBe(0);
  expect(end.captionPageIndex).toBe(shot.captionPages.length - 1);
  const markup = renderToStaticMarkup(<VideoFrame plan={zh} frame={shot.from} />);
  expect(markup).toContain("opacity:1");
  expect(markup).toContain('data-caption-page="0"');
  expect(markup).toContain('data-event-seq="4"');
  expect(markup).not.toContain(replay.events[3].payload.text as string);
});

test("six and twelve seats stay inside the scene and outside the caption safe area", () => {
  for (const count of [6, 12])
    for (const [width, height] of [
      [1280, 720],
      [720, 1280],
      [1080, 1080],
    ]) {
      const layout = createVideoLayout(
        Array.from({ length: count }, (_, index) => index + 1),
        width,
        height,
      );
      for (const seat of layout.seats) {
        expect(seat.x - seat.width / 2).toBeGreaterThan(0);
        expect(seat.x + seat.width / 2).toBeLessThan(width);
        expect(seat.y - seat.height / 2).toBeGreaterThan(0);
        expect(seat.y + seat.height / 2).toBeLessThan(layout.caption.y);
      }
      expect(layout.caption.y + layout.caption.height).toBeLessThan(height);
    }
});

test("camera has deterministic full, interpolated player, group and full-return shots", () => {
  const replay = fixture(12);
  const plan = compileVideoPlan(
    replay,
    script(replay, {
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          durationFrames: 100,
          camera: [
            { frame: 0, target: "table", easing: "linear" },
            { frame: 20, target: { playerIds: [12] } },
            { frame: 50, target: { playerIds: [2, 12] } },
            { frame: 90, target: "table" },
          ],
        },
      ],
    }),
  );
  const from = getVideoEventFrame(plan, 4)!;
  expect(buildVideoFrame(plan, from).transform).toBe("translate(0px, 0px) scale(1)");
  const focus = buildVideoFrame(plan, from + 20);
  expect(focus.camera.scale).toBe(2.5);
  expect(focus.camera.x).toBe(focus.layout.seats[11].x);
  const middle = buildVideoFrame(plan, from + 10);
  expect(middle.camera.scale).toBe(1.75);
  const group = buildVideoFrame(plan, from + 50);
  expect(group.camera.x).toBeCloseTo(plan.width / 2);
  expect(buildVideoFrame(plan, from + 90).transform).toBe("translate(0px, 0px) scale(1)");
  const explicit = compileVideoPlan(
    replay,
    script(replay, {
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          camera: [{ frame: 0, target: { playerIds: [12] }, zoom: 1.8 }],
        },
      ],
    }),
  );
  expect(buildVideoFrame(explicit, getVideoEventFrame(explicit, 4)!).camera.scale).toBe(1.8);
});

test("preset and custom layers respect exclusive end boundaries and stable seed", () => {
  const replay = fixture();
  const plan = compileVideoPlan(
    replay,
    script(replay, {
      seed: 42,
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          layers: [
            { id: "callout", kind: "text", text: "关键判断", from: 5, durationFrames: 20 },
            {
              id: "arrow",
              kind: "arrow",
              fromTarget: { playerId: 1 },
              toTarget: { playerId: 2 },
              from: 5,
              durationFrames: 20,
            },
            { id: "focus", kind: "spotlight", playerIds: [2], from: 5, durationFrames: 20 },
            { id: "flash", kind: "flash", durationFrames: 5 },
            { id: "shake", kind: "shake", from: 5, durationFrames: 20 },
            {
              id: "custom",
              kind: "custom",
              component: "Example",
              from: 5,
              durationFrames: 20,
              props: { text: "自定义注解" },
            },
          ],
        },
      ],
    }),
  );
  const from = getVideoEventFrame(plan, 4)!;
  const Example = ({ frame, props, mediaBaseUrl }: CustomVideoLayerProps) => (
    <div data-custom-frame={frame} data-media-base={mediaBaseUrl}>
      {String(props.text)}
    </div>
  );
  const render = (frame: number) =>
    renderToStaticMarkup(
      <VideoFrame
        plan={plan}
        frame={frame}
        layerRegistry={{ Example }}
        mediaBaseUrl="https://example.test/prepared/"
      />,
    );
  expect(buildVideoFrame(plan, from + 4).activeLayers.map((item) => item.id)).toEqual(["flash"]);
  const markup = render(from + 5);
  expect(markup).toContain("关键判断");
  expect(markup).toContain('data-layer-space="world"');
  expect(markup).toContain('data-layer-space="screen"');
  expect(markup).toContain('data-custom-frame="0"');
  expect(markup).toContain('data-media-base="https://example.test/prepared/"');
  expect(markup).toContain("自定义注解");
  expect(render(from + 5)).toBe(markup);
  expect(buildVideoFrame(plan, from + 25).activeLayers).toEqual([]);
  expect(render(from + 25)).not.toContain("关键判断");
  expect(() => renderToStaticMarkup(<VideoFrame plan={plan} frame={from + 5} />)).toThrow(
    "video_custom_component_missing:Example",
  );
});

test("screen-space player anchors follow the camera while text coordinates stay fixed", () => {
  const replay = fixture();
  const plan = compileVideoPlan(
    replay,
    script(replay, {
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          camera: [{ frame: 0, target: { playerIds: [2] } }],
          layers: [
            {
              id: "screen-arrow",
              kind: "arrow",
              space: "screen",
              fromTarget: { x: 20, y: 30 },
              toTarget: { playerId: 2 },
            },
            { id: "screen-focus", kind: "spotlight", space: "screen", playerIds: [2] },
            { id: "fixed", kind: "text", x: 55, y: 66, text: "固定屏幕文字" },
          ],
        },
      ],
    }),
  );
  const from = getVideoEventFrame(plan, 4)!;
  const view = buildVideoFrame(plan, from);
  const point = videoWorldToScreen(view.layout.seats[1], view);
  expect(point.x).toBeCloseTo(plan.width / 2);
  expect(point.y).toBeCloseTo(plan.height * 0.385);
  const markup = renderToStaticMarkup(<VideoFrame plan={plan} frame={from} />);
  expect(markup).toContain(`M 20 30 L ${point.x} ${point.y}`);
  expect(markup).toContain(`cx="${point.x}" cy="${point.y}"`);
  expect(markup).toContain("left:55px;top:66px");
});

test("prepared speech media extends auto shots and produces explicit voice and music tracks", () => {
  const replay = fixture();
  const plan = compileVideoPlan(
    replay,
    script(replay, {
      media: [
        { id: "voice", kind: "audio", src: "audio/line.wav", durationFrames: 150 },
        { id: "music", kind: "audio", src: "audio/music.wav", durationFrames: 5000 },
      ],
      audio: [
        {
          id: "music",
          assetId: "music",
          from: 0,
          track: "music",
          volume: 0.25,
          fadeInFrames: 10,
          fadeOutFrames: 20,
        },
      ],
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          speech: [{ speaker: "god", text: "这是一段预先录好的讲解。", from: 5, assetId: "voice" }],
        },
      ],
    }),
  );
  const shot = plan.shots.find((item) => item.eventSeq === 4)!;
  expect(shot.durationFrames).toBe(155);
  expect(plan.audio[0].durationFrames).toBe(plan.durationFrames);
  expect(plan.audio[1]).toMatchObject({
    assetId: "voice",
    from: shot.from + 5,
    durationFrames: 150,
    track: "voice",
    speaker: "god",
    offsetFrames: 0,
  });
  expect(audioCueVolume(plan.audio[0], 0)).toBe(0);
  expect(audioCueVolume(plan.audio[0], 10)).toBe(0.25);
  expect(audioCueVolume(plan.audio[0], plan.durationFrames - 1)).toBe(0);
  expect(resolveVideoMediaSource("audio/line.wav", "https://example.test/videos/test/")).toBe(
    "https://example.test/videos/test/audio/line.wav",
  );
  expect(resolveVideoMediaSource("audio/line.wav", "./public/")).toBe("./public/audio/line.wav");
  expect(resolveVideoMediaSource("/audio/line.wav", "https://example.test/videos/test/")).toBe(
    "/audio/line.wav",
  );
});

test("invalid timing, missing targets and non-JSON layer props fail before rendering", () => {
  const replay = fixture();
  const invalid = (values: Omit<VideoScript, "source">) => () =>
    compileVideoPlan(replay, script(replay, values));
  expect(
    invalid({ edits: [{ anchor: { seq: 4, type: "day_speech" }, durationFrames: 0 }] }),
  ).toThrow("video_shot_duration_invalid");
  expect(
    invalid({
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          camera: [{ frame: 0, target: { playerIds: [99] } }],
        },
      ],
    }),
  ).toThrow("video_player_missing:99");
  expect(
    invalid({
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          camera: [
            { frame: 0, target: "table" },
            { frame: 90, target: "table" },
          ],
        },
      ],
    }),
  ).toThrow("video_camera_frame_order_invalid");
  expect(
    invalid({
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          layers: [{ id: "x", kind: "flash", from: 80, durationFrames: 20 }],
        },
      ],
    }),
  ).toThrow("video_layer_out_of_shot");
  expect(
    invalid({
      audio: [{ id: "x", assetId: "missing", from: 0, track: "voice", durationFrames: 30 }],
    }),
  ).toThrow("video_audio_asset_missing");
  expect(
    invalid({
      edits: [
        { anchor: { seq: 4, type: "day_speech" }, speech: [{ speaker: "player:99", text: "bad" }] },
      ],
    }),
  ).toThrow("video_speaker_invalid");
  expect(
    invalid({
      edits: [
        {
          anchor: { seq: 4, type: "day_speech" },
          layers: [
            {
              id: "x",
              kind: "custom",
              component: "x",
              props: { bad: (() => 1) as unknown as string },
            },
          ],
        },
      ],
    }),
  ).toThrow("video_custom_props_not_json");
  expect(() => buildVideoFrame(compileVideoPlan(replay), -1)).toThrow("video_frame_invalid");
});

test("empty canonical archive still yields one readable frame and zero gameplay assumptions", () => {
  const replay = { ...fixture(), events: [] };
  const plan = compileVideoPlan(replay);
  expect(plan.shots).toHaveLength(1);
  expect(plan.shots[0].eventSeq).toBeNull();
  expect(plan.shots[0].scene.cues.impact).toBe(0);
  expect(buildVideoFrame(plan, 0).caption).toContain("暂无事件");
  expect(paginateVideoCaption("a\nb\nc\nd", 58, 3)).toEqual(["a\nb\nc\n", "d"]);
});
