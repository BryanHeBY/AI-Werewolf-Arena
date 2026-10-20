/**
 * 负责真实归档的正式渲染取样。输入为单份复盘快照与语言，输出不改标题、名册展示或原文的关键事件采样帧。
 * 不注入模型头像以掩盖缺省身份问题；前后帧来自同一已编译计划，来源保留原字节摘要和独立事件序号。
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { parseOfflineReplayJson } from "@ai-werewolf-arena/game-media/replay/offline-replay";
import { compileVideoPlan } from "@ai-werewolf-arena/game-media/video/compiler";
import type { ArtGalleryCase } from "@ai-werewolf-arena/game-media/testing/gallery";

export async function createRecordedGalleryCases(
  input: string,
  locale: Locale = "zh-CN",
): Promise<ArtGalleryCase[]> {
  const bytes = await readFile(input);
  const replay = parseOfflineReplayJson(bytes.toString("utf8"));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const plan = compileVideoPlan(replay, undefined, { locale, timeZone: "UTC" });
  const cases: ArtGalleryCase[] = [];
  const included = new Set<string>();
  const add = (id: string, index: number, localFrame: number) => {
    const shot = plan.shots[index];
    if (!shot || included.has(id)) return;
    included.add(id);
    cases.push({
      id,
      plan,
      frame: shot.from + Math.max(0, Math.min(shot.durationFrames - 1, localFrame)),
      sourceKind: "recorded",
      provenance: `${replay.sessionId}; sha256:${digest}; original archive; no presentation overrides`,
    });
  };
  const pivotal = new Set([
    "god_private_game_info",
    "phase_changed",
    "wolf_discussion",
    "wolf_discussion_ended",
    "seer_checked",
    "witch_potion_used",
    "witch_potion_skipped",
    "vote_summary",
    "sheriff_vote_summary",
    "voted_out",
    "night_resolved",
    "day_speech",
    "game_over",
  ]);
  const seen = new Set<string>();
  for (const [index, shot] of plan.shots.entries()) {
    const type = replay.events.find((event) => event.seq === shot.eventSeq)?.type;
    if (type && pivotal.has(type) && !seen.has(type)) {
      seen.add(type);
      add(`recorded-${type.replaceAll("_", "-")}`, index, Math.max(shot.scene.cues.settled, 60));
      if (["witch_potion_used", "seer_checked", "game_over"].includes(type))
        add(`recorded-${type.replaceAll("_", "-")}--before`, index, shot.scene.cues.impact - 1);
      if (type === "sheriff_vote_summary" && shot.scene.resolution?.ballot) {
        add(
          "recorded-sheriff-vote-summary--before-tally",
          index,
          shot.scene.resolution.revealFrame - 1,
        );
        add("recorded-sheriff-vote-summary--tally", index, shot.scene.resolution.revealFrame);
      }
    }
    if (type === "witch_potion_used")
      add(`recorded-witch-${shot.eventSeq}`, index, shot.scene.cues.settled);
    if (
      shot.sourceFacts.some(
        (seq) => replay.facts?.find((fact) => fact.seq === seq)?.kind === "life_committed",
      )
    )
      add("recorded-eliminated-roster", index, shot.scene.cues.settled);
  }
  const longest = plan.shots.reduce(
    (index, shot, next) =>
      shot.scene.kind === "speech" &&
      shot.scene.body.length >
        (plan.shots[index]?.scene.kind === "speech" ? plan.shots[index]!.scene.body.length : 0)
        ? next
        : index,
    0,
  );
  const shot = plan.shots[longest]!;
  for (const [name, local] of [
    ["start", 1],
    ["middle", Math.floor(shot.durationFrames / 2)],
    ["end", shot.durationFrames - 1],
  ] as const)
    add(`recorded-longest-speech--${name}`, longest, local);
  return cases;
}
