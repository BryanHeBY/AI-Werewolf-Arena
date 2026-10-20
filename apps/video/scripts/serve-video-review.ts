/** 负责提供本机成片审片服务。输入为显式审片索引，输出带Range的视频、字幕和署名；不暴露仓库目录或凭据。 */
import { PROJECT_ROOT } from "@ai-werewolf-arena/project-paths";
import path from "node:path";
import { parseArgs } from "node:util";
import { serveLocalReview } from "./video/review-http";
import type { VideoReview } from "./video/review";

if (import.meta.main) {
  const { values } = parseArgs({
    options: { review: { type: "string" }, port: { type: "string" } },
  });
  if (!values.review) throw new Error("video_review_required");
  const file = path.resolve(values.review),
    directory = path.dirname(file);
  const data = (await Bun.file(file).json()) as VideoReview;
  const server = serveLocalReview({
    root: PROJECT_ROOT,
    port: Number(values.port ?? 5186),
    async resolve(pathname) {
      return (
        {
          "/": path.join(directory, "index.html"),
          "/script-review.html": path.join(directory, "script-review.html"),
          "/movie.mp4": data.video,
          "/subtitles.srt": data.subtitles ?? undefined,
          "/credits.txt": data.credits,
        } as Record<string, string | undefined>
      )[pathname];
    },
  });
  console.log(server.url.href);
}
