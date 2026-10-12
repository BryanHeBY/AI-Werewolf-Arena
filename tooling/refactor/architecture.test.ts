/**
 * Unit architecture gate tests use synthetic source graphs and literal violations
 * as independent oracles. They verify import/export/alias boundaries, AST header
 * placement and vocabulary, immutable debt handling, new/modified file strictness
 * and mechanical path mappings. No production module, role resolver, private
 * configuration or model adapter is executed to derive these expectations.
 */
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  compiler,
  digest,
  sourceDigest,
  type ArchitectureDebt,
  type ArchitectureInput,
} from "./architecture/contracts";
import { checkDependencies } from "./architecture/dependency-check";
import { checkComments } from "./architecture/comment-check";
import { checkNaming } from "./architecture/naming-check";
import {
  allViolations,
  BASELINE_COMMIT,
  checkArchitecture,
  readCurrentPublicInput,
} from "./architecture/run";

const ts = compiler(process.cwd());
const input = (
  rows: Record<string, string>,
  documentationPaths: string[] = [],
): ArchitectureInput => ({
  files: Object.entries(rows).map(([path, text]) => ({ path, text, sha256: digest(text) })),
  documentationPaths,
});
const pkg = (name: string, exports: unknown = { ".": "./src/index.ts" }, dependencies = {}) =>
  JSON.stringify({ name, exports, dependencies });
const header =
  "/** Owns a pure transformation. Inputs are detached values; outputs are returned data. Only this module writes its result; no external side effects. */\n";
const rules = (value: ArchitectureInput) => checkDependencies(ts, value).map((row) => row.rule);
const debt = (value: ArchitectureInput): ArchitectureDebt => ({
  schema: "awa-architecture-debt-v1",
  generatedBy: "tooling/refactor/architecture/run.ts",
  baselineCommit: BASELINE_COMMIT,
  baselineInputHash: sourceDigest(value.files),
  files: value.files.map(({ path, sha256 }) => ({ path, sha256 })),
  violations: allViolations(process.cwd(), value),
  policy: "unit fixture, not a production debt replacement",
});

test("feature internals reject while its explicit public contract is allowed", () => {
  const privateGraph = input({
    "backend/src/features/a/effect.ts": "import {x} from '../b/authority';",
    "backend/src/features/b/authority.ts": "export const x=1;",
  });
  expect(rules(privateGraph)).toContain("dependency.feature-internal");
  const publicGraph = input({
    "backend/src/features/a/effect.ts": "import {x} from '../b/contracts';",
    "backend/src/features/b/contracts.ts": "export const x=1;",
  });
  expect(rules(publicGraph)).toEqual([]);
});

test("adapters and engine cannot reach role authority through import or re-export", () => {
  const graph = input({
    "backend/src/ai/agents/player/test.ts":
      "export {x} from '../../../game/mechanisms/roles/fox/authority';",
    "backend/src/game/engine/test.ts": "import {x} from '../mechanisms/roles/fox/authority';",
    "backend/src/game/mechanisms/roles/fox/authority.ts": "export const x=1;",
  });
  expect(rules(graph)).toEqual(["dependency.adapter-feature", "dependency.engine-feature"]);
});

test("cross package deep path fails while declared package and subpath exports resolve", () => {
  const graph = input({
    "packages/a/package.json": pkg("@ai-werewolf-arena/a", {
      ".": "./src/index.ts",
      "./facts": "./src/facts.ts",
    }),
    "frontend/package.json": pkg("frontend", undefined, { "@ai-werewolf-arena/a": "workspace:*" }),
    "packages/a/src/index.ts": "export const x=1;",
    "packages/a/src/facts.ts": "export const f=1;",
    "frontend/src/a.ts":
      "import {x} from '../../packages/a/src/index'; import {f} from '@ai-werewolf-arena/a/facts';",
  });
  expect(rules(graph)).toEqual(["dependency.package-internal"]);
  graph.files.find((row) => row.path === "frontend/src/a.ts")!.text =
    "import {x} from '@ai-werewolf-arena/a'; import {f} from '@ai-werewolf-arena/a/private';";
  expect(rules(graph)).toEqual(["dependency.package-export"]);
});

test("unknown alias and workspace package never become default exemptions", () => {
  expect(
    rules(
      input({
        "frontend/src/a.ts":
          "import x from '@/missing'; import y from '@ai-werewolf-arena/unknown';",
      }),
    ),
  ).toEqual(["dependency.unknown-package", "dependency.unknown-workspace"]);
  expect(
    rules(
      input({
        "frontend/tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
        "frontend/src/a.ts": "import x from '@/missing';",
      }),
    ),
  ).toEqual(["dependency.unresolved-alias"]);
});

test("configured browser alias resolves before applying backend and runtime boundaries", () => {
  const graph = input({
    "frontend/tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
    "frontend/src/a.ts":
      "import {x} from '@/b'; import {y} from '../../backend/src/a'; import fs from 'node:fs';",
    "frontend/src/b.ts": "export const x=1;",
    "backend/src/a.ts": "export const y=1;",
  });
  expect(rules(graph)).toEqual(["dependency.frontend-backend", "dependency.browser-runtime"]);
  expect(rules(input({ "packages/a/src/index.ts": "import x from 'node:crypto';" }))).toEqual([
    "dependency.browser-runtime",
  ]);
});

test("type imports, require and dynamic imports cannot conceal implementation access", () => {
  const graph = input({
    "backend/src/features/a/x.ts":
      "type T=typeof import('../b/authority'); const y=require('../b/authority'); import('../b/authority');",
    "backend/src/features/b/authority.ts": "export const x=1;",
  });
  expect(rules(graph)).toEqual(Array(3).fill("dependency.feature-internal"));
  expect(rules(input({ "backend/src/features/a/x.ts": "import(getModuleName());" }))).toEqual([
    "dependency.dynamic-target",
  ]);
});

test("unknown external package rejects, declared consuming dependency is allowed", () => {
  const graph = input({
    "backend/package.json": pkg("backend", undefined, { zod: "4" }),
    "backend/src/x.ts": "import {z} from 'zod'; import y from 'unknown-package';",
  });
  expect(rules(graph)).toEqual(["dependency.unknown-package"]);
});

test("declared public exports cannot hide a shared package dependency cycle", () => {
  const graph = input({
    "packages/a/package.json": pkg("@ai-werewolf-arena/a", undefined, {
      "@ai-werewolf-arena/b": "workspace:*",
    }),
    "packages/b/package.json": pkg("@ai-werewolf-arena/b", undefined, {
      "@ai-werewolf-arena/a": "workspace:*",
    }),
    "packages/a/src/index.ts": "import {b} from '@ai-werewolf-arena/b'; export const a=1;",
    "packages/b/src/index.ts": "import {a} from '@ai-werewolf-arena/a'; export const b=1;",
  });
  expect(rules(graph)).toEqual(Array(4).fill("dependency.package-cycle"));
});

test("responsibility header must precede imports and rejects empty placeholders", () => {
  expect(
    checkComments(
      ts,
      input({ "backend/src/a.ts": "import fs from 'node:fs';\n" + header + "export const x=1;" }),
    ).map((row) => row.rule),
  ).toEqual(["comment.missing-head"]);
  expect(
    checkComments(
      ts,
      input({ "backend/src/a.ts": "/** 负责本文件相关逻辑。 */\nexport const x=1;" }),
    ).map((row) => row.rule),
  ).toEqual(["comment.placeholder"]);
  expect(
    checkComments(
      ts,
      input({ "backend/src/a.ts": "// @ts-nocheck\n" + header + "export const x=1;" }),
    ),
  ).toEqual([]);
  expect(
    checkComments(
      ts,
      input({
        "backend/src/a.ts":
          "#!/usr/bin/env bun\n/**\n * Copyright Example Authors\n * SPDX-License-Identifier: MIT\n */\n/* eslint-disable no-console */\n" +
          header +
          "export const x=1;",
      }),
    ),
  ).toEqual([]);
});

test("state and adapter heads require their lifecycle and transport contract fields", () => {
  const state = checkComments(
    ts,
    input({
      "backend/src/features/a/authority.ts":
        "/** Owns mutable state and writes only canonical values. */\nexport const x=1;",
    }),
  );
  expect(state.map((row) => row.rule)).toEqual(["comment.terminal"]);
  const adapter = checkComments(
    ts,
    input({
      "backend/src/ai/integrations/client.ts":
        "/** Owns a network session; inputs are DTOs, outputs are received facts. Only detached data crosses this boundary. */\nexport const x=1;",
    }),
  );
  expect(adapter.map((row) => row.rule)).toEqual(["comment.deadline", "comment.cancellation"]);
});

test("contract links resolve only against public file names", () => {
  const source = header + "export const x=1;";
  const linked = source.replace(
    "no external side effects",
    "no external side effects; see [contract](../../docs/contracts/a.md)",
  );
  expect(checkComments(ts, input({ "backend/src/a.ts": linked }, ["docs/contracts/a.md"]))).toEqual(
    [],
  );
  expect(checkComments(ts, input({ "backend/src/a.ts": linked })).map((row) => row.rule)).toEqual([
    "comment.broken-link",
  ]);
});

test("development names reject production paths and leave historical test names separate", () => {
  const graph = input({
    "backend/src/features/p9e-cat/authority.ts": "",
    "backend/src/game/player_extended_state.ts": "",
    "backend/tests/rules/p9e-review.test.ts": "",
  });
  expect(checkNaming(graph).map((row) => row.rule)).toEqual([
    "naming.development-prefix",
    "naming.extended-bag",
  ]);
});

test("baseline legacy debt is reported, new files and modified heads fail immediately", () => {
  const base = input({ "backend/src/a.ts": "export const x=1;" }),
    frozen = debt(base);
  const same = checkArchitecture(process.cwd(), base, frozen);
  expect(same.failures).toEqual([]);
  expect(same.remainingDebt).toHaveLength(1);
  const changed = input({
    "backend/src/a.ts": "export const x=2;",
    "backend/src/new.ts": "export const y=1;",
  });
  expect(checkArchitecture(process.cwd(), changed, frozen).failures.map((row) => row.path)).toEqual(
    ["backend/src/a.ts", "backend/src/new.ts"],
  );
  const fixed = input({ "backend/src/a.ts": header + "export const x=1;" });
  expect(checkArchitecture(process.cwd(), fixed, frozen).counts).toMatchObject({
    failures: 0,
    remainingDebt: 0,
    clearedDebt: 1,
  });
  expect(checkArchitecture(process.cwd(), base, frozen, { strict: true }).failures).toHaveLength(1);
  expect(frozen.violations).toHaveLength(1);
});

test("approved mechanical mapping preserves bytes; changed bytes cannot carry debt", () => {
  const base = input({ "backend/src/old.ts": "export const x=1;" }),
    frozen = debt(base);
  const mappings = [
    {
      from: "backend/src/old.ts",
      to: "backend/src/new.ts",
      reason: "approved public path migration",
    },
  ];
  const pure = input({ "backend/src/new.ts": "export const x=1;" });
  expect(checkArchitecture(process.cwd(), pure, frozen, { mappings }).counts).toMatchObject({
    failures: 0,
    remainingDebt: 1,
  });
  const changed = input({ "backend/src/new.ts": "export const x=2;" });
  expect(
    checkArchitecture(process.cwd(), changed, frozen, { mappings }).failures.map((row) => row.rule),
  ).toContain("mapping.not-mechanical");
});

test("baseline file digest cannot be edited without detection", () => {
  const base = input({ "backend/src/a.ts": "export const x=1;" }),
    frozen = debt(base);
  frozen.files[0]!.sha256 = "0".repeat(64);
  expect(() => checkArchitecture(process.cwd(), base, frozen)).toThrow(
    "architecture_debt_input_mismatch",
  );
});

test("current discovery includes untracked public source and excludes private configuration", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "awa-architecture-input-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
    mkdirSync(path.join(root, "backend/src"), { recursive: true });
    mkdirSync(path.join(root, "configs/runtime"), { recursive: true });
    writeFileSync(path.join(root, "backend/src/new.ts"), "export const untracked=1;");
    writeFileSync(
      path.join(root, "configs/runtime/providers.json"),
      '{"private":"sentinel-private"}',
    );
    const current = await readCurrentPublicInput(root);
    expect(current.files.map((row) => row.path)).toEqual(["backend/src/new.ts"]);
    expect(JSON.stringify(current)).not.toContain("sentinel-private");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("public ancestor symlink is rejected before reading the external source bytes", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "awa-architecture-link-")),
    external = mkdtempSync(path.join(tmpdir(), "awa-architecture-outside-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
    mkdirSync(path.join(root, "backend"));
    writeFileSync(path.join(external, "outside.ts"), "sentinel-do-not-read");
    symlinkSync(external, path.join(root, "backend/src"));
    await expect(readCurrentPublicInput(root)).rejects.toThrow(
      "architecture_input_symlink_rejected",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});

// Maintained literal counterexamples from independent C04/C05 review.
const reviewInput = input;
const reviewDependencies = (rows: Record<string, string>) => checkDependencies(ts, input(rows));
const reviewDebt = debt;
test("import equals require form must not hide a cross-feature internal dependency", () => {
  expect(
    reviewDependencies({
      "backend/src/features/a/effect.ts": "import other = require('../b/effect');",
      "backend/src/features/b/effect.ts": "export const x=1;",
    }).map((x) => x.rule),
  ).toContain("dependency.feature-internal");
});
test("nested private index is not automatically another feature public exit", () => {
  expect(
    reviewDependencies({
      "backend/src/features/a/effect.ts": "import {x} from '../b/private/index';",
      "backend/src/features/b/private/index.ts": "export const x=1;",
    }).map((x) => x.rule),
  ).toContain("dependency.feature-internal");
});
test("domain source cannot import a production mechanism implementation", () => {
  expect(
    reviewDependencies({
      "backend/src/domain/state.ts": "import {x} from '../features/b/effect';",
      "backend/src/features/b/effect.ts": "export const x=1;",
    }).length,
  ).toBeGreaterThan(0);
});
test("independent verifier cannot import production rule algorithm", () => {
  expect(
    reviewDependencies({
      "backend/src/recording/verification/b/verify.ts":
        "import {x} from '../../../features/b/effect';",
      "backend/src/features/b/effect.ts": "export const x=1;",
    }).length,
  ).toBeGreaterThan(0);
});
test("unbounded export star cannot widen another feature implementation debt", () => {
  const base = reviewInput({
    "backend/src/features/a/effect.ts":
      header + "import {x} from '../b/effect'; export const value=x;",
    "backend/src/features/b/effect.ts": header + "export const x=1; export const hidden=2;",
  });
  const next = reviewInput({
    "backend/src/features/a/effect.ts": header + "export * from '../b/effect';",
    "backend/src/features/b/effect.ts": header + "export const x=1; export const hidden=2;",
  });
  expect(checkArchitecture(process.cwd(), next, reviewDebt(base)).failures.length).toBeGreaterThan(
    0,
  );
});
test("extra imported symbol on a historical forbidden edge is new debt", () => {
  const base = reviewInput({
    "backend/src/features/a/effect.ts":
      header + "import {x} from '../b/effect'; export const value=x;",
    "backend/src/features/b/effect.ts": header + "export const x=1; export const hidden=2;",
  });
  const next = reviewInput({
    "backend/src/features/a/effect.ts":
      header + "import {x,hidden} from '../b/effect'; export const value=hidden;",
    "backend/src/features/b/effect.ts": header + "export const x=1; export const hidden=2;",
  });
  expect(checkArchitecture(process.cwd(), next, reviewDebt(base)).failures.length).toBeGreaterThan(
    0,
  );
});
test("declared backend workspace name is not an external package for frontend", () => {
  expect(
    reviewDependencies({
      "backend/package.json": JSON.stringify({
        name: "backend",
        exports: { ".": "./src/index.ts" },
      }),
      "backend/src/index.ts": "export const x=1;",
      "frontend/package.json": JSON.stringify({
        name: "frontend",
        dependencies: { backend: "workspace:*" },
      }),
      "frontend/src/app.ts": "import {x} from 'backend';",
    }).map((x) => x.rule),
  ).toContain("dependency.frontend-backend");
});
test("tsconfig extends must preserve inherited alias ownership", () => {
  expect(
    reviewDependencies({
      "tsconfig.base.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "server/*": ["backend/src/*"] } },
      }),
      "frontend/tsconfig.json": JSON.stringify({ extends: "../tsconfig.base.json" }),
      "backend/src/effect.ts": "export const x=1;",
      "frontend/src/app.ts": "import {x} from 'server/effect';",
    }).map((x) => x.rule),
  ).toContain("dependency.frontend-backend");
});
test("baseUrl bare source resolution cannot silently pass as external npm declaration", () => {
  expect(
    reviewDependencies({
      "frontend/package.json": JSON.stringify({
        name: "frontend",
        dependencies: { backend: "workspace:*" },
      }),
      "frontend/tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".." } }),
      "backend/src/effect.ts": "export const x=1;",
      "frontend/src/app.ts": "import {x} from 'backend/src/effect';",
    }).map((x) => x.rule),
  ).toContain("dependency.frontend-backend");
});
test("self-maintained mjs script needs its responsibility header", () => {
  expect(
    checkComments(ts, reviewInput({ "backend/scripts/check.mjs": "export const x=1;" })).map(
      (x) => x.rule,
    ),
  ).toContain("comment.missing-head");
});
test("self-maintained mts module needs its responsibility header", () => {
  expect(
    checkComments(ts, reviewInput({ "backend/src/module.mts": "export const x=1;" })).map(
      (x) => x.rule,
    ),
  ).toContain("comment.missing-head");
});
test("declared package export cannot point into another package private source", () => {
  expect(
    reviewDependencies({
      "packages/a/package.json": JSON.stringify({
        name: "@ai-werewolf-arena/a",
        exports: { ".": "./../b/src/private.ts" },
      }),
      "packages/b/package.json": JSON.stringify({
        name: "@ai-werewolf-arena/b",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/b/src/index.ts": "export const x=1;",
      "packages/b/src/private.ts": "export const hidden=2;",
      "frontend/src/app.ts": "import {hidden} from '@ai-werewolf-arena/a';",
    }).length,
  ).toBeGreaterThan(0);
});
test("package metadata cycle is detected even before imports consume the declared dependency", () => {
  expect(
    reviewDependencies({
      "packages/a/package.json": JSON.stringify({
        name: "@ai-werewolf-arena/a",
        exports: { ".": "./src/index.ts" },
        dependencies: { "@ai-werewolf-arena/b": "workspace:*" },
      }),
      "packages/b/package.json": JSON.stringify({
        name: "@ai-werewolf-arena/b",
        exports: { ".": "./src/index.ts" },
        dependencies: { "@ai-werewolf-arena/a": "workspace:*" },
      }),
      "packages/a/src/index.ts": "export const a=1;",
      "packages/b/src/index.ts": "export const b=1;",
    }).length,
  ).toBeGreaterThan(0);
});
test("production import cannot read test fixture through a relative path", () => {
  expect(
    reviewDependencies({
      "backend/src/features/a/effect.ts": "import {expected} from '../../../tests/support/oracle';",
      "backend/tests/support/oracle.ts": "export const expected=1;",
    }).length,
  ).toBeGreaterThan(0);
});
test("bare local rule-card reference must resolve to an existing document", () => {
  expect(
    checkComments(
      ts,
      reviewInput({
        "backend/src/a.ts":
          header.replace(
            "no external side effects",
            "no external side effects; Rule contract: docs/rules/nonexistent.md",
          ) + "export const x=1;",
      }),
    ).map((x) => x.rule),
  ).toContain("comment.broken-link");
});

test("TypeScript moduleSuffixes resolves its actual public owner instead of a basename fallback", () => {
  const graph = input({
    "frontend/tsconfig.json": JSON.stringify({
      compilerOptions: { baseUrl: "..", moduleSuffixes: [".native", ""] },
    }),
    "frontend/src/app.ts": "import {x} from 'backend/src/effect';",
    "backend/src/effect.native.ts": "export const x=1;",
    "backend/src/effect.ts": "export const x=2;",
  });
  const violation = checkDependencies(ts, graph).find(
    (row) => row.rule === "dependency.frontend-backend",
  );
  expect(violation?.target).toBe("backend/src/effect.native.ts");
});
