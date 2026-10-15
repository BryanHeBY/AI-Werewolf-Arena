/**
 * 故障场景测试：验证寻香死亡波在必需发布失败后保留已付死亡。输入为原初始／枪波次动作与抛出原错误的必需 recorder；死亡、关系触发及单次提交为字面预期，保留未发布前缀，不把录制失败视为未付款波次。
 */
import { expect, test } from "bun:test";
import { fragrantRuntimeGame as game } from "../../../support/features/fragrant-pair-seer/builders/runtime-game";
import { fragrantRuntimeAction as act } from "../../../support/features/fragrant-pair-seer/drivers/actions";
import { type FragrantRuntimePlan } from "../../../support/features/fragrant-pair-seer/contracts";
import {
  fragrantAuthoritySnapshot,
  prepareFragrantDeathWave,
} from "../../../../src/features/fragrant-pair-seer/authority";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import type { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { COMPONENT } from "../../../../src/domain/components/names";
import type { AliveComponent } from "../../../../src/domain/components/alive";
for (const path of ["initial", "gun"] as const)
  test(`${path} wave record failure preserves the paid real deaths and original error`, async () => {
    const g = game(),
      failure = Error(`unique_required_${path}_record_error`);
    let injections = 0,
      caught: unknown;
    const recorder: Pick<SessionRecordManager, "recordLogicOp" | "recordRequiredLogicOp"> = {
        recordLogicOp() {},
        recordRequiredLogicOp(op) {
          if (op.op === "fragrant_link_triggered") {
            injections++;
            throw failure;
          }
        },
      },
      plan: FragrantRuntimePlan =
        path === "initial"
          ? { bind: [5, 6], knife: 5 }
          : { bind: [5, 6], knife: 11, poison: 1, shoot: 5 };
    try {
      await runWithSessionRecorder(recorder as SessionRecordManager, () =>
        g.phaseManager.runSingleCycle(
          {
            async getAction(r) {
              return act(r, plan);
            },
          },
          8,
        ),
      );
    } catch (error) {
      caught = error;
    }
    expect(injections).toBe(1);
    expect(caught).toBe(failure);
    expect(
      g.world
        .entityIds()
        .filter((id) => !g.world.getComponent(id, COMPONENT.Alive)!.alive),
    ).toEqual(path === "initial" ? [5, 6] : [1, 5, 6, 11]);
    const owned = fragrantAuthoritySnapshot(g.world);
    expect(owned.fragrant.trigger).toEqual({
      bindingId: "fragrant:night:1",
      day: 1,
      rootId: 5,
      addedTargetId: 6,
    });
    expect(owned.fragrant.bindings[0]!.status).toEqual({ kind: "triggered", day: 1 });
    expect(prepareFragrantDeathWave(g.world, 1, [])).toBeNull();
    const events = g.phaseManager.getEvents(),
      facts = events.filter((e) => e.type === "fragrant_link_triggered");
    expect(facts).toHaveLength(1);
    expect(facts[0]!.audience).toEqual([]);
    expect(events.filter((e) => e.type === "additional_deaths")).toHaveLength(0);
    expect(events.filter((e) => e.type === "game_over")).toHaveLength(0);
  });
