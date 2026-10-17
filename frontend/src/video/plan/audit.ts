/**
 * 负责只读审计真实复盘的视频展示覆盖。输入为已校验归档，输出原序号、实际版式及未专门处理记录的定位。
 * 不输出原话、私有提示或载荷，不以事件路由登记冒充画面实现；未结束对局同样按捕获时的事实前缀编译。
 */
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../compiler";
import { classifyVideoScene, type SceneTreatment } from "../scene-classification";
import { createVideoRecordReader } from "./records";
import { replayDisplayRoster } from "../../replay/replay-display-roster";
import { getVideoSourceIdentity } from "../source";

export function auditVideoReplay(
  replay: ReplayDocument,
  themeId: "gothic-v1" | "minimal-v1" = "gothic-v1",
) {
  const roster = replayDisplayRoster(replay);
  if (roster.source === "missing" && (replay.events.length || replay.facts?.length))
    throw new Error("video_audit_missing_roster");
  const readRecord = createVideoRecordReader(roster.players.map((player) => player.player_id));
  const invalidEvents = replay.events.flatMap((event) => {
    const { readerStatus } = readRecord(event);
    return readerStatus === "known" ? [] : [{ seq: event.seq, type: event.type, readerStatus }];
  });
  const plan = compileVideoPlan(replay, {
    source: getVideoSourceIdentity(replay),
    layout: "broadcast-v1",
    theme: { id: themeId },
  });
  const counts: Record<SceneTreatment, number> = {
    dedicated: 0,
    compact_notice: 0,
    generic_record: 0,
    unhandled: 0,
  };
  const scenes = plan.shots.map((shot) => {
    const classification = classifyVideoScene(shot.scene, themeId);
    counts[classification.treatment]++;
    const sourceEvents = shot.sourceSeqs.map((seq) => {
      const event = replay.events.find((row) => row.seq === seq);
      const safe = event ? readRecord(event).record?.event : undefined;
      return {
        seq,
        type: event?.type ?? "missing",
        ...(safe?.type === "action_requested" && typeof safe.payload.stage === "string"
          ? { stage: safe.payload.stage }
          : {}),
      };
    });
    return {
      shotId: shot.id,
      frame: shot.from,
      durationFrames: shot.durationFrames,
      day: shot.view.snapshot.day,
      phase: shot.view.snapshot.phase,
      sourceEvents,
      sourceFacts: shot.sourceFacts,
      family: shot.scene.visual?.family ?? null,
      template: shot.scene.visual?.template ?? null,
      process: shot.scene.visual?.process ?? null,
      blocks: shot.scene.content?.blocks.map((block) => block.kind) ?? [],
      ...classification,
    };
  });
  const scheduled = new Set(plan.shots.flatMap((shot) => shot.sourceSeqs));
  return {
    source: plan.source,
    rosterSource: roster.source,
    completed: replay.events.some(
      (event) => event.type === "game_over" && readRecord(event).readerStatus === "known",
    ),
    themeId,
    events: replay.events.length,
    facts: replay.facts?.length ?? 0,
    shotCount: scenes.length,
    counts,
    invalidEvents,
    unscheduledEventTypes: [
      ...new Set(
        replay.events.filter((event) => !scheduled.has(event.seq)).map((event) => event.type),
      ),
    ].sort(),
    scenes,
  };
}
