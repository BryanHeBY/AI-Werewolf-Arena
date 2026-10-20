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
  themeSurface,
  normalizeResolvedTheme,
  type ResolvedTheme,
} from "../../../src/themes";

test("two themes are independent JSON values and day/night tokens share a common shape", () => {
  const gothic = resolveTheme("gothic-v1");
  expect(gothic.options).toEqual({
    paperTexture: false,
    ornamentalFrames: false,
    waxSeals: false,
    largeText: false,
    reducedMotion: false,
  });
  expect(themePalette(gothic, "day").paper).toBe("#eef0ef");
  expect(themePalette(gothic, "night").canvas).toBe("#101723");
  expect(themePalette(gothic, "day").canvasText).toBe("#edf0f3");
  expect(JSON.parse(JSON.stringify(gothic))).toEqual(gothic);
  gothic.definition.palette.day.paper = "changed";
  expect(themePalette(resolveTheme("gothic-v1"), "day").paper).toBe("#eef0ef");
  const minimal = resolveTheme({ id: "minimal-v1", options: { density: "compact" } });
  expect(minimal.options).toEqual({
    density: "compact",
    highContrast: false,
    largeText: false,
    reducedMotion: false,
  });
  expect(themeToCssVariables(minimal, "day")["--awa-panel"]).toBe("#ffffff");
  expect(themeToCssVariables(minimal, "day")["--awa-canvasText"]).toBe("#162131");
});
test("shared visual tokens preserve the agreed output baseline and separate Web font faces from project video faces", () => {
  const gothic = resolveTheme({ id: "gothic-v1", options: { largeText: true } });
  expect(gothic.definition.typography).toMatchObject({
    referenceWidth: 1920,
    referenceHeight: 1080,
    bodyZh: 32,
    bodyEn: 30,
    speechBodyZh: 26,
    speechBodyEn: 24,
    bodyLarge: 48,
  });
  expect(gothic.definition.motion.standard).toEqual({
    establish: 0,
    travel: 8,
    impact: 24,
    settled: 40,
  });
  expect(gothic.definition.surface.stage).toBe("transparent");
  expect(gothic.definition.surface.readingMaxHeightRatio).toBe(0.8);
  expect(gothic.definition.surface.speechReadingMaxHeightRatio).toBe(0.9);
  expect(gothic.definition.typography.readingMaxWidth).toBe(1280);
  expect(themeSurface(gothic, "day").readingText).toBe("#efeade");
  expect(themeSurface(gothic, "night").readingText).toBe("#efeade");
  expect(themeSurface(resolveTheme("minimal-v1"), "day").readingText).toBe("#162131");
  expect(themeSurface(resolveTheme("minimal-v1"), "night").readingText).toBe("#edf1f6");
  expect(themeToCssVariables(gothic, "day")["--awa-font-body"]).toStartWith(
    '"AWA Web Noto Sans SC"',
  );
  expect(gothic.definition.fonts.body).toStartWith('"Noto Sans SC"');
  for (const id of ["gothic-v1", "minimal-v1"] as const) {
    expect(resolveTheme({ id, options: { reducedMotion: true } }).options.reducedMotion).toBe(true);
  }
  gothic.definition.connector.choiceDash.push(100);
  expect(resolveTheme("gothic-v1").definition.connector.choiceDash).toEqual([6, 6]);
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
  const hidden = Object.defineProperty({}, "id", {
    get() {
      reads++;
      return "minimal-v1";
    },
  });
  expect(() => parseThemeSelection(hidden)).toThrow("theme_selection_invalid");
  expect(reads).toBe(0);
});
test("slots use explicit own registry entries and never inherited names", () => {
  const registry = { "gothic-v1/frame": "gothic-frame" };
  expect(getThemeSlot(registry, resolveTheme("gothic-v1"), "frame")).toBe("gothic-frame");
  expect(getThemeSlot(registry, resolveTheme("minimal-v1"), "frame")).toBeUndefined();
  expect(resolveTheme("gothic-v1").definition.slots.actionEffect).toBe("gothic-v1/actionEffect");
  expect(resolveTheme("minimal-v1").definition.slots.playerCard).toBe("minimal-v1/playerCard");
});
test("a handwritten old compiled theme keeps authored appearance while new tokens and options fill missing fields without mutation", () => {
  const old = {
    id: "gothic-v1",
    definition: {
      id: "gothic-v1",
      version: 1,
      label: { "zh-CN": "ARCHIVED", en: "ARCHIVED" },
      palette: { day: { canvas: "#123456" }, night: { canvas: "#654321" } },
      fonts: { body: "Archived Body", heading: "Archived Heading", mono: "Archived Mono" },
      radii: { panel: 4, card: 2 },
      motion: { durationMs: 321, cameraFrames: 17 },
      options: { paperTexture: { type: "boolean", default: true } },
      slots: { background: "archive/background", frame: "archive/frame" },
    },
    options: { paperTexture: true },
  } as unknown as ResolvedTheme;
  const before = JSON.stringify(old);
  const resolved = normalizeResolvedTheme(old);
  expect(resolved.definition.palette.day.canvas).toBe("#123456");
  expect(resolved.definition.palette.night.canvas).toBe("#654321");
  expect(resolved.definition.fonts.body).toBe("Archived Body");
  expect(resolved.definition.slots.background).toBe("archive/background");
  expect(resolved.definition.slots.frame).toBe("archive/frame");
  expect(resolved.definition.slots.actionEffect).toBe("gothic-v1/actionEffect");
  expect(resolved.definition.typography.bodyZh).toBe(32);
  expect(resolved.definition.typography.speechBodyZh).toBe(26);
  expect(resolved.definition.typography.speechBodyEn).toBe(24);
  expect(resolved.definition.surface.readingMaxHeightRatio).toBe(0.8);
  expect(resolved.definition.surface.speechReadingMaxHeightRatio).toBe(0.9);
  expect(resolved.definition.frame.width).toBe(1.5);
  expect(resolved.definition.connector.choiceDash).toEqual([6, 6]);
  expect(resolved.definition.effect.heroSize).toBe(410);
  expect(resolved.definition.motion).toMatchObject({
    durationMs: 321,
    cameraFrames: 17,
    standard: { establish: 0, travel: 8, impact: 24, settled: 40 },
  });
  expect(resolved.options).toEqual({
    paperTexture: true,
    ornamentalFrames: false,
    waxSeals: false,
    largeText: false,
    reducedMotion: false,
  });
  const partial = normalizeResolvedTheme({
    ...old,
    definition: {
      ...old.definition,
      typography: { bodyZh: 47, speechBodyZh: 31 },
      surface: { palette: { night: { readingText: "#abcabc" } } },
      motion: { durationMs: 321, standard: { travel: 12 } },
    },
  } as unknown as ResolvedTheme);
  expect(partial.definition.typography).toMatchObject({
    bodyZh: 47,
    bodyEn: 30,
    speechBodyZh: 31,
    speechBodyEn: 24,
  });
  expect(partial.definition.surface.palette.night).toMatchObject({
    readingText: "#abcabc",
    readingColor: "#081219",
  });
  expect(partial.definition.motion.standard).toEqual({
    establish: 0,
    travel: 12,
    impact: 24,
    settled: 40,
  });
  expect(JSON.stringify(old)).toBe(before);
  resolved.definition.palette.day.canvas = "changed";
  resolved.definition.fonts.body = "changed";
  expect(normalizeResolvedTheme(old).definition.palette.day.canvas).toBe("#123456");
  expect(normalizeResolvedTheme(old).definition.fonts.body).toBe("Archived Body");
  expect(JSON.stringify(old)).toBe(before);
});
