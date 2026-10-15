/**
 * 单元测试以字面报告及内存阶段 scope 为输入，用明确校验错误码、去重结果及每日限制核对共享 bug 服务，不调用审计模型。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { AgentBugReportService } from "../../../src/agents/reporting/bug-report-service";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

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
      message: "report_bug.category无效；请使用工具schema声明的类别。",
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
