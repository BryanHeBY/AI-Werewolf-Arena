/**
 * 观察驱动的整局场景验证机械狼学习、模式和后续技能事件分支。
 * 输入为固定有限观察种子及录制的原身份快照。
 * 字面约束为模仿／模式／技能／跳过／继承狼刀覆盖及狼聊排除；完整对局严格重放结果另与原录制作一致性对照。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

for (const id of ["six_player_mechanical_wolf", "twelve_player_mechanical_wolf"] as const)
  test(`${id}: restricted-observation mechanical seeds naturally finish with active learning, skill/mode and exact Tape`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../../configs.example"),
      id,
    );
    const report = await simulateGames(board, {
      seeds: Array.from(
        { length: 20 },
        (_, i) => `mechanical-random:${i + (id.startsWith("twelve") ? 60 : 0)}`,
      ),
      styles: ["active", "conservative", "competitive", "random"],
      recordRoot: await createTestTempDirectory("awa-mechanical-random-"),
      maxDays: 12,
    });
    expect(report.games).toHaveLength(20);
    expect(report.rejects).toBe(0);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(20);
    expect(report.branches.mechanical_mimicked).toBeGreaterThan(0);
    expect(report.branches.mechanical_mode_selected).toBeGreaterThan(0);
    const root = await createTestTempDirectory("awa-mechanical-random-replay-");
    let inheritedKnives = 0,
      skills = 0,
      skips = 0,
      inheritance = 0;
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json")),
        actor = record.metadata.players.find((p) => p.role === "mechanical_wolf")!.id;
      for (const event of record.events) {
        if (event.type === "wolf_kill_vote_cast" && event.payload.actorId === actor)
          inheritedKnives++;
        if (
          ["mechanical_poison_used", "mechanical_guard_chosen"].includes(event.type) ||
          (event.type === "role_inspected" && event.payload.actorId === actor)
        )
          skills++;
        if (["mechanical_skill_skipped", "mechanical_mimic_skipped"].includes(event.type)) skips++;
        if (event.type === "mechanical_awakened") inheritance++;
        if (["wolf_discussion", "wolf_discussion_ended"].includes(event.type))
          expect(event.payload.actorId).not.toBe(actor);
      }
      expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
    }
    expect(skills).toBeGreaterThan(0);
    expect(skips).toBeGreaterThan(0);
    expect(inheritance).toBeGreaterThan(0);
    expect(inheritedKnives).toBeGreaterThan(0);
  }, 30000);
