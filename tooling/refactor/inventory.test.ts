/**
 * Unit checks for inventory trust and discovery boundaries. Synthetic runner logs and
 * temporary Git blobs are the independent oracle: duplicate resolved titles retain
 * identity, Bun summary repeats do not become cases, and private/symlink inputs never
 * enter public manifests. No game engine, fixture callback or model is executed.
 */
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  assertResolvedLogSummary,
  isPublicInventoryPath,
  parseResolvedTestLog,
  readPublicGitBlobs,
  verifyFrozenExecutableInputs,
} from "./inventory";

test("public inventory rejects private and traversal paths before reading blobs", () => {
  for (const value of [
    "configs/runtime/providers.json",
    ".env",
    "backend/src/.env.local",
    "packages/x/auth.json",
    "backend/src/../../.codex/auth.json",
    "/tmp/x",
    "backend/src/node_modules/x.ts",
    "backend/src/x\n.ts",
  ])
    expect(isPublicInventoryPath(value)).toBe(false);
  for (const value of [
    "backend/src/game/example.ts",
    "frontend/tests/fixtures/player-views/a.json",
    "packages/game-text/src/index.ts",
    "configs.example/runtime/providers.json",
  ])
    expect(isPublicInventoryPath(value)).toBe(true);
});

test("resolved Bun cases keep duplicate occurrences and ignore repeated skip summary", () => {
  const log = [
    "tests/runtime/sample.test.ts:",
    "(pass) Matrix > case [1.25ms]",
    "(pass) Matrix > case [2.00ms]",
    "(skip) conditional case",
    "",
    "1 tests skipped:",
    "(skip) conditional case",
    " 2 pass",
    " 1 skip",
  ].join("\n");
  const cases = parseResolvedTestLog(log, "backend", "sample.log");
  expect(cases).toHaveLength(3);
  expect(cases.map((row) => row.occurrence)).toEqual([1, 2, 1]);
  expect(new Set(cases.map((row) => row.id)).size).toBe(3);
  expect(cases.map((row) => row.title)).toEqual([
    "Matrix > case",
    "Matrix > case",
    "conditional case",
  ]);
  expect(cases.every((row) => row.path === "backend/tests/runtime/sample.test.ts")).toBe(true);
});

test("frontend prefixes and Chromium project/location preserve resolved case identity", () => {
  const unit = parseResolvedTestLog(
    'ai-werewolf-arena-frontend test: tests/unit/replay/a.test.ts:\nai-werewolf-arena-frontend test: (pass) zh-CN/{"target":3} [0.52ms]',
    "frontend-unit",
    "frontend.log",
  );
  expect(unit[0]?.path).toBe("frontend/tests/unit/replay/a.test.ts");
  expect(unit[0]?.title).toBe('zh-CN/{"target":3}');
  const browser = parseResolvedTestLog(
    "[1/2] [chromium] › tests/e2e/a.spec.ts:7:4 › suite › en\r[2/2] [chromium] › tests/e2e/a.spec.ts:7:4 › suite › zh-CN",
    "chromium",
    "chromium.log",
  );
  expect(browser).toHaveLength(2);
  expect(browser[0]).toMatchObject({
    project: "chromium",
    line: 7,
    column: 4,
    status: "listed",
    title: "suite › en",
  });
  expect(browser[0]?.id).not.toBe(browser[1]?.id);
});

test("fixed Git blobs exclude a tracked local secret and reject public symlink", () => {
  const repository = mkdtempSync(path.join(tmpdir(), "awa-inventory-unit-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repository, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  try {
    git("init", "-q");
    mkdirSync(path.join(repository, "backend/src"), { recursive: true });
    mkdirSync(path.join(repository, "configs/runtime"), { recursive: true });
    writeFileSync(path.join(repository, "backend/src/a.ts"), "export const value = 1;\n");
    writeFileSync(
      path.join(repository, "configs/runtime/providers.json"),
      '{"secret":"sentinel-secret"}',
    );
    git("add", ".");
    git(
      "-c",
      "user.name=Inventory Unit",
      "-c",
      "user.email=inventory@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
    const first = readPublicGitBlobs(repository, git("rev-parse", "HEAD"));
    expect(first.files.map((file) => file.path)).toEqual(["backend/src/a.ts"]);
    expect(first.files[0]?.bytes.toString()).toBe("export const value = 1;\n");
    expect(JSON.stringify(first)).not.toContain("sentinel-secret");
    symlinkSync("a.ts", path.join(repository, "backend/src/link.ts"));
    git("add", ".");
    git(
      "-c",
      "user.name=Inventory Unit",
      "-c",
      "user.email=inventory@example.invalid",
      "commit",
      "-qm",
      "symlink",
    );
    expect(() => readPublicGitBlobs(repository, git("rev-parse", "HEAD"))).toThrow(
      "inventory_symlink_rejected",
    );
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test("commit input cannot become a Git option or revision expression", () => {
  for (const value of ["HEAD", "--all", "27a97cb:path", "27a97cb^{tree}", "27a97cb\nHEAD"])
    expect(() => readPublicGitBlobs(process.cwd(), value)).toThrow("inventory_commit_invalid");
});

test("accepted exit alone cannot cover a truncated title listing", () => {
  const log =
    "tests/runtime/a.test.ts:\n(pass) one [1.00ms]\n 2 pass\n 0 fail\nRan 2 tests across 1 files.";
  const cases = parseResolvedTestLog(log, "backend", "a.log");
  expect(() => assertResolvedLogSummary(log, "backend", cases)).toThrow(
    "inventory_evidence_summary_mismatch",
  );
  const complete = log.replace("2 pass", "1 pass").replace("Ran 2 tests", "Ran 1 tests");
  expect(() => assertResolvedLogSummary(complete, "backend", cases)).not.toThrow();
  expect(() =>
    assertResolvedLogSummary("Running 2 tests using 1 worker\n 2 passed (1s)", "chromium", []),
  ).toThrow("inventory_evidence_summary_mismatch");
});

test("frozen execution requires identical before/after hashes and input membership", () => {
  const bytes = Buffer.from("export const value=1;\n"),
    hash = createHash("sha256").update(bytes).digest("hex");
  const files = [
    {
      path: "backend/src/game/engine/phase_manager.ts",
      bytes,
      mode: "100644",
      blob: "1".repeat(40),
    },
  ];
  const before = [{ path: files[0]!.path, sha256: hash }];
  expect(verifyFrozenExecutableInputs(before, structuredClone(before), files)).toMatchObject({
    executableInputs: 1,
    matched: 1,
  });
  expect(() =>
    verifyFrozenExecutableInputs(before, [{ path: files[0]!.path, sha256: "0".repeat(64) }], files),
  ).toThrow("inventory_evidence_inputs_changed");
  expect(() => verifyFrozenExecutableInputs(before, [], files)).toThrow(
    "inventory_evidence_inputs_changed",
  );
  expect(() =>
    verifyFrozenExecutableInputs(
      before,
      [...before, { path: "backend/src/new.ts", sha256: hash }],
      files,
    ),
  ).toThrow("inventory_evidence_inputs_changed");
  expect(() => verifyFrozenExecutableInputs(before, undefined, files)).toThrow(
    "inventory_evidence_inputs_invalid",
  );
  expect(() =>
    verifyFrozenExecutableInputs([...before, ...before], [...before, ...before], files),
  ).toThrow("inventory_evidence_inputs_invalid");
  expect(() =>
    verifyFrozenExecutableInputs(
      [{ path: files[0]!.path, sha256: "0".repeat(64) }],
      [{ path: files[0]!.path, sha256: "0".repeat(64) }],
      files,
    ),
  ).toThrow("inventory_evidence_build_mismatch");
});

test("matching incomplete manifests cannot omit root scripts lock or preload configuration", () => {
  const bytes = Buffer.from("public baseline input"),
    hash = createHash("sha256").update(bytes).digest("hex");
  const paths = ["backend/src/example.ts", "package.json", "bun.lock", "bunfig.toml"];
  const files = paths.map((path) => ({ path, bytes, mode: "100644", blob: "1".repeat(40) }));
  const rows = paths.map((path) => ({ path, sha256: hash }));
  expect(verifyFrozenExecutableInputs(rows, rows, files)).toMatchObject({
    executableInputs: 4,
    matched: 4,
  });
  for (const missing of paths.slice(1)) {
    const incomplete = rows.filter((row) => row.path !== missing);
    expect(() => verifyFrozenExecutableInputs(incomplete, incomplete, files)).toThrow(
      "inventory_evidence_input_coverage_missing",
    );
  }
});
