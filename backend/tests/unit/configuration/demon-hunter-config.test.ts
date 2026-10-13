/**
 * 单元测试验证猎魔人在公开 example 的不同人数和胜负条件下的配置。字面 roster、提示、反向配置与无效变体是预期，保留原样本，不调用模型或完整对局 driver。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/runtime/config/board_definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, WinCondition } from "../../../src/core";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/role-catalog-assembly";
import { demonHunterDeck } from "../../support/features/demon-hunter/builders/candidate-world";
const read = async (size: number, goal: string) =>
  JSON.parse(
    await readFile(
      new URL(
        `../../../../configs.example/boards/awa_netease_demon_hunter_${size}_${goal}_v1.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
for (const size of [6, 12] as const)
  for (const goal of ["city", "side"] as const)
    test(`public Demon ${size}/${goal}: finite native roster, named configuration and prompt roundtrip`, async () => {
      const b = parseBoardDefinition(await read(size, goal)),
        game = bootstrapGame(b.config, { fixedRoles: demonHunterDeck(size) });
      expect(game.playerIds).toHaveLength(size);
      expect(b.config.winConditions).toEqual([
        goal === "city" ? WinCondition.SlaughterCity : WinCondition.SlaughterSide,
      ]);
      expect(b.config.roleSetups.find((r) => r.role === Role.DemonHunter)?.count).toBe(1);
      expect(getDefaultRoleCatalog().requireMetadata(Role.DemonHunter).goodSide).toBe("god");
      const written = boardDefinitionFromConfig(b.definition.id, b.config);
      expect(parseBoardDefinition(written).config).toEqual(b.config);
    });
const variants: Record<string, (b: any) => void> = {
  optionalSeer: (b) => (b.roles.seer.actionPolicy = "awa_optional_v1"),
  selfHeal: (b) => (b.roles.witch.selfHeal = "always"),
  repeatGuard: (b) => (b.roles.guard.repeatPolicy = "awa_repeat_allowed_v1"),
  extraGod: (b) => (b.board.roleSetups.find((r: any) => r.role === "guard").role = "idiot"),
  duplicateDemon: (b) => {
    b.board.roleSetups.find((r: any) => r.role === "demon_hunter").count = 2;
    b.board.size = 13;
  },
  noSheriff: (b) => (b.mechanisms.sheriff.enabled = false),
  bothVictory: (b) => (b.rules.winConditions = ["slaughter_city", "slaughter_side"]),
  knifeOnlyGun: (b) => (b.roles.hunter.deathActionPolicy = "awa_knife_only_v1"),
  newPolicy: (b) => (b.roles.demon_hunter.policy = "invented_v2"),
  arbitraryImmunity: (b) => (b.roles.demon_hunter.allDamageImmune = true),
  faultInBoard: (b) => (b.faultPlan = { version: "awa_fault_plan_v1", steps: [] }),
};
for (const [name, patch] of Object.entries(variants))
  test(`${name}: public Demon unsupported variants fail closed`, async () => {
    const b = await read(12, "city");
    patch(b);
    expect(() => parseBoardDefinition(b)).toThrow();
  });
