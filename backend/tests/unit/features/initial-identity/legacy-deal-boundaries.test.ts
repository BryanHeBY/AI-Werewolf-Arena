/**
 * 单元测试：验证初始身份权威仅安装一次，旧盗贼门面不能披露或关闭其他机制。输入为原固定角色、有限 World 装配及重复／伪造发牌操作；库存对象身份、准备错误与准备前狼队许可为原字面预期，不执行完整阶段或模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, COMPONENT, type RoleComponent } from "../../../../src/core";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import * as shared from "../../../../src/game/mechanisms/roles/initial_identity/deal";
import * as thief from "../../../../src/game/mechanisms/roles/thief/deal";
import { wolfTeamPermissions } from "../../../../src/game/mechanisms/roles/wolf_team";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms";

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

test("shared ownership is finite; a second install or an invented kind cannot replace an existing authority", () => {
  const g = foundation(),
    before = shared.initialIdentityStock(g.world);
  expect(() =>
    shared.installInitialIdentityDeal(
      g.world,
      [...roles, Role.Villager, Role.Villager],
      g.world.entityIds(),
      "thief",
    ),
  ).toThrow("thief_initial_deal_invalid");
  expect(shared.initialIdentityStock(g.world)).toBe(before);
  const h = bootstrapGame(foxBoard(roles), { fixedRoles: roles });
  expect(() =>
    shared.installInitialIdentityDeal(
      h.world,
      [...roles, Role.Villager, Role.Villager],
      h.world.entityIds(),
      "invented" as never,
    ),
  ).toThrow("initial_identity_kind_invalid");
  expect(shared.initialIdentityKind(h.world)).toBeUndefined();
});

test("legacy Thief boundary never exposes or closes a different initial mechanism; shared gate blocks pre-setup wolf knowledge", () => {
  const g = foundation();
  expect(thief.thiefDeal(g.world)).toBeUndefined();
  expect(thief.initialThiefDeal(g.world)).toBeUndefined();
  expect(thief.projectThiefSetup(g.world)).toBeUndefined();
  expect(thief.thiefCandidateCounts(g.world)).toBeUndefined();
  expect(thief.thiefSetupStatus(g.world)).toBeUndefined();
  expect(thief.thiefSetupReady(g.world)).toBe(true);
  expect(shared.initialIdentitySetupReady(g.world)).toBe(false);
  expect(
    wolfTeamPermissions(
      g.world.getComponent(1, COMPONENT.Role)!,
      getDefaultRoleCatalog(),
      g.world,
    ),
  ).toMatchObject({ canChat: false, canVoteForKill: false, recognizes: "none" });
  expect(() => thief.openThiefSetup(g.world)).toThrow("thief_setup_unavailable");
  expect(() => thief.selectThiefCard(g.world, 1, 0)).toThrow("thief_selection_unavailable");
  thief.closeThiefSetup(g.world, "complete");
  thief.openThiefNight(g.world, 1)();
  expect(shared.initialIdentitySetupStatus(g.world)).toBe("pending");
  expect(shared.hasInitialIdentityNightCommit(g.world, 1)).toBe(false);
});
