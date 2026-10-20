/**
 * 单元测试核对源码 fixture 的精确导入迁移及声明证据。
 * 输入为手写源码和畸形清单记录；独立 binding 集合、字面字段与明确改动的函数体是预期。
 * 输出验证同源路径迁移和拒绝边界，不执行适配器、归档扫描、传输或对局，
 * 不调用生产规则生成预期，也不改写 fixture 字节或冻结的声明摘要。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { compiler } from "./architecture/contracts";
import {
  parseFixtureManifest,
  generateFixtureManifest,
  sourceProgramContract,
  sourceDeclarationContract,
  sourcePackageRelocationEvidence,
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
  expect(sourceProgramContract(ts, next, file, true, [], [relocation])).toEqual(
    sourceProgramContract(ts, old, file, false, []),
  );
  expect(() =>
    sourceProgramContract(
      ts,
      next.replace("check as verify", "other as verify"),
      file,
      true,
      [],
      [relocation],
    ),
  ).toThrow("source_module_relocation_binding_drift");
  expect(() =>
    sourceProgramContract(
      ts,
      'import * as verify from "../../support/oracles/new";',
      file,
      true,
      [],
      [relocation],
    ),
  ).toThrow("source_module_relocation_requires_named_import");
  expect(() => sourceProgramContract(ts, "verify(7);", file, true, [], [relocation])).toThrow(
    "source_module_relocation_unused",
  );
  expect(
    sourceProgramContract(
      ts,
      next.replace('"literal_action"', '"changed_action"'),
      file,
      true,
      [],
      [relocation],
    ),
  ).not.toEqual(sourceProgramContract(ts, old, file, false, []));
});

test("source declaration evidence retains complete function and data members", () => {
  const before = "export function check(value: number) { return value + 1; }";
  expect(sourceDeclarationContract(ts, before, "old.ts", "check")).toEqual(
    sourceDeclarationContract(ts, "// moved\n" + before, "new.ts", "check"),
  );
  expect(sourceDeclarationContract(ts, before, "old.ts", "check")).not.toEqual(
    sourceDeclarationContract(ts, before.replace("+ 1", "+ 2"), "new.ts", "check"),
  );
  expect(() => sourceDeclarationContract(ts, before + "\n" + before, "bad.ts", "check")).toThrow(
    "source_module_declaration_identity",
  );
  expect(() =>
    sourceDeclarationContract(ts, before.replace("export ", ""), "private.ts", "check"),
  ).toThrow("source_module_declaration_requires_named_export");
  expect(() =>
    sourceDeclarationContract(
      ts,
      before.replace("export function", "export default function"),
      "default.ts",
      "check",
    ),
  ).toThrow("source_module_declaration_requires_named_export");
});

test("source relocation manifest rejects private paths and malformed or duplicate evidence", () => {
  const base = structuredClone(manifest) as FixtureManifest;
  base.sourceAssets[0]!.moduleRelocations = [structuredClone(relocation)];
  expect(() => parseFixtureManifest(JSON.stringify(base))).not.toThrow();
  const mutations: Array<(r: FixtureSourceModuleRelocation) => void> = [
    (r) => {
      r.currentPath = "backend/tests/support/.codex/auth.json";
    },
    (r) => {
      r.bindings = [];
    },
    (r) => {
      r.bindings.push({ ...r.bindings[0]! });
    },
    (r) => {
      r.bindings[0]!.declarationSha256 = "not-a-hash";
    },
    (r) => {
      Object.assign(r, { originCommit: [] });
    },
  ];
  for (const mutate of mutations) {
    const next = structuredClone(base);
    mutate(next.sourceAssets[0]!.moduleRelocations![0]!);
    expect(() => parseFixtureManifest(JSON.stringify(next))).toThrow("fixture_manifest_invalid");
  }
});

// 这三项是新生产类型 relocation 的独立输入；现有 support 迁移三声明不因目录迁移重跑。
const productionTypeRoute: FixtureSourceModuleRelocation = {
  originPath: "backend/src/ai/integrations/acp/acp_mcp_bridge.ts",
  currentPath: "backend/src/adapters/acp/acp-mcp-bridge.ts",
  originCommit: "a".repeat(40),
  bindings: [{ name: "AcpMcpServerConfig", declarationSha256: "1".repeat(64) }],
};

test("production fixture type relocation retains named type-only imports and full type declarations", () => {
  const file = "backend/tests/fixtures/acp/test-agent.ts";
  for (const clause of [
    "import type { AcpMcpServerConfig as Config }",
    "import { type AcpMcpServerConfig as Config }",
  ]) {
    const before = `${clause} from "../../../src/ai/integrations/acp/acp_mcp_bridge"; const config: Config | undefined = undefined;`;
    const after = before.replace(
      "../../../src/ai/integrations/acp/acp_mcp_bridge",
      "../../../src/adapters/acp/acp-mcp-bridge",
    );
    expect(sourceProgramContract(ts, after, file, true, [], [productionTypeRoute])).toEqual(
      sourceProgramContract(ts, before, file, false, []),
    );
  }
  const first =
    "export interface AcpMcpServerConfig { args: string[]; env: Array<{ name: string; value: string }>; }";
  const alias =
    "export type AcpMcpServerConfig = { args: string[]; env: Array<{ name: string; value: string }>; };";
  expect(sourceDeclarationContract(ts, first, "first.ts", "AcpMcpServerConfig", true)).toBe(
    "export interface AcpMcpServerConfig {\n    args: string[];\n    env: Array<{\n        name: string;\n        value: string;\n    }>;\n}",
  );
  expect(sourceDeclarationContract(ts, alias, "alias.ts", "AcpMcpServerConfig", true)).toContain(
    "export type AcpMcpServerConfig = {",
  );
  expect(
    sourceDeclarationContract(
      ts,
      alias.replace("value: string", "value: number"),
      "changed.ts",
      "AcpMcpServerConfig",
      true,
    ),
  ).not.toEqual(sourceDeclarationContract(ts, alias, "alias.ts", "AcpMcpServerConfig", true));
});

test("production fixture type relocation rejects value loading and undeclared production paths", () => {
  const file = "backend/tests/fixtures/acp/test-agent.ts";
  expect(() =>
    sourceProgramContract(
      ts,
      'import { AcpMcpServerConfig } from "../../../src/adapters/acp/acp-mcp-bridge";',
      file,
      true,
      [],
      [productionTypeRoute],
    ),
  ).toThrow("source_module_relocation_requires_type_only_import");
  expect(() =>
    sourceProgramContract(
      ts,
      'import * as bridge from "../../../src/adapters/acp/acp-mcp-bridge";',
      file,
      true,
      [],
      [productionTypeRoute],
    ),
  ).toThrow("source_module_relocation_requires_named_import");
  expect(() =>
    sourceDeclarationContract(
      ts,
      "export class AcpMcpServerConfig {}",
      "class.ts",
      "AcpMcpServerConfig",
      true,
    ),
  ).toThrow("source_module_relocation_requires_type_declaration");
  const mutations: Array<(route: FixtureSourceModuleRelocation) => void> = [
    (route) => {
      route.currentPath = "backend/src/adapters/acp/other.ts";
    },
    (route) => {
      route.originPath = "backend/src/ai/integrations/acp/other.ts";
    },
    (route) => {
      route.currentPath = "backend/src/adapters/acp/../acp/acp-mcp-bridge.ts";
    },
    (route) => {
      route.currentPath = "backend/src/.codex/auth.ts";
    },
    (route) => {
      route.bindings[0]!.name = "AcpMcpControlServer";
    },
  ];
  const accepted = structuredClone(manifest) as FixtureManifest;
  accepted.sourceAssets[0]!.moduleRelocations = [structuredClone(productionTypeRoute)];
  expect(() => parseFixtureManifest(JSON.stringify(accepted))).not.toThrow();
  for (const mutate of mutations) {
    const next = structuredClone(accepted);
    mutate(next.sourceAssets[0]!.moduleRelocations![0]!);
    expect(() => parseFixtureManifest(JSON.stringify(next))).toThrow("fixture_manifest_invalid");
  }
});

test("production fixture type relocation refuses Git symlink mode and a current declaration symlink", async () => {
  // 临时 Git 只通过 alternates 读取当前仓库的公开固定对象；不 checkout、不复制配置凭据、不写原仓库。
  const repository = process.cwd();
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "awa-fixture-type-relocation-"));
  try {
    execFileSync("git", ["clone", "--quiet", "--shared", "--no-checkout", repository, temporary], {
      maxBuffer: 4 * 1024 * 1024,
    });
    const document = structuredClone(manifest) as FixtureManifest;
    const typeRoute = document.sourceAssets[0]!.moduleRelocations?.find(
      (entry) =>
        entry.currentPath.replace(/^packages\/game-runtime\//, "backend/") ===
        productionTypeRoute.currentPath,
    );
    if (!typeRoute) throw Error("production_type_route_fixture_not_applied");
    const inputs = new Set([
      "tooling/refactor/fixtures/source-inventory.json",
      "tooling/refactor/fixtures/manifest.json",
      "packages/game-runtime/package.json",
      ...document.sourceAssets.map((asset) => asset.currentPath),
      ...document.sourceAssets.flatMap((asset) =>
        (asset.moduleRelocations ?? []).map((route) => route.currentPath),
      ),
    ]);
    for (const relative of inputs) {
      await fs.mkdir(path.dirname(path.join(temporary, relative)), { recursive: true });
      await fs.copyFile(path.join(repository, relative), path.join(temporary, relative));
    }
    // compiler(root) 沿原工具入口定位已安装 TypeScript；此链接不是 safeFile 允许读取的公开输入。
    await fs.mkdir(path.join(temporary, "packages/game-runtime/node_modules"), { recursive: true });
    await fs.symlink(
      await fs.realpath(path.join(repository, "packages/game-runtime/node_modules/typescript")),
      path.join(temporary, "packages/game-runtime/node_modules/typescript"),
      "dir",
    );
    const originCommit = typeRoute.originCommit;
    const previous = execFileSync("git", ["show", `${originCommit}:${typeRoute.originPath}`], {
      cwd: temporary,
    });
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: temporary,
      input: previous,
      encoding: "utf8",
    }).trim();
    execFileSync("git", ["read-tree", originCommit], { cwd: temporary });
    execFileSync(
      "git",
      ["update-index", "--add", "--cacheinfo", `120000,${blob},${typeRoute.originPath}`],
      { cwd: temporary },
    );
    const tree = execFileSync("git", ["write-tree"], { cwd: temporary, encoding: "utf8" }).trim();
    typeRoute.originCommit = execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture mode probe",
        "-c",
        "user.email=fixture@example.invalid",
        "commit-tree",
        tree,
        "-p",
        originCommit,
      ],
      { cwd: temporary, input: "synthetic public type mode\n", encoding: "utf8" },
    ).trim();
    await fs.writeFile(
      path.join(temporary, "tooling/refactor/fixtures/manifest.json"),
      JSON.stringify(document),
    );
    await expect(generateFixtureManifest(temporary)).rejects.toThrow(
      "source_module_relocation_git_file_required",
    );
    typeRoute.originCommit = originCommit;
    await fs.writeFile(
      path.join(temporary, "tooling/refactor/fixtures/manifest.json"),
      JSON.stringify(document),
    );
    const current = path.join(temporary, typeRoute.currentPath);
    const target = path.join(temporary, "public-type-control.ts");
    await fs.rename(current, target);
    await fs.symlink(target, current, "file");
    await expect(generateFixtureManifest(temporary)).rejects.toThrow("symlink_rejected");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

// 新历史公共退桥仅逆两个真实资产的导入；不修改原源程序摘要，也不扩大生产模块读取。
const historicalAudit = "backend/tests/support/builders/audit-summary.ts";
const historicalMist = "backend/tests/support/features/mist-raven/oracles/transport.ts";
const historicalPairs = [
  { originPath: "backend/tests/support/audit_summary_fixture.ts", currentPath: historicalAudit },
  {
    originPath: "backend/tests/support/mist_raven_transport_oracle.ts",
    currentPath: historicalMist,
  },
];

test("historical fixture package retirement normalizes only the two exact named import forms", () => {
  const beforeAudit =
    'import type { Locale } from "@ai-werewolf-arena/game-catalog"; export const heading: Locale = "en";';
  const currentAudit = beforeAudit.replace(
    "@ai-werewolf-arena/game-catalog",
    "@ai-werewolf-arena/game-contract",
  );
  expect(sourceProgramContract(ts, currentAudit, historicalAudit, true, historicalPairs)).toEqual(
    sourceProgramContract(
      ts,
      beforeAudit,
      "backend/tests/support/audit_summary_fixture.ts",
      false,
      [],
    ),
  );
  const beforeMist =
    'import { MIST_RAVEN_EVENT_TYPES, readMistRavenFact } from "@ai-werewolf-arena/game-text"; const wire = "raven_unsealed"; const fact = readMistRavenFact(wire, { day: 1 });';
  const currentMist = beforeMist.replace(
    "@ai-werewolf-arena/game-text",
    "@ai-werewolf-arena/game-contract/facts/mist-raven",
  );
  expect(sourceProgramContract(ts, currentMist, historicalMist, true, historicalPairs)).toEqual(
    sourceProgramContract(
      ts,
      beforeMist,
      "backend/tests/support/mist_raven_transport_oracle.ts",
      false,
      [],
    ),
  );
  expect(
    sourceProgramContract(
      ts,
      currentMist.replace('"raven_unsealed"', '"literal_changed"'),
      historicalMist,
      true,
      historicalPairs,
    ),
  ).not.toEqual(sourceProgramContract(ts, beforeMist, "old.ts", false, []));
});

test("historical fixture package retirement retains path binding mode alias and body rejection", () => {
  const current =
    'import type { Locale } from "@ai-werewolf-arena/game-contract"; export const heading: Locale = "en";';
  const original = current.replace(
    "@ai-werewolf-arena/game-contract",
    "@ai-werewolf-arena/game-catalog",
  );
  const expected = sourceProgramContract(ts, original, "old.ts", false, []);
  expect(
    sourceProgramContract(
      ts,
      current,
      "backend/tests/support/builders/other.ts",
      true,
      historicalPairs,
    ),
  ).not.toEqual(expected);
  expect(() =>
    sourceProgramContract(ts, current, historicalAudit, true, [
      { originPath: "backend/tests/support/other.ts", currentPath: historicalAudit },
    ]),
  ).toThrow("historical_package_asset_pair");
  expect(() =>
    sourceProgramContract(
      ts,
      current.replace("game-contract", "other-contract"),
      historicalAudit,
      true,
      historicalPairs,
    ),
  ).toThrow("historical_package_import_missing");
  expect(() =>
    sourceProgramContract(
      ts,
      current.replace("import type", "import"),
      historicalAudit,
      true,
      historicalPairs,
    ),
  ).toThrow("historical_package_import_mode");
  expect(() =>
    sourceProgramContract(
      ts,
      current.replace("Locale }", "Role }"),
      historicalAudit,
      true,
      historicalPairs,
    ),
  ).toThrow("historical_package_import_binding");
  expect(() =>
    sourceProgramContract(
      ts,
      current.replace("{ Locale }", "* as Types"),
      historicalAudit,
      true,
      historicalPairs,
    ),
  ).toThrow("historical_package_requires_named_import");
  expect(
    sourceProgramContract(
      ts,
      current.replaceAll("Locale", "Local").replace("{ Local }", "{ Locale as Local }"),
      historicalAudit,
      true,
      historicalPairs,
    ),
  ).not.toEqual(expected);
  expect(
    sourceProgramContract(
      ts,
      current.replace('"en"', '"zh-CN"'),
      historicalAudit,
      true,
      historicalPairs,
    ),
  ).not.toEqual(expected);
  expect(() =>
    sourceProgramContract(
      ts,
      'import type { MIST_RAVEN_EVENT_TYPES, readMistRavenFact } from "@ai-werewolf-arena/game-contract/facts/mist-raven";',
      historicalMist,
      true,
      historicalPairs,
    ),
  ).toThrow("historical_package_import_mode");
});

test("historical fixture package retirement requires the original export chain and complete dependency declarations", () => {
  const asset = {
    originPath: "backend/tests/support/audit_summary_fixture.ts",
    currentPath: historicalAudit,
    originCommit: "442703cded8a5eb8c749bfcd3ce29b1d6a04e1cc",
  };
  const locale =
    'export const LOCALES = ["zh-CN", "en"] as const; export type Locale = (typeof LOCALES)[number];';
  const originalFiles = [
    {
      path: "packages/game-catalog/package.json",
      text: '{"name":"@ai-werewolf-arena/game-catalog","exports":{".":"./src/index.ts"}}',
    },
    {
      path: "packages/game-catalog/src/index.ts",
      text: 'export type { Locale } from "@ai-werewolf-arena/game-contract";',
    },
    {
      path: "packages/game-contract/package.json",
      text: '{"name":"@ai-werewolf-arena/game-contract","exports":{".":"./src/index.ts"}}',
    },
    {
      path: "packages/game-contract/src/index.ts",
      text: 'export type { Locale } from "./locale";',
    },
    { path: "packages/game-contract/src/locale.ts", text: locale },
  ];
  const currentFiles = originalFiles.filter((entry) =>
    entry.path.startsWith("packages/game-contract/"),
  );
  expect(
    sourcePackageRelocationEvidence(ts, asset, originalFiles, currentFiles).map(
      (entry) => entry.name,
    ),
  ).toEqual(["LOCALES", "Locale"]);
  expect(() =>
    sourcePackageRelocationEvidence(
      ts,
      asset,
      originalFiles,
      currentFiles.map((entry) =>
        entry.path.endsWith("/index.ts")
          ? { ...entry, text: 'export type { Locale } from "./other";' }
          : entry,
      ),
    ),
  ).toThrow("historical_package_reexport_endpoint");
  expect(() =>
    sourcePackageRelocationEvidence(
      ts,
      asset,
      originalFiles,
      currentFiles.map((entry) =>
        entry.path.endsWith("/locale.ts")
          ? { ...entry, text: locale.replace('["zh-CN", "en"]', '["en"]') }
          : entry,
      ),
    ),
  ).toThrow("historical_package_complete_declaration_drift");
  expect(() =>
    sourcePackageRelocationEvidence(
      ts,
      { ...asset, originCommit: "a".repeat(40) },
      originalFiles,
      currentFiles,
    ),
  ).toThrow("historical_package_origin_commit");
  expect(() =>
    sourcePackageRelocationEvidence(
      ts,
      { ...asset, originPath: "backend/tests/support/other.ts" },
      originalFiles,
      currentFiles,
    ),
  ).toThrow("historical_package_origin_identity");
  const wrongOrigin = structuredClone(manifest) as FixtureManifest;
  wrongOrigin.sourceAssets.find(
    (entry) =>
      entry.currentPath.replace(/^packages\/game-runtime\//, "backend/") === historicalAudit,
  )!.originPath = "backend/tests/support/other.ts";
  expect(() => parseFixtureManifest(JSON.stringify(wrongOrigin))).toThrow(
    "historical_package_origin_identity",
  );
});
