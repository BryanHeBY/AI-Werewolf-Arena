/**
 * Owns detached inputs and violation/debt records for the architecture gate.
 * Inputs are public source bytes, package metadata and approved path mappings;
 * outputs are stable data records, never engine state or writable capabilities.
 * Only the fixed baseline generator creates debt; checks report new or cleared
 * debt without mutating that baseline. Parser validation cannot prove a prose
 * contract's truth, so human review remains required for substantive changes.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import type * as TypeScript from "typescript";

export interface ArchitectureFile {
  path: string;
  text: string;
  sha256: string;
}
export interface ArchitectureInput {
  files: ArchitectureFile[];
  documentationPaths: string[];
}
export interface ArchitectureViolation {
  id: string;
  rule: string;
  path: string;
  line: number;
  column: number;
  detail: string;
  target?: string;
  specifier?: string;
  binding?: string;
}
export interface ArchitectureDebt {
  schema: "awa-architecture-debt-v1";
  generatedBy: "tooling/refactor/architecture/run.ts";
  baselineCommit: string;
  baselineInputHash: string;
  files: { path: string; sha256: string }[];
  violations: ArchitectureViolation[];
  policy: string;
}
export interface PathMapping {
  from: string;
  to: string;
  reason: string;
}
export interface ArchitectureReport {
  schema: "awa-architecture-report-v1";
  inputHash: string;
  failures: ArchitectureViolation[];
  remainingDebt: ArchitectureViolation[];
  clearedDebt: string[];
  counts: {
    files: number;
    violations: number;
    failures: number;
    remainingDebt: number;
    clearedDebt: number;
  };
  policy: string;
}
export const digest = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
export const sourceDigest = (files: ArchitectureFile[]) =>
  digest(
    JSON.stringify(
      [...files]
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .map(({ path, sha256 }) => ({ path, sha256 })),
    ),
  );
export function violation(
  rule: string,
  file: string,
  line: number,
  column: number,
  detail: string,
  identity = detail,
  extra?: Pick<ArchitectureViolation, "target" | "specifier" | "binding">,
): ArchitectureViolation {
  return {
    id: digest(`${rule}\0${file}\0${identity}`),
    rule,
    path: file,
    line,
    column,
    detail,
    ...extra,
  };
}
export function compiler(repository: string): typeof TypeScript {
  return createRequire(path.join(path.resolve(repository), "backend/package.json"))(
    "typescript",
  ) as typeof TypeScript;
}
export function parseSource(ts: typeof TypeScript, file: ArchitectureFile): TypeScript.SourceFile {
  return ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/.test(file.path)
      ? ts.ScriptKind.TSX
      : /\.[cm]?js$/.test(file.path)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS,
  );
}
export function isProductionPath(file: string): boolean {
  return /^(?:backend\/src\/|frontend\/src\/|packages\/[^/]+\/src\/)/.test(file);
}
export function isTypedSource(file: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(file);
}
