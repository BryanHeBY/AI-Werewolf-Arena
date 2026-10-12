/**
 * Configuration filesystem integration tests verify public board contributions round-trip and normal loaders refuse legacy fallback files.
 * Input: Original public example directory, actual temporary runtime/game/board files and explicit migration data.
 * Output and oracle: Exact registered schema results, missing/migration error codes and effective normalized boards preserve source-file wiring; no fixture bytes are rewritten.
 */
import { expect, test } from "bun:test";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Role } from "../../../../src/core";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";
import { convertLegacyBoard } from "../../../../src/runtime/config/migrate_board";
import { checkConfig } from "../../../../src/runtime/cli/check_config";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

test("all public example boards round-trip through every registered contribution, including empty schemas", async () => {
  const root = path.resolve(import.meta.dir, "../../../../../configs.example");
  for (const file of await readdir(path.join(root, "boards"))) {
    if (!file.endsWith(".json")) continue;
    const resolved = await loadBoardDefinition(root, file.slice(0, -5));
    const serialized = boardDefinitionFromConfig(resolved.definition.id, resolved.config);
    expect(serialized).toEqual(resolved.definition);
    expect(parseBoardDefinition(serialized).config).toEqual(resolved.config);
    for (const [id, value] of Object.entries(serialized.roles))
      expect(
        getDefaultRoleCatalog()
          .require(id as Role)
          .configuration!.schema.parse(value),
      ).toEqual(value);
  }
});

test("normal loading never probes legacy fallbacks; explicit migration remains active", async () => {
  const root = await createTestTempDirectory("awa-closure-legacy-");
  const legacy = { boardSize: 6 };
  await mkdir(path.join(root, "runtime"));
  await mkdir(path.join(root, "games"));
  await writeFile(
    path.join(root, "runtime/providers.json"),
    JSON.stringify({
      default: "fake",
      items: { fake: { type: "openai", apiKey: "synthetic-unused" } },
    }),
  );
  await writeFile(
    path.join(root, "runtime/agents.json"),
    JSON.stringify({
      default: "fake",
      items: { fake: { kind: "llm", provider: "fake", model: "unused" } },
    }),
  );
  await writeFile(
    path.join(root, "games/six_player_mvp.json"),
    JSON.stringify({ board: "six_player_mvp", agent: "fake" }),
  );
  await writeFile(path.join(root, "game-config.json"), JSON.stringify(legacy));
  await writeFile(path.join(root, "six_player_mvp.json"), JSON.stringify(legacy));
  await expect(loadBoardDefinition(root, "six_player_mvp")).rejects.toThrow(
    "board_config_file_missing",
  );
  await expect(checkConfig(root, "six_player_mvp")).rejects.toThrow("board_config_file_missing");
  await mkdir(path.join(root, "boards"));
  await writeFile(path.join(root, "boards/six_player_mvp.json"), JSON.stringify(legacy));
  await expect(loadBoardDefinition(root, "six_player_mvp")).rejects.toThrow(
    "board_config_migration_required",
  );
  await expect(checkConfig(root, "six_player_mvp")).rejects.toThrow(
    "board_config_migration_required",
  );
  const migrated = convertLegacyBoard(legacy, "six_player_mvp");
  await writeFile(
    path.join(root, "boards/six_player_mvp.json"),
    JSON.stringify(migrated.definition),
  );
  expect((await loadBoardDefinition(root, "six_player_mvp")).config).toEqual(
    parseBoardDefinition(migrated.definition).config,
  );
  await expect(checkConfig(root, "six_player_mvp")).resolves.toBeDefined();
});
