/** 将新独立政策首次应用于已有真实归档字节；不重跑其原游戏、旧审计器或exact replay。 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDeathHistoryRecord } from "../../../backend/src/verification/reproduction/death-history";
import type { ReproductionRecord } from "../../../backend/src/recording/reproduction";
const prefix = "docs/refactor/generated/ordinary-death-history-";
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
await writeFile(prefix + "compatibility-probe.json", JSON.stringify({ results, limits: ["只直接调用新的独立owner，不运行原游戏/18旧owner/parse/exactReplay，也不重写构建身份。", "3份既有真实档的兼容与4份既有字面伪造拒绝是新政策有限证据，不冒全55角色档案已覆盖。"] }, null, 2) + "\n");
console.log(JSON.stringify(results));
assert(results.every(row => row.actual === row.expected), "new_death_history_policy_compatibility_mismatch");
