/**
 * 复现场景验证真实流光／蚀日同工具缺目标失败能够终结并重放原始失败前缀。
 * 输入为原吞噬／庇护请求、空行动参数及现有受控录制驱动。
 * 输出与预期为字面到达行动点、终结及重放断言，保留原失败结果；测试不修复非法行动参数。
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
for (const stage of ["eclipse_swallow", "radiant_shelter"] as const)
  test(`a real ${stage} same-tool missing-target failure can finalize and replay its raw failed prefix`, async () => {
    let actionReached = false;
    const result = await radiantRecording({
      failureStage: stage,
      provider: (_game, manual) => ({
        getAction: async (request) => {
          if (request.context.day === 2 && request.context.stage === stage) {
            actionReached = true;
            return {
              name: stage === "eclipse_swallow" ? "swallow_skill" : "cast_shelter",
              args: {},
            } as any;
          }
          return manual.getAction(request);
        },
      }),
    });
    expect(actionReached).toBe(true);
    expect(result.finalized).toBe(true);
    expect(result.termination?.reason).toBe("runtime_error");
    expect(result.checkpoints.at(-1)?.complete).toBe(false);
    const row = result.decisions.find((d) => d.day === 2 && d.stage === stage)!;
    expect(row.outcome.kind).toBe("action");
    expect(
      row.outcome.kind === "action" ? (row.outcome.action?.args as unknown) : undefined,
    ).toEqual({});
  });
