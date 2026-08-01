import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { AgentBugReportService } from "../../../src/ai/agents/reporting/bug_report_service";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

describe("AgentBugReportService", () => {
  test("shares validation, scope dedupe, message dedupe, and daily limits", () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const accepted: string[] = [];
    const service = new AgentBugReportService(context.world, {
      maxPerActorPerDay: 2,
      onAccepted: (report) => accepted.push(report.message),
    });
    const base = {
      actorId: 1,
      day: 1,
      phase: "day",
      stage: "speech-1",
      category: "flow",
      severity: "medium",
      message: "流程异常",
    };

    expect(service.report({ ...base, category: "strategy" })).toEqual({
      ok: false,
      error: "invalid_report_bug_category",
    });
    expect(service.report(base)).toEqual({
      ok: true,
      accepted: true,
      report_id: "rb-no-recorder",
    });
    expect(service.report({ ...base, message: "同阶段另一个问题" })).toMatchObject({
      accepted: false,
      reason: "report_bug_scope_rate_limited",
    });
    expect(service.report({ ...base, stage: "speech-2", message: "  流程异常  " })).toMatchObject({
      accepted: false,
      reason: "report_bug_duplicate_message",
    });
    expect(service.report({ ...base, stage: "speech-2", message: "状态异常" })).toMatchObject({
      accepted: true,
    });
    expect(service.report({ ...base, stage: "speech-3", message: "日志异常" })).toMatchObject({
      accepted: false,
      reason: "report_bug_actor_day_rate_limited",
    });
    expect(service.report({ ...base, day: 2, stage: "speech-1" })).toMatchObject({
      accepted: true,
    });
    expect(accepted).toEqual(["流程异常", "状态异常", "流程异常"]);
  });
});

