/** 负责制作配置和本机产物路径。输入为主题作者目录、标题和来源，输出统一路径；不读取归档、不编译或联网。 */
import path from "node:path";
import { PROJECT_ROOT } from "@ai-werewolf-arena/project-paths";

const repository = PROJECT_ROOT;
export function defaultSpeechManifest(entry: string) {
  return path.join(
    repository,
    "output/videos",
    path.basename(path.dirname(entry)),
    path.basename(entry, path.extname(entry)),
    "speech.generated.ts",
  );
}

export function defineVideoProduction(options: {
  directory: string;
  sessionId: string;
  title: string;
  model: string;
  soundtrack?: string;
}) {
  const directory = path.resolve(options.directory),
    slug = path.basename(directory);
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) ||
    !/^session_[a-zA-Z0-9_]+$/.test(options.sessionId)
  )
    throw new Error("video_production_identity_invalid");
  return {
    ...options,
    directory,
    slug,
    input: path.join(repository, "record", options.sessionId, "replay.json"),
    visual: path.join(directory, "visual.project.ts"),
    script: path.join(directory, "speech.jsonl"),
    casting: path.join(directory, "casting.ts"),
    dialogue: path.join(directory, "dialogue.ts"),
    manifest: defaultSpeechManifest(path.join(directory, "dialogue.ts")),
    output: path.join(repository, "output/videos", slug, "production"),
    soundtrack: options.soundtrack ? path.resolve(directory, options.soundtrack) : undefined,
  };
}
export type VideoProduction = ReturnType<typeof defineVideoProduction>;
