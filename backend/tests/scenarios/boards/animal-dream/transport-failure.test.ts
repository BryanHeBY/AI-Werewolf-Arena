/**
 * 场景测试验证子狐／河豚必需行动缺失、无效或迟到时，真实动物梦境对局停止。
 * 输入为两种语言中截断于失败回合的原 SDK／ACP 脚本；不完整／停止的 checkpoint、空历史及缺少提交／终局事件构成字面预期。
 * 传输驱动负责本地进程和记录清理；失败前缀测试不补造成功行动、不退还已付效果，也不调用付费模型。
 */
import { expect, test } from "bun:test";
import { animalTransportScenario } from "../../../support/features/animal-dream/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import type { ToolCall } from "../../../../src/domain";
for (const skill of ["fox", "puffer"] as const)
  for (const fault of ["missing", "invalid", "late"] as const)
    for (const kind of ["llm", "acp"] as const)
      test(`Animal actual required failure ${skill}/${fault}/${kind}`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const s = await animalTransportScenario(
              skill === "fox" ? "fox_beauty" : "full_retaliation",
            ),
            id = s.mapping.get(skill === "fox" ? 10 : 12)!,
            rows = s.turns.get(id)!,
            index = rows.findIndex(
              (t) => t.stage === (skill === "fox" ? "fox_distract" : "puffer_reaction"),
            );
          const target = rows[index]!;
          s.turns.set(id, rows.slice(0, index + 1));
          target.terminalFailure = fault === "late" ? "late" : "missing";
          if (fault !== "late") target.action = null;
          if (fault === "invalid") {
            target.invalidActions = [
              (skill === "fox"
                ? { name: "fox_distract", args: { target_id: 999 } }
                : { name: "puffer_retaliate", args: { activate: "true" } }) as ToolCall,
            ];
            target.expectedInvalidError =
              skill === "fox" ? "animal_action_unavailable" : "invalid_tool_arguments";
          }
          s.expectedFailure = { actorId: id, stage: target.stage };
          const r = await runTransportGame(s, kind, locale),
            last = r.record.checkpoints.at(-1)!;
          expect(last.complete).toBe(false);
          expect(last.animalDream!.stopped).toBe(true);
          const stock = skill === "fox" ? last.animalDream!.fox : last.animalDream!.puffer;
          expect(stock[skill === "fox" ? "usedNight" : "usedDay"]).toBeNull();
          expect(stock.history).toEqual([]);
          expect(r.record.events.filter((e) => e.type === "game_over")).toHaveLength(0);
          expect(
            r.record.events.filter(
              (e) => e.type === (skill === "fox" ? "animal_fox_chosen" : "animal_puffer_decided"),
            ),
          ).toHaveLength(0);
        }
      }, 120000);
