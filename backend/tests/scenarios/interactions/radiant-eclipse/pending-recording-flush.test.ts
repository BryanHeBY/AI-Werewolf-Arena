/**
 * 交互场景验证流光／蚀日竞选、发言和投票请求处于 pending 时，自动录制仍可刷盘。
 * 输入为现有录制驱动，以及原三个阶段矩阵中一次延迟回复。
 * 输出与预期为字面到达延迟点、终结和空错误断言，覆盖运行中的周期；不重新生成归档预期输出。
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
for (const stage of ["sheriff_nomination", "day_speech", "voting"] as const)
  test(`real automatic recording flush during pending ${stage}`, async () => {
    let delayed = false;
    const r = await radiantRecording({
      provider: (_game, manual) => ({
        getAction: async (q) => {
          if (!delayed && q.context.day === 1 && q.context.stage === stage) {
            delayed = true;
            await Bun.sleep(1100);
          }
          return manual.getAction(q);
        },
      }),
    });
    expect(delayed).toBe(true);
    expect(r.finalized).toBe(true);
    expect(r.termination?.errors).toEqual([]);
  }, 10000);
