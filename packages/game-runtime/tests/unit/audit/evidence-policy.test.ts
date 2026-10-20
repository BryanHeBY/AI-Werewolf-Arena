/**
 * 单元测试以重复 findings 和显式序号引用为输入，用字面顺序及拒绝断言核对审计引用归属和缺证据失败。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { auditSummaryFixture } from "../../support/builders/audit-summary";
import { describe, expect, test } from "bun:test";
import { AuditEvidencePolicy } from "../../../src/audit/evidence-policy";

describe("AuditEvidencePolicy", () => {
  test("deduplicates and orders findings before rejecting unsupported evidence", () => {
    const policy = new AuditEvidencePolicy();
    const merged = policy.merge([
      {
        agent: "a",
        findings: [
          { category: "flow", severity: "low", message: "minor", evidence: [1], source: "a" },
          { category: "flow", severity: "high", message: "major", evidence: [2], source: "a" },
        ],
        notes: [],
        missing_info: [],
      },
      {
        agent: "b",
        findings: [
          { category: "flow", severity: "high", message: "major", evidence: [2], source: "a" },
          {
            category: "rule",
            severity: "medium",
            message: "invented",
            evidence: [99],
            source: "b",
          },
        ],
        notes: [],
        missing_info: [],
      },
    ]);
    expect(merged.findings.map((finding) => finding.message)).toEqual([
      "major",
      "invented",
      "minor",
    ]);
    const filtered = policy.filterByEvidence(merged.findings, new Set([1, 2]));
    expect(filtered.findings.map((finding) => finding.message)).toEqual(["major", "minor"]);
    expect(filtered.dropped[0]).toContain("invalid_evidence");
  });

  test("requires every generated finding line to cite an existing sequence", () => {
    const policy = new AuditEvidencePolicy();
    expect(
      policy.validatesMarkdown(
        auditSummaryFixture("en", "- [HIGH][flow] issue evidence=2"),
        new Set([2]),
      ),
    ).toBe(true);
    expect(
      policy.validatesMarkdown(
        auditSummaryFixture("en", "- [HIGH][flow] unsupported"),
        new Set([2]),
      ),
    ).toBe(false);
  });
});
