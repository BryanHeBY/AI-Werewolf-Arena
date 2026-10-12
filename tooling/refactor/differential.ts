/**
 * Compare two independently generated strict traces from fixed engine snapshots.
 * Input fingerprints may differ only as explicitly identified build metadata;
 * every request/event/operation/stock/knowledge/result/causal field is compared.
 * No unknown field is suppressed. Each child must replay under its own engine.
 * This verifies mechanical equivalence, not rule correctness or F01/F02 changes.
 */
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSnapshotUnchanged, freezeBuild, type BuildSnapshot } from "./build-snapshot";

export function comparableTrace(trace: unknown): unknown {
  if (!trace || typeof trace !== "object") throw Error("differential_trace_invalid");
  const copy = structuredClone(trace) as {
    record?: { metadata?: Record<string, unknown> };
    strictReplay?: Record<string, unknown>;
  };
  if (!copy.record?.metadata || !copy.strictReplay) throw Error("differential_trace_invalid");
  // Only these version fields differ. Engine ID and unknown fields still compare.
  const engine = copy.record.metadata.engine;
  if (!engine || typeof engine !== "object") throw Error("differential_engine_missing");
  for (const name of ["sourceHash", "lockHash", "commit"])
    delete (engine as Record<string, unknown>)[name];
  // Output location is an artifact address, not a field in the recorded protocol.
  delete copy.strictReplay.recordDir;
  return copy;
}

export function firstDifference(a: unknown, b: unknown, prefix = "$ "): string | null {
  if (Object.is(a, b)) return null;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return prefix.trim();
  if (Array.isArray(a) !== Array.isArray(b)) return prefix.trim();
  const ak = Object.keys(a).sort(),
    bk = Object.keys(b).sort();
  if (JSON.stringify(ak) !== JSON.stringify(bk)) return `${prefix.trim()}:keys`;
  for (const key of ak) {
    const different = firstDifference(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${prefix.trim()}.${key}`,
    );
    if (different) return different;
  }
  return null;
}

async function trace(build: BuildSnapshot, scenario: string, scratch: string, layout?: string) {
  await assertSnapshotUnchanged(build);
  const args = [
    process.execPath,
    "--no-env-file",
    path.join(import.meta.dir, "trace-game.ts"),
    build.root,
    scenario,
    scratch,
    ...(layout ? [layout] : []),
  ];
  const child = Bun.spawn(args, {
    cwd: build.root,
    stdout: "pipe",
    stderr: "pipe",
    env: { PATH: process.env.PATH ?? "", TMPDIR: "/tmp" },
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await assertSnapshotUnchanged(build);
  if (code !== 0) throw Error(`differential_child_failed: ${code}\n${stdout}\n${stderr}`);
  return JSON.parse(await readFile(path.join(scratch, "trace.json"), "utf8"));
}

export async function compareBuilds(options: {
  repository: string;
  scratch: string;
  baselineRevision: string;
  scenarios: string[];
  candidateLayout?: string;
  fixedBuilds?: { baseline: BuildSnapshot; candidate: BuildSnapshot };
}): Promise<void> {
  const scratch = path.resolve(options.scratch);
  await mkdir(scratch, { recursive: true });
  const baseline =
    options.fixedBuilds?.baseline ??
    (await freezeBuild(
      options.repository,
      path.join(scratch, "baseline"),
      options.baselineRevision,
    ));
  const candidate =
    options.fixedBuilds?.candidate ??
    (await freezeBuild(options.repository, path.join(scratch, "candidate"), null));
  if (baseline.revision !== options.baselineRevision && options.fixedBuilds)
    throw Error("differential_fixed_baseline_revision_mismatch");
  await assertSnapshotUnchanged(baseline);
  await assertSnapshotUnchanged(candidate);
  const driverFiles = [
    "trace-game.ts",
    "transcripts.ts",
    "differential.ts",
    "build-snapshot.ts",
    "inventory.ts",
  ];
  const driverDigest = async () => {
    const digest = createHash("sha256");
    for (const name of driverFiles)
      digest
        .update(name)
        .update("\0")
        .update(await readFile(path.join(import.meta.dir, name)))
        .update("\0");
    if (options.candidateLayout)
      digest.update("candidate-layout").update(await readFile(options.candidateLayout));
    return digest.digest("hex");
  };
  const driverHash = await driverDigest();
  const report = [];
  for (const [index, scenario] of options.scenarios.entries()) {
    const input = path.resolve(scenario),
      bytes = await readFile(input);
    const previous = await trace(baseline, input, path.join(scratch, `case-${index}/baseline`));
    if ((await driverDigest()) !== driverHash) throw Error("differential_driver_changed");
    const current = await trace(
      candidate,
      input,
      path.join(scratch, `case-${index}/candidate`),
      options.candidateLayout,
    );
    if (!bytes.equals(await readFile(input))) throw Error("differential_scenario_changed");
    if ((await driverDigest()) !== driverHash) throw Error("differential_driver_changed");
    const difference = firstDifference(comparableTrace(previous), comparableTrace(current));
    report.push({
      scenario: path.basename(input),
      inputHash: createHash("sha256").update(bytes).digest("hex"),
      difference,
    });
    await writeFile(
      path.join(scratch, "report.json"),
      JSON.stringify(
        { baseline: baseline.digest, candidate: candidate.digest, driverHash, cases: report },
        null,
        2,
      ) + "\n",
    );
    if (difference) throw Error(`differential_mismatch: ${scenario} at ${difference}`);
  }
}

if (import.meta.main) {
  const [repository, scratch, baselineRevision, ...scenarios] = process.argv.slice(2);
  if (!repository || !scratch || !baselineRevision || !scenarios.length)
    throw Error(
      "usage: differential.ts <repository> <empty-scratch> <baseline-commit> <scenario.json>...",
    );
  await compareBuilds({ repository, scratch, baselineRevision, scenarios });
}
