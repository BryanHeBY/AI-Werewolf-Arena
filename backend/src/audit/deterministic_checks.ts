/**
 * 负责录制事件、玩家历史的确定性观察和报告筛选；输入原公开序列／玩家时间线，输出计数与潜在疑点。
 * 判断依据是列明的历史标签、关键词和局部流程模式，不读取当前 World、隐藏库存或再次执行规则。
 * 本模块不写游戏／档案、不确认玩家发言为真；证据保原序号，玩家时间线序号不在这里映射为公共事件序号。
 */
import type {
  ReplayDebugReport,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "../recording/contracts";
import type { BuildDebugSummaryInput, DeterministicFinding, SummaryObservation } from "./contracts";

/** 只比对这些精确历史标签；不从任意发言推断请求 ID，也不额外规范化大小写或阶段值。 */
const REQUEST_PHASE_ALIASES: Record<string, readonly string[]> = {
  night: ["夜晚", "Night"],
  day: ["白天", "Day"],
  voting: ["投票", "Voting"],
  game_over: ["终局", "Game over"],
};
function requestPhaseMatchesTimelinePhase(requestPhase: string, timelinePhase: string): boolean {
  return (
    Object.hasOwn(REQUEST_PHASE_ALIASES, requestPhase) &&
    (requestPhase === timelinePhase || REQUEST_PHASE_ALIASES[requestPhase].includes(timelinePhase))
  );
}

/** 缺省集合按空数组统计；只扫描 turn 的元数据与标记，保原 number／day 条件和证据截取上限。 */
export function collectObservations(input: BuildDebugSummaryInput): SummaryObservation[] {
  const events = input.publicEvents ?? [];
  const ops = input.logicOps ?? [];
  const views = input.playerViews ?? [];
  const observations: SummaryObservation[] = [];

  const timelineEntries = views.reduce((acc, view) => acc + view.timeline.length, 0);
  const selfDestructCount = events.filter(
    (e) => e.type === "wolf_self_destruct" || e.type === "white_wolf_king_self_destruct",
  ).length;
  const deathShotCount = events.filter(
    (e) =>
      e.type === "player_shot" ||
      e.type === "hunter_shot" ||
      e.type === "wolf_king_shot" ||
      e.type === "mechanical_shot",
  ).length;
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
      // 警告／重试与 accepted=false 两类分别累加，同一 turn 可计两次；不是去重的失败请求数。
      if (
        entry.delta_messages.some(
          (item) => item.kind === "constraint_warning" || item.kind === "retry_prompt",
        )
      ) {
        toolRejectedCount += 1;
      }
      if (
        entry.delta_messages.some((item) => item.kind === "tool_call" && item.accepted === false)
      ) {
        toolRejectedCount += 1;
      }
    }
  }

  observations.push({
    code: "event_counts",
    title: "audit.observation.event_counts.title",
    detail: {
      key: "audit.observation.event_counts.detail",
      parameters: {
        events: events.length,
        ops: ops.length,
        players: views.length,
        timeline: timelineEntries,
      },
    },
  });
  observations.push({
    code: "process_counts",
    title: "audit.observation.process_counts.title",
    detail: {
      key: "audit.observation.process_counts.detail",
      parameters: { night: nightResolvedCount, blast: selfDestructCount, shot: deathShotCount },
    },
  });
  observations.push({
    code: "actions",
    title: "audit.observation.actions.title",
    detail: {
      key: "audit.observation.actions.detail",
      parameters: { rejected: toolRejectedCount, fallback: fallbackCount },
    },
  });

  if (invalidDaySeqs.length > 0) {
    observations.push({
      code: "invalid_day",
      title: "audit.observation.invalid_day.title",
      detail: {
        key: "audit.observation.invalid_day.detail",
        parameters: { count: invalidDaySeqs.length },
      },
      evidence: invalidDaySeqs.slice(0, 10),
    });
  }
  if (mismatchSeqs.length > 0) {
    observations.push({
      code: "request_mismatch",
      title: "audit.observation.request_mismatch.title",
      detail: {
        key: "audit.observation.request_mismatch.detail",
        parameters: { count: mismatchSeqs.length },
      },
      evidence: mismatchSeqs.slice(0, 10),
    });
  }

  return observations;
}
/** 返回原 report 引用的筛选数组；非空 evidence 只作现有门槛，不在此核实序号或事实真伪。 */
export function filterActionableReports(
  reports: ReplayDebugReport[],
  publicEvents: ReplayPublicEvent[],
): ReplayDebugReport[] {
  return reports.filter((report) => isActionableReport(report, publicEvents));
}

function isActionableReport(report: ReplayDebugReport, publicEvents: ReplayPublicEvent[]): boolean {
  const message = report.message;
  const category = report.category;
  const text = String(message ?? "").trim();
  if (!text) {
    return false;
  }
  const hasEvidenceSeq =
    Array.isArray(report.evidence_event_seq) && report.evidence_event_seq.length > 0;

  // 硬信号先结合非空证据或局部异常判定，之后才排策略噪声；三层顺序不能合并为关键词黑名单。
  const hardBugSignal =
    /(日志|广播|顺序|重复|缺失|未(触发|执行|生效|公布|记录|结算)|跳过|死后|出局后|仍然发言|工具.*调用|调用.*失败|报错|error|timeout|fallback|不一致|矛盾|\bcontradict(?:ion|s|ory)?\b|越权|空守|弃票|\blogs?\b|\bbroadcast\b|\border\b|\bduplicate\b|\bmissing\b|\bskipped\b|\bafter death\b|\bafter elimination\b|\btool.*call\b|\bcall.*failed\b|\binconsistent\b|\bunauthorized\b|\babstain\b|没(有)?(公布|记录|触发|执行|生效))/i;
  if (hardBugSignal.test(text) && (hasEvidenceSeq || detectFlowAnomaly(publicEvents))) {
    return true;
  }

  const strategyNoise =
    /(狼队|队友|悍跳|金水|查验|站边|刀口|带队|配合|盘逻辑|好人阵营|狼人阵营|局势对.*(有利|不利)|报假查验|\b(?:wolf team|teammates?|bluff|role claim|inspection|alignment|good team|werewolf team|kill target|favorable|unfavorable)\b)/i;
  if (strategyNoise.test(text)) {
    return false;
  }

  const softActionableSignal =
    /(流程|阶段|票型|投票|放逐|遗言|警长|上警|退水|\b(?:flow|phase|stage|votes?|voting|exile|last words|sheriff|nomination|withdrawal)\b)/i;
  if (softActionableSignal.test(text)) {
    return (
      hasEvidenceSeq ||
      ((category === "flow" || category === "rule" || category === "logging") &&
        detectFlowAnomaly(publicEvents))
    );
  }

  // 前面均未命中时，仍须非空 evidence 且属 flow／rule／logging；分类本身不足以保留简短上报。
  return hasEvidenceSeq && (category === "flow" || category === "rule" || category === "logging");
}

/**
 * 只检查相邻 phase_changed 的允许转移和 day>1 发言当天是否存在夜报；不复演配置，也不比较夜报与发言的先后 seq。
 * 未知／转换后的值沿原判断处理；单个首阶段不在相邻对循环内验证。
 */
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

/** 初日自爆、无原生守卫的发言及无公开用药事件的女巫说法均是候选，未复核受赠能力或发言真实性。 */
export function scanEventsForPotentialIssues(
  input: BuildDebugSummaryInput,
): DeterministicFinding[] {
  const events = input.publicEvents ?? [];
  const findings: DeterministicFinding[] = [];

  const selfDestruct = events.filter(
    (e) => e.type === "wolf_self_destruct" || e.type === "white_wolf_king_self_destruct",
  );
  for (const e of selfDestruct) {
    if (e.day === 1) {
      findings.push({
        severity: "medium",
        category: "rule",
        day: e.day,
        phase: e.phase,
        actorId: Number((e.payload as any).wolfId ?? (e.payload as any).actorId ?? 0),
        code: "first_day_blast",
        message: { key: "audit.check.first_day_blast" },
        evidence: [e.seq],
      });
    }
  }

  const hasGuardRole = input.manifest.players.some((p) => p.role === "guard");
  if (!hasGuardRole) {
    const guardMentions = events.filter(
      (e) =>
        (e.type === "day_speech" || e.type === "last_words_spoken") &&
        /(守卫|\bguard\b)/i.test(String((e.payload as any).text ?? "")),
    );
    if (guardMentions.length > 0) {
      findings.push({
        severity: "low",
        category: "state",
        day: guardMentions[0].day,
        phase: guardMentions[0].phase,
        actorId: Number(
          (guardMentions[0].payload as any).actorId ??
            (guardMentions[0].payload as any).playerId ??
            0,
        ),
        code: "guard_mention",
        message: { key: "audit.check.guard_mention" },
        evidence: guardMentions.slice(0, 6).map((e) => e.seq),
      });
    }
  }

  // 只取清单首个原生女巫，usedPotion 看整个公共序列；不额外按玩家／日期把用药事件配对。
  const witchId = input.manifest.players.find((p) => p.role === "witch")?.player_id ?? 0;
  if (witchId > 0) {
    const usedPotion = events.some((e) => e.type === "witch_potion_used");
    const witchSpeechClaims = events.filter(
      (e) =>
        (e.type === "day_speech" || e.type === "last_words_spoken") &&
        Number((e.payload as any).actorId ?? (e.payload as any).playerId ?? -1) === witchId &&
        /(用了救药|用了毒药|使用了?解药|使用了?毒药|\b(?:used|have used|administered)\s+(?:the\s+|my\s+|an?\s+)?(?:antidote|poison|healing potion|poison potion)\b)/i.test(
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
        code: "potion_claim",
        message: { key: "audit.check.potion_claim" },
        evidence: witchSpeechClaims.slice(0, 6).map((e) => e.seq),
      });
    }
  }

  return findings;
}

/** 输出 day=0／unknown 的日志疑点；evidence 来自各玩家 timeline 的局部 seq，原请求前缀未匹配时不猜测元数据。 */
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
        code: "invalid_day",
        message: { key: "audit.check.invalid_day" },
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
        code: "request_mismatch",
        message: { key: "audit.check.request_mismatch" },
        evidence: inconsistentReqSeqs.slice(0, 8),
      });
    }
  }

  return findings;
}
