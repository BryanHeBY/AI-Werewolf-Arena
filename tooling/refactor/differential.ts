/**
 * 负责比较两个固定引擎快照独立产生的严格复现轨迹。输入为两份轨迹及显式构建元数据；
 * 输出为首个差异或通过，请求、事件、操作、库存、知识、结果和因果字段均参与比较，不忽略未知字段。
 * 每个子进程必须先在自己的引擎下完成严格复现；该工具验证机械等价，不证明规则正确或 F01／F02 行为修正。
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
  // 仅移除这三个构建身份字段；引擎 ID 和未知扩展字段仍须一致。
  const engine = copy.record.metadata.engine;
  if (!engine || typeof engine !== "object") throw Error("differential_engine_missing");
  for (const name of ["sourceHash", "lockHash", "commit"])
    delete (engine as Record<string, unknown>)[name];
  // 只略过复现输出目录这一产物地址，不删录制协议内的路径或其它未知字段。
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
  await assertSnapshotUnchanged(build, { dependencies: false });
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
  await assertSnapshotUnchanged(build, { dependencies: false });
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
  let failure: unknown;
  try {
    // 每个输入按“旧构建→新构建”执行；场景和驱动文件在比较间隙也必须保持原字节。
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
  } catch (error) {
    failure = error;
  }
  // 较重的依赖树核验放在整批前后；每个子进程的源码／元数据字节与成员集合仍即时核对。
  const verified = await Promise.allSettled([
    assertSnapshotUnchanged(baseline),
    assertSnapshotUnchanged(candidate),
  ]);
  const errors = [
    ...(failure ? [failure] : []),
    ...verified.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
  ];
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, "differential_batch_failed");
}

if (import.meta.main) {
  const [repository, scratch, baselineRevision, ...scenarios] = process.argv.slice(2);
  if (!repository || !scratch || !baselineRevision || !scenarios.length)
    throw Error(
      "usage: differential.ts <repository> <empty-scratch> <baseline-commit> <scenario.json>...",
    );
  await compareBuilds({ repository, scratch, baselineRevision, scenarios });
}
