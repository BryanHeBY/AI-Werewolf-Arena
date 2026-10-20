/**
 * 单元资源测试负责本地字体字节、许可及显式覆盖边界。输入为随仓库分发的真实 WOFF2 和字面项目字体，输出固定摘要与同 family 替换。
 * 独立预期为官方固定版本／权重轴和实际字节头，不把合成字节当可渲染字体；浏览器加载与字形另以真实宿主验证。
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import manifest from "../../../src/themes/fonts/manifest.json";
import { BUILTIN_FONT_FACES, resolveVideoFontFaces } from "../../../src/themes/fonts";

test("bundled fonts are complete pinned Noto SC WOFF2 faces accompanied by upstream OFL licenses", () => {
  expect(manifest.fonts.map((font) => [font.family, font.version, font.weight])).toEqual([
    ["Noto Sans SC", "2.004", "100 900"],
    ["Noto Serif SC", "2.003", "200 900"],
  ]);
  for (const font of manifest.fonts) {
    const bytes = readFileSync(new URL(`../../../src/themes/fonts/${font.file}`, import.meta.url));
    expect(bytes.subarray(0, 4).toString()).toBe("wOF2");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(font.sha256);
    expect(bytes.length).toBe(font.bytes);
    expect(font.sourceCommit).toBe("f8d157532fbfaeda587e826d4cd5b21a49186f7c");
    expect(font.sourceUrl).toStartWith("https://raw.githubusercontent.com/notofonts/noto-cjk/");
    expect(font.copyright).toContain("Adobe");
    const license = readFileSync(
      new URL(`../../../src/themes/fonts/${font.licenseFile}`, import.meta.url),
      "utf8",
    );
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  }
});

test("project fonts own every weight of an explicitly replaced family without mutating bundled defaults", () => {
  const project = [{ family: "noto sans sc", src: "assets/custom.woff2", weight: "400" }];
  expect(resolveVideoFontFaces(project)).toEqual([BUILTIN_FONT_FACES[1]!, project[0]!]);
  const fonts = resolveVideoFontFaces();
  fonts[0]!.family = "changed";
  expect(resolveVideoFontFaces()[0]!.family).toBe("Noto Sans SC");
  expect(project[0]!.family).toBe("noto sans sc");
});
