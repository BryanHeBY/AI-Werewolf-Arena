/**
 * Initial identity scenarios verify real PM/setup/night reentry rejects before changing phase or event prefixes.
 * Input: Original two fresh foundation worlds, controlled null actions and explicit setup/night openings.
 * Output and oracle: Exact completion/reentry codes and unchanged snapshots/event counts preserve causal assertions; original production gates remain the driver.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role } from "../../../../src/core";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import * as shared from "../../../../src/game/mechanisms/roles/initial_identity/deal";

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
