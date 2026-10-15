/**
 * Configuration filesystem integration tests verify canonical board rejection, source migration, backup conflicts and resolved setup metadata.
 * Input: Original public twelve-player definition reads, actual temporary board/runtime files and literal invalid overrides.
 * Output and oracle: Exact diagnostic paths, backup bytes and redacted setup values preserve loader/migration behavior; private markers are synthetic test literals and no model or game runs.
 */
import { ActionWindow } from "../../../../src/domain/identity";
import { expect, test } from "bun:test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseBoardDefinition } from "../../../../src/runtime/config/board_definition";
import { convertLegacyBoard } from "../../../../src/runtime/config/migrate_board";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";
import { describeResolvedSetup } from "../../../../src/runtime/config/describe_setup";
import { resolveGameSetup } from "../../../../src/runtime/config/resolve_game_setup";
import { parseRuntimeConfig } from "../../../../src/runtime/config/parse_config";
import { migrateBoards, migrateBoardSource } from "../../../../src/runtime/cli/migrate_configs";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

async function definition() {
  return JSON.parse(
    await readFile(
      path.resolve(import.meta.dir, "../../../../../configs.example/boards/twelve_player_standard.json"),
      "utf8",
    ),
  );
}

test("canonical boards reject nested misspellings, planned roles and incomplete setup", async () => {
  const raw = await definition();
  raw.mechanisms.sheriff.voteWeigth = 2;
  expect(() => parseBoardDefinition(raw)).toThrow("mechanisms.sheriff.voteWeigth");
  delete raw.mechanisms.sheriff.voteWeigth;
  raw.roles.witch.selfHela = "always";
  expect(() => parseBoardDefinition(raw)).toThrow("roles.witch.selfHela");
  delete raw.roles.witch.selfHela;
  raw.board.roleSetups[0].role = "awakened_knight";
  expect(() => parseBoardDefinition(raw)).toThrow("board_config_role_not_implemented");
  raw.board.roleSetups[0].role = "wolf";
  raw.board.roleSetups[0].count = 3;
  expect(() => parseBoardDefinition(raw)).toThrow("board_config_role_count_mismatch");
});

test("parameters require the corresponding role and implemented semantics", async () => {
  const raw = await definition();
  raw.roles.guard = {};
  expect(() => parseBoardDefinition(raw)).toThrow("board_config_role_parameters_without_role");
  delete raw.roles.guard;
  raw.mechanisms.tieBreaker.wolfKillVote = "min_seat";
  expect(() => parseBoardDefinition(raw)).toThrow("board_config_invalid_field");
  raw.mechanisms.tieBreaker.wolfKillVote = "min_id";
  raw.mechanisms.selfDestruct.enabledWindows = ["on_daybreak"];
  raw.rules.hooks.onDaybreak = false;
  expect(() => parseBoardDefinition(raw)).toThrow("board_config_window_hook_disabled");
  raw.rules.hooks.onDaybreak = true;
  expect(parseBoardDefinition(raw).config.selfDestruct!.enabledWindows).toEqual([
    ActionWindow.OnDaybreak,
  ]);
});

test("boards require opposing camps before a game can start", async () => {
  const raw = await definition();
  raw.board.roleSetups = raw.board.roleSetups.filter(
    (entry: { role: string }) => entry.role !== "wolf",
  );
  raw.board.size = 8;
  expect(() => parseBoardDefinition(raw)).toThrow("board_config_requires_good_and_wolf");
  raw.board.roleSetups = [{ role: "wolf", count: 8 }];
  expect(() => parseBoardDefinition(raw)).toThrow("board_config_requires_good_and_wolf");
});

test("legacy collections validate all fields and select a source independently of the new id", async () => {
  expect(() =>
    convertLegacyBoard(
      { boards: { twelve_player_standard: { boardSize: 12 } }, defaut: {} },
      "twelve_player_standard",
    ),
  ).toThrow("board_config_invalid_override_field");
  expect(() =>
    convertLegacyBoard(
      { boards: { twelve_player_standard: { boardSize: 12 }, unused: { enableSherif: true } } },
      "twelve_player_standard",
    ),
  ).toThrow("board_config_invalid_override_field");
  const root = await createTestTempDirectory("awa-source-migration-");
  const source = path.join(root, "collection.json");
  const original = JSON.stringify({
    default: { hooks: { onPreVote: false } },
    boards: { twelve_player_standard: { boardSize: 12 } },
  });
  await writeFile(source, original);
  await migrateBoardSource(root, "custom_twelve", source, "twelve_player_standard", true);
  expect((await loadBoardDefinition(root, "custom_twelve")).config.hooks.onPreVote).toBe(false);
  expect(await readFile(source, "utf8")).toBe(original);
  expect(await readFile(`${source}.v1.bak`, "utf8")).toBe(original);
  await expect(
    migrateBoardSource(root, "custom_twelve", source, "twelve_player_standard", true),
  ).rejects.toThrow("board_config_migration_target_exists");
});

test("migration reuses identical backups and refuses conflicting backups before any board write", async () => {
  const root = await createTestTempDirectory("awa-backup-retry-");
  await mkdir(path.join(root, "boards"));
  const first = path.join(root, "boards/six_player_mvp.json");
  const second = path.join(root, "boards/twelve_player_standard.json");
  const original = JSON.stringify({ hooks: { onPerSpeechGap: false } });
  await writeFile(first, original);
  await writeFile(second, original);
  await writeFile(`${second}.v1.bak`, "DO_NOT_OVERWRITE");
  await expect(migrateBoards(root, true)).rejects.toThrow("board_config_migration_backup_conflict");
  expect(await readFile(first, "utf8")).toBe(original);
  expect(await readFile(second, "utf8")).toBe(original);
  expect(await readFile(`${second}.v1.bak`, "utf8")).toBe("DO_NOT_OVERWRITE");
  await writeFile(`${second}.v1.bak`, original);
  await migrateBoards(root, true);
  expect((await loadBoardDefinition(root, "six_player_mvp")).definition.version).toBe(2);
  expect((await loadBoardDefinition(root, "twelve_player_standard")).definition.version).toBe(2);
});

test("custom board ids load from one canonical file with matching metadata", async () => {
  const root = await createTestTempDirectory("awa-custom-board-");
  await mkdir(path.join(root, "boards"));
  const raw = await definition();
  raw.id = "custom_twelve";
  await writeFile(path.join(root, "boards/custom_twelve.json"), JSON.stringify(raw));
  const resolved = await loadBoardDefinition(root, "custom_twelve");
  expect(resolved.config.boardSize).toBe(12);
  expect(resolved.definition.ruleset).toEqual({ id: "awa_classic", version: "1.0.0" });
  await expect(loadBoardDefinition(root, "../custom_twelve")).rejects.toThrow(
    "board_config_id_invalid",
  );
  raw.id = "different";
  await writeFile(path.join(root, "boards/custom_twelve.json"), JSON.stringify(raw));
  await expect(loadBoardDefinition(root, "custom_twelve")).rejects.toThrow(
    "board_config_id_mismatch",
  );
});

test("legacy conversion preserves effective hooks and backup without touching runtime files", async () => {
  const root = await createTestTempDirectory("awa-board-migration-");
  await mkdir(path.join(root, "boards"));
  await mkdir(path.join(root, "runtime"));
  const legacy = {
    rules: { hooks: { onPerSpeechGap: false } },
    roles: { witch: { selfHeal: "always" } },
  };
  const original = JSON.stringify(legacy);
  await writeFile(path.join(root, "boards/twelve_player_standard.json"), original);
  await writeFile(path.join(root, "runtime/providers.json"), "PRIVATE_PROVIDER_CONTENT");
  const converted = convertLegacyBoard(legacy, "twelve_player_standard");
  expect(converted.definition.rules.hooks.onPerSpeechGap).toBe(false);
  expect(converted.definition.roles.witch).toEqual({
    selfHeal: "always",
    knifeVisibility: "awa_with_heal_v1",
    potionPolicy: "awa_one_native_v1",
  });
  await migrateBoards(root, false);
  expect(await readFile(path.join(root, "boards/twelve_player_standard.json"), "utf8")).toBe(
    original,
  );
  await migrateBoards(root, true);
  expect(await readFile(path.join(root, "boards/twelve_player_standard.json.v1.bak"), "utf8")).toBe(
    original,
  );
  expect(
    (await loadBoardDefinition(root, "twelve_player_standard")).config.hooks.onPerSpeechGap,
  ).toBe(false);
  expect(await readFile(path.join(root, "runtime/providers.json"), "utf8")).toBe(
    "PRIVATE_PROVIDER_CONTENT",
  );
});

test("legacy files are refused by normal loading instead of silently falling back", async () => {
  const root = await createTestTempDirectory("awa-legacy-board-");
  await mkdir(path.join(root, "boards"));
  await writeFile(
    path.join(root, "boards/twelve_player_standard.json"),
    JSON.stringify({ boardSize: 12 }),
  );
  await expect(loadBoardDefinition(root, "twelve_player_standard")).rejects.toThrow(
    "board_config_migration_required",
  );
  await expect(loadBoardDefinition(root, "missing")).rejects.toThrow("board_config_file_missing");
});

test("game bindings and CLI number overrides are validated after board resolution", async () => {
  const input = {
    providers: {
      default: "local",
      items: {
        local: {
          type: "openai",
          apiKey: "PRIVATE_TEST_KEY",
          baseURL: "https://private:password@example.test?key=SECRET_QUERY",
        },
      },
    },
    agents: {
      default: "test",
      items: {
        test: {
          kind: "llm",
          provider: "local",
          model: "test",
          personalityPrompt: "PRIVATE_PROMPT",
        },
      },
    },
    game: { board: "twelve_player_standard", agent: "test" },
  };
  const board = parseBoardDefinition(await definition());
  for (const seat of ["01", "99", "0", "1.0"]) {
    const runtime = parseRuntimeConfig({
      ...input,
      game: { ...input.game, playerAgents: { [seat]: "test" } },
    });
    expect(() => resolveGameSetup(runtime, {}, board)).toThrow(
      "runtime_config_player_binding_invalid",
    );
  }
  const typo = parseRuntimeConfig({
    ...input,
    game: { ...input.game, roleAgents: { wlof: "test" } },
  });
  expect(() => resolveGameSetup(typo, {}, board)).toThrow("runtime_config_role_binding_invalid");
  const runtime = parseRuntimeConfig(input);
  expect(() => resolveGameSetup(runtime, { maxDays: NaN }, board)).toThrow(
    "runtime_config_positive_integer_invalid",
  );
  const report = JSON.stringify(describeResolvedSetup(resolveGameSetup(runtime, {}, board)));
  for (const secret of ["PRIVATE_TEST_KEY", "PRIVATE_PROMPT", "password", "SECRET_QUERY"])
    expect(report).not.toContain(secret);
  expect(report).toContain('"explicit"');
});

test("the public twelve-player window example loads through normal v2 setup with all four hooks", async () => {
  const root = path.resolve(process.cwd(), "../configs.example");
  const resolved = await loadBoardDefinition(root, "twelve_player_windows");
  expect(resolved.config.boardSize).toBe(12);
  expect(resolved.config.selfDestruct!.enabledWindows).toEqual([
    ActionWindow.OnPreElection,
    ActionWindow.OnDaybreak,
    ActionWindow.OnPerSpeechGap,
    ActionWindow.OnPreVote,
  ]);
  expect(resolved.config.hooks).toEqual({
    onDaybreak: true,
    onPreElection: true,
    onPreVote: true,
    onPerSpeechGap: true,
  });
  const game = JSON.parse(
    await readFile(path.join(root, "games/twelve_player_windows.json"), "utf8"),
  );
  const runtime = parseRuntimeConfig({
    providers: {
      default: "synthetic",
      items: {
        synthetic: { type: "openai", apiKey: "synthetic-only", baseURL: "http://127.0.0.1:1/v1" },
      },
    },
    agents: {
      default: "default",
      items: { default: { kind: "llm", provider: "synthetic", model: "synthetic" } },
    },
    game,
  });
  const setup = resolveGameSetup(runtime, {}, resolved);
  expect(setup.boardConfig.selfDestruct!.enabledWindows).toEqual(
    resolved.config.selfDestruct!.enabledWindows,
  );
});
