/**
 * 故障场景测试：验证寻香 checkpoint 库存遭修改后仍与上帝事实一致。输入为原对局、配对／狼影伪造或恶意 getter 及阶段故障；实际失败后的规范库存、getter 次数及错误身份为字面预期，不重新生成归档。
 */
import { test, expect } from "bun:test";
import { fragrantRuntimeGame as game } from "../../../support/features/fragrant-pair-seer/builders/runtime-game";
import { fragrantRuntimeAction as act } from "../../../support/features/fragrant-pair-seer/drivers/actions";
import { captureCheckpoint } from "../../../../src/app/simulation/reproduction-context";
import { COMPONENT } from "../../../../src/domain/components/names";
for (const alteration of ["pair_forgery", "pair_getter", "phantom_forgery"] as const)
  test(`failure CP canonical God state and original player stock agree after ${alteration}`, async () => {
    const g = game(),
      error = Error(`unique_CP_${alteration}`);
    let caught: unknown,
      gets = 0;
    try {
      await g.phaseManager.runSingleCycle(
        {
          async getAction(r) {
            if (r.context.stage === "pair_inspection") {
              const role = g.world.getComponent(
                alteration === "phantom_forgery" ? 1 : 9,
                COMPONENT.Role,
              )!;
              // 只给原容器伪造读写加类型说明；仍逐次读取同一字段，不缓存或重新构造库存。
              if (alteration === "phantom_forgery")
                (role.privateState as { fragrant: { knownWolfId: number } }).fragrant.knownWolfId =
                  2;
              else if (alteration === "pair_forgery")
                (role.privateState as { pairSeer: { history: unknown[] } }).pairSeer.history = [
                  { day: 1, targetIds: [1, 9], containsWerewolf: false },
                ];
              else
                Object.defineProperty(
                  (role.privateState as { pairSeer: { history: unknown[] } }).pairSeer,
                  "history",
                  {
                    enumerable: true,
                    configurable: true,
                    get() {
                      gets++;
                      return [{ day: 1, targetIds: [1, 9], containsWerewolf: false }];
                    },
                  },
                );
              throw error;
            }
            return act(r, { bind: [5, 6] });
          },
        },
        8,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBe(error);
    const cp = captureCheckpoint(
      g.world,
      g.phaseManager.getSnapshot(),
      1,
      false,
      g.phaseManager.getEvents().length,
      error,
    );
    expect(gets).toBe(0);
    const phantom = cp.players.find((p) => p.id === 1)!,
      seer = cp.players.find((p) => p.id === 9)!;
    expect(phantom.privateState.fragrant).toEqual(cp.fragrantPair!.fragrant);
    expect(seer.privateState.pairSeer).toEqual(cp.fragrantPair!.pairSeer);
    expect((seer.privateState.abilities as any)["native:pair_check"].state).toEqual(
      cp.fragrantPair!.pairSeer,
    );
  });
