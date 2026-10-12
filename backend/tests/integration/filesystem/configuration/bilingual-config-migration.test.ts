/**
 * Configuration filesystem integration tests verify bilingual migration previews/publication and named party persona resolution.
 * Input: Original actual temporary legacy files, public party game JSON and literal invalid locale.
 * Output and oracle: Exact backup/report bytes, no write on invalid locale and twelve original persona strings preserve filesystem behavior; synthetic inputs are not replacement goldens.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { migrateBoardSource, migrateBoards } from "../../../../src/runtime/cli/migrate_configs";
import { MIGRATION_WARNING_CODES } from "../../../../src/runtime/config/migrate_board";

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
  const { parseRuntimeConfig } = await import("../../../../src/runtime/config/parse_config");
  const { resolveGameSetup } = await import("../../../../src/runtime/config/resolve_game_setup");
  const game = JSON.parse(
    await fs.readFile(
      path.resolve(process.cwd(), "../configs.example/games/twelve_player_fun.json"),
      "utf8",
    ),
  );
  for (const locale of ["zh-CN", "en"] as const) {
    const setup = resolveGameSetup(
      parseRuntimeConfig({
        providers: {
          default: "synthetic",
          items: { synthetic: { type: "acp", transport: "stdio", command: "synthetic-adapter" } },
        },
        agents: {
          default: "acp_default",
          items: { acp_default: { kind: "acp", provider: "synthetic" } },
        },
        game: { ...game, locale },
      }),
    );
    expect(setup.warnings).toEqual([]);
    expect(Object.keys(setup.players)).toHaveLength(12);
    for (const [seat, entry] of Object.entries(setup.players)) {
      expect(entry.name).toBe(game.players[seat].name);
      expect(entry.personalityPrompt).toBe(game.players[seat].personalityPrompt[locale]);
      expect(entry.personalityPrompt).toContain(locale === "en" ? "playful game" : "欢乐局");
    }
    expect(new Set(Object.values(setup.players).map((entry) => entry.personalityPrompt)).size).toBe(
      12,
    );
  }
});
