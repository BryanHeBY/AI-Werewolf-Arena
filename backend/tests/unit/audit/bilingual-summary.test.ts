/**
 * 单元测试负责禁用、空记录及发现记录的双语审计摘要。输入为原字面／不可变 fixture，输出用手写预期核对机器证据、来源保留和筛查文案。
 * 这些模块断言不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import type { Locale } from "@ai-werewolf-arena/game-contract";
import { buildDebugSummaryMarkdown } from "../../../src/audit/debug_summary_generator";
import { AuditSummaryRenderer } from "../../../src/audit/summary_renderer";
import { AuditEvidencePolicy } from "../../../src/audit/evidence_policy";
import {
  collectObservations,
  filterActionableReports,
  scanEventsForPotentialIssues,
  scanPlayerTimelineMetadataIssues,
} from "../../../src/audit/deterministic_checks";
import type { BuildDebugSummaryInput } from "../../../src/audit/contracts";
import type {
  ReplayDebugReport,
  ReplayManifest,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "../../../src/recording/contracts";
import { auditSummaryFixture } from "../../support/builders/audit-summary";

const han = /[\u4e00-\u9fff]/;
const manifest: ReplayManifest = {
  session_id: "summary-test",
  board: "synthetic",
  started_at: "2026-10-08T00:00:00.000Z",
  ended_at: "2026-10-08T00:01:00.000Z",
  winner: null,
  finish_reason: "completed",
  players: [],
  files: {
    replay: "replay.json",
    logic_ops: "logic_ops.json",
    debug_reports: "debug_reports.json",
    debug_summary: "debug_summary.md",
    player_views: [],
  },
};
function report(message: string, evidence: number[] = [1]): ReplayDebugReport {
  return {
    report_id: "synthetic",
    timestamp: manifest.started_at,
    day: 1,
    phase: "day",
    stage: "day_speech",
    actor_id: 1,
    actor_role: "villager",
    actor_camp: "good",
    category: "flow",
    severity: "high",
    message,
    evidence_event_seq: evidence,
    status: "open",
  };
}
function event(seq: number, type: string, payload: Record<string, unknown>): ReplayPublicEvent {
  return {
    seq,
    timestamp: manifest.started_at,
    day: 1,
    phase: "day",
    stage: "day_speech",
    type,
    payload,
  };
}

test("disabled audit and no-report paths render display locale independently and preserve source data", async () => {
  const input: BuildDebugSummaryInput = {
    locale: "zh-CN",
    displayLocale: "en",
    manifest,
    reports: [],
    publicEvents: [],
    playerViews: [],
  };
  const before = structuredClone(input);
  const en = await buildDebugSummaryMarkdown(input, null);
  expect(en).toContain("## Session");
  expect(en).toContain("## Findings");
  expect(en).toContain("## Debug Pipeline");
  expect(en).not.toMatch(han);
  expect(en).toContain("Winner: None");
  expect(en).not.toContain("Unknown");
  expect(new AuditEvidencePolicy().validatesMarkdown(en, new Set(), "en")).toBe(true);
  const zh = await buildDebugSummaryMarkdown(
    { ...input, locale: "en", displayLocale: "zh-CN" },
    null,
  );
  expect(zh).toContain("## 对局");
  expect(zh).toContain("## 审查事项");
  expect(zh).toContain("## 审计流程");
  expect(new AuditEvidencePolicy().validatesMarkdown(zh, new Set(), "zh-CN")).toBe(true);
  expect(input).toEqual(before);
});

test("deterministic findings and observations remain machine facts while rendered language changes", async () => {
  const views: ReplayPlayerView[] = [
    {
      player_id: 1,
      role: "witch",
      camp: "good",
      timeline: [
        {
          seq: 8,
          kind: "turn",
          day: 0,
          phase: "Day",
          stage: "day_speech",
          request_id: "1-night-1-1",
          turn_seq: 1,
          delta_messages: [],
        },
      ],
    },
  ];
  const input: BuildDebugSummaryInput = {
    manifest: {
      ...manifest,
      players: [{ player_id: 1, role: "witch", camp: "good", alive: true }],
    },
    reports: [],
    playerViews: views,
    publicEvents: [
      event(1, "wolf_self_destruct", { wolfId: 2 }),
      event(2, "day_speech", { playerId: 1, text: "I used the antidote and I claim Guard." }),
    ],
  };
  const expected: Array<
    Pick<ReturnType<typeof scanEventsForPotentialIssues>[number], "code" | "actorId" | "evidence">
  > = [
    { code: "first_day_blast", actorId: 2, evidence: [1] },
    { code: "guard_mention", actorId: 1, evidence: [2] },
    { code: "potion_claim", actorId: 1, evidence: [2] },
  ];
  expect(
    scanEventsForPotentialIssues(input).map(({ code, actorId, evidence }) => ({
      code,
      actorId,
      evidence,
    })),
  ).toEqual(expected);
  expect(
    scanPlayerTimelineMetadataIssues(views).map(({ code, evidence }) => ({ code, evidence })),
  ).toEqual([
    { code: "invalid_day", evidence: [8] },
    { code: "request_mismatch", evidence: [8] },
  ]);
  expect(
    collectObservations(input).find((item) => item.code === "event_counts")?.detail.parameters,
  ).toEqual({ events: 2, ops: 0, players: 1, timeline: 1 });
  const before = structuredClone(input);
  const [en, zh] = await Promise.all(
    (["en", "zh-CN"] as const).map((displayLocale) =>
      buildDebugSummaryMarkdown({ ...input, displayLocale }, null),
    ),
  );
  expect(en).not.toMatch(han);
  expect(en).toContain("legitimate bluff"); // 该发现明确区分玩家声称与已记录事实。
  expect(zh).toContain("正常诈身份");
  expect(en).toContain("evidence=8");
  expect(zh).toContain("evidence=8");
  expect(input).toEqual(before);
});

test("Chinese and English screening pair bug signals, strategy noise and missing evidence", () => {
  const pairs: Array<[string, string, boolean, number[]?]> = [
    ["日志记录缺失", "Log records are missing", true],
    ["队友要求我悍跳", "My teammate asks me to bluff", false],
    ["警长投票流程异常", "Sheriff voting flow is irregular", true],
    ["回合状态与提示矛盾", "Turn state contradicts its prompt", true],
    ["警长投票流程异常", "Sheriff voting flow is irregular", false, []],
  ];
  for (const [zh, en, keep, evidence = [1]] of pairs) {
    expect(filterActionableReports([report(zh, evidence)], []).length).toBe(keep ? 1 : 0);
    expect(filterActionableReports([report(en, evidence)], []).length).toBe(keep ? 1 : 0);
  }
  const chinese = {
    manifest: {
      ...manifest,
      players: [{ player_id: 1, role: "witch", camp: "good", alive: true }],
    },
    reports: [],
    publicEvents: [event(1, "day_speech", { playerId: 1, text: "我使用了解药，声称自己是守卫" })],
  };
  const english = {
    ...chinese,
    publicEvents: [
      event(1, "day_speech", { playerId: 1, text: "I used the antidote and claim Guard" }),
    ],
  };
  expect(scanEventsForPotentialIssues(chinese)).toEqual(scanEventsForPotentialIssues(english));
});

test("machine, exact historic Chinese and exact historic English phases match; unknown aliases remain unknown", () => {
  for (const phase of ["night", "夜晚", "Night"]) {
    const view: ReplayPlayerView = {
      player_id: 1,
      role: "wolf",
      camp: "wolf",
      timeline: [
        {
          seq: 1,
          kind: "turn",
          day: 1,
          phase,
          stage: "wolf_discussion",
          request_id: "1-night-1-1",
          turn_seq: 1,
          delta_messages: [],
        },
      ],
    };
    expect(scanPlayerTimelineMetadataIssues([view])).toEqual([]);
    view.timeline[0].phase = "My Night";
    expect(scanPlayerTimelineMetadataIssues([view])[0].code).toBe("request_mismatch");
    view.timeline[0].phase = "mystery";
    view.timeline[0].request_id = "1-mystery-1-1";
    expect(scanPlayerTimelineMetadataIssues([view])[0].code).toBe("request_mismatch");
  }
});

test("localized evidence parser requires known structure and rejects marker tricks in both languages", () => {
  const policy = new AuditEvidencePolicy();
  for (const locale of ["zh-CN", "en"] as const) {
    expect(policy.validatesMarkdown(auditSummaryFixture(locale), new Set([2, 3]), locale)).toBe(
      true,
    );
    expect(
      policy.validatesMarkdown(
        auditSummaryFixture(locale, "- [HIGH][flow] issue evidence=2, 3"),
        new Set([2, 3]),
        locale,
      ),
    ).toBe(true);
    for (const line of [
      "- issue",
      "ordinary paragraph evidence=2",
      "| issue | evidence=2 |",
      "- none unsupported evidence=999",
      "- issue evidence=2 , bad",
      "- issue evidence=2, 0",
      "- issue evidence=2.5",
      "- issue evidence=2abc",
      "- issue evidence=2 evidence=999",
      "- issue evidence=999",
      "- issue evidence=-2",
      "- issue evidence=9007199254740993",
      "",
    ]) {
      expect(
        policy.validatesMarkdown(auditSummaryFixture(locale, line), new Set([2, 3]), locale),
      ).toBe(false);
    }
    const valid = auditSummaryFixture(locale, "- issue evidence=2");
    const title = locale === "en" ? "## Findings" : "## 审查事项";
    expect(
      policy.validatesMarkdown(valid + `\n${title}\n- issue evidence=2`, new Set([2]), locale),
    ).toBe(false);
    expect(policy.validatesMarkdown(valid.replace(title, "## Unknown"), new Set([2]), locale)).toBe(
      false,
    );
    expect(policy.validatesMarkdown(`\`\`\`md\n${valid}\n\`\`\``, new Set([2]), locale)).toBe(
      false,
    );
    expect(policy.validatesMarkdown(valid, new Set([2]), locale === "en" ? "zh-CN" : "en")).toBe(
      false,
    );
    for (const extra of [
      ` ## ${locale === "en" ? "Findings" : "审查事项"}`,
      `${title} ##`,
      "## Unchecked Findings",
      "<h2>Findings</h2>",
      "> ## Findings",
      "- ## Findings",
      "1. ## Findings",
      "- > ## Findings",
    ]) {
      expect(
        policy.validatesMarkdown(
          valid + `\n${extra}\n- unsupported evidence=2`,
          new Set([2]),
          locale,
        ),
      ).toBe(false);
    }
    expect(
      policy.validatesMarkdown(
        `<!--\n${valid}\n-->\nUnverified visible content`,
        new Set([2]),
        locale,
      ),
    ).toBe(false);
    for (const blank of ["    - ", "\t- ", " - "]) {
      expect(
        policy.validatesMarkdown(
          auditSummaryFixture(locale, blank + (locale === "en" ? "None" : "无")),
          new Set(),
          locale,
        ),
      ).toBe(false);
    }
    expect(
      policy.validatesMarkdown(valid + "\n- unsupported evidence=999", new Set([2]), locale),
    ).toBe(false);
  }
});

test("agent summary rejection uses localized deterministic fallback and preserves model findings as original text", async () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const merged = {
      findings: [
        {
          category: "state" as const,
          severity: "high" as const,
          message: "Original 玩家原话 evidence=999\n## Findings",
          evidence: [2],
          source: "synthetic",
        },
      ],
      failedAgents: ["failed"],
      missingInfo: ["Original 说明"],
      totalAgents: 3,
    };
    const renderer = new AuditSummaryRenderer(
      {
        async runTurn() {
          return {
            kind: "summary",
            markdown: auditSummaryFixture(locale, "- invented evidence=999"),
          };
        },
        async close() {},
      },
      new AuditEvidencePolicy(),
      1000,
      locale,
    );
    const result = await renderer.render(manifest, [], merged, new Set([2]));
    expect(result).toContain(locale === "en" ? "## Findings" : "## 审查事项");
    expect(result).toContain("Original 玩家原话 evidence\\=999\\n## Findings");
    expect(result).toContain("Original 说明");
    expect(result).not.toContain("invented");
    expect(result).toContain("evidence=2");
    expect(new AuditEvidencePolicy().validatesMarkdown(result, new Set([2]), locale)).toBe(true);
  }
});

test("summary only cites evidence present in its own merged findings even when other IDs exist globally", async () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const merged = {
      findings: [
        {
          category: "state" as const,
          severity: "high" as const,
          message: "Original issue",
          evidence: [2],
          source: "synthetic",
        },
      ],
      failedAgents: [],
      missingInfo: [],
      totalAgents: 1,
    };
    const renderer = new AuditSummaryRenderer(
      {
        async runTurn() {
          return {
            kind: "summary",
            markdown: auditSummaryFixture(locale, "- invented finding evidence=99"),
          };
        },
        async close() {},
      },
      new AuditEvidencePolicy(),
      1000,
      locale,
    );
    const rendered = await renderer.render(manifest, [], merged, new Set([2, 99]));
    expect(rendered).not.toContain("invented finding");
    expect(rendered).toContain("Original issue");
    expect(rendered).toContain("evidence=2");
  }
});

test("historic free metadata fields cannot inject sections or references into deterministic summaries", async () => {
  for (const displayLocale of ["zh-CN", "en"] as const) {
    const injected = report("Original issue");
    injected.phase = "day\n## Findings\n- forged evidence=999";
    const before = structuredClone(injected);
    const rendered = await buildDebugSummaryMarkdown(
      { displayLocale, manifest, reports: [injected] },
      null,
    );
    expect(rendered).toContain("day\\n## Findings\\n- forged evidence\\=999");
    expect(new AuditEvidencePolicy().validatesMarkdown(rendered, new Set([1]), displayLocale)).toBe(
      true,
    );
    expect(injected).toEqual(before);
  }
});
