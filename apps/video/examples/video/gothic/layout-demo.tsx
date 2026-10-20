/**
 * 负责明确标注编导稿的长中文排版演示。输入为教学归档与作者排版要求，输出长文本演示项目。复用教学归档与真实事件时间线，只显式替换49号事件的画面正文，不冒充玩家原话。
 * 本地归档没有足够长的真实中文发言；该示例只验证字级重点、分页和自适应名册，不改变身份、票型或生命事实，不接入 TTS。
 */
import { defineVideoProject } from "@ai-werewolf-arena/game-media/video-project";
import base from "./project";

export default defineVideoProject({
  ...base,
  script: {
    ...base.script!,
    edits: base.script!.edits!.map((edit) =>
      edit.anchor.seq !== 49
        ? edit
        : {
            ...edit,
            durationFrames: 240,
            camera: [{ frame: 0, target: "table" as const }],
            emphasis: [{ text: "非玩家原话" }, { text: "自动收窄" }],
            scene: {
              kind: "speech" as const,
              title: "编导稿 · 非玩家原话",
              speaker: "god" as const,
              body: "这是一段编导排版示例，非玩家原话，用于检查较长中文在实际视频中的字号、行距与分页。\n座次、角色和生死状态仍然读取原始归档；这段说明不会据此推断目标，也不会改写对局结果。\n隐藏昵称和模型时，两侧名册会自动收窄；中央保留清楚的阅读层级，并为后续旁白与特效留下独立空间。",
            },
          },
    ),
  },
});
