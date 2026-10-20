/**
 * 负责演示真实十二人回放的主题、固定名册、技能场景、合并票型和显式镜头微调。
 * 输入为已签入的后端教学回放；徽记是美术展示配置，不宣称该历史局实际使用了相应模型，不改写原事件或身份。
 */
import recording from "../../../tests/fixtures/twelve-player-dreamer/dreamer-twelve/zh-CN/god.replay.json";
import { defineVideoProject } from "../../../src/video-project";
import type { AvatarKey } from "../../../src/presentation";

const keep = new Set([9, 13, 14, 47, 49, ...Array.from({ length: 15 }, (_, index) => index + 61)]);
const symbols: AvatarKey[] = [
  "deepseek",
  "openai",
  "anthropic",
  "gemini",
  "qwen",
  "doubao",
  "kimi",
  "glm",
  "neutral",
  "openai",
  "anthropic",
  "deepseek",
];
export default defineVideoProject({
  input: "../../../tests/fixtures/twelve-player-dreamer/dreamer-twelve/zh-CN/god.replay.json",
  script: {
    source: { sessionId: "session_1791458555965_gtf44n", fingerprint: "fnv1a64:bb93170e8c2f3910" },
    layout: "broadcast-v1",
    theme: { id: "gothic-v1" },
    presentation: {
      showNames: false,
      showModels: false,
      players: Object.fromEntries(
        symbols.map((avatarKey, index) => [String(index + 1), { avatarKey }]),
      ),
    },
    edits: [
      ...recording.events
        .filter((event) => !keep.has(event.seq))
        .map((event) => ({ anchor: { seq: event.seq, type: event.type }, skip: true })),
      {
        anchor: { seq: 49, type: "day_speech" },
        durationFrames: 150,
        emphasis: [{ text: "Public speech" }],
        camera: [
          { frame: 0, target: { playerIds: [9] }, zoom: 1.15 },
          { frame: 100, target: "table" },
        ],
      },
    ],
  },
});
