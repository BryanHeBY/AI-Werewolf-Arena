/**
 * 单元测试以不可变公开示例和显式额外身份变体为输入，用字面 parser／bootstrap 拒绝核对 Black Market 支持的联合名单。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, type BoardConfig } from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
for (const id of ["six_player_black_market_merchant", "twelve_player_black_market_merchant"])
  test(`${id}: public AWA board composes exactly one strict Black and the declared roles`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../configs.example"),
      id,
    );
    bootstrapGame(board.config);
    expect(board.config.roleSetups.find((s) => s.role === Role.BlackMarketMerchant)).toEqual({
      role: Role.BlackMarketMerchant,
      count: 1,
    });
    expect(board.definition.roles.black_market_merchant).toEqual({});
    expect(board.config.roleSetups.reduce((n, s) => n + s.count, 0)).toBe(
      id.startsWith("six") ? 6 : 12,
    );
    if (id.startsWith("twelve"))
      expect(board.config.roleSetups).toEqual([
        { role: Role.Wolf, count: 3 },
        { role: Role.WolfKing, count: 1 },
        { role: Role.Seer, count: 1 },
        { role: Role.Witch, count: 1 },
        { role: Role.BlackMarketMerchant, count: 1 },
        { role: Role.Dreamer, count: 1 },
        { role: Role.Villager, count: 4 },
      ]);
    for (const params of [
      { immediate: true },
      { skill: "guard" },
      { donorVisible: true },
      { refill: true },
    ]) {
      const raw = structuredClone(board.definition);
      raw.roles.black_market_merchant = params;
      expect(() => parseBoardDefinition(raw)).toThrow("board_config_invalid_field");
    }
  });
for (const extra of [
  Role.AwakenedHiddenWolf,
  Role.MechanicalWolf,
  Role.MiracleMerchant,
  Role.Hybrid,
  Role.Gargoyle,
  Role.Psychic,
  Role.MirrorGirl,
  Role.WolfBeauty,
  Role.WhiteWolfKing,
  Role.Idiot,
  Role.Knight,
  Role.Bear,
])
  test(`${extra}: normal parsing and direct bootstrap reject undeclared Black combinations`, () => {
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.BlackMarketMerchant, count: 1 },
        { role: Role.Wolf, count: 1 },
        { role: extra, count: 1 },
        { role: Role.Villager, count: 3 },
      ],
    };
    expect(() => bootstrapGame(config)).toThrow("role_combination_not_supported");
    expect(() => parseBoardDefinition(boardDefinitionFromConfig("black_bad", config))).toThrow(
      "board_config_role_combination_not_supported",
    );
  });
test("duplicate Black is rejected through configuration and direct bootstrap", () => {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [
      { role: Role.BlackMarketMerchant, count: 2 },
      { role: Role.Wolf, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
  };
  expect(() => bootstrapGame(config)).toThrow("role_count_exceeds_limit");
  expect(() => parseBoardDefinition(boardDefinitionFromConfig("black_dup", config))).toThrow();
});
