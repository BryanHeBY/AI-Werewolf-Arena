/**
 * 单元测试核对源码 fixture 的精确导入迁移及声明证据。
 * 输入为手写源码和畸形清单记录；独立 binding 集合、字面字段与明确改动的函数体是预期。
 * 输出验证同源路径迁移和拒绝边界，不执行适配器、归档扫描、传输或对局，
 * 不调用生产规则生成预期，也不改写 fixture 字节或冻结的声明摘要。
 */
import { expect, test } from "bun:test";
import { compiler } from "./architecture/contracts";
import {
  parseFixtureManifest,
  sourceProgramContract,
  sourceDeclarationContract,
  type FixtureManifest,
  type FixtureSourceModuleRelocation,
} from "./fixture-manifest";
import manifest from "./fixtures/manifest.json";

const ts = compiler(process.cwd());
const relocation: FixtureSourceModuleRelocation = {
  originPath: "backend/tests/support/old.ts",
  currentPath: "backend/tests/support/oracles/new.ts",
  originCommit: "a".repeat(40),
  bindings: [{ name: "check", declarationSha256: "1".repeat(64) }],
};

test("source module relocation permits only its exact named import and retains program literals", () => {
  const file = "backend/tests/fixtures/acp/test-agent.ts";
  const old = 'import { check as verify } from "../../support/old"; verify("literal_action", 7);';
  const next = old.replace("../../support/old", "../../support/oracles/new");
  expect(sourceProgramContract(ts, next, file, true, [], [relocation]))
    .toEqual(sourceProgramContract(ts, old, file, false, []));
  expect(() => sourceProgramContract(ts, next.replace("check as verify", "other as verify"), file, true, [], [relocation]))
    .toThrow("source_module_relocation_binding_drift");
  expect(() => sourceProgramContract(ts, 'import * as verify from "../../support/oracles/new";', file, true, [], [relocation]))
    .toThrow("source_module_relocation_requires_named_import");
  expect(() => sourceProgramContract(ts, "verify(7);", file, true, [], [relocation]))
    .toThrow("source_module_relocation_unused");
  expect(sourceProgramContract(ts, next.replace('"literal_action"', '"changed_action"'), file, true, [], [relocation]))
    .not.toEqual(sourceProgramContract(ts, old, file, false, []));
});

test("source declaration evidence retains complete function and data members", () => {
  const before = 'export function check(value: number) { return value + 1; }';
  expect(sourceDeclarationContract(ts, before, "old.ts", "check"))
    .toEqual(sourceDeclarationContract(ts, "// moved\n" + before, "new.ts", "check"));
  expect(sourceDeclarationContract(ts, before, "old.ts", "check"))
    .not.toEqual(sourceDeclarationContract(ts, before.replace("+ 1", "+ 2"), "new.ts", "check"));
  expect(() => sourceDeclarationContract(ts, before + "\n" + before, "bad.ts", "check"))
    .toThrow("source_module_declaration_identity");
  expect(() => sourceDeclarationContract(ts, before.replace("export ", ""), "private.ts", "check"))
    .toThrow("source_module_declaration_requires_named_export");
  expect(() => sourceDeclarationContract(ts, before.replace("export function", "export default function"), "default.ts", "check"))
    .toThrow("source_module_declaration_requires_named_export");
});

test("source relocation manifest rejects private paths and malformed or duplicate evidence", () => {
  const base = structuredClone(manifest) as FixtureManifest;
  base.sourceAssets[0]!.moduleRelocations = [structuredClone(relocation)];
  expect(() => parseFixtureManifest(JSON.stringify(base))).not.toThrow();
  const mutations: Array<(r: FixtureSourceModuleRelocation) => void> = [
    (r) => { r.currentPath = "backend/tests/support/.codex/auth.json"; },
    (r) => { r.bindings = []; },
    (r) => { r.bindings.push({ ...r.bindings[0]! }); },
    (r) => { r.bindings[0]!.declarationSha256 = "not-a-hash"; },
    (r) => { Object.assign(r, { originCommit: [] }); },
  ];
  for (const mutate of mutations) {
    const next = structuredClone(base);
    mutate(next.sourceAssets[0]!.moduleRelocations![0]!);
    expect(() => parseFixtureManifest(JSON.stringify(next))).toThrow("fixture_manifest_invalid");
  }
});
