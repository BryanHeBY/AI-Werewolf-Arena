/** 负责读取工具生成的纯数据冻结稿。输入为严格的生成格式，输出项目数据；作者代码仍交给模块加载，不执行或改写已迁移的旧import。 */
import type { VideoProjectDefinition } from "@ai-werewolf-arena/game-media/video-project";

export const VIDEO_PROJECT_SNAPSHOT_HEADER =
  "/** 负责保存已备语音生成的项目。输入为锁定台词和音频，输出连续时间线；重新编译生成新版本，不手改此文件。 */";

export function readVideoProjectSnapshot(source: string): VideoProjectDefinition | undefined {
  if (!source.startsWith(VIDEO_PROJECT_SNAPSHOT_HEADER)) return undefined;
  const match =
    /^\s*import\s+\{\s*defineVideoProject\s*\}\s+from\s+(?:"[^"\r\n]+"|'[^'\r\n]+');\s*export default defineVideoProject\((\{[\s\S]*\})\);\s*$/.exec(
      source.slice(VIDEO_PROJECT_SNAPSHOT_HEADER.length),
    );
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]!) as VideoProjectDefinition;
  } catch {
    throw new Error("video_project_snapshot_invalid");
  }
}
