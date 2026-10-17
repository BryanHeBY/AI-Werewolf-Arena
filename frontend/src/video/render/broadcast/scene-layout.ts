/**
 * 负责按既有场景与typed意图选择广播版式。输入为单个已编译scene，输出渲染分支名称。
 * 不改变scene来源、结果、目标或事实时钟，未知意图沿用原notice回退。
 */
import type { VideoScene } from "../../types";
import type { BroadcastSceneLayout } from "./contracts";
/** 只选择版式，不更改scene.kind、来源、结果或事实时钟。旧无意图计划安全退到原scene语义。 */
export function broadcastSceneLayout(scene: VideoScene): BroadcastSceneLayout {
  if (scene.kind === "speech") return "speech";
  if (scene.kind === "ballot") return "ballot";
  if (scene.visual?.family === "game_result") return "end";
  if (scene.kind === "phase" || scene.visual?.family === "phase_transition") return "phase";
  if (scene.kind === "settlement" || scene.visual?.family === "life_settlement")
    return "settlement";
  if (scene.stock) return "action";
  if (
    scene.visual?.fallbackReason ||
    scene.visual?.process === "notice" ||
    scene.visual?.process === "unknown" ||
    scene.visual?.process === "skipped"
  )
    return "notice";
  return scene.kind === "action" || scene.visual ? "action" : "notice";
}
