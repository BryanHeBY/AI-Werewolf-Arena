/**
 * 负责把离线快速门禁分成可独立执行的检查组；输入为唯一组名，输出为原命令日志和失败退出码。
 * 只调度公开配置下的现有检查，不重试失败、不运行长场景回归，也不改写录制或游戏源码。
 */
import path from "node:path";

const root = path.resolve(import.meta.dir, "../..");
const suites = {
  quality: [
    ["run", "check"],
    ["run", "lint:backend"],
    ["run", "lint:frontend"],
    ["run", "lint:workbench"],
    ["run", "format:check"],
  ],
  shared: [
    ["run", "test:tooling"],
    ["run", "test:ci"],
    ["run", "test:packages"],
    ["run", "build:backend"],
  ],
  backend: [
    [
      "test",
      "--preload",
      "./tests/setup.ts",
      "./tests/unit",
      "./tests/architecture",
      "./tests/integration",
    ],
  ],
  frontend: [
    ["run", "test:workbench"],
    ["run", "build:workbench"],
    ["run", "test:frontend"],
    ["run", "build:frontend"],
  ],
} satisfies Record<string, string[][]>;

const suite = process.argv[2];
if (process.argv.length !== 3 || !suite || !Object.hasOwn(suites, suite)) {
  console.error(`Usage: bun tooling/ci/fast.ts <${Object.keys(suites).join("|")}>`);
  process.exit(2);
}

for (const args of suites[suite as keyof typeof suites]) {
  console.info(`$ bun --no-env-file ${args.join(" ")}`);
  const child = Bun.spawn([process.execPath, "--no-env-file", ...args], {
    // 后端夹具保留既有相对 cwd 契约，与 backend/package.json 的测试入口一致。
    cwd: suite === "backend" ? path.join(root, "backend") : root,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
  // 原退出码直接上交 GitHub；后续组内检查不会掩盖首次失败。
  const code = await child.exited;
  if (code !== 0) process.exit(code);
}
