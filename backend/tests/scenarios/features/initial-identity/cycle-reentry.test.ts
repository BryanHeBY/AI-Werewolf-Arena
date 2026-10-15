/**
 * 初始身份场景验证真实 PM／setup／夜间重入在改变阶段或事件前缀之前被拒绝。
 * 输入为原两个新基础 World、受控 null 行动及明确 setup／夜间开放。
 * 输出与预期为精确完成／重入错误码和不变快照／事件数；仍由原生产门禁驱动。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role } from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import * as shared from "../../../../src/features/initial-identity/deal";

const roles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager];

function foundation() {
  const g = bootstrapGame(foxBoard(roles), { fixedRoles: roles });
  shared.installInitialIdentityDeal(
    g.world,
    [...roles, Role.Villager, Role.Villager],
    g.world.entityIds(),
    "shapeshifter",
  );
  return g;
}

test("shared night and PM gates reject actual recursive cycles before changing phase or events", async () => {
  const g = foundation();
  // 注册的 handler 在没有对应行动者时直接完成，不产生选择。
  const h = foundation();
  await h.phaseManager.runSingleCycle({ getAction: async () => null });
  expect(shared.initialIdentitySetupStatus(h.world)).toBe("complete");
  shared.openInitialIdentitySetup(g.world);
  const before = g.phaseManager.getSnapshot(),
    n = g.phaseManager.getEvents().length;
  await expect(g.phaseManager.runSingleCycle({ getAction: async () => null })).rejects.toThrow(
    "shapeshifter_setup_reentry",
  );
  expect(g.phaseManager.getSnapshot()).toEqual(before);
  expect(g.phaseManager.getEvents()).toHaveLength(n);
  shared.closeInitialIdentitySetup(g.world, "complete");
  const close = shared.openInitialIdentityNight(g.world, 1);
  await expect(g.phaseManager.runSingleCycle({ getAction: async () => null })).rejects.toThrow(
    "shapeshifter_setup_reentry",
  );
  expect(g.phaseManager.getSnapshot()).toEqual(before);
  expect(g.phaseManager.getEvents()).toHaveLength(n);
  close();
  expect(() => shared.openInitialIdentityNight(g.world, 1)).toThrow(
    "shapeshifter_night_reentry_or_unready",
  );
});
