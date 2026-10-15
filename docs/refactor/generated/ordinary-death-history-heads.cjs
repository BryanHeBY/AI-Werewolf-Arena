/** 只解析本批三个真实源的职责头；不执行 verifier、parser、World、测试或类型检查。 */
const fs = require("node:fs"), cp = require("node:child_process"), { createHash } = require("node:crypto");
const ts = require("../../../backend/node_modules/typescript"), { checkComments } = require("../../../tooling/refactor/architecture/comment-check.ts");
const prefix = "docs/refactor/generated/ordinary-death-history-", ready = JSON.parse(fs.readFileSync(prefix + "source-ready.json", "utf8"));
const hash = b => createHash("sha256").update(b).digest("hex");
const files = ready.source.map(r => { const b = fs.readFileSync(r.path); if (hash(b) !== r.sha256) throw Error("source_ready_changed"); return { path: r.path, text: b.toString("utf8"), sha256: r.sha256 }; });
const documentationPaths = cp.execFileSync("git", ["ls-tree", "-r", "--name-only", ready.baseCommit], { encoding: "utf8" }).split("\n").filter(p => p === "README.md" || /^docs\/.*\.md$/.test(p)).sort();
const diagnostics = checkComments(ts, { files, documentationPaths });
const report = { sourceReadySHA256: hash(fs.readFileSync(prefix + "source-ready.json")), roots: files.length, documentationPaths: documentationPaths.length, diagnostics };
fs.writeFileSync(prefix + "heads.json", JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report)); if (diagnostics.length) process.exitCode = 1;
