import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, COMPONENT, type RoleComponent } from "../../../src/core";
import { foxBoard } from "../../support/cursed_fox_scenarios";
import * as shared from "../../../src/game/mechanisms/roles/initial_identity/deal";
import * as thief from "../../../src/game/mechanisms/roles/thief/deal";
import { wolfTeamPermissions } from "../../../src/game/mechanisms/roles/wolf_team";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms";
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
      g.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
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
test("shared night and PM gates reject actual recursive cycles before changing phase or events", async () => {
  const g = foundation();
  // The registered handler completes an absent actor without a choice.
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
