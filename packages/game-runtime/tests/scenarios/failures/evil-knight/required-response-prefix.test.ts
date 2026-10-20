/**
 * 失败场景验证恶夜骑士对局的六个阶段在必需回复失败时保留原不完整录制前缀。
 * 输入为原缺失／迟到的 LLM／ACP 回复、两种语言及确定性的夜间／死亡枪计划。
 * 输出与预期为字面失败行动者／阶段、此前夜数及无回退断言，并绑定真实执行；不以完整通过的对局替换失败前缀。
 */
import { expect, test } from "bun:test";
import { Role } from "../../../../src/domain";
import { evilKnightScenario } from "../../../support/features/evil-knight/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";

const order = ["wolf_discussion", "guard", "wolf_vote", "witch", "seer", "hunter_shot"] as const;
for (const stage of order)
  for (const failure of ["missing", "late"] as const)
    for (const transport of ["llm", "acp"] as const)
      test(`evil knight ${stage}/${failure}/${transport}: required failure preserves partial Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = evilKnightScenario("night_immune_wolf");
          const day = stage === "hunter_shot" ? 2 : 1;
          const actorId =
            stage === "guard"
              ? scenario.roles.indexOf(Role.Guard) + 1
              : stage === "witch"
                ? scenario.witch
                : stage === "seer"
                  ? scenario.seer
                  : stage === "hunter_shot"
                    ? scenario.hunter
                    : scenario.knight;
          const allowed = new Set<string>(order.slice(0, order.indexOf(stage) + 1));
          const turns = new Map<number, PlannedTurn[]>();
          for (const [actor, plan] of scenario.turns) {
            turns.set(
              actor,
              plan
                .filter((t) => t.day < day || (t.day === day && allowed.has(t.stage)))
                .map((t) =>
                  actor === actorId && t.day === day && t.stage === stage
                    ? {
                        ...t,
                        terminalFailure: failure,
                        action: failure === "missing" ? null : t.action,
                      }
                    : t,
                ),
            );
          }
          const run = await runTransportGame(
            { ...scenario, turns, expectedFailure: { actorId, stage } },
            transport,
            locale,
          );
          expect(run.record.checkpoints.at(-1)!.complete).toBe(false);
          expect(run.record.decisions.at(-1)).toMatchObject({
            actorId,
            stage,
            outcome: { kind: "error" },
          });
          expect(run.replay.events.some((e) => e.type === "game_over")).toBe(false);
          expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(
            day - 1,
          );
          for (const view of run.views)
            for (const row of view.timeline)
              if (row.kind === "turn")
                expect(row.delta_messages.some((m) => m.kind === "fallback")).toBe(false);
        }
      }, 120000);
