/**
 * 负责广播画面与离线审计共用的场景分派。输入为已编译场景，输出版式和可核对的展示处理等级。
 * 只判断展示能力，不补动作、意图、权限或结果；正常紧凑简报与尚无专门呈现的记录分开统计。
 */
import type { VideoScene } from "./types";
import { sceneArt } from "../themes/gothic/scene-art";
import { minimalSkillGlyph } from "../themes/minimal/skill-glyphs";

export type BroadcastSceneLayout =
  "speech" | "ballot" | "action" | "end" | "phase" | "settlement" | "notice";
export type SceneTreatment = "dedicated" | "compact_notice" | "generic_record" | "unhandled";

/** 编排和审计必须走同一分支；存在路由本身并不代表画面已有专门处理。 */
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
    ["notice", "unknown", "skipped"].includes(scene.visual?.process ?? "")
  )
    return "notice";
  return scene.kind === "action" || scene.visual ? "action" : "notice";
}

export function classifyVideoScene(scene: VideoScene, themeId: string) {
  const layout = broadcastSceneLayout(scene);
  const visual = scene.visual;
  const art =
    themeId === "gothic-v1" ? sceneArt(scene) : (minimalSkillGlyph(visual)?.id ?? "record");
  let treatment: SceneTreatment = "dedicated";
  let reason = "scene_component";
  if (visual?.fallbackReason === "unknown_or_invalid_event") {
    treatment = "unhandled";
    reason = visual.fallbackReason;
  } else if (layout === "notice") {
    if (scene.content?.blocks.some((block) => block.kind === "announcement")) {
      treatment = "dedicated";
      reason = "structured_announcement";
    } else {
      // compact_notice 是展示路由的显式决策；普通 fact_card/notice 不因此被误报为专门呈现。
      if (visual?.template.endsWith("/compact_notice") || visual?.process === "skipped") {
        treatment = "compact_notice";
        reason = "explicit_compact_notice";
      } else {
        treatment = "generic_record";
        reason = visual?.fallbackReason ?? "no_dedicated_notice_layout";
      }
    }
  } else if (layout === "action" && art === "record") {
    treatment = "generic_record";
    reason = "action_without_theme_art";
  }
  return { layout, treatment, reason, art: layout === "action" ? art : null };
}
