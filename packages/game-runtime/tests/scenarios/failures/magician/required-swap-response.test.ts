/**
 * 失败场景验证魔术师必需交换回复缺失或迟到时保留原部分录制对局。
 * 输入为原受控 LLM／ACP 传输计划、语言矩阵及必需回复失败。
 * 输出与预期为字面失败 checkpoint／决定及无交换／夜间结算断言，覆盖真实 provider 到录制前缀，不补造角色行动作为回退。
 */
import { expect, test } from "bun:test";
import { magicianScenario } from "../../../support/features/magician/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
for (const failure of ["missing", "late"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(`Magician required swap ${failure}/${transport} preserves partial Tape`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = magicianScenario(),
          actorId = scenario.magician,
          stage = "magician_exchange";
        const turns = new Map<number, PlannedTurn[]>();
        for (const [actor, plan] of scenario.turns)
          turns.set(
            actor,
            plan
              .filter((t) => t.day === 1 && t.stage === stage)
              .map((t) => ({
                ...t,
                terminalFailure: failure,
                action: failure === "missing" ? null : t.action,
              })),
          );
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
        expect(
          run.replay.events.filter((e) => e.type === "magician_exchange_committed"),
        ).toHaveLength(0);
        expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(0);
      }
    }, 120000);
