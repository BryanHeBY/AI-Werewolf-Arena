/**
 * 负责本轮修复边界的真实渲染用例。输入为已签入角色契约，输出明确标注非真实对局的长文、身份与终局采样。
 * 不改record或生产默认值；测试结果独立手写，六种胜利归属和长原话首中尾必须通过正式宿主查看。
 */
import { ROLE_IDS, type GameOutcome } from "@ai-werewolf-arena/game-contract";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../src/video/compiler";
import { getVideoSourceIdentity } from "../src/video/source";
import type { VideoScript } from "../src/video/types";
import type { ArtGalleryCase } from "../tests/support/art-gallery-cases";

function document(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "explicit-repair-review-fixture",
    meta: {
      board: "review_fixture",
      startedAt: "2026-10-17T00:00:00Z",
      endedAt: "2026-10-17T00:01:00Z",
    },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, index) => ({
      player_id: index + 1,
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
      ][index]!,
      camp: index === 0 || index === 3 ? "wolf" : "good",
    })),
    events: [],
  };
}
export function createRepairGalleryCases(): ArtGalleryCase[] {
  const cases: ArtGalleryCase[] = [];
  const add = (
    id: string,
    replay: ReplayDocument,
    options: Partial<VideoScript> = {},
    locale: "zh-CN" | "en" = "zh-CN",
    samples: "all" | "stable" = "stable",
  ) => {
    const plan = compileVideoPlan(
      replay,
      { source: getVideoSourceIdentity(replay), layout: "broadcast-v1", ...options },
      { locale, timeZone: "UTC" },
    );
    const shot =
      plan.shots.find((candidate) => candidate.eventSeq === replay.events[0]?.seq) ??
      plan.shots[0]!;
    if (
      replay.events[0]?.type === "game_over" &&
      replay.events[0].payload.outcome &&
      !shot.scene.visual?.victory?.outcome
    )
      throw new Error("repair_gallery_outcome_not_interpreted");
    const points =
      samples === "all"
        ? ([
            ["start", Math.max(0, shot.scene.cues.impact - 1)],
            ["middle", Math.floor(shot.durationFrames / 2)],
            ["end", shot.durationFrames - 1],
          ] as const)
        : ([["stable", Math.min(shot.durationFrames - 1, shot.scene.cues.settled + 20)]] as const);
    for (const [suffix, local] of points)
      cases.push({
        id: `${id}--${suffix}`,
        plan,
        frame: shot.from + local,
        sourceKind: "review_fixture",
        provenance: "Explicit repair boundary fixture; not a real match; no implicit LLM avatars",
      });
  };
  const chat = document();
  const segment =
    "验收原话：先分清角色、座次和已记录的查验。预言家不是凭玩家自称确认；不得把发言里的怀疑当成真实身份。角色名白痴、女巫、狼人，座次12号，模型OpenAI-GPT，标点（和括号）都要自然换行。";
  chat.events = [
    {
      seq: 1,
      timestamp: "t",
      day: 2,
      phase: "day",
      type: "day_speech",
      payload: {
        actorId: 6,
        text:
          Array.from({ length: 16 }, (_, index) => `第${index + 1}段 ${segment}`).join("\n") +
          "\n末行：保留完整原话，匀速滚动到这里。",
      },
    },
  ];
  add("repair-scroll-zh", chat, {}, "zh-CN", "all");
  add(
    "repair-scroll-720-reduced",
    chat,
    {
      width: 1280,
      height: 720,
      fps: 60,
      theme: { id: "gothic-v1", options: { reducedMotion: true, largeText: true } },
    },
    "zh-CN",
    "all",
  );
  const en = structuredClone(chat);
  en.events[0]!.payload.text =
    Array.from(
      { length: 16 },
      (_, index) =>
        `Paragraph ${index + 1}: Preserve every original word and explicit emoji 😀. A player's claim is not an authoritative inspection report. (https://example.test/averylongsegmentwithoutspaces${"x".repeat(45)}) should wrap safely. Do not crop the sentence.`,
    ).join("\n") + "\nFINAL LINE: The complete original text remains reachable.";
  add("repair-scroll-en", en, {}, "en", "all");
  for (const index of ROLE_IDS.keys()) {
    if (index % 12 !== 0) continue;
    const atlas = document();
    atlas.players = ROLE_IDS.slice(index, index + 12).map((id, seat) => ({
      player_id: seat + 1,
      role: id,
      camp: "good",
    }));
    atlas.events = [
      {
        seq: 1,
        timestamp: "t",
        day: 1,
        phase: "night",
        type: "phase_changed",
        payload: { phase: "night" },
      },
    ];
    add(`repair-role-atlas-${Math.floor(index / 12) + 1}`, atlas);
  }
  const metadata = document();
  for (const player of metadata.players) {
    player.name = `Very long player display name ${player.player_id}`;
    player.model = "Model Provider · optional metadata";
  }
  // 使用真实存在的长英文角色；不造角色ID，也不按camp选图。
  for (const player of metadata.players) player.role = "awakened_guard";
  metadata.events = [
    {
      seq: 1,
      timestamp: "t",
      day: 2,
      phase: "day",
      type: "day_speech",
      payload: { actorId: 2, text: "Explicit long metadata and mirrored HUD review fixture." },
    },
  ];
  metadata.factCoverage = { committedDeaths: 1 };
  metadata.facts = [
    {
      seq: 1,
      afterSeq: 0,
      kind: "life_committed",
      day: 2,
      playerId: 1,
      alive: false,
      causes: ["poison"],
    },
  ];
  add(
    "repair-long-metadata",
    metadata,
    { presentation: { showNames: true, showModels: true } },
    "en",
  );
  add(
    "repair-explicit-avatar",
    metadata,
    {
      presentation: {
        players: {
          "1": { avatarKey: "openai" },
          "2": { avatarKey: "neutral" },
          "3": { showAvatar: false },
        },
      },
    },
    "en",
  );
  const unknown = document();
  unknown.players[0]!.role = "unknown";
  unknown.events = [
    {
      seq: 1,
      timestamp: "t",
      day: 1,
      phase: "night",
      type: "phase_changed",
      payload: { phase: "night" },
    },
  ];
  add("repair-unknown-identity", unknown);
  const outcomes: Array<[string, GameOutcome]> = [
    ...(["good", "wolf", "third_party"] as const).map((faction): [string, GameOutcome] => [
      faction,
      {
        kind: "victory",
        primary: { kind: "faction", faction, winningPlayerIds: [1, 4] },
        additional: [],
        winningPlayerIds: [1, 4],
      },
    ]),
    [
      "individual",
      {
        kind: "victory",
        primary: { kind: "individual", playerId: 1, goalId: "survive", winningPlayerIds: [1] },
        additional: [],
        winningPlayerIds: [1],
      },
    ],
    [
      "relationship",
      {
        kind: "victory",
        primary: { kind: "relationship", groupId: "lovers", winningPlayerIds: [1, 2] },
        additional: [],
        winningPlayerIds: [1, 2],
      },
    ],
    ["no-winner", { kind: "no_winner" }],
  ];
  for (const [name, outcome] of outcomes)
    for (const theme of ["gothic-v1", "minimal-v1"] as const) {
      const game = document();
      const result = {
        winner:
          outcome.kind === "victory" && outcome.primary.kind === "faction"
            ? outcome.primary.faction
            : null,
        reason:
          name === "wolf"
            ? "wolves_reach_half"
            : name === "good"
              ? "all_wolves_eliminated"
              : name === "no-winner"
                ? "no_winner"
                : "goal_completed",
        outcome,
        decidedAt: { day: 3, phase: "day", checkpoint: "day_interrupted" },
      };
      game.result = result;
      game.events = [
        { seq: 1, timestamp: "t", day: 3, phase: "day", type: "game_over", payload: result },
      ];
      game.factCoverage = { committedDeaths: 1 };
      game.facts = [
        {
          seq: 1,
          afterSeq: 0,
          kind: "life_committed",
          day: 3,
          playerId: 1,
          alive: false,
          causes: ["poison"],
        },
      ];
      add(`repair-end-${name}-${theme}`, game, { theme: { id: theme } }, "zh-CN", "all");
    }
  const multi = document();
  for (const player of multi.players)
    player.name = `Long winner name ${player.player_id} with extra display words`;
  const outcome: GameOutcome = {
    kind: "victory",
    primary: { kind: "faction", faction: "good", winningPlayerIds: [1, 2, 3, 4, 5, 6] },
    additional: Array.from({ length: 10 }, (_, index) => ({
      kind: "relationship",
      groupId: `recorded-bond-${index + 1}`,
      winningPlayerIds: [1, 2],
    })),
    winningPlayerIds: [1, 2, 3, 4, 5, 6],
  };
  const multiResult = {
    winner: "good",
    reason: "all_wolves_eliminated",
    outcome,
    decidedAt: { day: 3, phase: "day", checkpoint: "day_interrupted" },
  };
  multi.result = multiResult;
  multi.events = [
    { seq: 1, timestamp: "t", day: 3, phase: "day", type: "game_over", payload: multiResult },
  ];
  add("repair-long-additional-outcomes", multi, { presentation: { showNames: true } }, "en", "all");
  return cases;
}
