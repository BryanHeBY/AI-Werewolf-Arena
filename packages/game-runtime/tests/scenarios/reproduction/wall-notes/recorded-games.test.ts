/**
 * 复现场景验证完整录制对局保留匿名墙纸条发表及严格必需请求处理。
 * 输入为原六／十二人书写／跳过计划及传输／语言矩阵。
 * 输出与预期为字面发表次数／文本数、匿名受众及终局断言，保留精确重放；原临时诊断输出不变。
 */
import { promises as fs } from "node:fs";
import { expect, test } from "bun:test";
import { Camp } from "../../../../src/domain";
import { wallScenario } from "../../../support/features/wall-notes/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const size of [6, 12] as const)
  for (const mode of ["write", "skip"] as const)
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`${size}/${mode}/${transport}: bilingual full local SDK/ACP-MCP transport and strict wall Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = wallScenario(size, mode),
            run = await runTransportGame(scenario, transport, locale),
            notes = run.replay.events.filter((e) => e.type === "wall_notes_published");
          expect(notes).toHaveLength(1);
          expect(notes[0].day).toBe(1);
          expect(notes[0].payload.texts as string[]).toHaveLength(mode === "write" ? size - 1 : 0);
          expect(run.record.decisions.filter((d) => d.stage === "wall_notes")).toHaveLength(
            size - 1,
          );
          expect(
            run.record.decisions
              .filter((d) => d.stage === "wall_notes")
              .every(
                (d) =>
                  d.request.context.allow_fallback === false &&
                  d.request.context.turn_constraints.min_valid_actions === 0,
              ),
          ).toBe(true);
          expect(run.record.checkpoints.at(-1)!.snapshot).toMatchObject({
            gameOver: true,
            day: size === 6 ? 2 : 4,
            result: { winner: Camp.Good },
          });
          const stocks = run.record.checkpoints.at(-1)!.players.filter((p) => p.wallNote);
          expect(stocks).toHaveLength(size - 1);
          expect(
            stocks.every(
              (p) => p.wallNote?.remaining === (mode === "write" ? 0 : 1) && p.wallNote.expired,
            ),
          ).toBe(true);
          for (const view of run.views) {
            const body = JSON.stringify(view.timeline);
            expect(body).not.toContain("wall_note_changed");
            expect(body).not.toContain("wall_note_order_recorded");
            expect(body).not.toContain("wall_id");
            for (let id = 1; id <= size; id++)
              if (id !== view.player_id) expect(body).not.toContain(`wall:1:${id}\"`);
          }
          if (transport === "llm" && locale === "zh-CN")
            await fs.writeFile(
              `/tmp/awa-p8-wall-${size}-${mode}.replay.json`,
              JSON.stringify(run.replay),
            );
        }
      }, 120000);
