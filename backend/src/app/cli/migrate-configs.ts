/**
 * 负责旧板子及显式 runtime V2 配置的预览、备份及文件发布。输入为显式迁移参数和本地旧文件，输出转换报告或原错误／清理错误集合。
 * 仅 apply 才创建备份与写文件；逐份转换先完成再批量写，目标冲突、恢复及临时文件归本命令管理。
 * 配置解析政策归 convertLegacyBoard；不启动游戏或调用模型；runtime 迁移仅重排已有认证字段，不读取私人目录或宿主环境。
 */
import { convertLegacyRuntime, preflightRuntimeMigration } from "../config/migrate-runtime";
import { resolveCliConfigDirectory } from "./config-directory";
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
import { convertLegacyBoard, type MigrationWarningCode } from "../config/migrate-board";
import { CONFIG_ID_PATTERN } from "../config/board-definition";
import type { BoardName } from "../../rulesets/presets/board-config-resolver";

async function ensureBackup(
  file: string,
  original: string,
  conflictCode = "board_config_migration_backup_conflict",
): Promise<void> {
  // 固定备份名只独占创建；已存在时必须与本次原文相同，不能静默覆盖另一轮来源。
  const backup = `${file}.v1.bak`;
  try {
    await writeFile(backup, original, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if ((await readFile(backup, "utf8")) !== original) throw new Error(conflictCode);
  }
}

/** 记录实际发布前缀；即使后续临时文件清理失败，调用者也能恢复自己写入的目标。 */
interface PublicationReceipt {
  published: boolean;
  temporary?: string;
}

/** 完整临时文件关闭后才发布；独占模式的目标冲突不删除别人创建的目标。 */
async function publishBoard(
  file: string,
  content: string,
  exclusive = false,
  receipt?: PublicationReceipt,
): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const mode = exclusive ? 0o600 : (await stat(file)).mode & 0o777;
  let owned = false;
  let failure: unknown;
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporary, "wx", mode);
    owned = true;
    if (receipt) receipt.temporary = temporary;
    await handle.writeFile(content);
    await handle.close();
    handle = undefined;
    // 独占新目标用 link，替换已存在目标用 rename；两种写入保持各自原冲突政策。
    if (exclusive) await link(temporary, file);
    else await rename(temporary, file);
    if (receipt) receipt.published = true;
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
      if (receipt) delete receipt.temporary;
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
  // 所有转换均已校验，之后才创建备份并替换板子；预览模式只有读取和报告。
  if (apply) {
    for (const change of changes) await ensureBackup(change.file, change.original);
    const written: typeof changes = [];
    try {
      for (const change of changes) {
        // 先登记恢复范围再发布，当前这一项即使只完成部分文件操作也在原恢复列表中。
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

/** 先完整预检，再备份及发布两个 V2 文件；任何中途失败恢复旧源，备份永不覆盖。 */
export async function migrateRuntimeConfigs(configDir: string, apply: boolean): Promise<void> {
  const root = path.resolve(configDir),
    runtime = path.join(root, "runtime");
  const providerFile = path.join(runtime, "providers.json"),
    agentFile = path.join(runtime, "agents.json"),
    backendFile = path.join(runtime, "backends.json");
  try {
    await access(backendFile);
    throw new Error("runtime_config_migration_target_exists");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const originals = await Promise.all([
    readFile(providerFile, "utf8"),
    readFile(agentFile, "utf8"),
  ]);
  function json(source: string, label: string): unknown {
    try {
      return JSON.parse(source);
    } catch {
      throw new Error(`runtime_config_json_invalid: ${label}`);
    }
  }
  const converted = convertLegacyRuntime(
    json(originals[0], "providers"),
    json(originals[1], "agents"),
  );
  const games: unknown[] = [];
  let filenames: string[] = [];
  try {
    filenames = (await readdir(path.join(root, "games")))
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const filename of filenames)
    games.push(
      json(await readFile(path.join(root, "games", filename), "utf8"), `games.${filename}`),
    );
  let debugSummary: unknown;
  try {
    debugSummary = json(
      await readFile(path.join(runtime, "debug_summary.json"), "utf8"),
      "debugSummary",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  preflightRuntimeMigration(converted, games, debugSummary);
  if (apply) {
    // 预检期间若源文件被修改，拒绝发布；不会用较早读取内容覆盖用户的新编辑。
    if (
      (await readFile(providerFile, "utf8")) !== originals[0] ||
      (await readFile(agentFile, "utf8")) !== originals[1]
    )
      throw new Error("runtime_config_migration_source_changed");
    await ensureBackup(providerFile, originals[0], "runtime_config_migration_backup_conflict");
    await ensureBackup(agentFile, originals[1], "runtime_config_migration_backup_conflict");
    const backendReceipt: PublicationReceipt = { published: false },
      agentReceipt: PublicationReceipt = { published: false };
    let providersRemoved = false;
    try {
      await publishBoard(
        backendFile,
        JSON.stringify(converted.backends, null, 2) + "\n",
        true,
        backendReceipt,
      );
      await publishBoard(
        agentFile,
        JSON.stringify(converted.agents, null, 2) + "\n",
        false,
        agentReceipt,
      );
      await unlink(providerFile);
      providersRemoved = true;
    } catch (error) {
      const failures: unknown[] = [error];
      if (agentReceipt.published)
        try {
          await publishBoard(agentFile, originals[1]);
        } catch (rollback) {
          failures.push(rollback);
        }
      if (providersRemoved)
        try {
          await publishBoard(providerFile, originals[0], true);
        } catch (rollback) {
          failures.push(rollback);
        }
      if (backendReceipt.published)
        try {
          await unlink(backendFile);
        } catch (rollback) {
          failures.push(rollback);
        }
      // 仅重清理本轮确已创建的临时文件；第一次清理错误仍保留，不能假报成功。
      for (const receipt of [backendReceipt, agentReceipt])
        if (receipt.temporary) {
          try {
            await unlink(receipt.temporary);
          } catch (cleanup) {
            if ((cleanup as NodeJS.ErrnoException).code !== "ENOENT") failures.push(cleanup);
          }
        }
      if (failures.length > 1)
        throw new AggregateError(failures, "runtime_config_migration_rollback_failed");
      throw error;
    }
  }
  // 报告只包含固定路径与数量，不包含名字、模型参数、进程命令或认证原文。
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "preview",
        schemaVersion: 2,
        backends: Object.keys(converted.backends.items).length,
        agents: Object.keys(converted.agents.items).length,
        gamesChecked: games.length,
        changed: ["runtime/backends.json", "runtime/agents.json"],
        retired: ["runtime/providers.json"],
        backups: ["runtime/providers.json.v1.bak", "runtime/agents.json.v1.bak"],
      },
      null,
      2,
    ),
  );
}

export async function main(
  argv = process.argv.slice(2),
  display: CliDisplayContext = { locale: "zh-CN", explicit: false },
): Promise<void> {
  const args = takeDisplayArguments(argv, display);
  const values: Record<string, string> = {};
  let apply = false;
  let runtime = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runtime") {
      runtime = true;
      continue;
    }
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
  if (runtime && ["--source", "--board", "--base"].some((key) => values[key]))
    throw new Error("config_migration_usage");
  const task = runtime
    ? migrateRuntimeConfigs(configDir, apply)
    : values["--source"]
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
