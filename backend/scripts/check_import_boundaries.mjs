#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.cwd(), "src");
const coreDir = path.join(rootDir, "core");
const forbiddenTopDirs = new Set(["game", "ai", "runtime", "server", "observability"]);

const errors = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs);
      continue;
    }
    if (entry.isFile() && abs.endsWith(".ts")) {
      checkFile(abs);
    }
  }
}

function checkFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const importLike = /(from\s+["']([^"']+)["'])|(import\s*\(\s*["']([^"']+)["']\s*\))/g;
  let match;
  while ((match = importLike.exec(text)) !== null) {
    const spec = match[2] ?? match[4];
    if (!spec || !spec.startsWith(".")) {
      continue;
    }
    const resolved = path.resolve(path.dirname(filePath), spec);
    const rel = path.relative(rootDir, resolved).replace(/\\/g, "/");
    const top = rel.split("/")[0];
    if (forbiddenTopDirs.has(top)) {
      errors.push(
        `${path.relative(process.cwd(), filePath)} imports forbidden layer "${top}" via "${spec}"`,
      );
    }
  }
}

walk(coreDir);

if (errors.length > 0) {
  console.error("[import-boundary] core layer dependency violations:");
  for (const item of errors) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("[import-boundary] ok");
