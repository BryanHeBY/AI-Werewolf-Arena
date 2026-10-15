/**
 * 严格引擎来源的单元／文件系统契约测试。以独立字面路径及字节哈希核对 runtime、AI、recording、新包和 schema 是否纳入指纹；新增或改变这些输入会改变构建身份，测试及私有配置仍在声明的生产范围之外。源码符号链接必须被拒绝；不执行身份结算、模型、档案改写，也不借兼容路径生成预期。
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import {
  engineFingerprintInputs,
  fingerprintEngine,
} from "../../src/recording/reproduction/engine-fingerprint";

async function fixture() {
  const root = await mkdtemp("/tmp/awa-engine-fingerprint-unit-");
  const files: Record<string, string> = {
    "backend/src/ai/agent.ts": "agent-v1",
    "backend/src/recording/schema.json": '{"schema":1}',
    "backend/src/runtime/runner.ts": "runner-v1",
    "packages/game-contract/src/identity.ts": "identity-v1",
    "packages/game-presentation/src/project.tsx": "presentation-v1",
    "backend/tests/test.ts": "not production",
    "configs/runtime/auth.json": "local sentinel, no real key",
    "bun.lock": "fixed-lock",
  };
  for (const [name, value] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), value);
  }
  return { root, files };
}

test("source scope includes runtime agent recording and each shared package in exact path order", async () => {
  const { root, files } = await fixture();
  try {
    const expected = [
      "backend/src/ai/agent.ts",
      "backend/src/recording/schema.json",
      "backend/src/runtime/runner.ts",
      "packages/game-contract/src/identity.ts",
      "packages/game-presentation/src/project.tsx",
    ];
    expect(await engineFingerprintInputs(root)).toEqual(expected);
    const hash = createHash("sha256");
    for (const name of expected) hash.update(name).update("\0").update(files[name]!).update("\0");
    const expectedDigest = hash.digest("hex");
    expect(await fingerprintEngine(root)).toEqual({
      sourceHash: expectedDigest,
      lockHash: createHash("sha256").update("fixed-lock").digest("hex"),
    });
    await writeFile(path.join(root, "backend/src/runtime/runner.ts"), "runner-v2");
    expect((await fingerprintEngine(root)).sourceHash).not.toBe(expectedDigest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("new package source participates immediately while hidden credentials are not read", async () => {
  const { root } = await fixture();
  try {
    const before = await fingerprintEngine(root);
    await mkdir(path.join(root, "packages/new-contract/src"), { recursive: true });
    await writeFile(path.join(root, "packages/new-contract/src/fact.mts"), "new fact");
    expect((await fingerprintEngine(root)).sourceHash).not.toBe(before.sourceHash);
    const next = await fingerprintEngine(root);
    await writeFile(path.join(root, "backend/src/.env"), "private sentinel");
    await writeFile(path.join(root, "backend/src/auth.json"), "private sentinel");
    expect(await fingerprintEngine(root)).toEqual(next);
    await symlink("/tmp", path.join(root, "backend/src/external"));
    await expect(engineFingerprintInputs(root)).rejects.toThrow("engine_source_symlink_rejected");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
