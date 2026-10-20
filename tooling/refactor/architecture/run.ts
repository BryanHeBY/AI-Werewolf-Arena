/**
 * 负责当前公共源码的依赖、命名和中文职责说明检查，所有违规直接导致失败。
 * 输入为已跟踪及未忽略的新文件；输出为本次诊断与输入摘要，不读取历史提交或债务台账。
 * 私有配置、认证及安装目录不进入输入；源码及父路径读取前拒绝符号链接。
 * 自动检查只约束结构，职责、状态所有权和异常顺序仍需结合实现审查。
 */
import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { checkDependencies } from "./dependency-check";
import { checkComments } from "./comment-check";
import { checkNaming } from "./naming-check";
import {
  compiler,
  digest,
  sourceDigest,
  type ArchitectureFile,
  type ArchitectureInput,
  type ArchitectureReport,
  type ArchitectureViolation,
} from "./contracts";
const documentationPath = (file: string) =>
  /^(?:docs\/.*\.md|README\.md)$/.test(file) &&
  !file
    .split("/")
    .some(
      (part) => ["..", ".codex", ".aws", "auth.json"].includes(part) || part.startsWith(".env"),
    );
const sortFiles = (files: ArchitectureFile[]) =>
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
const publicRoots = [
  "apps/",
  "backend/src/",
  "backend/tests/",
  "backend/scripts/",
  "frontend/src/",
  "frontend/tests/",
  "frontend/scripts/",
  "packages/",
  "configs.example/",
  "tooling/refactor/",
];
const rootFiles = new Set([
  "package.json",
  "tooling/eslint.config.js",
  "tooling/browser-tests.ts",
  "tooling/media-browser-hosts.ts",
  "bun.lock",
  "bunfig.toml",
  "backend/package.json",
  "frontend/package.json",
  "backend/bunfig.toml",
  "frontend/bunfig.toml",
  "backend/tsconfig.json",
  "backend/tsconfig.tests.json",
  "frontend/tsconfig.json",
  "backend/eslint.config.cjs",
  "frontend/eslint.config.js",
  "frontend/playwright.config.ts",
  "frontend/vite.config.ts",
  "frontend/remotion.config.ts",
  ".prettierignore",
  ".prettierrc.json",
  ".editorconfig",
  "frontend/index.html",
  "frontend/README.md",
  "frontend/.gitignore",
]);
const normalizedPath = (value: string) => value.replaceAll("\\", "/");
function isPublicSourcePath(value: string): boolean {
  if (!value || value.startsWith("/") || /[\0\r\n]/.test(value)) return false;
  const parts = normalizedPath(value).split("/");
  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        ["node_modules", ".git", ".env", ".codex", ".aws", "auth.json"].includes(part),
    )
  )
    return false;
  if (parts.some((part) => part.startsWith(".env"))) return false;
  return rootFiles.has(value) || publicRoots.some((root) => value.startsWith(root));
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
  // Git 会列出被替换的源码根本身，不遍历其符号链接；先检查白名单祖先，再筛普通公共文件。
  const publicAncestors = new Set([
    "apps",
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
        (name) => isPublicSourcePath(name) || /^tsconfig(?:\.[a-zA-Z0-9_-]+)?\.json$/.test(name),
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
    if (missing) continue; // 已删除的跟踪输入按缺席记录，不补造旧源码。
    const bytes = await readFile(path.join(root, file));
    files.push({ path: file, text: bytes.toString(), sha256: digest(bytes) });
  }
  return { files: sortFiles(files), documentationPaths: listed.filter(documentationPath).sort() };
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
/** 当前所有文件使用同一严格政策，不再携带已清零的历史豁免。 */
export function checkArchitecture(
  repository: string,
  input: ArchitectureInput,
): ArchitectureReport {
  const failures = allViolations(repository, input);
  return {
    schema: "awa-architecture-report-v1",
    inputHash: sourceDigest(input.files),
    failures,
    counts: { files: input.files.length, violations: failures.length, failures: failures.length },
    policy: "所有现存违规均失败；结构检查不替代实际职责与行为审查。",
  };
}
if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.shift() !== "check") throw Error("architecture_command_invalid");
    let repository = process.cwd(),
      assigned = false;
    while (args.length) {
      const key = args.shift();
      if (key === "--strict") continue;
      if (key !== "--repository" || !args[0] || assigned)
        throw Error("architecture_arguments_invalid");
      repository = args.shift()!;
      assigned = true;
    }
    const report = checkArchitecture(repository, await readCurrentPublicInput(repository));
    console.log(JSON.stringify(report, null, 2));
    if (report.failures.length) process.exitCode = 1;
  } catch (error) {
    const code =
      error instanceof Error && /^architecture_[a-z_]+$/.test(error.message)
        ? error.message
        : "architecture_failed";
    console.error(JSON.stringify({ error: code }));
    process.exitCode = 1;
  }
}
