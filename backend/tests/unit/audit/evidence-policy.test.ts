/**
 * Unit tests: Audit evidence policy uses duplicate findings and explicit sequence
 * references; literal order and rejection assertions check citation ownership and
 * missing-evidence failure. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { auditSummaryFixture } from "../../support/builders/audit-summary";
import { describe, expect, test } from "bun:test";
import { AuditEvidencePolicy } from "../../../src/audit/evidence_policy";

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
