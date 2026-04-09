#!/usr/bin/env node
/*
 * 注释覆盖检查器：
 * 1) 每个源码文件至少包含一条注释（文件级/实现级均可）。
 * 2) 每个 export 的 type/function/class/interface/enum/const 必须在定义前有紧邻注释。
 *
 * 用法：
 *   node scripts/comment_coverage_check.js --report
 *   node scripts/comment_coverage_check.js --strict --scope backend/src/app --scope backend/src/scenarios
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const report = args.includes("--report");
const checkMethods = args.includes("--check-methods");
const scopes = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--scope" && args[i + 1]) {
    scopes.push(args[i + 1]);
    i += 1;
  }
}

const ROOT = process.cwd();
const DEFAULT_ROOTS = ["backend/src", "frontend/src"];
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".vue"]);
const SKIP_DIR = new Set(["node_modules", "dist", "coverage", ".git", ".idea", ".vscode"]);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIR.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p, out);
      continue;
    }
    const ext = path.extname(ent.name);
    if (!SOURCE_EXT.has(ext)) continue;
    if (p.includes(".d.ts")) continue;
    out.push(p);
  }
}

function hasAnyComment(text, ext) {
  if (ext === ".vue") {
    return /<!--|\/\*|\/\//.test(text);
  }
  return /\/\*|\/\//.test(text);
}

function parseExportTargets(lines) {
  const targets = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*export\s+(?:default\s+)?(?:(async)\s+)?(function|class|interface|type|enum|const)\s+([A-Za-z_$][\w$]*)/);
    if (!m) continue;
    targets.push({
      lineNo: i + 1,
      kind: m[2],
      name: m[3],
    });
  }
  return targets;
}

function parseClassMethodTargets(lines) {
  const targets = [];
  let inClass = false;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inClass && /^\s*(export\s+)?class\s+[A-Za-z_$][\w$]*/.test(line)) {
      inClass = true;
    }
    if (!inClass) {
      continue;
    }
    const open = (line.match(/\{/g) || []).length;
    const close = (line.match(/\}/g) || []).length;
    depth += open - close;

    const method = line.match(/^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*:\s*[^=]+\s*\{/);
    if (method) {
      const name = method[1];
      if (name !== "constructor") {
        targets.push({
          lineNo: i + 1,
          name,
        });
      }
    }

    if (depth <= 0) {
      inClass = false;
      depth = 0;
    }
  }
  return targets;
}

function hasLeadingComment(lines, lineNo) {
  let i = lineNo - 2;
  let steps = 0;
  while (i >= 0 && steps < 8) {
    const raw = lines[i];
    const s = raw.trim();
    if (s.length === 0) {
      i -= 1;
      steps += 1;
      continue;
    }
    if (/^(\/\/|\/\*|\*|<!--)/.test(s) || s.endsWith("*/")) {
      return true;
    }
    return false;
  }
  return false;
}

function toRel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

const roots = scopes.length > 0 ? scopes : DEFAULT_ROOTS;
const files = [];
for (const r of roots) {
  walk(path.join(ROOT, r), files);
}
files.sort();

const violations = [];
let exportCount = 0;
let methodCount = 0;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const ext = path.extname(file);
  const lines = text.split(/\r?\n/);

  if (!hasAnyComment(text, ext)) {
    violations.push({ file: toRel(file), line: 1, reason: "missing_file_comment" });
  }

  const exports = parseExportTargets(lines);
  exportCount += exports.length;
  for (const target of exports) {
    if (!hasLeadingComment(lines, target.lineNo)) {
      violations.push({
        file: toRel(file),
        line: target.lineNo,
        reason: `missing_export_comment(${target.kind} ${target.name})`,
      });
    }
  }

  if (checkMethods) {
    const methods = parseClassMethodTargets(lines);
    methodCount += methods.length;
    for (const method of methods) {
      if (!hasLeadingComment(lines, method.lineNo)) {
        violations.push({
          file: toRel(file),
          line: method.lineNo,
          reason: `missing_method_comment(${method.name})`,
        });
      }
    }
  }
}

if (report) {
  console.log("[comment-coverage] scanned_files=" + files.length);
  console.log("[comment-coverage] scanned_exports=" + exportCount);
  console.log("[comment-coverage] scanned_methods=" + methodCount);
  console.log("[comment-coverage] violations=" + violations.length);
}

for (const v of violations) {
  console.log(`${v.file}:${v.line} ${v.reason}`);
}

if (strict && violations.length > 0) {
  process.exit(1);
}
