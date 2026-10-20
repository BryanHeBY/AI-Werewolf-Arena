/**
 * 复现场景验证杠精完整录制对局保留严格挑战投票、受阻投票者及终局时点。
 * 输入为原六／十二人成功、平票和弃票计划及传输／语言矩阵。
 * 输出与预期为字面投票／支持／弃票、隐私及声明终局日断言，保留真实录制顺序；临时诊断输出不变。
 */
import { promises as fs } from "node:fs";
import { expect, test } from "bun:test";
import { Camp, Role, Phase } from "../../../../src/domain";
import { debaterScenario } from "../../../support/features/debater/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const size of [6, 12] as const)
  for (const outcome of ["success", "tie", "abstain"] as const)
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`${size}/${outcome}/${transport}: bilingual complete local transports and strict Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = debaterScenario(size, outcome),
            run = await runTransportGame(scenario, transport, locale),
            actor = scenario.roles.indexOf(Role.Debater) + 1,
            target = scenario.roles.map((_, i) => i + 1).find((id) => id !== actor)!,
            ledger = run.replay.events.filter((e) => e.type === "debate_ballots_recorded"),
            result = run.replay.events.filter((e) => e.type === "debate_resolved");
          expect(ledger).toHaveLength(1);
          expect(result).toHaveLength(1);
          expect(result[0]!.payload).toEqual({
            actorId: actor,
            targetId: target,
            day: 1,
            eligibleCount: size,
            supports: size / 2 + (outcome === "success" ? 1 : 0),
            rejects: outcome === "abstain" ? 0 : size / 2 - (outcome === "success" ? 1 : 0),
            abstentions: outcome === "abstain" ? size / 2 : 0,
            success: outcome === "success",
            blockedId: outcome === "success" ? target : actor,
          });
          expect(run.record.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
          expect(run.record.checkpoints.at(-1)!.snapshot.result?.winner).toBe(Camp.Good);
          expect(run.record.checkpoints.at(-1)!.snapshot.day).toBe(size === 6 ? 1 : 4);
          expect(run.record.decisions.filter((d) => d.stage === "debate_challenge")).toHaveLength(
            1,
          );
          expect(run.record.decisions.filter((d) => d.stage === "debate_ballot")).toHaveLength(
            size,
          );
          expect(
            run.record.decisions
              .filter((d) => d.stage === "voting" && d.request.context.day === 1)
              .some((d) => d.request.actorId === (outcome === "success" ? target : actor)),
          ).toBe(false);
          expect(
            run.record.decisions
              .filter((d) => d.stage === "debate_ballot")
              .every((d) => d.request.context.allow_fallback === false),
          ).toBe(true);
          if (transport === "llm" && locale === "zh-CN" && outcome !== "abstain")
            await fs.writeFile(
              `/tmp/awa-p8-debater-${size}-${outcome}.replay.json`,
              JSON.stringify(run.replay),
            );
          for (const view of run.views)
            expect(JSON.stringify(view.timeline)).not.toContain("debate_ballots_recorded");
        }
      }, 120000);
