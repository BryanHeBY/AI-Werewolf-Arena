/** 跟读测试负责真实时间、重复文本及尾行提前露出；独立文字和行位置不依赖生产排版或整段镜头读速。 */
import { expect, test } from "bun:test";
import { speechReadingCues } from "../../../src/video/render/broadcast/speech-reading";
import {
  speechReadingOffset,
  speechReadingStops,
} from "../../../src/video/render/broadcast/reading-motion";

test("alignment keeps original UTF16 offsets and repeated phrases advance monotonically", () => {
  const result = speechReadingCues(
    "甲👩🏽‍💻，甲！１２号。",
    [
      {
        speaker: "player:1",
        text: "甲，甲，12号。",
        from: 30,
        alignment: {
          source: "provider",
          spans: [
            { text: "甲", startMs: 100, endMs: 200 },
            { text: "甲！", startMs: 800, endMs: 1000 },
            { text: "12号。", startMs: 1200, endMs: 1500 },
          ],
        },
      },
    ],
    30,
  );
  expect(result).toEqual([
    { start: 0, end: 1, frame: 33 },
    { start: 9, end: 10, frame: 54 },
    { start: 11, end: 14, frame: 66 },
  ]);
});

test("small provider omissions retain later positions while rewritten narration is not matched to the body", () => {
  const text = "甲".repeat(40) + "然后说4号，" + "乙".repeat(40);
  const cues = speechReadingCues(
    text,
    [
      {
        speaker: "player:1",
        text,
        alignment: {
          source: "provider",
          spans: [
            { text: "甲".repeat(40), startMs: 0, endMs: 10000 },
            { text: "乙".repeat(40), startMs: 11000, endMs: 20000 },
          ],
        },
      },
    ],
    30,
  );
  expect(cues?.[1]).toEqual({ start: 46, end: 86, frame: 330 });
  expect(
    speechReadingCues(
      "完整规则和额外说明。",
      [
        {
          speaker: "narrator",
          text: "规则。",
          subtitles: [{ text: "规则。", startMs: 0, endMs: 1000 }],
        },
      ],
      30,
    ),
  ).toBeUndefined();
});

test("last line is fully visible when its speech begins, independent of long pauses or trailing silence", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({ start: index * 10, top: index * 40 }));
  const cues = rows.map((row, index) => ({
    start: row.start,
    end: row.start + 10,
    frame: [30, 100, 200, 350, 400, 1200, 1250, 1300, 1320, 1400][index]!,
  }));
  const stops = speechReadingStops(rows, cues, 200, 200);
  expect(speechReadingOffset(stops, 30, 5)).toBe(0);
  expect(speechReadingOffset(stops, 395, 5)).toBe(40);
  expect(speechReadingOffset(stops, 398, 5)).toBe(64);
  expect(speechReadingOffset(stops, 400, 5)).toBe(80);
  expect(speechReadingOffset(stops, 1400, 5)).toBe(200);
  expect(rows.at(-1)!.top + 40 - speechReadingOffset(stops, 1400, 5)).toBeLessThanOrEqual(200);
  expect(speechReadingOffset(stops, 10000, 5)).toBe(200);
  expect(speechReadingOffset(stops, 398, 5)).toBe(64);
  expect(speechReadingStops(rows, cues, 400, 0)).toEqual([{ frame: 0, offset: 0 }]);
});
