/**
 * 模拟场景测试验证原两个板子、各 25 个种子的重复及交错完整对局。输入为原基线动作
 * 与延迟回复；精确快照／事件和自然终局提供预期。板子、种子与交错矩阵保持，不调用模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/core/domain/random";
import { BaselineBotActionProvider } from "../../../src/game/drivers/privileged-baseline";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";

for (const [board, config] of [
  ["six", sixPlayerMvpConfig],
  ["twelve", twelvePlayerStandardConfig],
] as const) {
  test(`${board}: 25 seeds reproduce complete engine games even with other games interleaved`, async () => {
    const run = async (seed: string, delayed: boolean) => {
      const context = bootstrapGame(config, { random: createRandom(seed) });
      // 原特权基线用作确定的控制器样本，T03 玩家模拟另有受限观察驱动。
      const baseline = new BaselineBotActionProvider(context.world);
      const provider = {
        async getAction(request: Parameters<typeof baseline.getAction>[0]) {
          if (delayed) await Promise.resolve();
          return baseline.getAction(request);
        },
      };
      const snapshot = await context.phaseManager.runUntilGameOver(provider, 30);
      return {
        snapshot,
        events: context.phaseManager
          .getEvents()
          .map(({ timestamp: _timestamp, ...event }) => event),
      };
    };
    for (let index = 0; index < 25; index++) {
      const seed = `${board}:rng:${index}`;
      const [first, other, replay] = await Promise.all([
        run(seed, false),
        run(`other:${seed}`, true),
        run(seed, true),
      ]);
      expect(first.snapshot.gameOver).toBe(true);
      expect(first.snapshot.result?.reason).not.toBe("max_days_reached");
      expect(other.snapshot.gameOver).toBe(true);
      expect(replay).toEqual(first);
    }
  }, 20000); // 每个板子执行 75 局，超时用于完成确定性验证，没有声明五秒性能预算。
}
