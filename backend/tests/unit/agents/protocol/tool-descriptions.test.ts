/**
 * Unit test verifies locale changes game/audit tool descriptions while preserving every declared schema constraint.
 * Input: Original protocol builders, literal locale errors and the pure description-stripping helper.
 * Output and oracle: Exact names/schema/constraint equality and invalid-locale rejection remain the original assertions; no shared request, listener or subprocess is created.
 */
import { expect, test } from "bun:test";
import { gameToolProtocol } from "../../../../src/agents/game-tool-protocol";
import {
  auditToolProtocol,
  AuditToolTurnRegistry,
} from "../../../../src/audit/agents/audit-tool-protocol";
import { AcpTurnRegistry } from "../../../../src/adapters/acp/acp-turn-registry";
import { taskLocale } from "../../../../src/adapters/acp/task-locale";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import type { Locale } from "@ai-werewolf-arena/game-text";

function withoutDescriptions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutDescriptions);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "description")
        .map(([key, child]) => [key, withoutDescriptions(child)]),
    );
  return value;
}

test("locale changes every protocol and nested parameter description without changing constraints", () => {
  for (const build of [gameToolProtocol, auditToolProtocol]) {
    const chinese = build("zh-CN");
    const english = build("en");
    expect(chinese.specs.map((spec) => spec.name)).toEqual(english.specs.map((spec) => spec.name));
    for (let index = 0; index < chinese.specs.length; index++) {
      expect(withoutDescriptions(chinese.specs[index].parameters)).toEqual(
        withoutDescriptions(english.specs[index].parameters),
      );
      expect(english.specs[index].description).not.toMatch(/[\u4e00-\u9fff]/);
      expect(JSON.stringify(english.specs[index].parameters)).not.toMatch(/[\u4e00-\u9fff]/);
    }
    expect(JSON.stringify(english.schema)).not.toMatch(/[\u4e00-\u9fff]/);
    expect(JSON.stringify(chinese.schema)).toMatch(/[\u4e00-\u9fff]/);
  }
  const nested = auditToolProtocol("en").specs.find(
    (spec) => spec.name === "submit_audit_findings",
  )!.parameters as any;
  expect(nested.properties.findings.items.properties.evidence.description).toContain(
    "authorized context",
  );
  expect(taskLocale({})).toBe("zh-CN");
  expect(taskLocale({ AWA_TASK_LOCALE: "en" })).toBe("en");
  expect(() => taskLocale({ AWA_TASK_LOCALE: "en-US" })).toThrow("acp_task_locale_invalid");
  expect(
    () =>
      new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig, { locale: "en-US" as Locale }).world),
  ).toThrow("game_locale_invalid");
  expect(() => new AuditToolTurnRegistry("en-US" as Locale)).toThrow("audit_task_locale_invalid");
});
