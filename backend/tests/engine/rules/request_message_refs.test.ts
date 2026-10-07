import type { MessageRef } from "@ai-werewolf-arena/game-text";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { Phase } from "../../../src/core";
import { resolveTurnConstraints, renderTurnConstraintUserHint } from "../../../src/ai/agents/player/turn_constraints";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import { getDefaultRoleCatalog, getDefaultToolSpecRegistry, getDefaultTargetHintRegistry, getDefaultPhaseStageLocalizationRegistry, getDefaultConfigRenderRegistry } from "../../../src/game/mechanisms";

function setup(locale: "zh-CN" | "en") {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale });
  const factory = new GameActionRequestFactory(game.world, [], 1);
  const request = factory.create({ phase: Phase.Voting, actorId: 1, stage: "voting", requiresAction: true, allowedTools: ["vote"], summary: { key: "request.summary.exile_vote" }, context: { retry_notice_message: { key: "request.retry.exile_vote" }, retry_attempt: 1, retry_reason: "invalid_tool_arguments" } });
  const policy = new PlayerPromptPolicy(game.world, { roleCatalog: getDefaultRoleCatalog(), toolSpecRegistry: getDefaultToolSpecRegistry(), targetHintRegistry: getDefaultTargetHintRegistry(), phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(), configRenderRegistry: getDefaultConfigRenderRegistry() });
  return { request, policy, factory };
}

test("factory request and constraint machine data do not change with game locale", () => {
  const zh = setup("zh-CN"); const en = setup("en"); expect(zh.request).toEqual(en.request);
  expect(en.request.context.turn_constraints).toEqual({ min_valid_actions: 1, max_valid_actions: 1, required_any_tools: ["vote"], summary_message: { key: "request.summary.exile_vote" } });
  expect(JSON.stringify(en.request.context)).not.toMatch(/[\u4e00-\u9fff]/);
  const before = structuredClone(en.request);
  const prompt = en.policy.buildUser(en.request, { turnId: "t9", allowedTools: ["vote"], actionSubmissionHint: "submit_action t9" });
  expect(prompt).toContain("Complete one exile vote action"); expect(prompt).toContain("Your vote action was invalid");
  expect(prompt).not.toMatch(/[\u4e00-\u9fff]/); expect(en.request).toEqual(before);
});

test("custom legacy summaries and retry notice stay original in English", () => {
  const { factory, policy } = setup("en");
  const request = factory.create({ phase: Phase.Day, actorId: 1, stage: "day_speech", requiresAction: true, allowedTools: ["speak"], summary: "自定说明 {key}", context: { retry_notice: "自定重试 {key}" } });
  expect(renderTurnConstraintUserHint(resolveTurnConstraints(request), "en")).toContain("自定说明 {key}");
  expect(policy.buildUser(request, { turnId: "t9", allowedTools: ["speak"], actionSubmissionHint: "submit" })).toContain("自定重试 {key}");
});


test("spread raw overrides take priority over inherited message refs and empty overrides clear hints", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const { request, policy } = setup(locale);
    const custom = { ...request, context: { ...request.context, retry_notice: "  自定重试 {key}  ", turn_constraints: { ...request.context.turn_constraints, summary: "  自定说明 {key}  " } } };
    const prompt = policy.buildUser(custom, { turnId: "t9", allowedTools: ["vote"], actionSubmissionHint: "submit" });
    expect(prompt).toContain("  自定说明 {key}  "); expect(prompt).toContain("  自定重试 {key}  ");
    expect(prompt).not.toContain("Complete one exile vote"); expect(prompt).not.toContain("Your vote action was invalid");
    const cleared = { ...request, context: { ...request.context, retry_notice: "", turn_constraints: { ...request.context.turn_constraints, summary: "" } } };
    const clearedPrompt = policy.buildUser(cleared, { turnId: "t9", allowedTools: ["vote"], actionSubmissionHint: "submit" });
    expect(clearedPrompt).not.toContain(locale === "en" ? "Complete one exile vote" : "放逐投票阶段必须完成");
    expect(clearedPrompt).not.toContain(locale === "en" ? "Your vote action was invalid" : "你的投票动作无效");
  }
});


test("factory owns detached message references including retry parameters", () => {
  const { factory } = setup("en");
  const summaryParameters = { count: 1 }; const retryParameters = { count: 2 };
  const summary: MessageRef = { key: "turn.minimum", parameters: summaryParameters };
  const retry: MessageRef = { key: "turn.maximum", parameters: retryParameters };
  const request = factory.create({ phase: Phase.Day, actorId: 1, stage: "day_speech", requiresAction: true, allowedTools: ["speak"], summary, context: { retry_notice_message: retry } });
  summaryParameters.count = 99; retryParameters.count = 99;
  summary.key = "turn.maximum"; retry.key = "turn.minimum";
  expect(request.context.turn_constraints.summary_message).toEqual({ key: "turn.minimum", parameters: { count: 1 } });
  expect(request.context.retry_notice_message).toEqual({ key: "turn.maximum", parameters: { count: 2 } });
});
