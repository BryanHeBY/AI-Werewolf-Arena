/**
 * 失败场景测试负责纯白／狼巫必选查验失败保留首夜已付前缀且不回退。输入为原第二夜阶段、缺失／非法／迟到回复及传输／语言矩阵。
 * 输出以手写前夜／死亡数、失败演员及未获授权的第二次结果缺席核对真实录制；生成归档本身不被称为独立覆盖。
 */
import { expect, test } from "bun:test";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { pureWhiteScenario } from "../../../support/features/pure-white-girl/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { type PlannedTurn } from "../../../support/transport/contracts";
for (const stage of ["pure_white_girl", "wolf_witch"] as const)
  for (const failure of ["missing", "invalid", "late"] as const)
    for (const transport of ["llm", "acp"] as const)
      test(`${stage}/${failure}/${transport}: required response failure preserves exact partial Tape without settlement or fallback`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = pureWhiteScenario("wolf");
          const actorId = stage === "pure_white_girl" ? scenario.pure : scenario.wolfWitch;
          const before = new Set<string>([
            "guard",
            "wolf_discussion",
            "wolf_vote",
            "witch",
            "pure_white_girl",
          ]);
          if (stage === "wolf_witch") before.add("wolf_witch");
          const turns = new Map<number, PlannedTurn[]>();
          for (const [actor, plan] of scenario.turns) {
            turns.set(
              actor,
              plan
                .filter((t) => t.day === 1 || (t.day === 2 && before.has(t.stage)))
                .map((t) => {
                  if (actor !== actorId || t.day !== 2 || t.stage !== stage) return t;
                  if (failure === "invalid")
                    return {
                      ...t,
                      action: null,
                      terminalFailure: "missing" as const,
                      invalidActions: Array.from({ length: 3 }, () => ({
                        name: "inspect_night_identity" as const,
                        args: { target_id: actorId, abstain: false },
                      })),
                      expectedInvalidError: RuleError.RoleInspectTarget,
                    };
                  return {
                    ...t,
                    terminalFailure: failure,
                    action: failure === "missing" ? null : t.action,
                  };
                }),
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
          expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(1);
          const secondNightReports = run.replay.events.filter(
            (e) => e.type === "role_inspected" && e.day === 2,
          );
          expect(secondNightReports).toHaveLength(stage === "pure_white_girl" ? 0 : 1);
          expect(secondNightReports.some((e) => e.payload.actorId === actorId)).toBe(false);
          expect(run.manifest.players.filter((p) => !p.alive)).toHaveLength(3);
          for (const view of run.views)
            for (const row of view.timeline)
              if (row.kind === "turn")
                expect(row.delta_messages.some((m) => m.kind === "fallback")).toBe(false);
        }
      }, 120000);
