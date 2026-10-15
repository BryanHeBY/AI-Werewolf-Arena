/** 将新独立政策首次应用于已有真实归档字节；不重跑其原游戏、旧审计器或exact replay。 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ReproductionRecord } from "../../../backend/src/recording/reproduction";
const prefix = "docs/refactor/generated/ordinary-death-history-";
const readyPath = prefix + "source-ready.json", readyBytes = await readFile(readyPath);
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
assert.equal(hash(readyBytes), "600e590457d7c3c7a9bf59c2df82da86910e752245ae9474ab289eef4910c817");
const ready = JSON.parse(readyBytes.toString());
for (const row of ready.source) assert.equal(hash(await readFile(row.path)), row.sha256, row.path);
const { validateDeathHistoryRecord } = await import("../../../backend/src/verification/reproduction/death-history");
const names = ["cupid-original", "dream-original", "badge-original", "cupid-derived-hunter-shot", "dream-derived-hunter-shot", "badge-fact-vs-final-checkpoint", "last-words-illegal-source-phase"];
const results = [];
for (const [index, name] of names.entries()) {
  const path = prefix + "characterization-" + name + ".json", bytes = await readFile(path);
  const record = JSON.parse(bytes.toString()).payload as ReproductionRecord;
  let error: unknown;
  try { validateDeathHistoryRecord(record); } catch (caught) { error = caught; }
  const expected = index < 3 ? "accept" : "reproduction_death_history_invalid";
  const actual = error === undefined ? "accept" : error instanceof Error ? error.message : String(error);
  results.push({ path, sha256: createHash("sha256").update(bytes).digest("hex"), expected, actual });
}
// 先保留全部首次结果；失败不丢较早真实输入，也不自动修改预期或历史文件。
for (const row of ready.source) assert.equal(hash(await readFile(row.path)), row.sha256, row.path);
assert.equal(hash(await readFile(readyPath)), hash(readyBytes));
await writeFile(prefix + "compatibility-final-probe.json", JSON.stringify({ sourceReady: { path: readyPath, sha256: hash(readyBytes) }, sourceBeforeAfter: ready.source, results, limits: ["只直接调用新的独立owner，不运行原游戏/18旧owner/parse/exactReplay，也不重写构建身份。", "3份既有真实档的兼容与4份既有字面伪造拒绝是新政策有限证据，不冒全55角色档案已覆盖。"] }, null, 2) + "\n");
console.log(JSON.stringify(results));
assert(results.every(row => row.actual === row.expected), "new_death_history_policy_compatibility_mismatch");
