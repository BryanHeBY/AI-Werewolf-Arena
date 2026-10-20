/**
 * 架构测试核对前端编译入口是否覆盖所有源码、脚本、测试和工具配置。
 * 输入为真实公开 tsconfig 与当前文件树；本应用声明的 TypeScript 解析出编译输入，
 * 输出为完整目录集合的无遗漏断言。实际文件集合是独立预期，不改配置来缩小检查范围，
 * 不运行对局、模型或浏览器，也不修改源码和 fixture。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import * as ts from "typescript";

test("frontend typecheck includes every source, script, test and tool configuration", () => {
  const root = path.resolve(import.meta.dir, "../..");
  const configPath = path.join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  expect(parsed.errors).toEqual([]);
  expect(parsed.options.noEmit).toBe(true);
  const checked = new Set(parsed.fileNames.map((file) => path.resolve(file)));
  const authored = ["src", "scripts", "tests"].flatMap((directory) =>
    ts.sys.readDirectory(path.join(root, directory), [".ts", ".tsx"]),
  );
  authored.push(...ts.sys.readDirectory(root, [".ts", ".tsx"], undefined, ["*"], 1));
  const missing = authored
    .filter((file) => !checked.has(path.resolve(file)))
    .map((file) => path.relative(root, file));
  expect(missing).toEqual([]);
});
