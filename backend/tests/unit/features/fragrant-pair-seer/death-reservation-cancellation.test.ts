/**
 * 单元测试：验证未提交寻香死亡预约在 false／抛错取消后释放，不花资源或标死。输入为原 owner fixture、有限 DeathResolution 操作与两种当前性模式；存活生命、空触发和可复用预约回执为原字面预期，不执行 PM 周期、录制或模型。
 */
import { expect, test } from "bun:test";
import { fragrantPairOwnerFixture } from "../../../engine/fragrant_pair_seer_fixture";
import {
  closeFragrantNight,
  prepareFragrantDeathWave,
  cancelFragrantDeathWave,
  fragrantAuthoritySnapshot,
} from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { Phase } from "../../../../src/core/domain/identity";
import { DeathCause } from "../../../../src/core/domain/deaths";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { type AliveComponent } from "../../../../src/core/domain/components/alive";
import type { RuntimeSnapshot } from "../../../../src/core/domain/model";

for (const mode of ["false", "throw"] as const)
  test(`uncommitted initial death reservation releases on ${mode} cancellation without spending`, async () => {
    const f = fragrantPairOwnerFixture();
    f.open();
    f.choices([9, 10]);
    closeFragrantNight(f.world, 1, "normal");
    const state: RuntimeSnapshot = { day: 1, phase: Phase.Day, gameOver: false, result: null },
      resolver = new DeathResolution(
        f.world,
        f.events,
        new ToolGateway(),
        new EventRegistry(),
        state,
      );
    let checks = 0,
      error: unknown;
    try {
      await resolver.resolve(
        [9],
        { 9: [DeathCause.WolfKill] },
        {
          async getAction() {
            throw Error("no_request_expected");
          },
        },
        Phase.Night,
        Phase.Day,
        {},
        {
          isCurrent: () => {
            if (++checks < 2) return true;
            if (mode === "throw") throw Error("cancel_at_wave");
            return false;
          },
        },
      );
    } catch (value) {
      error = value;
    }
    if (mode === "throw") expect(String(error)).toContain("cancel_at_wave");
    else expect(error).toBeUndefined();
    expect(f.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(true);
    expect(f.world.getComponent(10, COMPONENT.Alive)!.alive).toBe(true);
    expect(fragrantAuthoritySnapshot(f.world).fragrant.trigger).toBeNull();
    const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
    expect(receipt).not.toBeNull();
    cancelFragrantDeathWave(f.world, receipt);
  });
