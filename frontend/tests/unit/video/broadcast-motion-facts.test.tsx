/**
 * 单元组件测试负责核对有限动效、报告分支和权威落点在真实广播宿主中的边界。输入为手写事件/事实及整数帧，输出独立字面DOM断言。
 * 不调用规则或远程素材，不以当前玩家身份生成报告预期；图片解码与真实排版另由实际PNG/浏览器验收。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { VideoFrame } from "../../../src/video/VideoComposition";
import { BroadcastVideoFrame } from "../../../src/video/BroadcastVideoFrame";
import { SceneHero, SceneConnector, sceneArt } from "../../../src/video/SceneVisual";
import { sceneMotion } from "../../../src/video/scene-motion";
import { resolveTheme, type ResolvedTheme } from "../../../src/themes";
import { VideoLayers } from "../../../src/video/VideoLayers";
import { buildVideoFrame } from "../../../src/video/frame";
import type {
  VideoScene,
  VideoScript,
  VideoVisualIntent,
  VideoVisualReport,
} from "../../../src/video/types";

const cues = { establish: 0, travel: 8, impact: 24, settled: 40 };
const source = { eventSeqs: [1], factSeqs: [] };
function intent(extra: Partial<VideoVisualIntent> = {}): VideoVisualIntent {
  return {
    family: "inspection_camp",
    template: "inspection_camp/recorded_report_reveal",
    process: "reported",
    actorId: 2,
    requestedTargetIds: [1],
    effectiveTargetIds: [],
    recipientIds: [2],
    source,
    ...extra,
  };
}
function scene(visual = intent()): VideoScene {
  return {
    kind: "action",
    title: "Report",
    body: "Independent report",
    bodySource: "event",
    actorId: 2,
    targetIds: [1],
    emphasis: [],
    cues,
    visual,
  };
}
function hero(report: VideoVisualReport, frame = 24) {
  return renderToStaticMarkup(
    <SceneHero
      scene={scene(intent({ report }))}
      frame={frame}
      size={410}
      theme={resolveTheme()}
      gothic
      color="#d7e5ec"
    />,
  );
}
function document(): ReplayDocument {
  return {
    schemaVersion: 2,
    sessionId: "motion",
    perspective: "god",
    meta: { board: "motion", locale: "zh-CN", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, i) => ({
      player_id: i + 1,
      role: i === 0 ? "wolf" : "villager",
      camp: i === 0 ? "wolf" : "good",
    })),
    events: [],
  };
}
function video(doc: ReplayDocument, options: Omit<VideoScript, "source"> = {}) {
  return compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    ...options,
  });
}

test("motion has no future report pulse and freezes all art values after settled, including reverse seek", () => {
  expect(sceneMotion(23, cues).revealed).toBe(false);
  expect(sceneMotion(23, cues).impactOpacity).toBe(0);
  expect(sceneMotion(24, cues).revealed).toBe(true);
  expect(sceneMotion(30, cues).impactOpacity).toBeCloseTo(0.22);
  const last = sceneMotion(40, cues);
  expect(last).toEqual({
    revealed: true,
    stopped: true,
    opacity: 1,
    enterY: 0,
    pathProgress: 1,
    impactOpacity: 0,
  });
  expect(sceneMotion(500, cues)).toEqual(last);
  sceneMotion(2, cues);
  expect(sceneMotion(40, cues)).toEqual(last);
});

test("late impact and reduced motion keep exact reveal while removing movement", () => {
  const late = { establish: 0, travel: 8, impact: 100, settled: 116 };
  expect(sceneMotion(99, late).revealed).toBe(false);
  expect(sceneMotion(100, late).revealed).toBe(true);
  expect(sceneMotion(116, late)).toEqual(sceneMotion(1000, late));
  expect(sceneMotion(23, cues, { reduced: true })).toEqual({
    revealed: false,
    stopped: false,
    opacity: 1,
    enterY: 0,
    pathProgress: 0,
    impactOpacity: 0,
  });
  expect(sceneMotion(24, cues, { reduced: true }).pathProgress).toBe(1);
  expect(sceneMotion(24, cues, { reduced: true }).impactOpacity).toBe(0);
});

test("the actual claw artwork is static after settled and reduced motion reveals it without a wipe", () => {
  const value = scene(
    intent({
      family: "pack_attack",
      template: "pack_attack/wolf_knife_committed",
      process: "used",
      report: undefined,
    }),
  );
  const render = (frame: number, reduced = false) =>
    renderToStaticMarkup(
      <SceneHero
        scene={value}
        frame={frame}
        size={410}
        theme={resolveTheme({ id: "gothic-v1", options: { reducedMotion: reduced } })}
        gothic
        color="#c48186"
      />,
    );
  expect(render(40)).toBe(render(500));
  expect(render(24).includes("clip-path:inset(0 90% 0 0)")).toBe(true);
  expect(render(24, true).includes("clip-path:inset(0 0% 0 0)")).toBe(true);
  expect(render(24, true).includes("data-impact-envelope")).toBe(false);
});

test("wolf, good, third party, role and unknown reports have distinct impact-only artwork", () => {
  expect(hero({ kind: "camp", camp: "wolf" }, 23).includes("data-report-seal")).toBe(false);
  const wolf = hero({ kind: "camp", camp: "wolf" });
  const good = hero({ kind: "camp", camp: "good" });
  const third = hero({ kind: "camp", camp: "third_party" });
  const role = hero({ kind: "role", roleId: "witch" });
  const unknown = hero({ kind: "unknown", reason: "not_recorded" });
  expect(wolf.includes('data-gothic-skill-art="blood-wolf-claw"')).toBe(true);
  expect(good.includes("blood-wolf-claw")).toBe(false);
  expect(good.includes('data-gothic-skill-art="report-silver-seal"')).toBe(true);
  expect(third.includes('data-gothic-skill-art="report-eclipse-seal"')).toBe(true);
  expect(third.includes('data-gothic-skill-art="report-silver-seal"')).toBe(false);
  expect(role.includes('data-role-crest="witch"')).toBe(true);
  expect(role.includes("report-silver-seal")).toBe(false);
  expect(role.includes("report-eclipse-seal")).toBe(false);
  expect(role.includes('data-report-role-medallion="true"')).toBe(true);
  const roleSize = Number(role.match(/<svg width="([^"]+)"[^>]+data-role-crest="witch"/)?.[1]);
  expect(roleSize).toBeGreaterThanOrEqual(40);
  expect(roleSize).toBeLessThanOrEqual(48);
  expect(unknown.includes('data-report-seal="unknown"')).toBe(true);
  expect(unknown.includes("blood-wolf-claw")).toBe(false);
});

test("pair inspection produces one aggregate seal without identifying either target as the wolf", () => {
  const positive = hero({ kind: "pair", targetIds: [3, 9], containsWerewolf: true });
  const negative = hero({ kind: "pair", targetIds: [3, 9], containsWerewolf: false });
  expect(positive.match(/data-aggregate-pair-seal/g)).toHaveLength(1);
  expect(positive.includes('data-pair-result="true"')).toBe(true);
  expect(negative.includes('data-pair-result="false"')).toBe(true);
  // 整组不含狼人仍可能含第三方，不能借用好人／第三方阵营封印。
  expect(negative.includes("report-silver-seal")).toBe(false);
  expect(negative.includes("report-eclipse-seal")).toBe(false);
  expect(negative.includes("blood-wolf-claw")).toBe(false);
  expect(positive.includes("data-composition-player")).toBe(false);
  expect(positive.includes("data-role-crest")).toBe(false);
});

test("explicit death tools and demon hunt keep their own art while an ambiguous blocked action stays neutral", () => {
  const action = (extra: Partial<VideoVisualIntent>) =>
    scene(
      intent({
        family: "death_action",
        template: "death_action/recorded_resolution",
        process: "resolved",
        ...extra,
      }),
    );
  expect(sceneArt(action({ deathTool: "gun" }))).toBe("flintlock");
  expect(sceneArt(action({ deathTool: "claw" }))).toBe("blood-wolf-claw");
  expect(sceneArt(action({ deathTool: "patrol" }))).toBe("oath-contract");
  expect(sceneArt(action({ deathTool: "retaliation" }))).toBe("beast-totem");
  expect(sceneArt(action({ process: "blocked" }))).toBe("record");
  expect(
    sceneArt(
      scene(
        intent({
          family: "duel",
          template: "duel/recorded_choice",
          duelKind: "demon_hunter",
          process: "choice",
        }),
      ),
    ),
  ).toBe("demon-crossbow");
  expect(
    sceneArt(
      scene(
        intent({
          family: "reflection",
          template: "reflection/committed_effect_not_automatic_death",
          process: "choice",
        }),
      ),
    ),
  ).toBe("clock-lock");
});

for (const [type, family, role] of [
  ["wolf_king_shot", "pack_attack", "wolf_king"],
  ["mechanical_shot", "copy_resource", "mechanical_wolf"],
] as const)
  test(`${type} consumes its explicit gun tool without replacing its mechanism family`, () => {
    const doc = document();
    doc.players[1]!.role = role;
    doc.players[1]!.camp = "wolf";
    doc.events = [
      {
        seq: 1,
        type,
        timestamp: "2026-10-17T00:00:00Z",
        day: 1,
        phase: "night",
        payload: { actorId: 2, targetId: 3, day: 1 },
      },
    ];
    const plan = video(doc);
    expect(plan.shots[0]!.scene.visual!.family).toBe(family);
    expect(plan.shots[0]!.scene.visual!.deathTool).toBe("gun");
    const html = renderToStaticMarkup(<VideoFrame plan={plan} frame={24} />);
    expect(html).toContain(`data-visual-family="${family}"`);
    expect(html).toContain('data-scene-hero="flintlock"');
    expect(html).not.toContain('data-gothic-skill-art="blood-wolf-claw"');
    expect(html).not.toContain('data-gothic-skill-art="sealed-grimoire"');
    expect(html).not.toContain('data-role-crest="hunter"');
  });

test("selection paths retain pixel dashes and do not normalize them to the full path length", () => {
  const visual = intent({
    family: "pack_attack",
    template: "pack_attack/recorded_individual_choice",
    process: "choice",
    recipientIds: [],
  });
  const html = renderToStaticMarkup(
    <SceneConnector
      intent={visual}
      scene={scene(visual)}
      frame={40}
      width={1132.8}
      height={837}
      scale={1}
      theme={resolveTheme()}
      color="#b67c83"
    />,
  );
  expect(html.includes('data-connection-state="choice"')).toBe(true);
  expect(html.includes('stroke-dasharray="6 6"')).toBe(true);
  expect(html.includes("pathLength")).toBe(false);
  expect(sceneArt(scene(visual))).toBe("oath-contract");
});

test("a report without a matching feedback recipient does not invent a return arrow to the actor", () => {
  const visual = intent({ report: { kind: "camp", camp: "good" }, recipientIds: [7] });
  const html = renderToStaticMarkup(
    <SceneConnector
      intent={visual}
      scene={scene(visual)}
      frame={40}
      width={1132.8}
      height={837}
      scale={1}
      theme={resolveTheme()}
      color="#b67c83"
    />,
  );
  expect(html).toBe("");
});

test("authoritative empty knife target is shown as empty after impact, preserving only a separate request record", () => {
  const doc = document();
  doc.factCoverage = { committedDeaths: 1 };
  doc.facts = [
    {
      seq: 1,
      afterSeq: 0,
      day: 1,
      kind: "wolf_knife_committed",
      requestedTargetId: 3,
      effectiveTargetId: null,
      participantIds: [1],
    },
  ];
  const plan = video(doc);
  const before = renderToStaticMarkup(<VideoFrame plan={plan} frame={23} />);
  const after = renderToStaticMarkup(<VideoFrame plan={plan} frame={24} />);
  expect(before.includes('data-target-kind="requested"')).toBe(true);
  expect(before.includes("data-action-no-target")).toBe(false);
  expect(before.includes("对局准备")).toBe(true);
  expect(after.includes("data-action-no-target")).toBe(true);
  expect(after.includes("对局准备")).toBe(false);
  expect(after.includes('data-requested-targets="3"')).toBe(true);
  expect(after.includes('data-target-kind="effective"')).toBe(false);
  expect(after.includes("data-scene-connector")).toBe(false);
  expect(after.match(/data-player-alive="true"/g)).toHaveLength(12);
});

test("a good inspection report does not inherit the inspected player's actual wolf identity", () => {
  const doc = document();
  doc.events = [
    {
      seq: 1,
      type: "seer_checked",
      timestamp: "2026-10-17T00:00:00Z",
      day: 1,
      phase: "night",
      payload: {
        actorId: 2,
        targetId: 1,
        result: { kind: "camp", camp: "good" },
        isWerewolf: false,
      },
    },
  ];
  const plan = video(doc);
  const before = renderToStaticMarkup(<VideoFrame plan={plan} frame={23} />);
  const after = renderToStaticMarkup(<VideoFrame plan={plan} frame={24} />);
  expect(before.includes("data-report-seal")).toBe(false);
  expect(after.includes('data-report-camp="good"')).toBe(true);
  expect(after.includes('data-gothic-skill-art="blood-wolf-claw"')).toBe(false);
  expect(after.includes('data-player-alive="false"')).toBe(false);
  expect(after.includes("background:transparent")).toBe(true);
  expect(after.includes("color:#efeade")).toBe(true);
});

test("guard-heal cancellation and blocked wolf damage use separate artwork without committing death", () => {
  const cancelled = scene(
    intent({
      family: "protection",
      template: "protection/night_protection_resolved",
      process: "resolved",
      report: undefined,
      protection: { interaction: "guard_heal_cancelled" },
    }),
  );
  const blocked = scene(
    intent({
      family: "protection",
      template: "protection/night_protection_resolved",
      process: "blocked",
      report: undefined,
      protection: { interaction: "wolf_attack_blocked", kind: "guard" },
    }),
  );
  const render = (value: VideoScene, frame: number) =>
    renderToStaticMarkup(
      <SceneHero
        scene={value}
        frame={frame}
        size={410}
        theme={resolveTheme()}
        gothic
        color="#d7e5ec"
      />,
    );
  expect(render(cancelled, 23).includes("data-protection-interaction")).toBe(false);
  expect(render(cancelled, 23).includes("data-protection-pair")).toBe(false);
  expect(render(cancelled, 24).includes("data-protection-pair")).toBe(true);
  expect(render(cancelled, 24).includes('data-gothic-skill-art="iron-ward"')).toBe(true);
  expect(render(cancelled, 24).includes('data-gothic-skill-art="heal"')).toBe(true);
  expect(render(blocked, 24).includes('data-gothic-skill-art="heal"')).toBe(false);
  expect(render(cancelled, 24).includes('data-protection-interaction="guard_heal_cancelled"')).toBe(
    true,
  );
  expect(render(blocked, 24).includes('data-protection-interaction="wolf_attack_blocked"')).toBe(
    true,
  );
  expect(render(cancelled, 24).includes("data-player-alive")).toBe(false);
  const healed = scene({
    ...blocked.visual!,
    protection: { interaction: "wolf_attack_blocked", kind: "heal" },
  });
  expect(render(healed, 24).includes('data-gothic-skill-art="heal"')).toBe(true);
  expect(render(healed, 24).includes('data-gothic-skill-art="iron-ward"')).toBe(false);
});

test("30/60fps corresponding physical instants share finite pulse and claw envelopes", () => {
  const twice = { establish: 0, travel: 16, impact: 48, settled: 80 };
  for (const frame of [0, 4, 8, 20, 24, 27, 30, 36, 40, 90]) {
    expect(sceneMotion(frame, cues)).toEqual(sceneMotion(frame * 2, twice));
  }
  const visual = intent({
    family: "pack_attack",
    template: "pack_attack/wolf_knife_committed",
    process: "used",
  });
  const render = (frame: number, double: boolean) =>
    renderToStaticMarkup(
      <SceneHero
        scene={{ ...scene(visual), cues: double ? twice : cues }}
        frame={frame}
        size={410}
        theme={resolveTheme()}
        gothic
        color="#c48186"
      />,
    );
  for (const frame of [24, 25, 29, 33, 40]) {
    expect(render(frame, false)).toBe(render(frame * 2, true));
  }
});

test("an actor-only editorial note never relabels recorded speech or its footer source", () => {
  const doc = document();
  doc.events = [
    {
      seq: 1,
      type: "day_speech",
      timestamp: "2026-10-17T00:00:00Z",
      day: 1,
      phase: "day",
      payload: { actorId: 2, text: "这是二号的原话。" },
    },
  ];
  const plan = video(doc, {
    edits: [{ anchor: { seq: 1, type: "day_speech" }, scene: { actorId: 12 } }],
  });
  const html = renderToStaticMarkup(<VideoFrame plan={plan} frame={0} />);
  expect(html).toContain('data-speech-speaker="2"');
  expect(html).toContain('data-editorial-actor="12"');
  expect(html).toContain("这是二号的原话。");
  const footer = html.match(/data-testid="composition-event"[^>]*>([^<]*)<\/span>/)?.[1];
  expect(footer).toBe("当前发言 · 2号");
  expect(footer).not.toContain("12号");
});

test("inventory prose and pre-impact waiting each appear once without hiding authored text", () => {
  const doc = document();
  doc.factCoverage = { committedDeaths: 1 };
  doc.facts = [
    {
      seq: 1,
      afterSeq: 0,
      day: 1,
      kind: "potion_stock",
      actorId: 2,
      abilityId: "witch-potions",
      heal: 0,
      poison: 1,
    },
  ];
  const plan = video(doc);
  const before = renderToStaticMarkup(<VideoFrame plan={plan} frame={23} />);
  const after = renderToStaticMarkup(<VideoFrame plan={plan} frame={24} />);
  expect(before.match(/等待结果揭晓/g)).toHaveLength(1);
  expect(before).not.toContain("解药 0");
  expect(after.match(/解药 0/g)).toHaveLength(1);
  expect(after.match(/毒药 1/g)).toHaveLength(1);
  expect(after).not.toContain("data-scene-stock");
  const authored = video(doc, {
    factEdits: [{ anchor: { seq: 1, kind: "potion_stock" }, caption: "作者的独立说明" }],
  });
  const edited = renderToStaticMarkup(<VideoFrame plan={authored} frame={24} />);
  expect(edited).toContain("作者的独立说明");
  expect(edited).toContain('data-stock-ability="witch-potions"');
  expect(edited).toContain("解药 0 · 毒药 1");
});

test("a long recorded victory point shares the bounded source footer rather than a separate absolute overlay", () => {
  const doc = document();
  doc.events = [
    {
      seq: 1,
      type: "game_over",
      timestamp: "2026-10-17T00:00:00Z",
      day: 2,
      phase: "day",
      stage: "additional_deaths",
      payload: {
        winner: "wolf",
        reason: "recorded_win",
        outcome: {
          kind: "victory",
          primary: { kind: "faction", faction: "wolf", winningPlayerIds: [1] },
          additional: [],
          winningPlayerIds: [1],
        },
        decidedAt: { day: 2, phase: "day", checkpoint: "night_settled" },
      },
    },
  ];
  const plan = video(doc);
  const html = renderToStaticMarkup(<VideoFrame plan={plan} frame={24} />);
  const footer = html.match(/data-testid="composition-caption"[\s\S]*?<\/div>/)?.[0];
  expect(footer).toContain('data-testid="composition-victory"');
  expect(footer).toContain("第2日");
  expect(footer).toContain("grid-template-columns:minmax(0,1fr) max-content");
  expect(html.match(/data-testid="composition-victory"/g)).toHaveLength(1);
  expect(html).not.toContain('data-testid="composition-victory" style="position:absolute');
});

test("explicit editorial targets remain separate from real report targets and original speech authors", () => {
  const doc = document();
  doc.events = [
    {
      seq: 1,
      type: "seer_checked",
      timestamp: "2026-10-17T00:00:00Z",
      day: 1,
      phase: "night",
      payload: {
        actorId: 2,
        targetId: 1,
        result: { kind: "camp", camp: "wolf" },
        isWerewolf: true,
      },
    },
  ];
  const plan = video(doc, {
    edits: [{ anchor: { seq: 1, type: "seer_checked" }, scene: { targetIds: [9] } }],
  });
  const html = renderToStaticMarkup(<VideoFrame plan={plan} frame={24} />);
  expect(html.includes('data-editorial-targets="9"')).toBe(true);
  expect(plan.shots[0]!.scene.visual!.requestedTargetIds).toEqual([1]);
  expect(plan.shots[0]!.scene.editorial).toEqual({ targetIds: [9] });
});

test("an independently handwritten old prepared theme renders through VideoFrame and standalone layers without mutation", () => {
  const doc = document();
  doc.events = [
    {
      seq: 1,
      type: "day_speech",
      timestamp: "2026-10-17T00:00:00Z",
      day: 1,
      phase: "day",
      payload: { actorId: 2, text: "Archived words." },
    },
  ];
  const plan = video(doc);
  // 手写旧字段，不用新版resolveTheme删字段生成预期；该快照没有任何新token。
  plan.theme = {
    id: "gothic-v1",
    definition: {
      id: "gothic-v1",
      version: 1,
      label: { "zh-CN": "OLD", en: "OLD" },
      palette: { day: { canvas: "#123456" }, night: { canvas: "#654321" } },
      fonts: { body: "Archived Body", heading: "Archived Heading", mono: "Archived Mono" },
      radii: { panel: 4, card: 2 },
      motion: { durationMs: 321, cameraFrames: 17 },
      options: { paperTexture: { type: "boolean", default: false } },
      slots: { background: "archive/background", frame: "archive/frame" },
    },
    options: { paperTexture: false },
  } as unknown as ResolvedTheme;
  plan.shots[0]!.layers.push({
    id: "old-note",
    kind: "text",
    text: "OLD LAYER",
    from: 0,
    durationFrames: 90,
    space: "screen",
    zIndex: 1,
  });
  const before = JSON.stringify(plan);
  const html = renderToStaticMarkup(<VideoFrame plan={plan} frame={0} />);
  const direct = renderToStaticMarkup(<BroadcastVideoFrame plan={plan} frame={0} />);
  const layers = renderToStaticMarkup(
    <VideoLayers plan={plan} view={buildVideoFrame(plan, 0)} space="screen" />,
  );
  expect(html.includes("Archived Body")).toBe(true);
  expect(direct.includes("Archived Body")).toBe(true);
  expect(direct.includes("Archived words.")).toBe(true);
  expect(html.includes("Archived words.")).toBe(true);
  expect(html.includes("font-size:42px")).toBe(true);
  expect(layers.includes("OLD LAYER")).toBe(true);
  expect(layers.includes("color:#efeade")).toBe(true);
  expect(JSON.stringify(plan)).toBe(before);
  expect(plan.theme.definition.typography).toBeUndefined();
});
