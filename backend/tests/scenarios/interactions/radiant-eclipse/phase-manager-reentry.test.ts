/**
 * 交互场景验证 PhaseManager 拒绝流光／蚀日重入，同时保留原阶段 owner。
 * 输入为原暂挂吞噬／白天发言请求及同一 PhaseManager 上的第二次调用。
 * 输出与预期通过明确阶段、生命期和拒绝检查保留首周期所有权；第二次调用不成为新 owner。
 */
import { expect, test } from "bun:test";
import { radiantFixture } from "../../../support/features/radiant-eclipse/builders/runtime-game";
import { radiantProvider } from "../../../support/features/radiant-eclipse/drivers/actions";
import { Phase } from "../../../../src/domain";
for (const moment of ["swallow", "day_speech"] as const)
  test(`same PM rejected reentry preserves original ${moment} owner and phase`, async () => {
    const f = await radiantFixture();
    await f.phaseManager.runSingleCycle(radiantProvider(f.requests), 20);
    expect(f.phaseManager.getSnapshot()).toMatchObject({
      day: 2,
      phase: Phase.Voting,
      gameOver: false,
    });
    let seen = false;
    await f.phaseManager.runSingleCycle(
      radiantProvider(f.requests, { swallow: 5, dream: 7 }, async (r) => {
        const chosen =
          moment === "swallow"
            ? r.context.stage === "eclipse_swallow"
            : r.phase === Phase.Day && r.allowedTools.includes("speak");
        if (!seen && chosen) {
          seen = true;
          const before = f.phaseManager.getSnapshot(),
            eventCount = f.phaseManager.getEvents().length;
          await expect(f.phaseManager.runSingleCycle(radiantProvider([]), 20)).rejects.toThrow(
            "radiant_night_reentry",
          );
          expect(f.phaseManager.getSnapshot()).toEqual(before);
          expect(f.phaseManager.getEvents()).toHaveLength(eventCount);
        }
        return undefined;
      }),
      20,
    );
    expect(seen).toBe(true);
    expect(f.phaseManager.getSnapshot()).toMatchObject({
      day: 3,
      phase: Phase.Voting,
      gameOver: false,
    });
  });
