import { resolveCliConfigDirectory } from "./config_directory";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import {
  readFile,
  writeFile,
  readdir,
  access,
  mkdir,
  unlink,
  rename,
  link,
  stat,
  open,
  type FileHandle,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { convertLegacyBoard, type MigrationWarningCode } from "../config/migrate_board";
import { CONFIG_ID_PATTERN } from "../config/board_definition";
import type { BoardName } from "../scenarios/board_config_resolver";

async function ensureBackup(file: string, original: string): Promise<void> {
  const backup = `${file}.v1.bak`;
  try {
    await writeFile(backup, original, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if ((await readFile(backup, "utf8")) !== original)
      throw new Error("board_config_migration_backup_conflict");
  }
}

/** Publish a complete JSON file; an exclusive target is never removed on collision. */
async function publishBoard(file: string, content: string, exclusive = false): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const mode = exclusive ? 0o600 : (await stat(file)).mode & 0o777;
  let owned = false;
  let failure: unknown;
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporary, "wx", mode);
    owned = true;
    await handle.writeFile(content);
    await handle.close();
    handle = undefined;
    if (exclusive) await link(temporary, file);
    else await rename(temporary, file);
  } catch (error) {
    failure = error;
  }
  if (handle) {
    try {
      await handle.close();
    } catch (error) {
      failure = new AggregateError([failure, error], "board_config_migration_cleanup_failed");
    }
  }
  if (owned) {
    try {
      await unlink(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        if (failure)
          throw new AggregateError([failure, error], "board_config_migration_cleanup_failed");
        throw error;
      }
    }
  }
  if (failure) throw failure;
}

export async function migrateBoardSource(
  configDir: string,
  boardId: string,
  source: string,
  legacyBase: BoardName | undefined,
  apply: boolean,
  displayLocale: Locale = "zh-CN",
): Promise<void> {
  if (!CONFIG_ID_PATTERN.test(boardId)) throw new Error("board_config_id_invalid");
  const sourceFile = path.resolve(source);
  const target = path.resolve(configDir, "boards", `${boardId}.json`);
  let existed = true;
  try {
    await access(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") existed = false;
    else throw error;
  }
  if (existed && target !== sourceFile) throw new Error("board_config_migration_target_exists");
  const original = await readFile(sourceFile, "utf8");
  let raw: unknown;
  try {
    raw = JSON.parse(original);
  } catch {
    throw new Error("board_config_json_invalid");
  }
  const result = convertLegacyBoard(raw, boardId, legacyBase);
  const report = JSON.stringify(
    {
      mode: apply ? "apply" : "preview",
      boardId,
      sourceFile,
      target,
      warnings: result.warnings,
      message: text(displayLocale, "cli.migrated"),
      warningMessages: migrationWarningMessages(result.warnings, displayLocale),
    },
    null,
    2,
  );
  if (apply) {
    await ensureBackup(sourceFile, original);
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await publishBoard(target, JSON.stringify(result.definition, null, 2) + "\n", !existed);
    } catch (error) {
      if (existed) {
        try {
          await publishBoard(target, original);
        } catch (rollback) {
          throw new AggregateError([error, rollback], "board_config_migration_rollback_failed");
        }
      }
      throw error;
    }
  }
  console.log(report);
}

export async function migrateBoards(
  configDir: string,
  apply: boolean,
  displayLocale: Locale = "zh-CN",
): Promise<void> {
  const root = path.resolve(configDir, "boards");
  const changes: Array<{
    file: string;
    original: string;
    converted: string;
    id: string;
    warnings: MigrationWarningCode[];
  }> = [];
  for (const filename of (await readdir(root)).filter((name) => name.endsWith(".json")).sort()) {
    const id = filename.slice(0, -5);
    const file = path.join(root, filename);
    const original = await readFile(file, "utf8");
    let raw: unknown;
    try {
      raw = JSON.parse(original);
    } catch {
      throw new Error(`board_config_json_invalid: ${id}`);
    }
    const converted = convertLegacyBoard(raw, id);
    if (raw && typeof raw === "object" && "version" in raw) continue;
    changes.push({
      file,
      original,
      converted: JSON.stringify(converted.definition, null, 2) + "\n",
      id,
      warnings: converted.warnings,
    });
  }
  const report = JSON.stringify(
    {
      mode: apply ? "apply" : "preview",
      changes: changes.map(({ id, warnings }) => ({
        id,
        warnings,
        warningMessages: migrationWarningMessages(warnings, displayLocale),
      })),
      untouched: ["runtime/providers.json", "runtime/agents.json", "games/*"],
      message: text(displayLocale, "cli.migrated"),
    },
    null,
    2,
  );
  // Validate every conversion before creating backups or replacing any board.
  if (apply) {
    for (const change of changes) await ensureBackup(change.file, change.original);
    const written: typeof changes = [];
    try {
      for (const change of changes) {
        written.push(change);
        await publishBoard(change.file, change.converted);
      }
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      for (const change of written) {
        try {
          await publishBoard(change.file, change.original);
        } catch (rollback) {
          cleanupErrors.push(rollback);
        }
      }
      if (cleanupErrors.length)
        throw new AggregateError(
          [error, ...cleanupErrors],
          "board_config_migration_rollback_failed",
        );
      throw error;
    }
  }
  console.log(report);
}

export async function main(
  argv = process.argv.slice(2),
  display: CliDisplayContext = { locale: "zh-CN", explicit: false },
): Promise<void> {
  const args = takeDisplayArguments(argv, display);
  const values: Record<string, string> = {};
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") {
      apply = true;
      continue;
    }
    if (
      !["--configs-dir", "--source", "--board", "--base"].includes(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw new Error("config_migration_usage");
    values[args[i]] = args[++i];
  }
  const configDir = resolveCliConfigDirectory(values["--configs-dir"]);
  if (values["--base"] && !["six_player_mvp", "twelve_player_standard"].includes(values["--base"]))
    throw new Error("board_config_legacy_base_unknown");
  if (
    Boolean(values["--source"]) !== Boolean(values["--board"]) ||
    (values["--base"] && !values["--source"])
  )
    throw new Error("config_migration_usage");
  const task = values["--source"]
    ? migrateBoardSource(
        configDir,
        values["--board"],
        values["--source"],
        values["--base"] as BoardName | undefined,
        apply,
        display.locale,
      )
    : migrateBoards(configDir, apply, display.locale);
  await task;
}

if (require.main === module) void runCli(main);

function migrationWarningMessages(
  warnings: readonly MigrationWarningCode[],
  locale: Locale,
): string[] {
  return warnings.map((code) => text(locale, `config.warning.${code}`));
}
