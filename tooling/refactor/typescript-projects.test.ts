/**
 * 核对编辑器从测试／脚本目录自动发现的 TypeScript 项目。
 * 输入为真实目录与公开配置；通过编译器的配置发现和继承解析，检查文件覆盖、
 * Bun 类型及禁止输出约束，避免命令行能检查、编辑器却退回推断项目。
 * 预期文件集合来自独立目录盘点，项目位置与类型约束使用明确的手写要求。
 * 不运行对局或生成构建产物，也不修改源码与夹具。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { compiler } from "./architecture/contracts";

const root = path.resolve(import.meta.dir, "../..");
const ts = compiler(root);

for (const directory of [
  "backend/tests",
  "backend/scripts",
  "packages/game-catalog/tests",
  "packages/game-contract/tests",
  "packages/game-presentation/tests",
  "packages/game-text/tests",
  "packages/replay-contract/tests",
]) {
  test(`editor discovers the Bun-aware project for ${directory}`, () => {
    const absolute = path.join(root, directory);
    const configPath = ts.findConfigFile(absolute, ts.sys.fileExists);
    expect(configPath).toBe(path.join(absolute, "tsconfig.json"));
    const parsed = ts.getParsedCommandLineOfConfigFile(
      configPath!,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
        },
      },
    );
    expect(parsed).toBeDefined();
    expect(parsed!.errors).toEqual([]);
    expect(parsed!.options.noEmit).toBe(true);
    expect(parsed!.options.types).toContain("bun-types");

    // 用独立文件盘点核对继承后的 include，不能仅验证配置文件存在。
    const extensions = [".ts", ".tsx", ".mts", ".cts"];
    if (parsed!.options.allowJs) extensions.push(".js", ".jsx", ".mjs", ".cjs");
    const authored = ts.sys.readDirectory(absolute, extensions, ["**/node_modules/**"]);
    expect(authored.length).toBeGreaterThan(0);
    const checked = new Set(parsed!.fileNames.map((file) => path.resolve(file)));
    expect(authored.filter((file) => !checked.has(path.resolve(file)))).toEqual([]);
  });
}
