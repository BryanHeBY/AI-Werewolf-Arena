/**
 * 负责定义结构门禁的输入、诊断与报告数据，并提供摘要和源码解析辅助。
 * 输入为调用方捕获的公共源码文本、路径和 SHA；输出保留原记录结构、摘要与解析结果。
 * 这些契约由本模块拥有，不包含游戏状态、资源写权或行动许可；字段声明不复制或冻结输入。
 * 调用方须验证捕获字节与 SHA 的对应关系，任何当前违规都不能通过历史豁免。
 * AST 与词项检查不能证明职责说明真实，实际所有权、异常和时序仍需人工审查。
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import type * as TypeScript from "typescript";

/** 捕获方负责让文本和摘要来自同一真实输入；检查库消费这三个字段，不自行重算文本摘要。 */
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
export interface ArchitectureReport {
  schema: "awa-architecture-report-v1";
  inputHash: string;
  failures: ArchitectureViolation[];
  counts: {
    files: number;
    violations: number;
    failures: number;
  };
  policy: string;
}
export const digest = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
/** 只摘要排序后的路径／已提供 SHA 元信息；不读取文件或重算 text，也不是对局 Tape 的 sourceHash。 */
export const sourceDigest = (files: ArchitectureFile[]) =>
  digest(
    JSON.stringify(
      [...files]
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .map(({ path, sha256 }) => ({ path, sha256 })),
    ),
  );
// 诊断身份由规则、路径和业务身份组成；行列仅用于定位，位置移动不改变同一项诊断的身份。
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
  return createRequire(path.join(path.resolve(repository), "packages/game-runtime/package.json"))(
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
  return /^(?:backend\/src\/|frontend\/src\/|packages\/[^/]+\/src\/|apps\/[^/]+\/src\/)/.test(file);
}
export function isTypedSource(file: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(file);
}
