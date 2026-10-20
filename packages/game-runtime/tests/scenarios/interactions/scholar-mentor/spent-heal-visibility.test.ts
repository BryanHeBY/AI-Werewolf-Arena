/**
 * 交互场景验证学者／导师治疗已消耗后，后续刀口目标在整局录制及重放检查中不再公开。
 * 输入为原提前治疗传输计划、声明的胜方／存活预期及后续目标 context 副本伪造。
 * 输出与预期为明确第二／三日隐私字段、原计划结果及伪造拒绝，保留因果历史；存活预期由计划声明，不由第二个 World 计算。
 */
import { expect, test } from "bun:test";
import { scholarMentorScenario } from "../../../support/features/scholar-mentor/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";

for (const transport of ["llm", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`Scholar Mentor spent heal hides later knife targets/${transport}/${locale}`, async () => {
      const scenario = scholarMentorScenario("early-heal");
      const run = await runTransportGame(scenario, transport, locale);
      const second = run.record.decisions.find((d) => d.day === 2 && d.stage === "witch")!;
      const third = run.record.decisions.find((d) => d.day === 3 && d.stage === "witch")!;
      expect(second.request.context.wolf_targets).toHaveLength(2);
      expect(third.request.context.modifier_poison_blocked).toBe(true);
      expect(Object.hasOwn(third.request.context, "wolf_target")).toBe(false);
      expect(Object.hasOwn(third.request.context, "wolf_targets")).toBe(false);
      expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
      expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
        scenario.alive,
      );
      const forged = structuredClone(run.record);
      forged.decisions.find(
        (d) => d.day === 3 && d.stage === "witch",
      )!.request.context.wolf_targets = [];
      expect(() => parseReproductionRecord(forged)).toThrow("reproduction_scholar_mentor_invalid");
    }, 120000);
