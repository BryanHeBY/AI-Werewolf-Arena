/**
 * 双生查验生命周期场景验证白天重入与中止夜晚保留原 provider 错误和已持有所有权。输入为原
 * 脚本角色动作、嵌套周期尝试与演员替换矩阵；精确错误身份、中止夜晚／知识状态、外层阶段／
 * 事件流不变是因果预期，不重新生成结果。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { fragrantRuntimeGame as game } from "../../../support/features/fragrant-pair-seer/builders/runtime-game";
import { fragrantRuntimeAction as act } from "../../../support/features/fragrant-pair-seer/drivers/actions";
import { fragrantAuthoritySnapshot } from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { type AliveComponent } from "../../../../src/core/domain/components/alive";

test("day cycle reentry rejects before mutating the outer phase or feed", async () => {
  const g = game();
  let checked = false;
  await g.phaseManager.runSingleCycle(
    {
      async getAction(r) {
        if (!checked && r.context.stage === "sheriff_nomination") {
          checked = true;
          const before = g.phaseManager.getSnapshot(),
            events = g.phaseManager.getEvents();
          await expect(
            g.phaseManager.runSingleCycle(
              {
                async getAction() {
                  throw Error("nested_provider_must_not_run");
                },
              },
              8,
            ),
          ).rejects.toThrow("fragrant_cycle_reentry");
          expect(g.phaseManager.getSnapshot()).toEqual(before);
          expect(g.phaseManager.getEvents()).toEqual(events);
        }
        return act(r, { bind: [5, 6] });
      },
    },
    8,
  );
  expect(checked).toBe(true);
  expect(g.phaseManager.getSnapshot().day).toBe(2);
});

for (const replace of [false, true])
  test(`aborted night retains original provider failure even after actor replacement=${replace}`, async () => {
    const g = game(),
      original = g.world.getComponent(1, COMPONENT.Alive)!,
      failure = Error("provider_unique_failure");
    let thrown: unknown;
    try {
      await g.phaseManager.runSingleCycle(
        {
          async getAction(r) {
            if (r.context.stage === "fragrant_bind") {
              if (replace) g.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
              throw failure;
            }
            return act(r);
          },
        },
        8,
      );
    } catch (error) {
      thrown = error;
    }
    // Restore solely to inspect the held failed owner, never to resume this game.
    if (replace) g.world.addComponent(1, COMPONENT.Alive, original);
    expect(thrown).toBe(failure);
    expect(fragrantAuthoritySnapshot(g.world).nights[0]!.status).toBe("aborted");
    expect(fragrantAuthoritySnapshot(g.world).fragrant.knowledgeNight).toBe(1);
  });
