/**
 * 负责从签入教学归档及明确验收用例建立视频真实渲染图库。输入为源码目录，输出有出处的独立场景计划与采样帧。
 * 教学归档不改事实，手写用例明确标注非真实对局；此工具只准备美术验收，不替代游戏规则的独立测试预期。
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { ROLE_IDS } from "@ai-werewolf-arena/game-contract";
import type { ReplayDocument, ReplayEvent, ReplayFact } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../src/video/compiler";
import { getVideoSourceIdentity } from "../../src/video/source";
import { eventVisualIntent } from "../../src/video/visual-intent";
import { VIDEO_EVENT_VISUAL_ROUTES } from "../../src/video/visual-routes";
import type { VideoPlan, VideoScript } from "../../src/video/types";
import type { AvatarKey } from "../../src/presentation";

export interface ArtGalleryCase {
  id: string;
  provenance: string;
  sourceKind: "teaching" | "review_fixture" | "recorded";
  plan: VideoPlan;
  frame: number;
}
const root = path.resolve(import.meta.dir, "../../../..");
const avatarKeys: AvatarKey[] = [
  "deepseek",
  "openai",
  "anthropic",
  "qwen",
  "gemini",
  "glm",
  "kimi",
  "doubao",
];
const templateName = (value: string) => value.replaceAll("/", "--").replaceAll("_", "-");
function base(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "explicit-art-review-fixture",
    meta: {
      board: "art-review-fixture",
      locale: "zh-CN",
      startedAt: "2026-10-17T00:00:00Z",
      endedAt: "2026-10-17T00:01:00Z",
    },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, i) => ({
      player_id: i + 1,
      seat: i + 1,
      role: [
        "wolf",
        "knight",
        "villager",
        "wolf",
        "seer",
        "witch",
        "guard",
        "hunter",
        "idiot",
        "awakened_seer",
        "villager",
        "villager",
      ][i]!,
      camp: i === 0 || i === 3 ? "wolf" : "good",
    })),
    events: [],
  };
}
function event(type: string, payload: Record<string, unknown>, phase = "night"): ReplayEvent {
  return { seq: 1, timestamp: "2026-10-17T00:00:00Z", day: 1, phase, type, payload };
}
function compile(
  document: ReplayDocument,
  anchor?: number,
  options: Partial<VideoScript> = {},
  locale: "zh-CN" | "en" = "zh-CN",
) {
  const script: VideoScript = {
    source: getVideoSourceIdentity(document),
    layout: "broadcast-v1",
    presentation: {
      showNames: false,
      showModels: false,
      players: Object.fromEntries(
        document.players.map((p, i) => [
          String(p.player_id),
          { avatarKey: avatarKeys[i % avatarKeys.length] },
        ]),
      ),
    },
    ...(anchor === undefined
      ? {}
      : {
          edits: document.events.map((e) => ({
            anchor: { seq: e.seq, type: e.type },
            ...(e.seq !== anchor ? { skip: true } : {}),
          })),
        }),
    ...options,
  };
  return compileVideoPlan(document, script, { locale, timeZone: "UTC" });
}
function sample(
  id: string,
  document: ReplayDocument,
  provenance: string,
  sourceKind: ArtGalleryCase["sourceKind"],
  anchor?: number,
  options: Partial<VideoScript> = {},
  locale: "zh-CN" | "en" = "zh-CN",
): ArtGalleryCase {
  const plan = compile(document, anchor, options, locale);
  const shot =
    plan.shots.find((s) => anchor === undefined || s.eventSeq === anchor) ?? plan.shots[0]!;
  // 只加验收署名，不替换原正文、目标、投影或结果；采样使用实际编译cue而非假定固定90帧。
  shot.scene.title = `${sourceKind === "teaching" ? "教学归档" : "验收用例·非真实对局"} · ${shot.scene.title}`;
  return {
    id,
    provenance,
    sourceKind,
    plan,
    frame:
      shot.from + Math.min(shot.durationFrames - 1, Math.max(shot.scene.cues.settled + 12, 52)),
  };
}

/** 同一模板优先十二人中文归档；模板全集与实际typed reader交叉后才计入覆盖。 */
export async function createArtGalleryCases(): Promise<ArtGalleryCase[]> {
  const candidates = new Map<
    string,
    { document: ReplayDocument; file: string; seq: number; score: number }
  >();
  const allDocuments: Array<{ document: ReplayDocument; file: string }> = [];
  for (const [directory, pattern] of [
    ["frontend/tests/fixtures", "**/god.replay.json"],
    ["docs/examples", "**/*.replay.json"],
  ]) {
    for await (const relative of new Bun.Glob(pattern).scan(path.join(root, directory))) {
      const file = path.join(directory, relative);
      const document = JSON.parse(await readFile(path.join(root, file), "utf8")) as ReplayDocument;
      allDocuments.push({ document, file });
      for (const e of document.events) {
        const route = eventVisualIntent(
          e,
          document.players.map((p) => p.player_id),
        );
        if (route.process === "unknown") continue;
        const score =
          (document.players.length === 12 ? 4 : 0) +
          (file.includes("zh-CN") ? 2 : 0) -
          document.events.length / 10000;
        if (!candidates.has(route.template) || candidates.get(route.template)!.score < score)
          candidates.set(route.template, { document, file, seq: e.seq, score });
      }
    }
  }
  const cases: ArtGalleryCase[] = [];
  const expected = [
    ...new Set(Object.values(VIDEO_EVENT_VISUAL_ROUTES).map((route) => route.template)),
  ].sort();
  for (const template of expected) {
    const candidate = candidates.get(template);
    if (candidate)
      cases.push(
        sample(
          templateName(template),
          candidate.document,
          `${candidate.file}#seq=${candidate.seq}`,
          "teaching",
          candidate.seq,
        ),
      );
  }
  const add = (
    id: string,
    e: ReplayEvent,
    options: Partial<VideoScript> = {},
    locale: "zh-CN" | "en" = "zh-CN",
  ) => {
    const d = base();
    d.events = [e];
    cases.push(
      sample(id, d, `explicit review fixture: ${e.type}`, "review_fixture", 1, options, locale),
    );
  };
  // 三个教学归档尚无记录的模板，使用契约允许的明确载荷，不假装来自一次真实模型对局。
  const policy = "awa_awakened_guard_cycle_v1";
  add(
    "review-pack-attack--self-destruct-declared",
    event(
      "awakened_self_destruct_declared",
      { policy, day: 1, actorId: 1, window: "on_pre_vote" },
      "day",
    ),
  );
  add(
    "review-pack-attack--self-destruct-resolved",
    event(
      "awakened_self_destruct_resolved",
      { policy, day: 1, actorId: 1, window: "on_pre_vote", deaths: [1] },
      "day",
    ),
  );
  add(
    "civic-ballot--compact-notice",
    event("debate_canceled", { actorId: 2, targetId: 3, day: 1, reason: "scope_changed" }, "day"),
  );
  for (const camp of ["good", "wolf", "third_party"])
    add(
      `report-camp-${camp}`,
      event("seer_checked", { actorId: 5, targetId: 3, result: { kind: "camp", camp } }),
    );
  add(
    "report-combined",
    event("seer_checked", {
      actorId: 5,
      targetId: 3,
      result: { kind: "combined", camp: "wolf", role: "hidden_wolf" },
    }),
  );
  add(
    "report-role",
    event("role_inspected", {
      actorId: 5,
      targetId: 3,
      day: 1,
      result: { kind: "role", role: "witch" },
    }),
  );
  add(
    "unknown-event-safe-record",
    event("future_review_event", { text: "未识别记录：只保留说明，不推断技能或结果。" }),
  );
  for (const containsWerewolf of [true, false]) {
    const source = allDocuments.flatMap((a) =>
      a.document.events
        .filter((e) => e.type === "fragrant_pair_inspected")
        .map((e) => ({ ...a, event: e })),
    )[0];
    if (source)
      add(
        `report-pair-${containsWerewolf}`,
        event(source.event.type, { ...source.event.payload, containsWerewolf }),
      );
  }
  const facts: Array<{ id: string; fact: ReplayFact }> = [
    {
      id: "knife-committed",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "wolf_knife_committed",
        day: 1,
        participantIds: [1, 4],
        requestedTargetId: 3,
        effectiveTargetId: 3,
      },
    },
    {
      id: "knife-mapped",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "wolf_knife_committed",
        day: 1,
        participantIds: [1, 4],
        requestedTargetId: 3,
        effectiveTargetId: 7,
      },
    },
    {
      id: "knife-explicit-empty",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "wolf_knife_committed",
        day: 1,
        participantIds: [1, 4],
        requestedTargetId: 3,
        effectiveTargetId: null,
      },
    },
    {
      id: "knife-revoked",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "wolf_knife_revoked",
        day: 1,
        targetId: 3,
        reason: "stale_target",
      },
    },
    {
      id: "guard-blocked",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "night_protection_resolved",
        day: 1,
        targetId: 3,
        interaction: "wolf_attack_blocked",
        protection: "guard",
      },
    },
    {
      id: "heal-blocked",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "night_protection_resolved",
        day: 1,
        targetId: 3,
        interaction: "wolf_attack_blocked",
        protection: "heal",
      },
    },
    {
      id: "guard-heal-cancelled",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "night_protection_resolved",
        day: 1,
        targetId: 3,
        interaction: "guard_heal_cancelled",
      },
    },
    {
      id: "stock-multiple",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "potion_stock",
        day: 1,
        actorId: 6,
        abilityId: "witch.potion",
        heal: 2,
        poison: 3,
      },
    },
    {
      id: "stock-zero",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "potion_stock",
        day: 1,
        actorId: 6,
        abilityId: "witch.potion",
        heal: 0,
        poison: 0,
      },
    },
    {
      id: "life-committed",
      fact: {
        seq: 1,
        afterSeq: 0,
        kind: "life_committed",
        day: 1,
        playerId: 3,
        alive: false,
        causes: ["poison"],
      },
    },
  ];
  for (const { id, fact } of facts) {
    const d = base();
    d.factCoverage = { committedDeaths: 1 };
    d.facts = [fact];
    cases.push(sample(id, d, `explicit God fact: ${fact.kind}`, "review_fixture"));
  }
  const speech =
    "先看这一轮的票型。请区分玩家原话、编导说明和已经记录的技能结果。画面需要紧凑，但每一页文字都要读得完。长发言在固定阅读区连续分页，不能缩小字号或删掉原文。这里是明确的排版验收用例，不是真实玩家发言。😀\n第二段检查标点、换行、强调和长名字。";
  for (const night of [false, true])
    add(
      `long-zh-${night ? "night" : "day"}`,
      event("day_speech", { actorId: 2, text: speech }, night ? "night" : "day"),
    );
  add(
    "long-en-six-seats",
    event(
      "day_speech",
      {
        actorId: 2,
        text: "This is an explicitly authored rendering fixture. Preserve every original word while wrapping long sentences. A player’s claim is not an authoritative inspection report. The typography should remain steady during reading, including emoji 😀 and exceptionallylongunbrokentokenswithoutanyspaces.",
      },
      "day",
    ),
    {},
    "en",
  );
  const last = cases.at(-1)!;
  const six = base();
  six.players = six.players.slice(0, 6);
  six.events = [event("day_speech", { actorId: 2, text: last.plan.shots[0]!.scene.body }, "day")];
  cases[cases.length - 1] = sample(
    "long-en-six-seats",
    six,
    "explicit six-seat English typography fixture",
    "review_fixture",
    1,
    {},
    "en",
  );
  for (const tone of ["day", "night"])
    add(`minimal-${tone}`, event("day_speech", { actorId: 2, text: speech }, tone), {
      theme: { id: "minimal-v1" },
    });
  add(
    "legacy-compatibility",
    event("day_speech", { actorId: 2, text: "Legacy layout compatibility fixture." }, "day"),
    { layout: "legacy-ellipse-v1" },
  );
  const mixed = base();
  mixed.events = [event("day_speech", { actorId: 2, text: speech }, "day")];
  for (const p of mixed.players)
    if (p.player_id <= 6) {
      p.name = `很长的玩家展示名称 ${p.player_id}`;
      p.model = `Model ${p.player_id} · optional metadata`;
    }
  cases.push(
    sample(
      "asymmetric-long-metadata",
      mixed,
      "explicit long-name and one-column metadata fixture",
      "review_fixture",
      1,
      { presentation: { showNames: true, showModels: true } },
    ),
  );
  for (let offset = 0; offset < ROLE_IDS.length; offset += 12) {
    const d = base();
    for (const [i, p] of d.players.entries()) p.role = ROLE_IDS[(offset + i) % ROLE_IDS.length]!;
    d.events = [
      event(
        "day_speech",
        {
          actorId: 2,
          text: "角色纹章与身份文字验收：模型头像、座次和角色身份分别呈现。这是排版验收用例。",
        },
        "day",
      ),
    ];
    cases.push(
      sample(
        `role-roster-${offset}`,
        d,
        "explicit complete role-crest roster fixture",
        "review_fixture",
        1,
        {},
        "en",
      ),
    );
  }
  // 关键揭晓边界也导出真实PNG：不能只看settled后一张漂亮定帧。
  for (const id of [
    "report-camp-wolf",
    "report-pair-true",
    "knife-committed",
    "knife-explicit-empty",
    "guard-heal-cancelled",
    "duel--recorded-resolution",
  ]) {
    const found = cases.find((c) => c.id === id);
    if (!found) throw new Error(`art_gallery_boundary_missing:${id}`);
    const shot = found.plan.shots[0]!;
    for (const delta of [-1, 0, 1]) {
      const frame = shot.from + shot.scene.cues.impact + delta;
      if (frame >= shot.from)
        cases.push({
          ...found,
          id: `${id}--impact-${delta < 0 ? "before" : delta > 0 ? "after" : "at"}`,
          frame,
        });
    }
  }
  const stable = cases.find((c) => c.id === "knife-committed")!;
  cases.push({ ...stable, id: "knife-committed--stable-later", frame: 100 });

  // 高风险语义采用完整教学归档编译，保留连续逐票／乌鸦明细的聚合窗口，不用逐事件skip屏障打散来源。
  const archived = (
    id: string,
    matches: (e: ReplayEvent, document: ReplayDocument) => boolean,
    fileIncludes?: string,
  ) => {
    const source = allDocuments
      .filter((entry) => !fileIncludes || entry.file.includes(fileIncludes))
      .flatMap((entry) =>
        entry.document.events
          .filter((e) => matches(e, entry.document))
          .map((e) => ({ ...entry, event: e })),
      )
      .sort((a, b) => {
        const score = (entry: typeof a) =>
          (entry.document.players.length === 12 ? 4 : 0) + (entry.file.includes("zh-CN") ? 2 : 0);
        return score(b) - score(a) || a.file.localeCompare(b.file) || a.event.seq - b.event.seq;
      })[0];
    if (!source) throw new Error(`art_gallery_archive_missing:${id}`);
    const locale = source.document.meta.locale === "en" ? "en" : "zh-CN";
    const plan = compile(source.document, undefined, {}, locale);
    const shot = plan.shots.find((s) => s.sourceSeqs.includes(source.event.seq));
    if (!shot) throw new Error(`art_gallery_archive_shot_missing:${id}`);
    shot.scene.title = `教学归档 · ${shot.scene.title}`;
    cases.push({
      id,
      plan,
      sourceKind: "teaching",
      provenance: `${source.file}#seq=${source.event.seq}`,
      // 尾声若在主段读完后才揭晓，样例也必须采到实际结果，不能假定settled就是原事件的全部事实。
      frame:
        shot.from +
        Math.min(
          shot.durationFrames - 1,
          Math.max(shot.scene.cues.settled + 12, (shot.scene.resolution?.revealFrame ?? 0) + 12),
        ),
    });
  };
  archived(
    "ballot-weighted-sheriff",
    (e) =>
      e.type === "vote_summary" &&
      Array.isArray(e.payload.votes) &&
      e.payload.votes.some(
        (v) => v !== null && typeof v === "object" && typeof v.weight === "number" && v.weight > 1,
      ),
    "twelve-player-dreamer/",
  );
  archived(
    "ballot-crow-extra-vote",
    (e, d) =>
      e.type === "vote_summary" &&
      d.events.some(
        (previous) =>
          previous.seq < e.seq &&
          previous.day === e.day &&
          previous.phase === e.phase &&
          previous.type === "crow_curse_applied",
      ),
    "docs/examples/crow/",
  );
  for (const round of [1, 2])
    archived(
      `ballot-pk-round-${round}`,
      (e) => e.type === "vote_summary" && e.day === 1 && e.payload.round === round,
      "animal-pk-skip-final/zh-CN/",
    );
  archived(
    "outcome-individual",
    (e) => e.type === "game_over",
    "six-player-fox-dream/fox-dream/zh-CN/",
  );
  archived("outcome-third-party", (e) => e.type === "game_over", "ghost-bride-12-witness/");
  archived("outcome-no-winner", (e) => e.type === "game_over", "ghost-bride-all-dead/");
  // 普通骑士的报告只有狼／非狼两种结果，非狼不扩写成好人阵营；保持签入教学归档原载荷。
  for (const result of ["wolf", "not_wolf"] as const)
    archived(
      `knight-duel-${result.replaceAll("_", "-")}`,
      (e) => e.type === "knight_duel" && e.payload.result === result,
    );
  // 工具表现必须覆盖跨家族的真实交集，不能拿狼人顺序或能力变更的同族卡片代替枪击。
  archived("wolf-king-gun", (e) => e.type === "wolf_king_shot");
  archived("mechanical-gun", (e) => e.type === "mechanical_shot");

  add(
    "authored-actor-original-speech",
    event(
      "day_speech",
      {
        actorId: 2,
        text: "原始发言来自2号。编导actor标注12号不改变这段原话的署名，也不产生查验或技能结果。",
      },
      "day",
    ),
    { edits: [{ anchor: { seq: 1, type: "day_speech" }, scene: { actorId: 12 } }] },
  );
  const englishMetadata = base();
  const longRoles = [
    "awakened_idiot",
    "black_market_merchant",
    "awakened_hidden_wolf",
    "awakened_wolf_beauty",
  ];
  for (const [i, p] of englishMetadata.players.entries()) {
    p.role = longRoles[i % longRoles.length]!;
    p.camp = i % longRoles.length < 2 ? "good" : "wolf";
    p.name = `Explicit long player display name ${p.player_id}`;
    p.model = `Explicit model ${p.player_id} with optional metadata`;
  }
  englishMetadata.events = [
    event(
      "day_speech",
      {
        actorId: 2,
        text: "Explicit typography fixture. Player name, model, seat, LLM avatar and the full role label must coexist without clipping.",
      },
      "day",
    ),
  ];
  cases.push(
    sample(
      "english-long-role-full-metadata",
      englishMetadata,
      "explicit full name/model metadata and longest registered English role labels; not a real match",
      "review_fixture",
      1,
      { presentation: { showNames: true, showModels: true } },
      "en",
    ),
  );
  for (const locale of ["zh-CN", "en"] as const)
    add(
      `large-text-${locale === "en" ? "en" : "zh"}-720p`,
      event(
        "day_speech",
        {
          actorId: 2,
          text: locale === "zh-CN" ? speech : six.events[0]!.payload.text,
        },
        "day",
      ),
      { width: 1280, height: 720, theme: { id: "gothic-v1", options: { largeText: true } } },
      locale,
    );

  const timed = (id: string, document: ReplayDocument, options: Partial<VideoScript>) => {
    const prepared = sample(
      id,
      document,
      "explicit timing review fixture; not a real match",
      "review_fixture",
      undefined,
      options,
    );
    const shot = prepared.plan.shots[0]!;
    for (const [suffix, localFrame] of [
      ["impact-before", shot.scene.cues.impact - 1],
      ["impact-at", shot.scene.cues.impact],
      ["settled", shot.scene.cues.settled],
    ] as const)
      cases.push({ ...prepared, id: `${id}--${suffix}`, frame: shot.from + localFrame });
  };
  const report = base();
  report.events = [
    event("seer_checked", { actorId: 5, targetId: 3, result: { kind: "camp", camp: "wolf" } }),
  ];
  timed("reduced-motion-report", report, {
    theme: { id: "gothic-v1", options: { reducedMotion: true } },
  });
  timed("fps60-report", report, { fps: 60 });
  const knife = base();
  knife.factCoverage = { committedDeaths: 1 };
  knife.facts = [
    {
      seq: 1,
      afterSeq: 0,
      day: 1,
      kind: "wolf_knife_committed",
      participantIds: [1, 4],
      requestedTargetId: 3,
      effectiveTargetId: 3,
    },
  ];
  timed("fps60-knife", knife, { fps: 60 });
  add("fps60-speech-reading", event("day_speech", { actorId: 2, text: speech }, "day"), {
    fps: 60,
  });
  // waveId是录制方明确提交的同波证据；同prefix本身不足以把两条生命事实合成同时死亡。
  for (const wave of ["same", "distinct", "legacy-unknown"] as const) {
    const document = base();
    document.factCoverage = { committedDeaths: 1 };
    document.facts = [3, 4].map<ReplayFact>((playerId, index) => ({
      seq: index + 1,
      afterSeq: 0,
      day: 1,
      kind: "life_committed",
      playerId,
      alive: false,
      causes: index === 0 ? ["poison"] : ["wolf_kill"],
      ...(wave === "legacy-unknown" ? {} : { waveId: wave === "same" ? 1 : index + 1 }),
    }));
    const plan = compile(document);
    for (const [index, shot] of plan.shots.entries()) {
      shot.scene.title = `验收用例·非真实对局 · ${shot.scene.title}`;
      cases.push({
        id: `life-wave-${wave}${wave === "same" ? "" : index === 0 ? "--first" : "--second"}`,
        provenance: `explicit life facts: same afterSeq=0; ${wave === "same" ? "waveId=1/1" : wave === "distinct" ? "waveId=1/2" : "waveId omitted (no simultaneous-wave evidence)"}; not a real match`,
        sourceKind: "review_fixture",
        plan,
        frame: shot.from + shot.scene.cues.impact,
      });
    }
  }
  // 自动模板与手写分支共用输出目录，提前拒绝同名，避免后续PNG覆盖或resume误认完成。
  const ids = new Set<string>();
  for (const item of cases) {
    if (ids.has(item.id)) throw new Error(`art_gallery_duplicate_id:${item.id}`);
    ids.add(item.id);
  }
  return cases;
}
