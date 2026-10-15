/**
 * 发布场景测试负责全部公开板的受限观察、并行隔离和同构建逐局复现；不把模拟终局当精确角色规则oracle。
 * 默认每板中英各一局；阶段验收显式设AWA_EXPANSION_BATCH_COUNT=1000扩充，避免每次定向开发重复千局。
 * 每条路线只获本人DTO，独立要求自然终局、零回退、公开牌池覆盖及实际回放快照一致；成功原档及时清理，失败原档保留。
 */
import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Role, type Locale } from "@ai-werewolf-arena/game-contract";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import { simulateGames } from "../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/app/simulation/replay-reproduction";
import { currentEngineVersion } from "../../../src/app/simulation/reproduction-context";

test("全部公开板两语受限观察、并行隔离及逐局严格复现", async () => {
  const folder = new URL("../../../../configs.example/boards/", import.meta.url),
    files = (await readdir(folder)).filter((name) => name.endsWith(".json")).sort(),
    jobs = files.flatMap((file) => (["zh-CN", "en"] as const).map((locale) => ({ file, locale }))),
    total = Number(process.env.AWA_EXPANSION_BATCH_COUNT ?? jobs.length),
    // 发布证据不登记到通用afterEach清理器；成功子档自行清理，失败原档和receipt保留供审查。
    root = await mkdtemp(path.join(tmpdir(), "awa-expansion-matrix-")),
    seen = new Set<string>(),
    receipt: Array<{
      board: string;
      locale: Locale;
      games: number;
      natural: number;
      fallbacks: number;
      rejects: number;
      strict: number;
      branches: Record<string, number>;
      maxDay: number;
      maxDecisions: number;
    }> = [];
  if (!Number.isSafeInteger(total) || total < jobs.length || total > 1000)
    throw new Error("expansion_batch_count_invalid");
  const engine = await currentEngineVersion();
  let next = 0;
  let longest = { day: 0, decisions: 0, file: "" };
  // 两个独立对局并行，World／locale／RNG／录制作用域都由真实装配分别创建。
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++,
        { file, locale } = jobs[index]!,
        board = parseBoardDefinition(JSON.parse(await readFile(new URL(file, folder), "utf8"))),
        count = Math.floor(total / jobs.length) + Number(index < total % jobs.length),
        directory = path.join(root, `${index}-${board.definition.id}-${locale}`),
        report = await simulateGames(board, {
          locale,
          seeds: Array.from(
            { length: count },
            (_, i) => `p10:${board.definition.id}:${locale}:${i}`,
          ),
          styles: ["active", "conservative", "competitive", "random"],
          maxDays: 60,
          recordRoot: path.join(directory, "original"),
        });
      expect(report.naturallyFinished, `${file}/${locale}`).toBe(count);
      expect(report.fallbacks, `${file}/${locale}`).toBe(0);
      let strict = 0,
        maxDay = 0,
        maxDecisions = 0;
      for (const [i, game] of report.games.entries()) {
        const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
        for (const player of record.metadata.players) seen.add(player.role);
        expect(
          (await replayReproduction(record, path.join(directory, "replayed", String(i)))).snapshot,
        ).toEqual(record.checkpoints.at(-1)!.snapshot);
        strict++;
        const day = record.checkpoints.at(-1)!.snapshot.day;
        maxDay = Math.max(maxDay, day);
        maxDecisions = Math.max(maxDecisions, record.decisions.length);
        // 保留实际行动数增长的已解析归档见证，不把maxDays配置上限当作已执行长度。
        if (record.decisions.length > longest.decisions) {
          const file = path.join(root, `longest-${index}-${i}.reproduction.json`);
          longest = { day, decisions: record.decisions.length, file };
          await writeFile(file, JSON.stringify(record, null, 2));
        }
      }
      receipt.push({
        board: board.definition.id,
        locale,
        games: count,
        natural: report.naturallyFinished,
        fallbacks: report.fallbacks,
        rejects: report.rejects,
        strict,
        branches: report.branches,
        maxDay,
        maxDecisions,
      });
      // 测试预加载会静音console；阶段长任务直接写进程stdout以保留真实进度回执。
      process.stdout.write(
        `[expansion_batch] ${board.definition.id}/${locale} games=${count} strict=${strict}\n`,
      );
      // 只删除本worker已完整验证的独占子目录；失败时在进入此处前抛错，原始证据保持。
      await rm(directory, { recursive: true });
    }
  };
  const results = await Promise.allSettled([worker(), worker()]),
    errors = results.flatMap((result) =>
      result.status === "rejected" ? [String(result.reason)] : [],
    ),
    summary = {
      engine,
      requested: total,
      completed: receipt.reduce((n, row) => n + row.games, 0),
      strict: receipt.reduce((n, row) => n + row.strict, 0),
      coveredRoles: [...seen].sort(),
      longest,
      errors,
      boards: receipt.sort(
        (a, b) => a.board.localeCompare(b.board) || a.locale.localeCompare(b.locale),
      ),
    };
  await writeFile(path.join(root, "receipt.json"), JSON.stringify(summary, null, 2));
  process.stdout.write(`[expansion_batch_receipt] ${path.join(root, "receipt.json")}\n`);
  expect(errors).toEqual([]);
  expect(summary.completed).toBe(total);
  expect(summary.strict).toBe(total);
  expect(summary.coveredRoles).toEqual(Object.values(Role).sort());
}, 1800000);
