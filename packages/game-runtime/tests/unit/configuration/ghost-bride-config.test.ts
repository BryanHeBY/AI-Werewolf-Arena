/**
 * 单元测试读取不可变具名公开板子，以精确名单／bootstrap 和不支持组合断言核对 Ghost Bride 原生有限装配。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, WinCondition } from "../../../src/domain";
const read = async () =>
  JSON.parse(
    await readFile(
      new URL(
        "../../../../../configs.example/boards/awa_melbourne_ghost_bride_12_v1.json",
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
