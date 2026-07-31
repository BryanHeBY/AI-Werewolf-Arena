import { describe, expect, test } from "bun:test";
import { AuditEvidencePolicy } from "../../src/observability/audit_evidence_policy";

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
          { category: "logic", severity: "medium", message: "invented", evidence: [99], source: "b" },
        ],
        notes: [],
        missing_info: [],
      },
    ]);
    expect(merged.findings.map((finding) => finding.message)).toEqual([
      "major", "invented", "minor",
    ]);
    const filtered = policy.filterByEvidence(merged.findings, new Set([1, 2]));
    expect(filtered.findings.map((finding) => finding.message)).toEqual(["major", "minor"]);
    expect(filtered.dropped[0]).toContain("invalid_evidence");
  });

  test("requires every generated finding line to cite an existing sequence", () => {
    const policy = new AuditEvidencePolicy();
    expect(policy.validatesMarkdown(
      "## Findings\n- [HIGH][flow] issue evidence=2\n\n## TODO",
      new Set([2]),
    )).toBe(true);
    expect(policy.validatesMarkdown(
      "## Findings\n- [HIGH][flow] unsupported\n\n## TODO",
      new Set([2]),
    )).toBe(false);
  });
});
