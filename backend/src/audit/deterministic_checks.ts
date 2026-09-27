/** Deterministic observations and report screening for one recorded game. */
import type { ReplayDebugReport, ReplayPlayerView, ReplayPublicEvent } from "../recording/contracts";
import type { BuildDebugSummaryInput, DeterministicFinding, SummaryObservation } from "./contracts";

/** request_id 使用机器 phase 名，玩家时间线展示本地化 phase 名。 */
const REQUEST_PHASE_DISPLAY_NAME: Record<string, string> = {
  night: "夜晚",
  day: "白天",
  voting: "投票",
  game_over: "终局",
};

function requestPhaseMatchesTimelinePhase(requestPhase: string, timelinePhase: string): boolean {
  return (
    requestPhase === timelinePhase ||
    REQUEST_PHASE_DISPLAY_NAME[requestPhase] === timelinePhase
  );
}

export function collectObservations(input: BuildDebugSummaryInput): SummaryObservation[] {
  const events = input.publicEvents ?? [];
  const ops = input.logicOps ?? [];
  const views = input.playerViews ?? [];
  const observations: SummaryObservation[] = [];

  const timelineEntries = views.reduce((acc, view) => acc + view.timeline.length, 0);
  const selfDestructCount = events.filter((e) => e.type === "wolf_self_destruct").length;
  const hunterShotCount = events.filter((e) => e.type === "hunter_shot").length;
  const nightResolvedCount = events.filter((e) => e.type === "night_resolved").length;

  const mismatchSeqs: number[] = [];
  const invalidDaySeqs: number[] = [];
  let fallbackCount = 0;
  let toolRejectedCount = 0;
  for (const view of views) {
    for (const entry of view.timeline) {
      if (entry.kind !== "turn") {
        continue;
      }
      if (typeof entry.day !== "number" || entry.day <= 0) {
        invalidDaySeqs.push(entry.seq);
      }
      const requestId = String(entry.request_id ?? "");
      const match = requestId.match(/^(\d+)-([a-z_]+)-/i);
      if (match) {
        const reqDay = Number(match[1]);
        const reqPhase = match[2];
        if (reqDay !== entry.day || !requestPhaseMatchesTimelinePhase(reqPhase, entry.phase)) {
          mismatchSeqs.push(entry.seq);
        }
      }
      if (entry.delta_messages.some((item) => item.kind === "fallback")) {
        fallbackCount += 1;
      }
      if (
        entry.delta_messages.some(
          (item) => item.kind === "constraint_warning" || item.kind === "retry_prompt",
        )
      ) {
        toolRejectedCount += 1;
      }
      if (
        entry.delta_messages.some(
          (item) => item.kind === "tool_call" && item.accepted === false,
        )
      ) {
        toolRejectedCount += 1;
      }
    }
  }

  observations.push({
    title: "对局事件规模",
    detail: `public_events=${events.length}, logic_ops=${ops.length}, player_views=${views.length}, timeline_entries=${timelineEntries}`,
  });
  observations.push({
    title: "关键流程计数",
    detail: `night_resolved=${nightResolvedCount}, wolf_self_destruct=${selfDestructCount}, hunter_shot=${hunterShotCount}`,
  });
  observations.push({
    title: "动作稳定性",
    detail: `tool_rejected=${toolRejectedCount}, fallback=${fallbackCount}`,
  });

  if (invalidDaySeqs.length > 0) {
    observations.push({
      title: "元数据异常",
      detail: `发现 day<=0 的行动条目 ${invalidDaySeqs.length} 条`,
      evidence: invalidDaySeqs.slice(0, 10),
    });
  }
  if (mismatchSeqs.length > 0) {
    observations.push({
      title: "请求编号异常",
      detail: `发现 request_id 与 day/phase 不一致条目 ${mismatchSeqs.length} 条`,
      evidence: mismatchSeqs.slice(0, 10),
    });
  }

  return observations;
}
export function filterActionableReports(
  reports: ReplayDebugReport[],
  publicEvents: ReplayPublicEvent[],
): ReplayDebugReport[] {
  return reports.filter((report) =>
    isActionableReport(report, publicEvents),
  );
}

function isActionableReport(
  report: ReplayDebugReport,
  publicEvents: ReplayPublicEvent[],
): boolean {
  const message = report.message;
  const category = report.category;
  const text = String(message ?? "").trim();
  if (!text) {
    return false;
  }
  const hasEvidenceSeq = Array.isArray(report.evidence_event_seq) && report.evidence_event_seq.length > 0;

  const hardBugSignal =
    /(日志|广播|顺序|重复|缺失|未(触发|执行|生效|公布|记录|结算)|跳过|死后|出局后|仍然发言|工具.*调用|调用.*失败|报错|error|timeout|fallback|不一致|越权|空守|弃票|没(有)?(公布|记录|触发|执行|生效))/i;
  if (hardBugSignal.test(text) && (hasEvidenceSeq || detectFlowAnomaly(publicEvents))) {
    return true;
  }

  const strategyNoise =
    /(狼队|队友|悍跳|金水|查验|站边|刀口|带队|配合|盘逻辑|好人阵营|狼人阵营|局势对.*(有利|不利)|报假查验)/i;
  if (strategyNoise.test(text)) {
    return false;
  }

  const softActionableSignal =
    /(流程|阶段|票型|投票|放逐|遗言|警长|上警|退水)/i;
  if (softActionableSignal.test(text)) {
    return (
      hasEvidenceSeq ||
      ((category === "flow" || category === "rule" || category === "logging") &&
        detectFlowAnomaly(publicEvents))
    );
  }

  // 规则/流程类分类在无明显噪声时默认保留，避免漏掉简短上报。
  return (
    hasEvidenceSeq &&
    (category === "flow" || category === "rule" || category === "logging")
  );
}

function detectFlowAnomaly(events: ReplayPublicEvent[]): boolean {
  if (events.length === 0) {
    return false;
  }
  const phaseChanged = events.filter((e) => e.type === "phase_changed");
  const allowed = new Set([
    "night->day:0",
    "day->voting:0",
    "day->night:1",
    "voting->night:1",
    "night->game_over:0",
    "day->game_over:0",
    "voting->game_over:0",
  ]);
  for (let i = 1; i < phaseChanged.length; i++) {
    const prev = phaseChanged[i - 1];
    const curr = phaseChanged[i];
    const key = `${String(prev.payload.phase ?? prev.phase)}->${String(curr.payload.phase ?? curr.phase)}:${Number(curr.day) - Number(prev.day)}`;
    if (!allowed.has(key)) {
      return true;
    }
  }

  const firstDaySpeechByDay = new Map<number, number>();
  const nightResolvedByDay = new Set<number>();
  for (const e of events) {
    if (e.type === "night_resolved") {
      nightResolvedByDay.add(Number(e.day));
    }
    if (e.type === "day_speech" && !firstDaySpeechByDay.has(Number(e.day))) {
      firstDaySpeechByDay.set(Number(e.day), Number(e.seq));
    }
  }
  for (const [day] of firstDaySpeechByDay.entries()) {
    if (day <= 1) {
      continue;
    }
    if (!nightResolvedByDay.has(day)) {
      return true;
    }
  }
  return false;
}

export function scanEventsForPotentialIssues(input: BuildDebugSummaryInput): DeterministicFinding[] {
  const events = input.publicEvents ?? [];
  const findings: DeterministicFinding[] = [];

  const selfDestruct = events.filter((e) => e.type === "wolf_self_destruct");
  for (const e of selfDestruct) {
    if (e.day === 1) {
      findings.push({
        severity: "medium",
        category: "rule",
        day: e.day,
        phase: e.phase,
        actorId: Number((e.payload as any).wolfId ?? 0),
        message: "首日出现狼人自爆，建议核查自爆窗口策略配置是否符合预期。",
        evidence: [e.seq],
      });
    }
  }

  const hasGuardRole = input.manifest.players.some((p) => p.role === "guard");
  if (!hasGuardRole) {
    const guardMentions = events.filter(
      (e) =>
        (e.type === "day_speech" || e.type === "last_words_spoken") &&
        /守卫/.test(String((e.payload as any).text ?? "")),
    );
    if (guardMentions.length > 0) {
      findings.push({
        severity: "low",
        category: "state",
        day: guardMentions[0].day,
        phase: guardMentions[0].phase,
        actorId: Number((guardMentions[0].payload as any).actorId ?? (guardMentions[0].payload as any).playerId ?? 0),
        message: "本局板子无守卫，但发言中出现守卫相关断言，疑似模型幻觉或信息污染。",
        evidence: guardMentions.slice(0, 6).map((e) => e.seq),
      });
    }
  }

  const witchId = input.manifest.players.find((p) => p.role === "witch")?.player_id ?? 0;
  if (witchId > 0) {
    const usedPotion = events.some((e) => e.type === "witch_potion_used");
    const witchSpeechClaims = events.filter(
      (e) =>
        (e.type === "day_speech" || e.type === "last_words_spoken") &&
        Number((e.payload as any).actorId ?? (e.payload as any).playerId ?? -1) === witchId &&
        /(用了救药|用了毒药|使用了?解药|使用了?毒药)/.test(
          String((e.payload as any).text ?? ""),
        ),
    );
    if (!usedPotion && witchSpeechClaims.length > 0) {
      findings.push({
        severity: "medium",
        category: "logging",
        day: witchSpeechClaims[0].day,
        phase: witchSpeechClaims[0].phase,
        actorId: witchId,
        message: "女巫发言声称已用药，但事件流无用药记录，建议核查模型发言约束与私有信息同步。",
        evidence: witchSpeechClaims.slice(0, 6).map((e) => e.seq),
      });
    }
  }

  return findings;
}

export function scanPlayerTimelineMetadataIssues(
  views: ReplayPlayerView[],
): DeterministicFinding[] {
  const findings: DeterministicFinding[] = [];

  for (const view of views) {
    const invalidDaySeqs: number[] = [];
    const inconsistentReqSeqs: number[] = [];

    for (const entry of view.timeline) {
      if (entry.kind !== "turn") {
        continue;
      }

      if (typeof entry.day !== "number" || entry.day <= 0) {
        invalidDaySeqs.push(entry.seq);
      }

      const requestId = String(entry.request_id ?? "");
      const match = requestId.match(/^(\d+)-([a-z_]+)-/i);
      if (!match) {
        continue;
      }
      const reqDay = Number(match[1]);
      const reqPhase = match[2];
      if (reqDay !== entry.day || !requestPhaseMatchesTimelinePhase(reqPhase, entry.phase)) {
        inconsistentReqSeqs.push(entry.seq);
      }
    }

    if (invalidDaySeqs.length > 0) {
      findings.push({
        severity: "high",
        category: "logging",
        day: 0,
        phase: "unknown",
        actorId: view.player_id,
        message: "玩家时间线出现 day<=0 的行动记录，疑似动作上下文写入错误。",
        evidence: invalidDaySeqs.slice(0, 8),
      });
    }

    if (inconsistentReqSeqs.length > 0) {
      findings.push({
        severity: "medium",
        category: "logging",
        day: 0,
        phase: "unknown",
        actorId: view.player_id,
        message: "玩家时间线 request_id 与 day/phase 不一致，疑似请求元数据错位。",
        evidence: inconsistentReqSeqs.slice(0, 8),
      });
    }
  }

  return findings;
}
