/**
 * 场景测试通过两种语言的 SDK／ACP 验证子狐和河豚的无效行动纠正。
 * 输入为原完整对局计划及一条手写无效行动；字面错误、一次已付历史和最终固定结果检验纠正过程不重复消耗库存。
 * 传输驱动拥有子进程和录制资源；测试不授予替换角色原体的权限，也不调用付费模型。
 */
import { expect, test } from "bun:test";
import { animalTransportScenario } from "../../../support/features/animal-dream/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import type { ToolCall } from "../../../../src/domain";
for (const skill of ["fox", "puffer"] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`Animal actual rejection then correction ${skill}/${kind}`, async () => {
      for (const locale of ["en", "zh-CN"] as const) {
        const s = await animalTransportScenario(
            skill === "fox" ? "fox_beauty" : "full_retaliation",
          ),
          actor = s.mapping.get(skill === "fox" ? 10 : 12)!,
          turn = s.turns
            .get(actor)!
            .find((t) => t.stage === (skill === "fox" ? "fox_distract" : "puffer_reaction"))!;
        turn.invalidActions = [
          (skill === "fox"
            ? { name: "fox_distract", args: { target_id: 999 } }
            : { name: "puffer_retaliate", args: { activate: "true" } }) as ToolCall,
        ];
        turn.expectedInvalidError =
          skill === "fox" ? "animal_action_unavailable" : "invalid_tool_arguments";
        const r = await runTransportGame(s, kind, locale),
          stock =
            skill === "fox"
              ? r.record.checkpoints.at(-1)!.animalDream!.fox
              : r.record.checkpoints.at(-1)!.animalDream!.puffer;
        expect(r.result.snapshot.result?.winner).toBe(s.golden.winner);
        expect(stock.history).toHaveLength(1);
        expect(stock[skill === "fox" ? "usedNight" : "usedDay"]).toBe(skill === "fox" ? 2 : 1);
      }
    }, 120000);
