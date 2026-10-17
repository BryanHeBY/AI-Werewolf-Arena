/**
 * 负责将默认复盘与单局差异脚本编译为纯数据时间线。输入为原归档、脚本和显示选项，输出镜头、事实视图及媒体轨道。
 * 锚点校验和时间展开在渲染前完成；跳剪仅删镜头，事实视图始终复用完整原事件前缀投影，不执行对局规则。
 */
import {
  readReplayArchive,
  type ReplayDocument,
  type RecordingEnvelope,
  type ReplayFact,
} from "@ai-werewolf-arena/replay-contract";
import { supportsGamePresentation } from "@ai-werewolf-arena/game-presentation";
import { buildPresentationReplay } from "../replay/replay-presentation";
import { presentationPlayers, resolvePlayerPresentations } from "../presentation";
import { resolveTheme } from "../themes";
import {
  DEFAULT_REPLAY_TIME_ZONE,
  validateReplayDisplay,
  type ReplayDisplayOptions,
} from "../replay/replay-display";
import { createVideoRecordReader } from "./plan/records";
import { createVideoSourceIndex, selectVideoShotSource } from "./plan/source-index";
import { fail, integer, nonempty } from "./plan/validation";
import {
  compileCamera,
  compileLayers,
  compileMedia,
  compileAudio,
  compileSpeechTrack,
} from "./plan/tracks";
import { scheduleVideoShot } from "./plan/shot-timing";
import { compileVideoShotState } from "./plan/shot-state";
import { getVideoSourceIdentity } from "./source";
import { semanticEventGroups } from "./semantic-scenes";
import { prepareVideoShotContent } from "./plan/shot-content";
import type { AudioCue, JsonObject, ShotOptions, VideoPlan, VideoScript, VideoShot } from "./types";

export function defineVideoScript(script: VideoScript): VideoScript {
  return script;
}
export function compileVideoPlan(
  input: ReplayDocument | RecordingEnvelope<ReplayDocument>,
  script?: VideoScript,
  display?: ReplayDisplayOptions,
): VideoPlan {
  const archive = readReplayArchive(input);
  if (archive.identities && !supportsGamePresentation(archive.identities.presentation))
    fail("unsupported_presentation");
  const replay = archive.replay;
  const source = getVideoSourceIdentity(replay);
  if (
    script &&
    (script.source?.sessionId !== source.sessionId ||
      script.source?.fingerprint !== source.fingerprint)
  )
    fail("source_mismatch");
  const options = display ?? {
    locale: replay.meta.locale ?? "zh-CN",
    timeZone: DEFAULT_REPLAY_TIME_ZONE,
  };
  validateReplayDisplay(options);
  const fps = integer(script?.fps ?? 30, "fps", 1);
  // 旧单局脚本的坐标和world图层保持原布局；新项目默认采用广播名册与中央舞台。
  const layout = script?.layout ?? (script ? "legacy-ellipse-v1" : "broadcast-v1");
  if (!["legacy-ellipse-v1", "broadcast-v1"].includes(layout)) fail("layout_invalid");
  const width = integer(script?.width ?? (layout === "broadcast-v1" ? 1920 : 1280), "width", 320);
  const height = integer(script?.height ?? (layout === "broadcast-v1" ? 1080 : 720), "height", 240);
  const defaultDuration = integer(
    script?.defaultEventFrames ?? Math.round(fps * 3),
    "default_event_duration",
    1,
  );
  const pageDuration = integer(
    script?.captionPageFrames ?? Math.round(fps * 3),
    "caption_page_duration",
    1,
  );
  const seed = integer(script?.seed ?? 0, "seed");
  const media = compileMedia(script?.media ?? []);
  const playerIds = replay.players.map((item) => item.player_id);
  const readRecord = createVideoRecordReader(playerIds);
  const playersPresentation = resolvePlayerPresentations(replay.players, script?.presentation);
  const names = presentationPlayers(playersPresentation);
  const theme = resolveTheme(script?.theme);
  for (const player of playersPresentation) {
    const avatar = player.avatar;
    if (
      avatar.kind === "asset" &&
      !media.some((asset) => asset.id === avatar.assetId && asset.kind === "image")
    )
      fail("avatar_asset_missing");
  }
  const presentation = buildPresentationReplay(replay);
  const visible = new Set(presentation.events.map((event) => event.seq));
  // 让事实投影始终使用完整原序列；过滤只决定默认镜头，不删除状态历史。
  const renderInput = {
    ...options,
    systemPlayers: names,
    replay: { ...presentation, events: replay.events },
  };
  const sourceIndex = createVideoSourceIndex(replay, renderInput);
  const { facts, factsAfter, anchorIndex } = sourceIndex;
  const edits = new Map<number, NonNullable<VideoScript["edits"]>[number]>();
  for (const edit of script?.edits ?? []) {
    const index = anchorIndex(edit.anchor);
    if (edits.has(index)) fail("edit_anchor_duplicate");
    edits.set(index, edit);
  }
  const factEdits = new Map<number, NonNullable<VideoScript["factEdits"]>[number]>();
  for (const edit of script?.factEdits ?? []) {
    if (!Number.isSafeInteger(edit.anchor?.seq)) fail(`fact_anchor_mismatch:${edit.anchor?.seq}`);
    const fact = facts[edit.anchor?.seq - 1];
    if (!fact || fact.kind !== edit.anchor.kind) fail(`fact_anchor_mismatch:${edit.anchor?.seq}`);
    if (factEdits.has(fact.seq)) fail("fact_edit_anchor_duplicate");
    factEdits.set(fact.seq, edit);
  }
  const holds = new Map<number, NonNullable<VideoScript["holds"]>>();
  const holdIds = new Set<string>();
  for (const hold of script?.holds ?? []) {
    nonempty(hold.id, "hold_id");
    if (holdIds.has(hold.id)) fail("hold_id_duplicate");
    holdIds.add(hold.id);
    const index = anchorIndex(hold.after);
    if (hold.stateAt) anchorIndex(hold.stateAt);
    holds.set(index, [...(holds.get(index) ?? []), hold]);
  }
  const shots: VideoShot[] = [];
  const shotAudio: AudioCue[] = [];
  let cursor = 0;
  function append(
    index: number,
    id: string,
    kind: VideoShot["kind"],
    edit: ShotOptions = {},
    sourceIndexes = [index],
    committedFacts: ReplayFact[] = [],
  ) {
    const selected = selectVideoShotSource(sourceIndex, index, kind, sourceIndexes, committedFacts);
    const { committedFact, event, view, sourceEvents } = selected;
    const content = prepareVideoShotContent(selected, edit, {
      locale: options.locale,
      layout,
      playerIds,
      names,
      readRecord,
    });
    const timing = scheduleVideoShot(content, edit, {
      fps,
      layout,
      kind,
      eventType: event?.type,
      hasRecord: Boolean(event || committedFact),
      defaultDuration,
      pageDuration,
      explicitPageClock: script?.captionPageFrames !== undefined,
      largeText: theme.options.largeText === true,
      media,
      playerIds,
    });
    const { base } = content;
    const { scene, durationFrames, captionPages, captionPageOffsets, captionPageRanges, speech } =
      timing;
    if (base.visual) {
      scene.visual = structuredClone(base.visual);
      scene.visual.source = {
        eventSeqs: committedFact ? [] : sourceEvents.map((item) => item.seq),
        factSeqs: committedFacts.map((fact) => fact.seq),
      };
      if (committedFacts.length > 1 && scene.visual.life) {
        scene.visual.effectiveTargetIds = [...base.targetIds];
        scene.visual.effectiveTargetKnown = true;
        scene.visual.life = {
          ...scene.visual.life,
          playerIds: [...base.targetIds],
          committed: true,
          causes: Object.fromEntries(
            committedFacts
              .filter((fact) => fact.kind === "life_committed")
              .map((fact) => [fact.playerId, [...fact.causes]]),
          ),
        };
      }
    }
    const compiledVoice = compileSpeechTrack(speech, {
      id,
      shotFrom: cursor,
      durationFrames,
      media,
      playerIds,
    });
    shotAudio.push(...compiledVoice.audio);
    const stateCues = compileVideoShotState(sourceIndex, selected, timing, {
      layout,
      kind,
      baseKind: base.kind,
    });
    shots.push({
      id,
      kind,
      from: cursor,
      durationFrames,
      eventIndex: index,
      eventSeq: committedFact ? null : (event?.seq ?? null),
      view,
      captionPages,
      captionPageOffsets,
      ...(captionPageRanges ? { captionPageRanges } : {}),
      camera: compileCamera(edit.camera, durationFrames, playerIds),
      layers: compileLayers(edit.layers, durationFrames, playerIds),
      speech: compiledVoice.speech,
      sourceSeqs: committedFact ? [] : sourceEvents.map((item) => item.seq),
      sourceFacts: committedFacts.map((fact) => fact.seq),
      scene,
      stateCues,
    });
    cursor += durationFrames;
    integer(cursor, "timeline_duration", 1);
  }
  // 内部锚点一旦有导演修改、停留或事实提交，就切开自动聚合；原脚本无需重写整局。
  const barriers = new Set([
    ...edits.keys(),
    ...holds.keys(),
    ...facts.map((fact) => fact.afterSeq - 1),
  ]);
  const { groups, consumed } =
    layout === "broadcast-v1"
      ? semanticEventGroups(
          replay.events,
          playerIds,
          barriers,
          new Set([...edits.keys(), ...holds.keys()]),
          readRecord,
        )
      : {
          groups: new Map<number, { indexes: number[]; primary: number }>(),
          consumed: new Set<number>(),
        };
  function appendFacts(afterSeq: number) {
    const pending = factsAfter.get(afterSeq) ?? [];
    for (let index = 0; index < pending.length; index++) {
      const fact = pending[index]!;
      const batch = [fact];
      // 只有同一前缀且owner明确标为同wave的死亡同时揭晓；afterSeq相同本身不是同波证据。
      // 旧档缺waveId或跨原事件前缀时保守逐条陈述提交，不宣称各条属于不同真实死亡波。
      while (
        layout === "broadcast-v1" &&
        fact.kind === "life_committed" &&
        fact.waveId !== undefined &&
        pending[index + 1]?.kind === "life_committed" &&
        (pending[index + 1] as Extract<ReplayFact, { kind: "life_committed" }>).waveId ===
          fact.waveId &&
        pending[index + 1]?.day === fact.day &&
        !factEdits.has(fact.seq) &&
        !factEdits.has(pending[index + 1]!.seq)
      )
        batch.push(pending[++index]!);
      const edit = factEdits.get(fact.seq);
      if (!edit?.skip) append(afterSeq - 1, `fact:${fact.seq}`, "event", edit, [], batch);
    }
  }
  appendFacts(0);
  for (let index = 0; index < replay.events.length; index++) {
    const event = replay.events[index];
    const group = groups.get(index);
    const primaryIndex = group?.primary ?? index;
    const primary = replay.events[primaryIndex]!;
    const edit = edits.get(primaryIndex);
    const incompleteVote =
      layout === "broadcast-v1" && ["vote_cast", "sheriff_vote_cast"].includes(primary.type);
    if (!consumed.has(index) && !edit?.skip && (visible.has(primary.seq) || edit || incompleteVote))
      append(primaryIndex, `event:${primary.seq}`, "event", edit, group?.indexes ?? [index]);
    appendFacts(event.seq);
    for (const hold of holds.get(index) ?? [])
      append(hold.stateAt ? anchorIndex(hold.stateAt) : index, `hold:${hold.id}`, "hold", hold);
  }
  if (!replay.events.length && !facts.length) append(-1, "empty", "event");
  if (!shots.length) fail("timeline_empty");
  const audio = compileAudio([...(script?.audio ?? []), ...shotAudio], media, cursor, playerIds);
  const eventFrames: VideoPlan["eventFrames"] = {};
  for (const shot of shots)
    for (const seq of shot.sourceSeqs) {
      const reveal = shot.stateCues.find((cue) => cue.throughSeq >= seq)!.frame;
      eventFrames[String(seq)] ??= [];
      eventFrames[String(seq)]!.push({
        shotId: shot.id,
        frame: shot.from + (shot.kind === "hold" ? 0 : reveal),
        mode: shot.kind === "hold" ? "revisit" : seq === shot.eventSeq ? "primary" : "absorbed",
      });
    }
  return {
    version: 1,
    source,
    display: { ...options },
    fps,
    width,
    height,
    seed,
    durationFrames: cursor,
    shots,
    media,
    audio,
    layout,
    theme,
    playersPresentation,
    eventFrames,
  };
}

/** 自定义参数辅助类型，供视频项目导出纯 JSON 数据时使用。 */
export type VideoCustomProps = JsonObject;
