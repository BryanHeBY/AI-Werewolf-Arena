/**
 * 负责把已校验事件／提交事实映射为观众场景。输入为原始出处、系统标签及显式导演选项，输出纯 JSON 场景与安全分组。
 * 不分析玩家话语意图、不计算票数胜者或夜间规则；汇总只吸收同窗口连续明细，未知事件保留通用说明。
 */
import type { ReplayEvent, ReplayFact } from "@ai-werewolf-arena/replay-contract";
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { readReplayEvent } from "../replay/replay-event-reader";
import type {
  VideoScene,
  VideoSceneCues,
  VideoSceneOverride,
  TextEmphasis,
  CompiledTextEmphasis,
  VideoBallot,
} from "./types";

type Names = readonly { id: number; seat?: number; name?: string }[];
/** 当前录制registry对这两种事件回退到type名；只统一已知展示别名，PK／未知阶段仍独立切段。 */
function ballotStage(event: ReplayEvent): string | undefined {
  if (event.type === "sheriff_vote_summary" && event.stage === "sheriff_vote_summary")
    return "sheriff";
  if (event.type === "crow_curse_applied" && event.stage === "crow_curse_applied") return "voting";
  return event.stage;
}
function ballot(event: ReplayEvent): VideoBallot {
  const p = event.payload;
  const votes = Array.isArray(p.votes) ? (p.votes as Record<string, unknown>[]) : [p];
  return {
    kind: event.type.startsWith("sheriff_")
      ? "sheriff"
      : event.type.startsWith("wolf_")
        ? "wolf"
        : "exile",
    ...(typeof p.round === "number" ? { round: p.round } : {}),
    votes: votes.map((v) => ({
      actorId: Number(v.actorId),
      targetId: typeof v.targetId === "number" ? v.targetId : null,
      abstain: v.abstain === true,
      weight: typeof v.weight === "number" ? v.weight : null,
      ...(typeof v.fallback === "boolean" ? { fallback: v.fallback } : {}),
    })),
    tally:
      p.tally && typeof p.tally === "object"
        ? (structuredClone(p.tally) as Record<string, number>)
        : null,
    targetId:
      typeof p.target === "number" ? p.target : typeof p.winnerId === "number" ? p.winnerId : null,
    adjustments: [],
    complete: event.type === "vote_summary" || event.type === "sheriff_vote_summary",
  };
}

/** 同一汇总前只吸收连续的本轮明细；脚本／事实屏障与阶段切换都结束窗口，不凭相同目标猜测重复。 */
export function semanticEventGroups(
  events: ReplayEvent[],
  playerIds: number[],
  barriers: Set<number>,
  explicitAnchors = barriers,
) {
  const groups = new Map<number, { indexes: number[]; primary: number }>();
  const consumed = new Set<number>();
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;
    if (
      !["vote_summary", "sheriff_vote_summary"].includes(event.type) ||
      !readReplayEvent(event, playerIds)
    )
      continue;
    const castType = event.type === "vote_summary" ? "vote_cast" : "sheriff_vote_cast";
    const indexes = [index];
    for (let previous = index - 1; previous >= 0; previous--) {
      const item = events[previous]!;
      if (
        barriers.has(previous) ||
        item.day !== event.day ||
        item.phase !== event.phase ||
        ballotStage(item) !== ballotStage(event) ||
        !readReplayEvent(item, playerIds)
      )
        break;
      if (
        item.type !== castType &&
        !(castType === "vote_cast" && item.type === "crow_curse_applied")
      )
        break;
      if (
        item.payload.round !== undefined &&
        event.payload.round !== undefined &&
        item.payload.round !== event.payload.round
      )
        break;
      indexes.unshift(previous);
    }
    const next = events[index + 1];
    // 只有明确紧邻同窗口且目标一致的放逐记录可成为本段尾声；映射、PK或任何导演锚点都切段。
    if (
      event.type === "vote_summary" &&
      next?.type === "voted_out" &&
      next.day === event.day &&
      next.phase === event.phase &&
      ballotStage(next) === ballotStage(event) &&
      typeof event.payload.target === "number" &&
      next.payload.target === event.payload.target &&
      !barriers.has(index) &&
      !explicitAnchors.has(index + 1) &&
      readReplayEvent(next, playerIds)
    )
      indexes.push(index + 1);
    // 单个summary仍是独立节点；没有summary的旧逐票记录不伪造complete或最终落点。
    groups.set(indexes[0]!, { indexes, primary: index });
    for (const item of indexes.slice(1)) consumed.add(item);
  }
  return { groups, consumed };
}

export function eventScene(
  event: ReplayEvent | undefined,
  source: ReplayEvent[],
  label: string,
  stage: string,
  playerIds: number[],
  locale: Locale,
): VideoScene {
  const scene: VideoScene = {
    kind: "fallback",
    title: stage,
    body: label,
    bodySource: "event",
    targetIds: [],
    speaker: "god",
    emphasis: [],
    cues: { establish: 0, travel: 0, impact: 0, settled: 0 },
  };
  if (!event) return scene;
  const fact = readReplayEvent(event, playerIds);
  if (!fact) return scene;
  const p = fact.event.payload;
  const actorId =
    typeof p.actorId === "number"
      ? p.actorId
      : typeof p.playerId === "number"
        ? p.playerId
        : undefined;
  const targets = typeof p.targetId === "number" ? [p.targetId] : [];
  if (
    ["day_speech", "last_words_spoken", "wolf_discussion"].includes(event.type) &&
    typeof p.text === "string" &&
    actorId !== undefined
  ) {
    return { ...scene, kind: "speech", body: p.text, speaker: `player:${actorId}`, actorId };
  }
  if (
    ["vote_summary", "sheriff_vote_summary", "vote_cast", "sheriff_vote_cast"].includes(event.type)
  ) {
    const data = ballot(event);
    data.adjustments = source
      .filter((e) => e.type === "crow_curse_applied")
      .map((e) => ({
        kind: "crow",
        targetId: Number(e.payload.targetId),
        weight: Number(e.payload.bonus),
        sourceSeq: e.seq,
      }));
    return {
      ...scene,
      kind: "ballot",
      ballot: data,
      targetIds: data.targetId === null ? [] : [data.targetId],
      speaker: "god",
    };
  }
  if (event.type === "wolf_kill_vote_cast")
    return {
      ...scene,
      kind: "action",
      actorId,
      targetIds: targets,
      action: { kind: "wolf-vote", status: "choice" },
      ballot: ballot(event),
      speaker: "god",
    };
  if (event.type === "seer_checked" || event.type === "role_inspected")
    return {
      ...scene,
      kind: "action",
      actorId,
      targetIds: targets,
      action: { kind: "inspect", status: "recorded", result: label },
      speaker: "god",
    };
  if (event.type === "witch_potion_used")
    return {
      ...scene,
      kind: "action",
      actorId,
      targetIds: targets,
      action: {
        kind: p.potionType === "heal" ? "heal" : p.potionType === "poison" ? "poison" : "generic",
        status: "recorded",
      },
      speaker: "god",
    };
  if (event.type === "guard_applied")
    return {
      ...scene,
      kind: "action",
      actorId,
      targetIds: targets,
      action: { kind: "guard", status: "choice" },
      speaker: "god",
    };
  if (event.type === "voted_out")
    return {
      ...scene,
      kind: "action",
      targetIds: typeof p.target === "number" ? [p.target] : [],
      action: { kind: "exile", status: "recorded" },
      speaker: "god",
    };
  if (["night_resolved", "additional_deaths"].includes(event.type))
    return {
      ...scene,
      kind: "settlement",
      targetIds: Array.isArray(p.deaths) ? ([...p.deaths] as number[]) : [],
      speaker: "god",
    };
  if (event.type === "phase_changed")
    return {
      ...scene,
      kind: "phase",
      title: text(locale, "video.phase_transition"),
      speaker: "god",
    };
  if (event.type === "game_over") return { ...scene, kind: "settlement", speaker: "god" };
  return scene;
}

/** God事实只陈述已记录结果；药物库存不证明生效，保护不证明最终存活，刀口不等于死亡。 */
export function factScene(fact: ReplayFact, locale: Locale, names: Names): VideoScene {
  const name = (id: number | null) =>
    id === null
      ? text(locale, "video.no_target")
      : playerLabel(names.find((player) => player.id === id) ?? { id }, locale);
  const scene: VideoScene = {
    kind: "action",
    title: "",
    body: "",
    bodySource: "event",
    targetIds: [],
    speaker: "god",
    emphasis: [],
    cues: { establish: 0, travel: 0, impact: 0, settled: 0 },
  };
  switch (fact.kind) {
    case "wolf_knife_revoked":
      return {
        ...scene,
        title: text(locale, "video.knife_revoked_title"),
        body: text(locale, "video.knife_revoked_body", { target: name(fact.targetId) }),
        targetIds: [fact.targetId],
        action: { kind: "wolf-knife", status: "revoked", result: fact.reason },
      };
    case "wolf_knife_committed":
      return {
        ...scene,
        title: text(locale, "video.knife_title"),
        body: text(locale, "video.knife_body", { target: name(fact.effectiveTargetId) }),
        targetIds: fact.effectiveTargetId === null ? [] : [fact.effectiveTargetId],
        participantIds: [...fact.participantIds],
        action: { kind: "wolf-knife", status: "committed" },
      };
    case "potion_stock":
      return {
        ...scene,
        title: text(locale, "video.stock_title"),
        actorId: fact.actorId,
        body: text(locale, "video.stock_body", {
          actor: name(fact.actorId),
          heal: fact.heal,
          poison: fact.poison,
        }),
        stock: {
          actorId: fact.actorId,
          abilityId: fact.abilityId,
          heal: fact.heal,
          poison: fact.poison,
        },
        action: { kind: "generic", status: "recorded" },
      };
    case "night_protection_resolved":
      return {
        ...scene,
        title: text(locale, "video.protection_title"),
        targetIds: [fact.targetId],
        body:
          fact.interaction === "guard_heal_cancelled"
            ? text(locale, "video.guard_heal_cancelled", { target: name(fact.targetId) })
            : text(
                locale,
                fact.protection === "guard" ? "video.guard_blocked" : "video.heal_blocked",
                { target: name(fact.targetId) },
              ),
        action: { kind: "protection", status: "committed", result: fact.interaction },
      };
    case "life_committed":
      return {
        ...scene,
        kind: "settlement",
        title: text(locale, "video.death_title"),
        body: text(locale, "video.death_body", { target: name(fact.playerId) }),
        targetIds: [fact.playerId],
      };
  }
}

/** 文本重点必须由脚本精确指定原文片段及第几次出现，不通过关键词猜测角色声称或目标。 */
export function compileEmphasis(
  body: string,
  emphasis: TextEmphasis[] = [],
): CompiledTextEmphasis[] {
  const ranges = emphasis
    .map((item) => {
      if (
        typeof item.text !== "string" ||
        !item.text.length ||
        !Number.isSafeInteger(item.occurrence ?? 0) ||
        (item.occurrence ?? 0) < 0
      )
        throw new Error("video_emphasis_invalid");
      let start = -1;
      for (let index = 0; index <= (item.occurrence ?? 0); index++) {
        start = body.indexOf(item.text, start + 1);
        if (start < 0) throw new Error("video_emphasis_text_missing");
      }
      return { text: item.text, start, end: start + item.text.length };
    })
    .sort((first, last) => first.start - last.start);
  for (let index = 1; index < ranges.length; index++)
    if (ranges[index]!.start < ranges[index - 1]!.end) throw new Error("video_emphasis_overlap");
  return ranges;
}
export function compileScene(
  base: VideoScene,
  override: VideoSceneOverride | undefined,
  emphasis: TextEmphasis[] | undefined,
  fps: number,
  duration: number,
  playerIds: number[],
): VideoScene {
  if (
    override &&
    Object.keys(override).some(
      (key) => !["kind", "title", "body", "speaker", "actorId", "targetIds", "cues"].includes(key),
    )
  )
    throw new Error("video_scene_field_invalid");
  if (
    override?.cues &&
    Object.keys(override.cues).some(
      (key) => !["establish", "travel", "impact", "settled"].includes(key),
    )
  )
    throw new Error("video_scene_cues_invalid");
  const scene = { ...base, ...structuredClone(override ?? {}) };
  if (
    !["speech", "action", "ballot", "settlement", "phase", "fallback"].includes(scene.kind) ||
    typeof scene.title !== "string" ||
    typeof scene.body !== "string"
  )
    throw new Error("video_scene_invalid");
  if (override?.body !== undefined) scene.bodySource = "script";
  if (
    !Array.isArray(scene.targetIds) ||
    new Set(scene.targetIds).size !== scene.targetIds.length ||
    scene.targetIds.some((id) => !playerIds.includes(id)) ||
    (scene.actorId !== undefined && !playerIds.includes(scene.actorId))
  )
    throw new Error("video_scene_player_invalid");
  if (
    scene.speaker !== undefined &&
    scene.speaker !== "god" &&
    !playerIds.some((id) => scene.speaker === `player:${id}`)
  )
    throw new Error("video_speaker_invalid");
  const defaults: VideoSceneCues = {
    establish: 0,
    travel: Math.round((fps * 8) / 30),
    impact: Math.round((fps * 24) / 30),
    settled: Math.round((fps * 40) / 30),
  };
  let previous = -1;
  const cues = Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => {
      const explicit = override?.cues?.[key as keyof VideoSceneCues];
      const frame = explicit ?? Math.min(duration - 1, value);
      if (!Number.isSafeInteger(frame) || frame < 0 || frame >= duration || frame < previous)
        throw new Error("video_scene_cues_invalid");
      previous = frame;
      return [key, frame];
    }),
  ) as unknown as VideoSceneCues;
  return { ...scene, cues, emphasis: compileEmphasis(scene.body, emphasis) };
}
