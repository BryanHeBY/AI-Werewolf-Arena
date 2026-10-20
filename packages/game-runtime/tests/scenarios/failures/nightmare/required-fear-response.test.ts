/**
 * 失败场景验证噩梦之影必需恐惧回复缺失或迟到时保留原部分录制对局。
 * 输入为 LLM／ACP、两种语言及必需回复失败模式下的原受控传输计划。
 * 输出与预期为字面不完整 checkpoint、失败行动者／阶段及无恐惧／夜间结算断言，保留实际前缀，不把录制输入重新生成固定预期。
 */
import { expect, test } from "bun:test";
import { nightmareScenario } from "../../../support/features/nightmare-shadow/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
for (const failure of ["missing", "late"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(`nightmare required fear ${failure}/${transport} preserves partial Tape`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = nightmareScenario(),
          actorId = scenario.nightmare,
          stage = "nightmare_fear";
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
        expect(run.replay.events.filter((e) => e.type === "nightmare_fear_committed")).toHaveLength(
          0,
        );
        expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(0);
      }
    }, 120000);
