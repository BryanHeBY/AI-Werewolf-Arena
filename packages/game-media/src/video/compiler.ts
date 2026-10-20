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
import { readVideoSpeechReadingOptions } from "./captions";
import { compileVideoSubtitles } from "./subtitles";
import { sceneContent } from "../presentation/scene-content";
import { replayDisplayRoster } from "../replay/replay-display-roster";
import { buildPresentationReplay } from "../replay/replay-presentation";
import { presentationPlayers, resolvePlayerPresentations } from "../presentation";
import { resolveTheme } from "../themes";
import {
  DEFAULT_REPLAY_TIME_ZONE,
  validateReplayDisplay,
  type ReplayDisplayOptions,
} from "../replay/replay-display";
import { committedLifeReport, isCoveredLifeReport } from "./plan/life-report";
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
  // 指纹始终来自原档；进行中录制的开局名册仅作为只读展示输入，不回写原档。
  const source = getVideoSourceIdentity(archive.replay);
  const roster = replayDisplayRoster(archive.replay);
  const replay =
    roster.source === "recorded_initialization"
      ? { ...archive.replay, players: roster.players }
      : archive.replay;
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
  if (script?.pacing !== undefined && !["narration", "reading"].includes(script.pacing))
    fail("pacing_invalid");
  const maximumDuration =
    script?.maxDurationFrames === undefined
      ? undefined
      : integer(script.maxDurationFrames, "maximum_duration", 1);
  const program = script?.program;
  if (program !== undefined) {
    if (!program || typeof program !== "object") fail("program_invalid");
    nonempty(program.title, "program_title");
    if (program.subtitle !== undefined) nonempty(program.subtitle, "program_subtitle");
  }
  const speechReading = readVideoSpeechReadingOptions(script?.speechReading);
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
    if (
      edit.lifeFacts !== undefined &&
      (!Array.isArray(edit.lifeFacts) ||
        edit.lifeFacts.some(
          (anchor) =>
            !anchor ||
            !Number.isSafeInteger(anchor.seq) ||
            anchor.seq < 1 ||
            anchor.kind !== "life_committed",
        ))
    )
      fail("life_fact_anchor_invalid");
    readVideoSpeechReadingOptions(edit.speechReading);
    const index = anchorIndex(edit.anchor);
    if (edits.has(index)) fail("edit_anchor_duplicate");
    edits.set(index, edit);
  }
  const factEdits = new Map<number, NonNullable<VideoScript["factEdits"]>[number]>();
  for (const edit of script?.factEdits ?? []) {
    if ("lifeFacts" in edit) fail("fact_edit_life_facts_unavailable");
    readVideoSpeechReadingOptions(edit.speechReading);
    if (!Number.isSafeInteger(edit.anchor?.seq)) fail(`fact_anchor_mismatch:${edit.anchor?.seq}`);
    const fact = facts[edit.anchor?.seq - 1];
    if (!fact || fact.kind !== edit.anchor.kind) fail(`fact_anchor_mismatch:${edit.anchor?.seq}`);
    if (factEdits.has(fact.seq)) fail("fact_edit_anchor_duplicate");
    factEdits.set(fact.seq, edit);
  }
  const holds = new Map<number, NonNullable<VideoScript["holds"]>>();
  const holdIds = new Set<string>();
  for (const hold of script?.holds ?? []) {
    if ("lifeFacts" in hold) fail("hold_life_facts_unavailable");
    readVideoSpeechReadingOptions(hold.speechReading);
    nonempty(hold.id, "hold_id");
    if (holdIds.has(hold.id)) fail("hold_id_duplicate");
    holdIds.add(hold.id);
    const index = anchorIndex(hold.after);
    if (hold.stateAt) anchorIndex(hold.stateAt);
    holds.set(index, [...(holds.get(index) ?? []), hold]);
  }
  const shots: VideoShot[] = [];
  const shotEdits = new Map<string, ShotOptions>();
  const usedShotEdits = new Set<string>();
  for (const edit of script?.shotEdits ?? []) {
    nonempty(edit.id, "shot_edit_id");
    if (shotEdits.has(edit.id)) fail("shot_edit_duplicate");
    if ("lifeFacts" in edit) fail("shot_edit_life_facts_unavailable");
    shotEdits.set(edit.id, edit);
  }
  const shotAudio: AudioCue[] = [];
  let cursor = 0;
  const absorbedFactSeqs = new Set<number>();
  const silentLifeReports: number[] = [];
  // 导演扩展可在append阶段才应用；这里只读取稳定镜头id，兼容保留作者明确指定的中间镜头。
  const authoredShotIds = new Set(
    (
      (script as (VideoScript & { shotEdits?: readonly { id: string }[] }) | undefined)
        ?.shotEdits ?? []
    ).map((edit) => edit.id),
  );
  function append(
    index: number,
    id: string,
    kind: VideoShot["kind"],
    edit: ShotOptions = {},
    sourceIndexes = [index],
    committedFacts: ReplayFact[] = [],
    reportFacts: Extract<ReplayFact, { kind: "life_committed" }>[] = [],
  ) {
    const shotEdit = shotEdits.get(id);
    if (shotEdit) {
      usedShotEdits.add(id);
      edit = { ...edit, ...shotEdit, scene: { ...edit.scene, ...shotEdit.scene } };
    }
    const selected = selectVideoShotSource(sourceIndex, index, kind, sourceIndexes, committedFacts);
    if (reportFacts.length) {
      const after = sourceIndex.cursorAt(selected.endIndex, reportFacts.at(-1)!.seq);
      selected.after = after;
      selected.view = sourceIndex.viewAt(after);
    }
    const { committedFact, event, view, sourceEvents } = selected;
    const content = prepareVideoShotContent(selected, edit, {
      locale: options.locale,
      layout,
      playerIds,
      names,
      readRecord,
      pendingLifeReport:
        layout === "broadcast-v1" &&
        replay.factCoverage?.committedDeaths === 1 &&
        !committedFact &&
        reportFacts.length === 0 &&
        Array.isArray(event?.payload.deaths) &&
        event.payload.deaths.some(
          (id) => view.players.find((player) => player.playerId === id)?.alive !== false,
        ),
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
      speechReading,
      narrationPacing: script === undefined || script.pacing === "narration",
    });
    const { base } = content;
    const { scene, durationFrames, captionPages, captionPageOffsets, captionPageRanges, speech } =
      timing;
    if (base.visual) {
      scene.visual = structuredClone(base.visual);
      scene.visual.source = {
        eventSeqs: committedFact ? [] : sourceEvents.map((item) => item.seq),
        factSeqs: [...committedFacts, ...reportFacts].map((fact) => fact.seq),
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
    if (reportFacts.length && scene.visual) {
      const playerIds = reportFacts.map((fact) => fact.playerId);
      scene.visual.life = {
        playerIds,
        committed: true,
        causes: Object.fromEntries(reportFacts.map((fact) => [fact.playerId, [...fact.causes]])),
        ...(reportFacts[0]!.waveId === undefined ? {} : { waveId: reportFacts[0]!.waveId }),
      };
      scene.visual.effectiveTargetIds = [...playerIds];
      scene.visual.effectiveTargetKnown = true;
    }
    if (committedFact?.kind === "potion_stock")
      scene.inventory = {
        before: sourceIndex.inventoryAt(
          committedFact.seq - 1,
          committedFact.actorId,
          committedFact.abilityId,
        ),
        after: sourceIndex.inventoryAt(
          committedFact.seq,
          committedFact.actorId,
          committedFact.abilityId,
        ),
        revealFrame: scene.cues.impact,
      };
    const safeEvent = readRecord(event).record?.event;
    if (
      !committedFact &&
      safeEvent &&
      ["witch_potion_used", "witch_potion_skipped"].includes(safeEvent.type) &&
      typeof safeEvent.payload.actorId === "number"
    ) {
      const actorId = safeEvent.payload.actorId;
      const abilityId =
        typeof safeEvent.payload.abilityId === "string" ? safeEvent.payload.abilityId : undefined;
      // 扣库事实可能紧挨在动作事件之前。事前数值排除该前缀全部新捕获，避免将扣后值冒充扣前；无证据宁可unknown。
      const before = sourceIndex.inventoryAt(
        index === 0 ? 0 : sourceIndex.factSeqAt(index - 1),
        actorId,
        abilityId,
      );
      const after = sourceIndex.inventoryAt(selected.after.throughFactSeq, actorId, abilityId);
      scene.inventory = { before, after, revealFrame: scene.cues.impact };
    }
    scene.content = sceneContent(scene, committedFact ? undefined : readRecord(event).record);
    const compiledVoice = compileSpeechTrack(speech, {
      id,
      fps,
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
      ...(timing.reading ? { reading: timing.reading } : {}),
      captionPageOffsets,
      ...(captionPageRanges ? { captionPageRanges } : {}),
      camera: compileCamera(edit.camera, durationFrames, playerIds),
      layers: compileLayers(edit.layers, durationFrames, playerIds),
      speech: compiledVoice.speech,
      sourceSeqs: committedFact ? [] : sourceEvents.map((item) => item.seq),
      sourceFacts: [...committedFacts, ...reportFacts].map((fact) => fact.seq),
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
      if (absorbedFactSeqs.has(fact.seq)) continue;
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
      // 库存捕获属于状态而非一次行动。默认广播不额外念库存，显式导演fact锚点仍可独立成段。
      if (layout === "broadcast-v1" && fact.kind === "potion_stock" && !edit) {
        const previous = shots.at(-1);
        const lastState = previous?.stateCues.at(-1);
        // partial可能停在库存捕获后、没有下一动作：在同一前缀的末帧消费静默状态，不能吞掉事实游标。
        // 只连续推进一条stock；不跨过被导演跳过的其他fact，也不提前提交生命或改变镜头长度。
        if (
          previous &&
          lastState?.throughSeq === afterSeq &&
          lastState.throughFactSeq === fact.seq - 1
        ) {
          const context = sourceIndex.cursorAt(afterSeq - 1, fact.seq);
          previous.stateCues.push({
            frame: previous.durationFrames - 1,
            throughSeq: afterSeq,
            throughFactSeq: fact.seq,
            view: sourceIndex.viewAt(context),
          });
        }
        continue;
      }
      if (!edit?.skip) append(afterSeq - 1, `fact:${fact.seq}`, "event", edit, [], batch);
    }
  }
  const introIds = new Set<string>();
  for (const intro of script?.intro ?? []) {
    if ("lifeFacts" in intro) fail("intro_life_facts_unavailable");
    nonempty(intro.id, "intro_id");
    if (introIds.has(intro.id)) fail("intro_id_duplicate");
    introIds.add(intro.id);
    append(-1, `intro:${intro.id}`, "hold", intro, []);
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
    if (
      !consumed.has(index) &&
      !edit?.skip &&
      (visible.has(primary.seq) || edit || incompleteVote)
    ) {
      const pending = factsAfter.get(primary.seq) ?? [];
      const reportFacts = edit?.lifeFacts
        ? edit.lifeFacts.map((anchor) => {
            const fact = facts[anchor.seq - 1];
            if (
              !fact ||
              anchor.kind !== "life_committed" ||
              fact.kind !== "life_committed" ||
              fact.afterSeq !== primary.seq ||
              factEdits.has(fact.seq)
            )
              fail("life_fact_anchor_invalid");
            return fact as Extract<ReplayFact, { kind: "life_committed" }>;
          })
        : committedLifeReport(
            primary,
            pending,
            layout === "broadcast-v1" &&
              replay.factCoverage?.committedDeaths === 1 &&
              !edit &&
              !holds.has(primaryIndex) &&
              pending
                .slice(0, Array.isArray(primary.payload.deaths) ? primary.payload.deaths.length : 0)
                .every((fact) => !factEdits.has(fact.seq)) &&
              Boolean(readRecord(primary).record),
          );
      if (
        edit?.lifeFacts &&
        (!reportFacts.length ||
          new Set(reportFacts.map((fact) => fact.seq)).size !== reportFacts.length ||
          reportFacts.some((fact, index) => fact.seq !== pending[index]?.seq) ||
          (reportFacts.length > 1 &&
            (reportFacts[0]!.waveId === undefined ||
              reportFacts.some((fact) => fact.waveId !== reportFacts[0]!.waveId))))
      )
        fail("life_fact_group_invalid");
      // 有权威生命覆盖时，未能配对的名单只是中间报告；默认不另播“等待确认”，
      // 死亡仍由后面的原fact镜头逐条/逐波提交。显式导演编辑或停留保留原锚点。
      if (
        layout === "broadcast-v1" &&
        !edit &&
        !authoredShotIds.has(`event:${primary.seq}`) &&
        !holds.has(primaryIndex) &&
        !reportFacts.length &&
        isCoveredLifeReport(
          readRecord(primary).record?.event,
          replay.factCoverage?.committedDeaths === 1,
        )
      ) {
        silentLifeReports.push(primaryIndex);
      } else {
        append(
          primaryIndex,
          `event:${primary.seq}`,
          "event",
          edit,
          group?.indexes ?? [index],
          [],
          reportFacts,
        );
        for (const fact of reportFacts) absorbedFactSeqs.add(fact.seq);
      }
    }
    appendFacts(event.seq);
    for (const hold of holds.get(index) ?? [])
      append(hold.stateAt ? anchorIndex(hold.stateAt) : index, `hold:${hold.id}`, "hold", hold);
  }
  if (!replay.events.length && !facts.length) append(-1, "empty", "event");
  // 仅库存的进行中档案也可预览初始状态；不把库存伪装成一次上帝行动或补出对局事件。
  if (
    !shots.length &&
    !replay.events.length &&
    facts.length &&
    facts.every((fact) => fact.kind === "potion_stock") &&
    !factEdits.size
  )
    append(-1, "context", "event", {}, []);
  if (!shots.length && silentLifeReports.length) append(-1, "context", "event", {}, []);
  if (!shots.length) fail("timeline_empty");
  const finalSilentIndex = silentLifeReports.at(-1);
  const lastShot = [...shots].reverse().find((shot) => shot.kind !== "hold");
  if (
    finalSilentIndex !== undefined &&
    lastShot &&
    lastShot.stateCues.at(-1)!.throughSeq < replay.events[finalSilentIndex]!.seq
  ) {
    // 进行中归档可能恰好停在未确认名单。静默消费末尾原事件，不加页面、不据名单杀人；
    // 倒看仍由唯一投影按原事件/事实游标还原，不能把未提交名单改成已死亡，不能修改作者固定stateAt的hold。
    const tail = sourceIndex.cursorAt(finalSilentIndex);
    lastShot.stateCues.push({
      frame: lastShot.durationFrames - 1,
      throughSeq: tail.throughSeq,
      throughFactSeq: tail.throughFactSeq,
      view: sourceIndex.viewAt(tail),
    });
  }
  if (maximumDuration !== undefined && cursor > maximumDuration) fail("duration_budget_exceeded");
  for (const id of shotEdits.keys()) if (!usedShotEdits.has(id)) fail(`shot_edit_missing:${id}`);
  const audio = compileAudio([...(script?.audio ?? []), ...shotAudio], media, cursor, playerIds);
  const subtitles = compileVideoSubtitles(shots, fps, script?.subtitles);
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
  // 默认省略的中间报告仍可从Web时间线跳转到接纳该前缀的有效镜头，不能丢失审计锚点。
  for (const index of silentLifeReports) {
    const seq = replay.events[index]!.seq;
    for (const shot of shots) {
      const cue = shot.stateCues.find(
        (value) => value.throughSeq >= seq && value.frame >= shot.scene.cues.impact,
      );
      if (!cue) continue;
      eventFrames[String(seq)] = [
        { shotId: shot.id, frame: shot.from + cue.frame, mode: "absorbed" },
      ];
      break;
    }
  }
  return {
    version: 1,
    source,
    ...(program ? { program: structuredClone(program) } : {}),
    display: { ...options },
    fps,
    width,
    height,
    seed,
    durationFrames: cursor,
    shots,
    media,
    audio,
    ...(subtitles.length ? { subtitles } : {}),
    layout,
    theme,
    playersPresentation,
    eventFrames,
  };
}

/** 自定义参数辅助类型，供视频项目导出纯 JSON 数据时使用。 */
export type VideoCustomProps = JsonObject;
