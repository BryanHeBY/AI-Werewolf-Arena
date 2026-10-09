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
