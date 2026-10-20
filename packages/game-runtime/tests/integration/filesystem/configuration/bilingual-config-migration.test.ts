/**
 * 配置文件系统集成测试以原真实临时旧文件、公开聚会游戏 JSON 及字面非法语言为输入，核对双语迁移预览／发布和具名聚会 persona 解析。精确备份／报告字节、非法语言零写入及十二个原 persona 字符串为预期；合成输入不替代 golden。
 */
import { PROJECT_ROOT } from "@ai-werewolf-arena/project-paths";

import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import {
  migrateBoardSource,
  migrateBoards,
} from "../../../../../../apps/game/src/cli/migrate-configs";
import { MIGRATION_WARNING_CODES } from "../../../../src/app/config/migrate-board";
test("all migration warning keys are bilingual and valid preview/apply reports are built before publication", async () => {
  for (const locale of ["zh-CN", "en"] as const) {
    for (const code of MIGRATION_WARNING_CODES)
      expect(text(locale, `config.warning.${code}`)).toBeTruthy();
    const root = await createTestTempDirectory("awa-migration-display-");
    const source = path.join(root, "old.json"),
      original = '{"enableSheriff":false}';
    await fs.writeFile(source, original);
    const lines: string[] = [],
      before = console.log;
    console.log = (value) => {
      lines.push(String(value));
    };
    try {
      await migrateBoardSource(root, "six_player_mvp", source, undefined, false, locale);
      expect(await fs.readFile(source, "utf8")).toBe(original);
      expect(await Bun.file(`${source}.v1.bak`).exists()).toBe(false);
      const preview = JSON.parse(lines[0]);
      expect(preview.mode).toBe("preview");
      expect(preview.warningMessages).toHaveLength(1);
      await migrateBoardSource(root, "six_player_mvp", source, undefined, true, locale);
      expect(
        JSON.parse(await fs.readFile(path.join(root, "boards/six_player_mvp.json"), "utf8"))
          .version,
      ).toBe(2);
      expect(await fs.readFile(`${source}.v1.bak`, "utf8")).toBe(original);
      expect(JSON.parse(lines[1]).mode).toBe("apply");
      await migrateBoards(root, false, locale);
      expect(JSON.parse(lines[2]).changes).toEqual([]);
      const badRoot = await createTestTempDirectory("awa-migration-display-fail-");
      const badSource = path.join(badRoot, "old.json");
      await fs.writeFile(badSource, original);
      await expect(
        migrateBoardSource(
          badRoot,
          "six_player_mvp",
          badSource,
          undefined,
          true,
          "invalid" as Locale,
        ),
      ).rejects.toThrow("i18n_locale_invalid");
      expect(await Bun.file(path.join(badRoot, "boards/six_player_mvp.json")).exists()).toBe(false);
      expect(await Bun.file(`${badSource}.v1.bak`).exists()).toBe(false);
      expect(await fs.readFile(badSource, "utf8")).toBe(original);
      await fs.mkdir(path.join(badRoot, "boards"));
      const bulkSource = path.join(badRoot, "boards/six_player_mvp.json");
      await fs.writeFile(bulkSource, original);
      await expect(migrateBoards(badRoot, true, "invalid" as Locale)).rejects.toThrow(
        "i18n_locale_invalid",
      );
      expect(await fs.readFile(bulkSource, "utf8")).toBe(original);
      expect(await Bun.file(`${bulkSource}.v1.bak`).exists()).toBe(false);
    } finally {
      console.log = before;
    }
  }
});
test("bilingual party example resolves every named seat without missing-language fallback", async () => {
  const { parseRuntimeConfig } = await import("../../../../src/app/config/parse-config");
  const { resolveGameSetup } = await import("../../../../src/app/config/resolve-game-setup");
  const game = JSON.parse(
    await fs.readFile(
      path.resolve(PROJECT_ROOT, "configs.example/games/twelve_player_fun.json"),
      "utf8",
    ),
  );
  for (const locale of ["zh-CN", "en"] as const) {
    const setup = resolveGameSetup(
      parseRuntimeConfig({
        backends: {
          schemaVersion: 2,
          items: {
            synthetic: {
              kind: "acp",
              config: {
                transport: "stdio",
                command: "synthetic-adapter",
              },
            },
          },
        },
        agents: {
          schemaVersion: 2,
          default: "acp_default",
          items: {
            acp_default: {
              backend: "synthetic",
              options: {},
            },
          },
        },
        game: { ...game, locale },
      }),
    );
    expect(setup.warnings).toEqual([]);
    expect(Object.keys(setup.players)).toHaveLength(12);
    for (const [seat, entry] of Object.entries(setup.players)) {
      expect(entry.name).toBe(game.players[seat].name);
      expect((entry.customInstructions as { text: string }).text).toBe(
        game.players[seat].customInstructions.text[locale],
      );
      expect((entry.customInstructions as { text: string }).text).toContain(
        locale === "en" ? "playful game" : "欢乐局",
      );
      expect((entry.customInstructions as { text: string }).text).toContain(
        locale === "en" ? "sharing of your own inspections" : "分享自己的查验",
      );
      expect((entry.customInstructions as { text: string }).text).toContain(
        locale === "en" ? "in your reasoning" : "自己记清",
      );
      expect((entry.customInstructions as { text: string }).text).not.toContain(
        locale === "en" ? "private information must not be casually disclosed" : "不该公开的信息",
      );
    }
    expect(
      new Set(
        Object.values(setup.players).map(
          (entry) => (entry.customInstructions as { text: string }).text,
        ),
      ).size,
    ).toBe(12);
    const ceo = (setup.players["2"].customInstructions as { text: string }).text;
    expect(ceo).toContain(locale === "en" ? "occasionally signing off" : "偶尔用");
    expect(ceo).not.toContain(locale === "en" ? "then finish with" : "每次发言");
  }
});
