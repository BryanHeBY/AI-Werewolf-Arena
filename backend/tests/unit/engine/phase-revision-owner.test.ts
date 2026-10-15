/**
 * 单元测试验证经理阶段修订的真实 debug、阶段变化与等待中撤销边界。
 * 输入为固定六席内存局、原阶段及受控首个行动 Promise；事件、关闭次数和修订值为手写预期。
 * 只驱动阶段跳转或被撤销的首个请求，不完成整局、连接模型或生成 golden。
 */
import { expect, test } from "bun:test";
import { Phase, Role } from "@ai-werewolf-arena/game-contract";
import type { ActionRequest, ToolCall } from "../../../src/domain/actions";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import type { PhaseRevisionClock } from "../../../src/game/engine/phase-revision";

function fixture() {
  return bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard],
  });
}
function revision(manager: ReturnType<typeof fixture>["phaseManager"]): number {
  // 只观察原私有计时职责，不注入或修改经理状态；对外 snapshot 字段保持原格式。
  return (manager as unknown as { readonly phaseRevision: PhaseRevisionClock }).phaseRevision.current;
}

test("same-phase debug invalidates once without a phase event or closing death windows", () => {
  const { phaseManager, world } = fixture();
  let closes = 0;
  const original = world.closeDeathActions.bind(world);
  world.closeDeathActions = () => { closes++; original(); };
  expect(revision(phaseManager)).toBe(0);
  phaseManager.jumpTo(Phase.Night);
  expect(revision(phaseManager)).toBe(1);
  expect(closes).toBe(0);
  expect(phaseManager.getEvents().filter(e => e.type === "phase_changed").map(e => e.payload)).toEqual([{ phase: Phase.Night, day: 1 }]);
});

test("different-phase debug retains both invalidation and actual transition, before publication failure", () => {
  const { phaseManager, world } = fixture();
  const failure = new Error("original_death_window_close_failed");
  world.closeDeathActions = () => { throw failure; };
  expect(() => phaseManager.jumpTo(Phase.Day)).toThrow(failure);
  expect(revision(phaseManager)).toBe(2);
  expect(phaseManager.getSnapshot().phase).toBe(Phase.Day);
  expect(phaseManager.getSnapshot().day).toBe(1);
  expect(phaseManager.getEvents().filter(e => e.type === "phase_changed").map(e => e.payload)).toEqual([{ phase: Phase.Night, day: 1 }]);
});

test("a same-night debug jump revokes a real pending first action without advancing the day", async () => {
  const { phaseManager, world } = fixture();
  const entered = Promise.withResolvers<ActionRequest>();
  const released = Promise.withResolvers<ToolCall | null>();
  let asks = 0;
  const running = phaseManager.runSingleCycle({
    getAction(request) { asks++; entered.resolve(request); return released.promise; },
  });
  await entered.promise;
  phaseManager.jumpTo(Phase.Night);
  released.resolve(null);
  const final = await running;
  expect(asks).toBe(1);
  expect(final.phase).toBe(Phase.Night);
  expect(final.day).toBe(1);
  expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  expect(phaseManager.getEvents().filter(e => e.type === "phase_changed").map(e => e.payload)).toEqual([{ phase: Phase.Night, day: 1 }]);
});
