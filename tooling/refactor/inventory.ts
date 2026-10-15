/**
 * 负责盘点固定 Git 构建的公开源码、测试发现、fixture 字节与包契约。输入为仓库、固定提交及可选冻结离线证据；
 * 输出为脱离运行对象的 JSON 清单，只读取 Git blob，不执行应用、私有配置、测试回调或模型适配器。
 * 历史测试标题只有在全部可执行证据输入与本构建逐字节匹配时才接纳；AST 声明与参数展开后的实际案例分别记录。
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type * as TypeScript from "typescript";

// 六根保留历史盘点口径；目录迁移后的现行精确身份由 recording/reproduction/engine-fingerprint.ts 枚举。
const sourceRoots = [
  "backend/src/core",
  "backend/src/game",
  "backend/src/app",
  "packages/game-catalog/src",
  "packages/game-text/src",
  "packages/replay-contract/src",
] as const;
const publicRoots = [
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
const evidenceLogs = [
  "backend-shard-1.log",
  "backend-shard-2.log",
  "backend-shard-3.log",
  "backend-shard-4.log",
  "backend-shard-5.log",
  "backend-shard-6.log",
  "backend-timing.log",
  "frontend-unit.log",
  "chromium.log",
] as const;
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const ordered = <T extends { path: string }>(rows: T[]) =>
  rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
const normalizedPath = (value: string) => value.replaceAll("\\", "/");

export function isPublicInventoryPath(value: string): boolean {
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

export interface PublicBlob {
  path: string;
  bytes: Buffer;
  mode: string;
  blob: string;
}

export function verifyFrozenExecutableInputs(
  before: unknown,
  after: unknown,
  files: readonly PublicBlob[],
) {
  // 双向核对输入成员与字节：前后相同仍不足够，还必须覆盖本构建全部指定可执行输入。
  const isExecutable = (file: string) =>
    /^(backend|frontend|packages|configs\.example)\//.test(file) ||
    ["package.json", "bun.lock", "bunfig.toml"].includes(file);
  const parse = (value: unknown) => {
    if (
      !Array.isArray(value) ||
      value.some(
        (row) =>
          !row ||
          typeof row !== "object" ||
          typeof row.path !== "string" ||
          typeof row.sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(row.sha256),
      )
    )
      throw Error("inventory_evidence_inputs_invalid");
    const rows = value as { path: string; sha256: string }[];
    if (new Set(rows.map((row) => row.path)).size !== rows.length)
      throw Error("inventory_evidence_inputs_invalid");
    return rows;
  };
  const beforeRows = parse(before),
    afterRows = parse(after);
  const executable = (rows: { path: string; sha256: string }[]) =>
    rows
      .filter((row) => isExecutable(row.path))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const previous = executable(beforeRows),
    current = executable(afterRows);
  if (JSON.stringify(previous) !== JSON.stringify(current))
    throw Error("inventory_evidence_inputs_changed");
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const row of previous)
    if (
      !isPublicInventoryPath(row.path) ||
      !byPath.has(row.path) ||
      sha(byPath.get(row.path)!.bytes) !== row.sha256
    )
      throw Error("inventory_evidence_build_mismatch");
  for (const file of files)
    if (isExecutable(file.path) && !previous.some((row) => row.path === file.path))
      throw Error("inventory_evidence_input_coverage_missing");
  return {
    executableInputs: previous.length,
    matched: previous.length,
    omittedNonExecutable: beforeRows.length - previous.length,
    omittedAfterNonExecutable: afterRows.length - current.length,
  };
}
export function readPublicGitBlobs(
  repository: string,
  requestedCommit: string,
): { commit: string; files: PublicBlob[] } {
  if (!/^[a-f0-9]{7,40}$/.test(requestedCommit)) throw Error("inventory_commit_invalid");
  const git = (args: string[], input?: string) =>
    execFileSync("git", args, {
      cwd: repository,
      input,
      stdio: ["pipe", "pipe", "ignore"],
      maxBuffer: 256 * 1024 * 1024,
    });
  const commit = git(["rev-parse", "--verify", `${requestedCommit}^{commit}`])
    .toString()
    .trim();
  const entries = git(["ls-tree", "-r", "-z", commit])
    .toString()
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const match = /^(\d+) blob ([a-f0-9]+)\t(.+)$/.exec(row);
      if (!match) return null;
      return { mode: match[1]!, blob: match[2]!, path: match[3]! };
    })
    .filter((row): row is NonNullable<typeof row> => !!row && isPublicInventoryPath(row.path));
  if (entries.some((row) => row.mode === "120000")) throw Error("inventory_symlink_rejected");
  const output = git(["cat-file", "--batch"], entries.map((row) => row.blob).join("\n") + "\n");
  let offset = 0;
  const files = entries.map((row) => {
    const end = output.indexOf(10, offset),
      header = output.subarray(offset, end).toString();
    const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
    if (!match || match[1] !== row.blob) throw Error("inventory_blob_invalid");
    const length = Number(match[2]);
    offset = end + 1;
    const bytes = Buffer.from(output.subarray(offset, offset + length));
    offset += length + 1;
    if (bytes.length !== length) throw Error("inventory_blob_truncated");
    return { ...row, bytes };
  });
  return { commit, files: ordered(files) };
}

export interface ResolvedTestCase {
  id: string;
  runner: string;
  path: string;
  title: string;
  occurrence: number;
  status: "pass" | "skip" | "fail" | "listed";
  evidence: string;
  project?: string;
  line?: number;
  column?: number;
}
export function parseResolvedTestLog(
  log: string,
  runner: string,
  evidence: string,
): ResolvedTestCase[] {
  const rows: ResolvedTestCase[] = [],
    occurrences = new Map<string, number>();
  let file: string | undefined;
  for (const raw of log.replace(/\x1b\[[0-9;]*m/g, "").split(/[\r\n]+/)) {
    const line = raw.replace(/^ai-werewolf-arena-frontend test: /, "");
    // Bun 尾部会重复跳过／失败标题且没有文件上下文；清空归属，不能把汇总重复算作案例。
    if (/^\d+ tests? (?:skipped|failed):$/.test(line)) {
      file = undefined;
      continue;
    }
    const header = /^(tests\/[^:]+\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]sx?)):$/.exec(line);
    if (header) {
      file = `${runner === "backend" ? "backend" : "frontend"}/${header[1]}`;
      continue;
    }
    const browser = /^\[\d+\/\d+\] \[([^\]]+)\] › (tests\/.*?):(\d+):(\d+) › (.*)$/.exec(line);
    const test = /^\((pass|skip|fail)\) (.*?)(?: \[\d+(?:\.\d+)?ms\])?$/.exec(line);
    if (!browser && (!test || !file)) continue;
    const target = browser ? `frontend/${browser[2]}` : file!;
    const title = browser ? browser[5]! : test![2]!;
    // 同名参数案例保留出现次数；浏览器 project 也参与身份，不按标题去重。
    const key = `${runner}\0${target}\0${browser?.[1] ?? ""}\0${title}`;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    rows.push({
      id: sha(`${key}\0${occurrence}`),
      runner,
      path: target,
      title,
      occurrence,
      status: browser ? "listed" : (test![1] as ResolvedTestCase["status"]),
      evidence,
      ...(browser
        ? { project: browser[1]!, line: Number(browser[3]), column: Number(browser[4]) }
        : {}),
    });
  }
  return rows;
}

export function assertResolvedLogSummary(
  log: string,
  runner: string,
  cases: ResolvedTestCase[],
): void {
  const text = log
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/^ai-werewolf-arena-frontend test: /gm, "");
  if (runner === "chromium") {
    const total = /Running (\d+) tests using/.exec(text),
      passed = /(?:^|\n)\s*(\d+) passed\s*\(/.exec(text);
    if (
      !total ||
      !passed ||
      Number(total[1]) !== cases.length ||
      Number(passed[1]) !== cases.length
    )
      throw Error("inventory_evidence_summary_mismatch");
  } else {
    for (const status of ["pass", "skip", "fail"] as const) {
      const summary = new RegExp(`(?:^|\\n)\\s*(\\d+) ${status}(?:\\s|$)`).exec(text);
      if (Number(summary?.[1] ?? 0) !== cases.filter((row) => row.status === status).length)
        throw Error("inventory_evidence_summary_mismatch");
    }
    const total = /Ran (\d+) tests across (\d+) files/.exec(text);
    if (
      !total ||
      Number(total[1]) !== cases.length ||
      Number(total[2]) !== new Set(cases.map((row) => row.path)).size
    )
      throw Error("inventory_evidence_summary_mismatch");
  }
}

interface Declaration {
  // 这是语法位置身份与待展开的表达式，不代表测试已经运行；resolvedCases 才描述日志中的执行项。
  id: string;
  path: string;
  line: number;
  column: number;
  kind: string;
  titleExpression: string;
  title: string | null;
  modifiers: string[];
  parameterization: { kind: string; expression: string; line: number }[];
}
function declarationInventory(ts: typeof TypeScript, file: PublicBlob) {
  const source = ts.createSourceFile(
    file.path,
    file.bytes.toString(),
    ts.ScriptTarget.Latest,
    true,
    file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declarations: Declaration[] = [],
    strings: string[] = [],
    exports: { name: string; kind: string; line: number }[] = [];
  const location = (node: TypeScript.Node) => {
    const p = source.getLineAndCharacterOfPosition(node.getStart(source));
    return { line: p.line + 1, column: p.character + 1 };
  };
  const callRoot = (
    expression: TypeScript.Expression,
  ): { name: string; modifiers: string[]; matrix?: TypeScript.Expression } | null => {
    if (ts.isIdentifier(expression))
      return ["test", "it", "describe"].includes(expression.text)
        ? { name: expression.text, modifiers: [] }
        : null;
    if (ts.isPropertyAccessExpression(expression)) {
      const result = callRoot(expression.expression);
      return result ? { ...result, modifiers: [...result.modifiers, expression.name.text] } : null;
    }
    if (ts.isCallExpression(expression)) {
      const result = callRoot(expression.expression);
      return result?.modifiers.includes("each")
        ? { ...result, matrix: expression.arguments[0] }
        : null;
    }
    if (ts.isTaggedTemplateExpression(expression)) {
      const result = callRoot(expression.tag);
      return result ? { ...result, matrix: expression.template } : null;
    }
    return null;
  };
  const visit = (node: TypeScript.Node) => {
    if (ts.isStringLiteralLike(node)) strings.push(node.text);
    if (ts.isCallExpression(node)) {
      const root = callRoot(node.expression),
        titleNode = node.arguments[0];
      if (
        root &&
        titleNode &&
        node.arguments.some((arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))
      ) {
        const pos = location(node),
          title = ts.isStringLiteralLike(titleNode) ? titleNode.text : null;
        const parameterization: Declaration["parameterization"] = root.matrix
          ? [
              {
                kind: "each",
                expression: root.matrix.getText(source),
                line: location(root.matrix).line,
              },
            ]
          : [];
        for (
          let parent: TypeScript.Node | undefined = node.parent;
          parent;
          parent = parent.parent
        ) {
          if (ts.isForOfStatement(parent) || ts.isForInStatement(parent))
            parameterization.push({
              kind: "loop",
              expression: parent.expression.getText(source),
              line: location(parent).line,
            });
          else if (ts.isForStatement(parent))
            parameterization.push({
              kind: "loop",
              expression: [
                parent.initializer?.getText(source),
                parent.condition?.getText(source),
                parent.incrementor?.getText(source),
              ]
                .filter(Boolean)
                .join("; "),
              line: location(parent).line,
            });
          else if (
            ts.isCallExpression(parent) &&
            ts.isPropertyAccessExpression(parent.expression) &&
            ["forEach", "map", "flatMap"].includes(parent.expression.name.text)
          )
            parameterization.push({
              kind: parent.expression.name.text,
              expression: parent.expression.expression.getText(source),
              line: location(parent).line,
            });
        }
        declarations.push({
          id: sha(`${file.path}\0${pos.line}\0${pos.column}\0${root.name}`),
          path: file.path,
          ...pos,
          kind: root.name,
          titleExpression: titleNode.getText(source),
          title,
          modifiers: root.modifiers,
          parameterization,
        });
      }
    }
    if (ts.isExportDeclaration(node)) {
      const names =
        node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements.map((entry) => entry.name.text)
          : ["*"];
      for (const name of names)
        exports.push({
          name,
          kind: node.moduleSpecifier
            ? `reexport:${(node.moduleSpecifier as TypeScript.StringLiteral).text}`
            : "local-export",
          line: location(node).line,
        });
    } else if (
      ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (ts.isVariableStatement(node))
        for (const entry of node.declarationList.declarations)
          exports.push({
            name: entry.name.getText(source),
            kind: "variable",
            line: location(node).line,
          });
      else {
        const name =
          "name" in node && node.name && ts.isIdentifier(node.name as TypeScript.Node)
            ? (node.name as TypeScript.Identifier).text
            : "default";
        exports.push({ name, kind: ts.SyntaxKind[node.kind], line: location(node).line });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { declarations, strings: [...new Set(strings)], exports };
}

async function readInertEvidence(directory: string, filename: string) {
  if (path.basename(filename) !== filename) throw Error("inventory_evidence_path_invalid");
  const root = await realpath(directory),
    target = path.join(root, filename),
    stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(target)) !== target)
    throw Error("inventory_evidence_symlink_rejected");
  return readFile(target);
}

export async function buildInventory(options: {
  repository: string;
  commit: string;
  evidenceDirectory?: string;
}) {
  const { files, commit } = readPublicGitBlobs(options.repository, options.commit);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const require = createRequire(
    path.join(path.resolve(options.repository), "backend/package.json"),
  );
  const ts = require("typescript") as typeof TypeScript;
  const summaries = files.map((file) => ({
    path: file.path,
    sha256: sha(file.bytes),
    bytes: file.bytes.length,
    mode: file.mode,
    gitBlob: file.blob,
  }));
  const ast = new Map(
    files
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file.path))
      .map((file) => [file.path, declarationInventory(ts, file)]),
  );
  const tests = files.filter((file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file.path));
  const runners = [
    {
      id: "backend",
      command: "bun --no-env-file test --preload ./tests/setup.ts tests",
      cwd: "backend",
      roots: ["backend/tests"],
      preload: ["backend/tests/setup.ts"],
      environment: ["local ports/processes required by individual transport tests"],
      rootTest: true,
    },
    {
      id: "frontend-unit",
      command: "bun --no-env-file test tests/unit",
      cwd: "frontend",
      roots: ["frontend/tests/unit"],
      preload: [],
      environment: ["some CLI/render tests spawn local processes"],
      rootTest: true,
    },
    {
      id: "chromium",
      command: "bun --no-env-file run test:e2e --workers=1 --retries=0 --reporter=line",
      cwd: "frontend",
      roots: ["frontend/tests/e2e"],
      preload: [],
      environment: [
        "Chromium",
        "127.0.0.1:4173",
        "AWA_REPLAY_INPUT=tests/fixtures/sample.replay.json",
      ],
      rootTest: false,
    },
  ];
  const declarations = tests.flatMap((file) => ast.get(file.path)!.declarations);
  const discoveredFiles = tests.map((file) => ({
    path: file.path,
    sha256: sha(file.bytes),
    runner:
      runners.find((runner) => runner.roots.some((root) => file.path.startsWith(`${root}/`)))?.id ??
      null,
    declarations: ast.get(file.path)!.declarations.length,
  }));
  const fixtures = files.filter((file) => /\/(?:fixtures|__snapshots__)\//.test(file.path));
  const references = new Map<
    string,
    { path: string; literal: string; resolution: "exact" | "basename-hint" }[]
  >();
  const fixtureByBasename = new Map<string, string[]>();
  for (const file of fixtures)
    fixtureByBasename.set(path.basename(file.path), [
      ...(fixtureByBasename.get(path.basename(file.path)) ?? []),
      file.path,
    ]);
  for (const [sourcePath, item] of ast)
    for (const literal of item.strings) {
      const candidates = [
        path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), literal)),
        literal,
        path.posix.join(sourcePath.split("/")[0]!, literal),
      ];
      const exact = fixtures.find((file) => candidates.includes(file.path));
      const targets = exact
        ? [exact.path]
        : (fixtureByBasename.get(path.posix.basename(literal)) ?? []);
      for (const target of targets)
        references.set(target, [
          ...(references.get(target) ?? []),
          { path: sourcePath, literal, resolution: exact ? "exact" : "basename-hint" },
        ]);
    }
  // 精确字面路径与同名提示分别标记；提示关联不等于发现了所有动态文件消费者。
  const fixtureRows = fixtures.map((file) => ({
    path: file.path,
    sha256: sha(file.bytes),
    bytes: file.bytes.length,
    references: references.get(file.path) ?? [],
    referencePolicy:
      "literal hints only; templates and filesystem discovery can have additional consumers",
  }));
  const covered = sourceRoots.flatMap((root) =>
    files.filter((file) => file.path.startsWith(`${root}/`) && file.path.endsWith(".ts")),
  );
  const sourceHash = createHash("sha256");
  for (const file of covered)
    sourceHash.update(file.path).update("\0").update(file.bytes).update("\0");
  const uncovered = files.filter(
    (file) =>
      /^(backend\/src|frontend\/src|packages\/.*\/src)\//.test(file.path) &&
      /\.tsx?$/.test(file.path) &&
      !covered.includes(file),
  );
  const packages = files
    .filter((file) => /^packages\/[^/]+\/package.json$/.test(file.path))
    .map((file) => {
      const data = JSON.parse(file.bytes.toString()) as Record<string, unknown>,
        root = path.posix.dirname(file.path);
      return {
        path: file.path,
        name: data.name,
        exports: data.exports ?? null,
        types: data.types ?? null,
        scripts: data.scripts ?? {},
        dependencies: data.dependencies ?? {},
        declarations: [...ast.entries()]
          .filter(([p]) => p.startsWith(`${root}/src/`))
          .map(([p, value]) => ({ path: p, exports: value.exports })),
      };
    });
  const results: ResolvedTestCase[] = [],
    evidence: { file: string; sha256: string; cases: number; runner: string }[] = [];
  let evidenceVerification: {
    inputManifestHash: string;
    afterInputManifestHash: string;
    fixedExecutableInputs: true;
    executableInputs: number;
    matched: number;
    omittedNonExecutable: number;
    omittedAfterNonExecutable: number;
  } | null = null;
  if (options.evidenceDirectory) {
    // 先验证冻结输入，再接纳退出状态、完整标题和汇总；只看到 exit 0 不能证明日志未截断。
    const bytes = await readInertEvidence(options.evidenceDirectory, "inputs.before.json");
    let afterBytes: Buffer;
    try {
      afterBytes = await readInertEvidence(options.evidenceDirectory, "inputs.after.json");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw Error("inventory_evidence_after_required");
      throw error;
    }
    const verification = verifyFrozenExecutableInputs(
      JSON.parse(bytes.toString()),
      JSON.parse(afterBytes.toString()),
      files,
    );
    const execution = JSON.parse(
      (await readInertEvidence(options.evidenceDirectory, "results.json")).toString(),
    ) as { name: string; exit_code: number }[];
    for (const name of evidenceLogs) {
      const runName = name.replace(/\.log$/, ""),
        run = execution.find((row) => row.name === runName);
      if (!run || run.exit_code !== 0) throw Error("inventory_evidence_run_not_accepted");
      const content = await readInertEvidence(options.evidenceDirectory, name),
        runner = name.startsWith("backend")
          ? "backend"
          : name === "chromium.log"
            ? "chromium"
            : "frontend-unit";
      const cases = parseResolvedTestLog(content.toString(), runner, name);
      assertResolvedLogSummary(content.toString(), runner, cases);
      if (cases.some((row) => !byPath.has(row.path) || row.status === "fail"))
        throw Error("inventory_evidence_case_invalid");
      results.push(...cases);
      evidence.push({ file: name, sha256: sha(content), cases: cases.length, runner });
    }
    for (const test of discoveredFiles)
      if (test.runner && !results.some((row) => row.path === test.path))
        throw Error("inventory_evidence_discovery_gap");
    if (new Set(results.map((row) => row.id)).size !== results.length)
      throw Error("inventory_evidence_duplicate_case");
    evidenceVerification = {
      inputManifestHash: sha(bytes),
      afterInputManifestHash: sha(afterBytes),
      fixedExecutableInputs: true,
      ...verification,
    };
  }
  const digest = sha(JSON.stringify(summaries));
  const metadata = {
    schema: "awa-refactor-inventory-v1",
    generatedBy: "tooling/refactor/inventory.ts",
    source: "immutable public Git blobs; optional byte-matched frozen offline test evidence",
    commit,
    publicInputsHash: digest,
  };
  return {
    inventory: {
      ...metadata,
      publicPathPolicy: {
        roots: publicRoots,
        files: [...rootFiles],
        privateAndSymlinks: "rejected",
      },
      files: summaries,
      counts: {
        files: files.length,
        typeScript: files.filter((file) => /\.tsx?$/.test(file.path)).length,
        discoveredTestFiles: tests.length,
        fixtures: fixtures.length,
      },
      limitations: [
        "No application, configuration loader, test body, fixture reader or real model is executed.",
        "Tracked public inputs only; generated/untracked/local files are outside this manifest.",
      ],
    },
    testCases: {
      ...metadata,
      runners,
      discovery: discoveredFiles,
      declarations,
      resolvedCases: results,
      evidence,
      evidenceVerification,
      counts: runners.map((runner) => ({
        runner: runner.id,
        files: discoveredFiles.filter((file) => file.runner === runner.id).length,
        resolvedCases: results.filter((row) => row.runner === runner.id).length,
        pass: results.filter((row) => row.runner === runner.id && row.status === "pass").length,
        skip: results.filter((row) => row.runner === runner.id && row.status === "skip").length,
      })),
      limitations: [
        "Declarations are syntax inventory, not expanded cases; unresolved title expressions and enclosing matrices are retained.",
        "Historical resolved cases are evidence for this exact executable input set only, not newly executed tests.",
        "Chromium cases are the accepted run listing; their status is listed, with successful whole-run evidence.",
      ],
    },
    fixtures: { ...metadata, files: fixtureRows },
    sourceHash: {
      ...metadata,
      owner: "历史实现：backend/src/runtime/simulation/reproduction_context.ts:currentEngineVersion（所选 Git 的历史六根口径，非现行精确指纹）",
      algorithm:
        "sha256(path UTF-8 + NUL + bytes + NUL), recursive lexical traversal for each root in declared order",
      roots: sourceRoots,
      extensions: [".ts"],
      sourceHash: sourceHash.digest("hex"),
      lockHash: byPath.has("bun.lock") ? sha(byPath.get("bun.lock")!.bytes) : null,
      covered: covered.map((file) => ({ path: file.path, sha256: sha(file.bytes) })),
      uncoveredSource: uncovered.map((file) => ({ path: file.path, sha256: sha(file.bytes) })),
      boundary:
        "仅按历史六根策略计算所选 Git 的盘点指标；owner 记录历史实现位置，不代表现行 engineFingerprint/sourceHash。六根外的源码单列，禁止把本值用于严格复现身份。",
    },
    contracts: {
      ...metadata,
      packages,
      applicationEntrypoints: files
        .filter((file) =>
          [
            "backend/src/index.ts",
            "backend/src/core/index.ts",
            "backend/src/core/domain/index.ts",
            "backend/src/domain/index.ts",
            "frontend/src/main.tsx",
          ].includes(file.path),
        )
        .map((file) => ({ path: file.path, exports: ast.get(file.path)?.exports ?? [] })),
      domainContractDeclarations: [...ast.entries()]
        .filter(([file]) =>
          /^backend\/src\/(?:core\/domain\/(?:actions|events|board|results|deaths|night_effects|action_request_context|request_delivery|model)|domain\/(?:actions|events|board|results|deaths|night-effects|action-request-context|request-delivery|model))\.ts$/.test(
            file,
          ),
        )
        .map(([file, item]) => ({ path: file, exports: item.exports })),
      scripts: files
        .filter((file) =>
          ["package.json", "backend/package.json", "frontend/package.json"].includes(file.path),
        )
        .map((file) => ({
          path: file.path,
          scripts: JSON.parse(file.bytes.toString()).scripts ?? {},
        })),
    },
  };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2),
      values = new Map<string, string>();
    for (let i = 0; i < args.length; i += 2) {
      if (
        !["--repository", "--commit", "--evidence-directory"].includes(args[i]!) ||
        !args[i + 1] ||
        values.has(args[i]!)
      )
        throw Error("inventory_arguments_invalid");
      values.set(args[i]!, args[i + 1]!);
    }
    if (!values.has("--commit")) throw Error("inventory_commit_required");
    console.log(
      JSON.stringify(
        await buildInventory({
          repository: values.get("--repository") ?? process.cwd(),
          commit: values.get("--commit")!,
          evidenceDirectory: values.get("--evidence-directory"),
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    const code =
      error instanceof Error && /^inventory_[a-z_]+$/.test(error.message)
        ? error.message
        : "inventory_failed";
    console.error(JSON.stringify({ error: code }));
    process.exitCode = 1;
  }
}
