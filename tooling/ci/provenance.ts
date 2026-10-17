/**
 * 负责为每个 CI runner 写入可追溯的公开构建身份；输入为检出的源码、锁文件和运行环境。
 * 输出只含提交、Bun 版本和公开指纹，不读取个人配置、认证或模型凭据，不改写引擎身份政策。
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fingerprintEngine } from "../../backend/src/recording/reproduction/engine-fingerprint";

const root = path.resolve(import.meta.dir, "../..");
const manifest = await Bun.file(path.join(root, "package.json")).json();
if (manifest.packageManager !== `bun@${Bun.version}`) {
  throw new Error(
    `Bun version mismatch: expected ${manifest.packageManager}, got bun@${Bun.version}`,
  );
}
const directory = path.join(root, "ci-artifacts");
await mkdir(directory, { recursive: true });
await writeFile(
  path.join(directory, "provenance.json"),
  JSON.stringify(
    {
      commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      bun: Bun.version,
      bunRevision: Bun.revision,
      platform: process.platform,
      arch: process.arch,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      job: process.env.GITHUB_JOB ?? null,
      ...(await fingerprintEngine(root)),
    },
    null,
    2,
  ) + "\n",
);
