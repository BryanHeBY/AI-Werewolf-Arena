/**
 * 单元测试以原协议构造器、字面语言错误及纯描述剥离 helper 为输入，核对语言只改变游戏／audit 工具说明且保留所有 schema 约束。原精确名称／schema／约束相等及非法语言拒绝为预期；不创建共享请求、listener 或子进程。
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
