/**
 * 单元测试负责主题 JSON 解析、主题专用选项与宿主插槽边界。输入为两套预设及字面坏配置，输出独立色值、默认值及明确拒绝。
 * 不启动 DOM 或视频，不读取本机偏好；修改返回主题不得改变后续解析结果。
 */
import { expect, test } from "bun:test";
import {
  getThemeSlot,
  parseThemeSelection,
  resolveTheme,
  themePalette,
  themeToCssVariables,
} from "../../../src/themes";

test("two themes are independent JSON values and day/night tokens share a common shape", () => {
  const gothic = resolveTheme("gothic-v1");
  expect(gothic.options).toEqual({ paperTexture: false, ornamentalFrames: false, waxSeals: false });
  expect(themePalette(gothic, "day").paper).toBe("#eef0ef");
  expect(themePalette(gothic, "night").canvas).toBe("#101723");
  expect(JSON.parse(JSON.stringify(gothic))).toEqual(gothic);
  gothic.definition.palette.day.paper = "changed";
  expect(themePalette(resolveTheme("gothic-v1"), "day").paper).toBe("#eef0ef");
  const minimal = resolveTheme({ id: "minimal-v1", options: { density: "compact" } });
  expect(minimal.options).toEqual({ density: "compact", highContrast: false });
  expect(themeToCssVariables(minimal, "day")["--awa-panel"]).toBe("#ffffff");
});
test("theme-specific options reject cross-theme keys and getters before execution", () => {
  for (const value of [
    { id: "future" },
    { id: "gothic-v1", options: { density: "compact" } },
    { id: "minimal-v1", options: { density: "dense" } },
    { id: "minimal-v1", extra: true },
  ])
    expect(() => parseThemeSelection(value)).toThrow("theme_selection_invalid");
  let reads = 0;
  const value = Object.defineProperty({}, "id", {
    enumerable: true,
    get() {
      reads++;
      return "minimal-v1";
    },
  });
  expect(() => parseThemeSelection(value)).toThrow("theme_selection_invalid");
  expect(reads).toBe(0);
});
test("slots use explicit own registry entries and never inherited names", () => {
  const registry = { "gothic-v1/frame": "gothic-frame" };
  expect(getThemeSlot(registry, resolveTheme("gothic-v1"), "frame")).toBe("gothic-frame");
  expect(getThemeSlot(registry, resolveTheme("minimal-v1"), "frame")).toBeUndefined();
  expect(resolveTheme("gothic-v1").definition.slots.actionEffect).toBe("gothic-v1/actionEffect");
  expect(resolveTheme("minimal-v1").definition.slots.playerCard).toBe("minimal-v1/playerCard");
});
