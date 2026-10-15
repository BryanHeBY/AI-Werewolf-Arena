/** 只核实际领域单例、迁移后的源码身份成员和受保护 fixture 类型；不推进对局或读取私有配置。 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as publicAPI from "../../../backend/src";
import * as domain from "../../../backend/src/domain";
import * as delivery from "../../../backend/src/domain/request-delivery";
import { World } from "../../../backend/src/domain/world";
import { bootstrapGame } from "../../../backend/src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../backend/src/runtime/scenarios/six_player_mvp";
import { engineFingerprintInputs, fingerprintEngine } from "../../../backend/src/recording/engine-fingerprint";
import { sourceDeclarationContract } from "../../../tooling/refactor/fixture-manifest";
import ts from "../../../backend/node_modules/typescript";

const prefix = "docs/refactor/generated/domain-owned-layout-";
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const routes = JSON.parse(await readFile(prefix + "module-routes.json", "utf8"));
const reverse = new Map<string, string>(routes.moves.map((row: { from: string; to: string }) => [row.to, row.from]));
assert.equal(publicAPI.World, World);
assert.equal(domain.World, World);
assert.equal(publicAPI.Role, domain.Role);
const game = bootstrapGame(sixPlayerMvpConfig, { random: domain.createRandom("domain-owner-probe") });
assert(game.world instanceof World);
assert.equal(publicAPI.bootstrapGame, bootstrapGame);

// 两个入口必须消费同一弱表：跨入口绑定、拒绝、别名传播与一次性完成，不复制许可状态。
const original = {} as domain.ActionRequest, alias = {} as domain.ActionRequest;
const completion = {}, calls: boolean[] = [];
let current = true;
delivery.bindRequestDeliveryGuard(original, () => current, completion);
assert.equal(publicAPI.deferRequestDelivery(original, accepted => calls.push(accepted)), true);
publicAPI.assertRequestDelivery(original);
current = false;
assert.throws(() => publicAPI.assertRequestDelivery(original), /action_request_delivery_authority_revoked/);
delivery.registerRequestAliasPropagation(original, 10, (source, target) => {
  assert.equal(source, original);
  assert.equal(target, alias);
  publicAPI.bindRequestDeliveryGuard(target, () => current, completion);
});
publicAPI.inheritRequestAlias(original, alias);
assert.throws(() => delivery.assertRequestDelivery(alias), /action_request_delivery_authority_revoked/);
publicAPI.settleRequestDelivery(completion, true);
delivery.settleRequestDelivery(completion, false);
assert.deepEqual(calls, [true]);

// 按实际 Git 树独立列出旧 v2 范围；旧构建与新构建分别使用自己的路径和原始字节。
const git = (args: string[], input?: string) => execFileSync("git", args, { input, maxBuffer: 128 * 1024 * 1024 });
const tree = git(["ls-tree", "-rz", routes.revision]).toString().split("\0").filter(Boolean).map(row => {
  const split = row.indexOf("\t"), [mode, kind, oid] = row.slice(0, split).split(" ");
  return { mode, kind, oid, path: row.slice(split + 1) };
});
const member = (name: string) => {
  if (/(?:^|\/)(?:node_modules|\.git|\.codex|\.agents|\.aws)(?:\/|$)/.test(name) || /(?:^|\/)(?:\.env[^/]*|auth\.json|credentials\.json)$/.test(name)) return false;
  return ["package.json", "backend/package.json", "frontend/package.json", "bunfig.toml"].includes(name)
    || /^(?:|backend\/|frontend\/|packages\/[^/]+\/)tsconfig(?:\.[^.]+)*\.json$/.test(name)
    || /^packages\/[^/]+\/package\.json$/.test(name)
    || /^(?:backend\/src\/|packages\/[^/]+\/src\/).+\.(?:[cm]?[jt]sx?|json)$/.test(name);
};
const oldMembers = tree.filter(row => member(row.path)).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const actualInputs = await engineFingerprintInputs(process.cwd());
const translated = actualInputs.map(name => reverse.get(name) ?? name).concat("backend/src/core/index.ts").sort();
assert.deepEqual(translated, oldMembers.map(row => row.path));
for (const row of routes.moves) assert(actualInputs.includes(row.to) && !actualInputs.includes(row.from));
assert(!actualInputs.some(name => name === "backend/src/core/index.ts" || name.startsWith("backend/src/core/")));
const oldHash = createHash("sha256");
const oids = [...new Set(oldMembers.map(row => row.oid))];
const batch = git(["cat-file", "--batch"], oids.join("\n") + "\n"), blobs = new Map<string, Buffer>();
let offset = 0;
for (const oid of oids) {
  const end = batch.indexOf(10, offset), fields = batch.subarray(offset, end).toString().split(" "), size = Number(fields[2]);
  assert.equal(fields[0], oid); assert.equal(fields[1], "blob");
  offset = end + 1;
  const bytes = batch.subarray(offset, offset + size);
  assert.equal(createHash("sha1").update("blob " + size + "\0").update(bytes).digest("hex"), oid);
  blobs.set(oid, bytes); offset += size; assert.equal(batch[offset++], 10);
}
assert.equal(offset, batch.length);
for (const row of oldMembers) oldHash.update(row.path).update("\0").update(blobs.get(row.oid)!).update("\0");
const oldSourceHash = oldHash.digest("hex"), currentHash = createHash("sha256");
for (const name of actualInputs) currentHash.update(name).update("\0").update(await readFile(name)).update("\0");
const currentFingerprint = await fingerprintEngine(process.cwd());
assert.equal(currentFingerprint.sourceHash, currentHash.digest("hex"));
assert.notEqual(currentFingerprint.sourceHash, oldSourceHash);
assert.equal(currentFingerprint.lockHash, sha(git(["show", routes.revision + ":bun.lock"])));

// fixture 固定的是该完整导出声明；外部类型导入改路由不能扩大为声明／样本豁免。
const manifest = JSON.parse(await readFile("tooling/refactor/fixtures/manifest.json", "utf8"));
const asset = manifest.sourceAssets.find((row: { currentPath: string }) => row.currentPath === "backend/tests/fixtures/acp/game-agent.ts");
const relocation = asset.moduleRelocations.find((row: { currentPath: string }) => row.currentPath === "backend/tests/support/transport/contracts.ts");
const binding = relocation.bindings.find((row: { name: string }) => row.name === "ActorTransportPlan");
const beforeText = git(["show", relocation.originCommit + ":" + relocation.originPath]).toString();
const afterText = await readFile(relocation.currentPath, "utf8");
assert.equal(sha(sourceDeclarationContract(ts, beforeText, relocation.originPath, binding.name)), binding.declarationSha256);
assert.equal(sha(sourceDeclarationContract(ts, afterText, relocation.currentPath, binding.name)), binding.declarationSha256);
assert.equal(sha(await readFile(asset.currentPath)), asset.currentSha256);
const report = { baseCommit: routes.revision, actualBootstrap: true, publicDomainIdentity: true, crossEntryDeliveryAndAliasIdentity: true,
  firstSettlementOnly: calls, movedInputs: routes.moves.length, currentInputs: actualInputs.length, oldInputs: oldMembers.length,
  retiredInputs: 43, oldSourceHash, currentFingerprint, actorTransportDeclarationSHA256: binding.declarationSha256,
  limits: ["仅装配初始 World 和独立请求交付弱表探针；未推进对局、创建归档或运行全量 gate。", "旧 v2 身份按实际固定 Git 树与完整 blob 计算；与历史六根指标分开，不允许严格复现豁免。"] };
await writeFile(prefix + "runtime-probe.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
