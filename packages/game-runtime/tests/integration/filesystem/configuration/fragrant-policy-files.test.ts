/**
 * 配置文件集成测试：验证寻香公开政策、原生数量、往返与装配一致。输入为原公开板子 JSON 的真实读取、游戏／板子 loader 及字面政策修改；角色、阵营、数量和冲突断言保留，不把文件 I/O 标为纯单元输入。
 */
import path from "node:path";
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../../src/app/config/board-definition";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { parseRuntimeConfig } from "../../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../../src/app/config/resolve-game-setup";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { fragrantPairSeerTwelveConfig as config } from "../../../../src/rulesets/presets/fragrant-pair-seer-twelve";
import { isFragrantPairSeerPreset } from "../../../../src/rulesets";
import { Role, Camp } from "../../../../src/domain/identity";
import { COMPONENT } from "../../../../src/domain/components/names";
const root = path.resolve(import.meta.dir, "../../../../../.."),
  id = "awa_fragrant_pair_seer_12_v1";
const raw = JSON.parse(readFileSync(root + "/configs.example/boards/" + id + ".json", "utf8"));
test("public example load, roundtrip, game resolve and bootstrap agree", async () => {
  const resolved = await loadBoardDefinition(root + "/configs.example", id);
  expect(resolved.config).toEqual(config);
  expect(parseBoardDefinition(boardDefinitionFromConfig(id, config)).config).toEqual(config);
  const rt = parseRuntimeConfig({
    environment: {},
    backends: {
      schemaVersion: 2,
      items: {
        fake: {
          kind: "llm",
          config: {
            type: "openai",
            apiKey: "synthetic-only",
          },
        },
      },
    },
    agents: {
      schemaVersion: 2,
      default: "deepseek_v4_flash",
      items: {
        deepseek_v4_flash: {
          backend: "fake",
          options: {
            model: "fake",
          },
        },
      },
    },
    game: JSON.parse(
      readFileSync(root + "/configs.example/games/twelve_player_fragrant_pair_seer.json", "utf8"),
    ),
  });
  const setup = resolveGameSetup(rt, {}, resolved);
  expect(setup.boardConfig).toEqual(config);
  const g = bootstrapGame(setup.boardConfig);
  expect(g.playerIds).toHaveLength(12);
  // ID 来自完整 bootstrap 名单；非空类型说明不增加运行检查或修复缺失槽。
  for (const row of config.roleSetups)
    expect(
      g.playerIds.filter((i) => g.world.getComponent(i, COMPONENT.Role)!.role === row.role),
    ).toHaveLength(row.count);
  for (const i of g.playerIds) {
    const role = g.world.getComponent(i, COMPONENT.Role)!;
    expect(g.world.getComponent(i, COMPONENT.Camp)!.camp).toBe(
      [Role.Wolf, Role.FragrantPhantom].includes(role.role) ? Camp.Wolf : Camp.Good,
    );
    expect(Object.hasOwn(role, "camp")).toBe(false);
  }
});
test("alternate hunter policy rejected publicly and internally", () => {
  for (const deathActionPolicy of ["awa_knife_or_exile_v1", "awa_day_deaths_v1"]) {
    const r = structuredClone(raw);
    r.roles.hunter = { deathActionPolicy };
    expect(() => {
      parseBoardDefinition(r);
    }).toThrow();
    const c = { ...config, hunter: { deathActionPolicy } } as any;
    expect(isFragrantPairSeerPreset(c)).toBe(false);
    expect(() => {
      bootstrapGame(c);
    }).toThrow("fragrant_pair_seer_preset_invalid");
  }
});
test("both role policy contributions reject conflicts in either object order", () => {
  for (const bad of ["fragrant_phantom", "awakened_seer"])
    for (const reverse of [false, true]) {
      const r = structuredClone(raw);
      r.roles[bad].policy = "not_the_fixed_policy";
      if (reverse) r.roles = Object.fromEntries(Object.entries(r.roles).reverse());
      expect(() => {
        parseBoardDefinition(r);
      }).toThrow("board_config_invalid_field");
    }
  for (const omitted of ["fragrant_phantom", "awakened_seer"]) {
    const r = structuredClone(raw);
    delete r.roles[omitted];
    expect(parseBoardDefinition(r).config).toEqual(config);
  }
});
test("wrong native counts fail publicly and at bootstrap", () => {
  const r = structuredClone(raw);
  r.board.roleSetups.find((x: any) => x.role === "wolf").count = 2;
  r.board.roleSetups.find((x: any) => x.role === "villager").count = 5;
  expect(() => {
    parseBoardDefinition(r);
  }).toThrow("fragrant_pair_seer_preset_invalid");
  const c = { ...config, roleSetups: r.board.roleSetups };
  expect(() => {
    bootstrapGame(c);
  }).toThrow("fragrant_pair_seer_preset_invalid");
});
