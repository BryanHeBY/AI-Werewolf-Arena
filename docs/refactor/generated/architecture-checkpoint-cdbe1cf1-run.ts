/**
 * 负责固定已提交 Git 原始字节的结构增量检查；输入为公开源码、同提交文档和原冻结债务。
 * 开跑前保存完整输入／原始摘要与六个实际工具来源，运行只消费固定输入，不读取产品 WIP。
 * 输出保持新增失败和原1779债务的完整分区；不改基线、不加映射／豁免，也不作行为或中文全验收。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const repository = "/home/hby/dev/AI-Werewolf-Arena";
const commit = process.argv[2];
if (!commit || !/^[0-9a-f]{40}$/.test(commit)) throw Error("checkpoint_fixed_commit_argument_invalid");
const output = repository + "/docs/refactor/generated/architecture-checkpoint-" + commit.slice(0, 8);
const rawInputPath = "/tmp/awa-architecture-checkpoint-" + commit.slice(0, 8) + "-input.json";
const hash = (s: Uint8Array | string) => createHash("sha256").update(s).digest("hex");
const git = (args: string[]) => execFileSync("git", args, { cwd: repository, maxBuffer: 256 * 1024 * 1024 });
const toolPaths = ["tooling/refactor/inventory.ts", "tooling/refactor/architecture/run.ts", "tooling/refactor/architecture/contracts.ts", "tooling/refactor/architecture/dependency-check.ts", "tooling/refactor/architecture/comment-check.ts", "tooling/refactor/architecture/naming-check.ts"];
// 实际执行工具必须先与固定 Git 全字节相同；产品 WIP 不可通过当前工具读取器混入。
const gateModules = toolPaths.map(path => {
  const bytes = git(["show", commit + ":" + path]);
  if (!bytes.equals(fs.readFileSync(repository + "/" + path))) throw Error("checkpoint_gate_source_changed:" + path);
  return { path, sha256: hash(bytes) };
});
const debtPath = "docs/refactor/generated/architecture-debt.json";
const debtBytes = git(["show", commit + ":" + debtPath]);
const expectedDebtSHA = "297b945bcdc85873b1d44e9e0ae705cddc1af8fd3e2fa5acfdb443f036550e5d";
if (hash(debtBytes) !== expectedDebtSHA || !debtBytes.equals(fs.readFileSync(repository + "/" + debtPath))) throw Error("checkpoint_original_debt_changed");
const { readPublicGitBlobs } = await import(repository + "/tooling/refactor/inventory");
const { sourceDigest } = await import(repository + "/tooling/refactor/architecture/contracts");
const { checkArchitecture } = await import(repository + "/tooling/refactor/architecture/run");
const blobs = readPublicGitBlobs(repository, commit);
const files = blobs.files.map(({path, bytes}) => ({path, text: bytes.toString("utf8"), sha256: hash(bytes)}));
const documentationPaths = git(["ls-tree", "-r", "--name-only", commit]).toString().split("\n").filter(path => /^docs\/.*\.md$/.test(path) || path === "README.md").sort();
const input = { files, documentationPaths };
const debt = JSON.parse(debtBytes.toString("utf8"));
if (debt.violations.length !== 1779) throw Error("checkpoint_original_debt_count_changed");
// 全文本仅留临时输入供实际运行／独立复核；持久清单保存路径、真实原始blob与SHA，可从同Git恢复。
fs.writeFileSync(rawInputPath, JSON.stringify(input));
const capture = { commit, files: blobs.files.map(({path, bytes, blob, mode}) => ({path, sha256: hash(bytes), blob, mode})), documentationPaths, sourceDigest: sourceDigest(files), debtSha256: hash(debtBytes), originalDebtCount: debt.violations.length, gateModules, rawInput: { path: rawInputPath, sha256: hash(fs.readFileSync(rawInputPath)), bytes: fs.statSync(rawInputPath).size }, options: { strict: false, mappings: [] }, scope: "仅固定公开Git源码与同Git文档；固定树已含该提交的全部已交付内容，仅排除该提交后的未提交工作树、私有configs、认证、node_modules。" };
fs.writeFileSync(output + "-capture.json", JSON.stringify(capture, null, 2) + "\n");
console.log(JSON.stringify({ phase: "captured-before-gate", commit, files: files.length, docs: documentationPaths.length, sourceDigest: capture.sourceDigest, tools: gateModules.length, debtSHA: capture.debtSha256 }));
// 按原 progressive 政策调用一次；失败仍按原终态返回，不改债或重启。
const report = checkArchitecture(repository, input, debt);
fs.writeFileSync(output + "-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ phase: "completed", commit, counts: report.counts, failures: report.failures }));
if (report.inputHash !== capture.sourceDigest) throw Error("checkpoint_report_input_mismatch");
if (report.failures.length) process.exitCode = 1;
