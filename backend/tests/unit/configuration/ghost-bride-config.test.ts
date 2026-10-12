/**
 * Unit tests: Ghost Bride configuration reads the immutable named public board; exact
 * roster/bootstrap and unsupported-combination assertions check the native finite setup.
 * Inputs and expected outcomes remain the original literal or immutable-fixture oracle;
 * these module assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, WinCondition } from "../../../src/core";
const read = async () =>
  JSON.parse(
    await readFile(
      new URL(
        "../../../../configs.example/boards/awa_melbourne_ghost_bride_12_v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
test("public named Ghost Bride example actually parses and bootstraps the exact native roster", async () => {
  const board = parseBoardDefinition(await read()),
    game = bootstrapGame(board.config);
  expect(game.playerIds).toHaveLength(12);
  expect(board.config.winConditions).toEqual([WinCondition.ThreeFactionsElimination]);
  expect(board.config.roleSetups.find((r) => r.role === Role.GhostBride)).toEqual({
    role: Role.GhostBride,
    count: 1,
  });
});
const variants: Record<string, (b: any) => void> = {
  city: (b) => (b.rules.winConditions = ["slaughter_city"]),
  noSheriff: (b) => (b.mechanisms.sheriff.enabled = false),
  extraEvent: (b) => (b.mechanisms.eventPack = "awa_wall_notes_v1"),
  optionalSeer: (b) => (b.roles.seer.actionPolicy = "awa_optional_v1"),
  selfHeal: (b) => (b.roles.witch.selfHeal = "always"),
  repeatedGuard: (b) => (b.roles.guard.repeatPolicy = "awa_repeat_allowed_v1"),
  differentGun: (b) => (b.roles.hunter.deathActionPolicy = "awa_qualified_sources_v1"),
  roleVariant: (b) => (b.board.roleSetups.find((r: any) => r.role === "guard").role = "cupid"),
  fewerPlayers: (b) => {
    b.board.size = 11;
    b.board.roleSetups.find((r: any) => r.role === "villager").count = 3;
  },
  daybreak: (b) => (b.rules.hooks.onDaybreak = true),
  extraWindow: (b) => b.mechanisms.selfDestruct.enabledWindows.push("on_per_speech_gap"),
  unknownPolicy: (b) => (b.roles.ghost_bride.policy = "made_up_v2"),
  extraPolicyField: (b) => (b.roles.ghost_bride.selfDream = true),
};
for (const [name, change] of Object.entries(variants))
  test(`${name}: public parser rejects an unsupported Ghost Bride combination`, async () => {
    const board = await read();
    change(board);
    expect(() => parseBoardDefinition(board)).toThrow();
  });
