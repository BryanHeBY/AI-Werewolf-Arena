/**
 * Runs dependency, naming and responsibility-contract gates over public sources.
 * Input is either immutable Git baseline 27a97cb or current tracked plus untracked
 * public files; output is a JSON debt manifest or candidate report. Only baseline
 * generation creates debt. Checks never update it, and changed/new TypeScript
 * files must clear their responsibility-head debt immediately. Source and parent
 * symlinks are rejected before file reads; private configs and auth are excluded.
 * Legacy exceptions are reported, strict final mode rejects all remaining debt,
 * and semantic correctness of contract prose remains a separate review duty.
 */
import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isPublicInventoryPath, readPublicGitBlobs } from "../inventory";
import { checkDependencies } from "./dependency-check";
import { checkComments } from "./comment-check";
import { checkNaming } from "./naming-check";
import {
  compiler,
  digest,
  isTypedSource,
  sourceDigest,
  violation,
  type ArchitectureDebt,
  type ArchitectureFile,
  type ArchitectureInput,
  type ArchitectureReport,
  type ArchitectureViolation,
  type PathMapping,
} from "./contracts";

export const BASELINE_COMMIT = "27a97cb66e8f30fceb7cb20130154291559dd14a";
const documentationPath = (file: string) =>
  /^(?:docs\/.*\.md|README\.md)$/.test(file) &&
  !file
    .split("/")
    .some(
      (part) => ["..", ".codex", ".aws", "auth.json"].includes(part) || part.startsWith(".env"),
    );
const sortFiles = (files: ArchitectureFile[]) =>
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
async function readGateData(repository: string, requested: string): Promise<unknown> {
  const root = await realpath(repository),
    target = path.resolve(requested);
  const relative = path.relative(root, target).replaceAll(path.sep, "/");
  if (
    !/^docs\/refactor\/[a-zA-Z0-9_./-]+\.json$/.test(relative) ||
    relative
      .split("/")
      .some(
        (part) => ["..", "auth.json", ".codex", ".aws"].includes(part) || part.startsWith(".env"),
      )
  )
    throw Error("architecture_gate_data_path_invalid");
  const parts = relative.split("/");
  for (let i = 1; i <= parts.length; i++)
    if ((await lstat(path.join(root, ...parts.slice(0, i)))).isSymbolicLink())
      throw Error("architecture_gate_data_symlink_rejected");
  return JSON.parse(await readFile(target, "utf8"));
}
export async function readCurrentPublicInput(repository: string): Promise<ArchitectureInput> {
  const root = await realpath(repository);
  const listed = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 },
  )
    .toString()
    .split("\0")
    .filter(Boolean);
  // Git lists a replaced source root itself rather than traversing its symlink.
  // Validate those allowlisted ancestors before filtering ordinary public files.
  const publicAncestors = new Set([
    "backend",
    "frontend",
    "tooling",
    "backend/src",
    "backend/tests",
    "backend/scripts",
    "frontend/src",
    "frontend/tests",
    "frontend/scripts",
    "packages",
    "configs.example",
    "tooling/refactor",
  ]);
  for (const name of listed.filter((entry) => publicAncestors.has(entry))) {
    if ((await lstat(path.join(root, name))).isSymbolicLink())
      throw Error("architecture_input_symlink_rejected");
  }
  const paths = [...new Set(listed)]
      .filter(
        (name) => isPublicInventoryPath(name) || /^tsconfig(?:\.[a-zA-Z0-9_-]+)?\.json$/.test(name),
      )
      .sort(),
    files: ArchitectureFile[] = [],
    checked = new Set<string>();
  for (const file of paths) {
    const parts = file.split("/");
    let missing = false;
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join("/");
      if (checked.has(prefix)) continue;
      let stat;
      try {
        stat = await lstat(path.join(root, prefix));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          missing = true;
          break;
        }
        throw Error("architecture_input_unreadable");
      }
      if (stat.isSymbolicLink()) throw Error("architecture_input_symlink_rejected");
      if ((i < parts.length && !stat.isDirectory()) || (i === parts.length && !stat.isFile()))
        throw Error("architecture_input_not_file");
      checked.add(prefix);
    }
    if (missing) continue; // Deleted tracked inputs are represented by their absence.
    const bytes = await readFile(path.join(root, file));
    files.push({ path: file, text: bytes.toString(), sha256: digest(bytes) });
  }
  return { files: sortFiles(files), documentationPaths: listed.filter(documentationPath).sort() };
}
export function readBaselinePublicInput(repository: string): ArchitectureInput {
  const { files } = readPublicGitBlobs(repository, BASELINE_COMMIT);
  const docs = execFileSync("git", ["ls-tree", "-r", "--name-only", BASELINE_COMMIT], {
    cwd: repository,
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .split("\n")
    .filter(documentationPath)
    .sort();
  return {
    files: files.map((file) => ({
      path: file.path,
      text: file.bytes.toString(),
      sha256: digest(file.bytes),
    })),
    documentationPaths: docs,
  };
}
export function allViolations(
  repository: string,
  input: ArchitectureInput,
): ArchitectureViolation[] {
  const ts = compiler(repository),
    rows = [...checkDependencies(ts, input), ...checkComments(ts, input), ...checkNaming(input)];
  return [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) =>
    a.path < b.path
      ? -1
      : a.path > b.path
        ? 1
        : a.rule < b.rule
          ? -1
          : a.rule > b.rule
            ? 1
            : a.id < b.id
              ? -1
              : 1,
  );
}
export function generateBaselineDebt(repository: string): ArchitectureDebt {
  const input = readBaselinePublicInput(repository);
  return {
    schema: "awa-architecture-debt-v1",
    generatedBy: "tooling/refactor/architecture/run.ts",
    baselineCommit: BASELINE_COMMIT,
    baselineInputHash: sourceDigest(input.files),
    files: input.files.map(({ path, sha256 }) => ({ path, sha256 })),
    violations: allViolations(repository, input),
    policy:
      "Immutable 27a97cb debt. New violations fail; changed/new TS responsibility heads are strict. Approved path mappings preserve exact bytes. Final strict mode permits zero debt. Prose truth requires human review.",
  };
}

export function checkArchitecture(
  repository: string,
  input: ArchitectureInput,
  debt: ArchitectureDebt,
  options: { strict?: boolean; mappings?: PathMapping[] } = {},
): ArchitectureReport {
  if (
    debt.schema !== "awa-architecture-debt-v1" ||
    debt.baselineCommit !== BASELINE_COMMIT ||
    !Array.isArray(debt.files) ||
    !Array.isArray(debt.violations)
  )
    throw Error("architecture_debt_invalid");
  if (
    digest(
      JSON.stringify(
        [...debt.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      ),
    ) !== debt.baselineInputHash
  )
    throw Error("architecture_debt_input_mismatch");
  const mappings = options.mappings ?? [],
    mappedPaths = new Map<string, string>(),
    originals = new Map(debt.files.map((file) => [file.path, file.sha256]));
  const mappingFailures: ArchitectureViolation[] = [];
  for (const map of mappings) {
    if (
      !map.reason?.trim() ||
      !isPublicInventoryPath(map.from) ||
      !isPublicInventoryPath(map.to) ||
      map.from === map.to ||
      mappedPaths.has(map.to) ||
      mappings.some((other) => other !== map && other.from === map.from)
    )
      throw Error("architecture_mapping_invalid");
    const candidate = input.files.find((file) => file.path === map.to);
    if (
      !candidate ||
      candidate.sha256 !== originals.get(map.from) ||
      input.files.some((file) => file.path === map.from)
    )
      mappingFailures.push(
        violation(
          "mapping.not-mechanical",
          map.to,
          1,
          1,
          "Approved path mapping must preserve baseline bytes and remove its original source.",
        ),
      );
    else mappedPaths.set(map.to, map.from);
  }
  const baselineViolations = new Map(debt.violations.map((row) => [row.id, row])),
    failures = [...mappingFailures],
    remainingDebt: ArchitectureViolation[] = [],
    matched = new Set<string>();
  const currentViolations = allViolations(repository, input),
    byPath = new Map(input.files.map((file) => [file.path, file]));
  for (const row of currentViolations) {
    const originalPath = mappedPaths.get(row.path) ?? row.path;
    const legacy = [...baselineViolations.values()].find(
      (old) =>
        old.rule === row.rule &&
        old.path === originalPath &&
        (old.specifier ?? "") === (row.specifier ?? "") &&
        (old.binding ?? "") === (row.binding ?? "") &&
        (old.target ?? "") === (mappedPaths.get(row.target ?? "") ?? row.target ?? "") &&
        (old.rule.startsWith("comment.") || old.detail === row.detail),
    );
    const changed = byPath.get(row.path)!.sha256 !== originals.get(originalPath);
    if (
      !legacy ||
      options.strict ||
      (row.rule.startsWith("comment.") && isTypedSource(row.path) && changed)
    )
      failures.push(row);
    else {
      remainingDebt.push(row);
      matched.add(legacy.id);
    }
  }
  return {
    schema: "awa-architecture-report-v1",
    inputHash: sourceDigest(input.files),
    failures,
    remainingDebt,
    clearedDebt: debt.violations
      .filter(
        (row) =>
          !matched.has(row.id) && !currentViolations.some((current) => current.id === row.id),
      )
      .map((row) => row.id),
    counts: {
      files: input.files.length,
      violations: currentViolations.length,
      failures: failures.length,
      remainingDebt: remainingDebt.length,
      clearedDebt: debt.violations.filter(
        (row) =>
          !matched.has(row.id) && !currentViolations.some((current) => current.id === row.id),
      ).length,
    },
    policy:
      "AST checks shape and position; human review validates contract truth. Historical debt is reported, never rewritten. This gate is not gameplay acceptance.",
  };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2),
      command = args.shift(),
      options = new Map<string, string>(),
      flags = new Set<string>();
    if (!["baseline-debt", "check"].includes(command ?? ""))
      throw Error("architecture_command_invalid");
    while (args.length) {
      const key = args.shift()!;
      if (key === "--strict") {
        flags.add(key);
        continue;
      }
      if (!["--repository", "--debt", "--mappings"].includes(key) || !args[0] || options.has(key))
        throw Error("architecture_arguments_invalid");
      options.set(key, args.shift()!);
    }
    const repository = options.get("--repository") ?? process.cwd();
    if (command === "baseline-debt")
      console.log(JSON.stringify(generateBaselineDebt(repository), null, 2));
    else {
      const debtPath =
        options.get("--debt") ??
        path.join(repository, "docs/refactor/generated/architecture-debt.json");
      const debt = (await readGateData(repository, debtPath)) as ArchitectureDebt;
      // Recompute from immutable Git so a rewritten debt file cannot silently approve a regression.
      if (JSON.stringify(debt) !== JSON.stringify(generateBaselineDebt(repository)))
        throw Error("architecture_debt_baseline_changed");
      const mappings = options.has("--mappings")
        ? ((await readGateData(repository, options.get("--mappings")!)) as PathMapping[])
        : [];
      const report = checkArchitecture(repository, await readCurrentPublicInput(repository), debt, {
        strict: flags.has("--strict"),
        mappings,
      });
      console.log(JSON.stringify(report, null, 2));
      if (report.failures.length) process.exitCode = 1;
    }
  } catch (error) {
    const code =
      error instanceof Error && /^architecture_[a-z_]+$/.test(error.message)
        ? error.message
        : "architecture_failed";
    console.error(JSON.stringify({ error: code }));
    process.exitCode = 1;
  }
}
