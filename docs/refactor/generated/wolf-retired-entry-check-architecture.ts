/**
 * 负责验证旧模块退休测试的后继结构修复；输入为真实4df固定输入，仅替换一份测试源码。
 * 输出为原门禁的完整报告与明确输入差异；原3160份输入、508文档、六工具和冻结债务不扩大。
 * 不读取并行死亡／夜流程候选，不覆盖原失败报告，也不修改门禁、旧债或例外政策。
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { checkArchitecture } from "../../../tooling/refactor/architecture/run";
import { sourceDigest } from "../../../tooling/refactor/architecture/contracts";

const prefix = "docs/refactor/generated/wolf-retired-entry-check";
const path = "backend/tests/unit/rulesets/wolf-tool-admission.test.ts";
const hash = (raw: Uint8Array | string) => createHash("sha256").update(raw).digest("hex");
const capture = JSON.parse(fs.readFileSync("docs/refactor/generated/architecture-checkpoint-4df94bfa-capture.json", "utf8"));
const raw = fs.readFileSync(capture.rawInput.path);
if (hash(raw) !== capture.rawInput.sha256) throw Error("fixed_input_changed");
for (const tool of capture.gateModules)
  if (hash(fs.readFileSync(tool.path)) !== tool.sha256) throw Error("fixed_gate_changed");
const debtBytes = fs.readFileSync("docs/refactor/generated/architecture-debt.json");
if (hash(debtBytes) !== capture.debtSha256) throw Error("fixed_debt_changed");
const input = JSON.parse(raw.toString());
const before = input.files.find((file: { path: string }) => file.path === path);
if (!before) throw Error("fixed_source_missing");
const text = fs.readFileSync(path, "utf8"), sha256 = hash(text);
input.files = input.files.map((file: { path: string }) => file.path === path ? { path, text, sha256 } : file);
const inputDelta = { basisCommit: capture.commit, path, beforeSHA256: before.sha256, afterSHA256: sha256,
  unchangedFiles: input.files.length - 1, documentationPaths: input.documentationPaths.length,
  beforeSourceDigest: capture.sourceDigest, afterSourceDigest: sourceDigest(input.files),
  debtSHA256: hash(debtBytes), gateModules: capture.gateModules };
fs.writeFileSync(prefix + "-architecture-input.json", JSON.stringify(inputDelta, null, 2) + "\n");
const report = checkArchitecture(process.cwd(), input, JSON.parse(debtBytes.toString()));
fs.writeFileSync(prefix + "-architecture-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ inputDelta, counts: report.counts, failures: report.failures }));
if (report.failures.length) process.exitCode = 1;
