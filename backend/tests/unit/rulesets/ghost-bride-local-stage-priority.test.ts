/**
 * Unit test checks local Ghost Bride stage priority and win-condition contributions. Inputs are literal role sets with and without Bride; fixed priorities, unchanged ordinary descriptors and explicit goal registration are the oracle. No setup window, phase, death chain, file or model executes.
 */
import { expect, test } from "bun:test";
import { Role } from "../../../src/core";
import { ghostBrideBoard } from "../../support/features/ghost-bride/builders/scenario";
import { getDefaultWinConditionRegistry, NightStageRegistry } from "../../../src/game/mechanisms";

test("stage registry uses local Guard/chat priority without mutating ordinary stage descriptors", () => {
  const config = ghostBrideBoard(),
    registry = new NightStageRegistry();
  const before = registry
    .getStages({
      ...config,
      roleSetups: config.roleSetups.filter((r) => r.role !== Role.GhostBride),
    })
    .find((s) => s.id === "wolf_discussion")!.priority;
  expect(registry.getStages(config).find((s) => s.id === "wolf_discussion")!.priority).toBe(350);
  expect(
    registry
      .getStages({
        ...config,
        roleSetups: config.roleSetups.filter((r) => r.role !== Role.GhostBride),
      })
      .find((s) => s.id === "wolf_discussion")!.priority,
  ).toBe(before);
  expect(
    getDefaultWinConditionRegistry()
      .all()
      .some((s) => s.id === "three_factions_elimination"),
  ).toBe(true);
});
