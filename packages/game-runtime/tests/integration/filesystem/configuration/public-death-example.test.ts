/**
 * 配置文件系统集成测试将同一个公开 JSON URL 与原固定板子 ID 送入严格解析器，核对该来源限定的公开死亡示例所声明条款及身份数量。精确机器政策、数量及胜利条件值为预期；只读原文件，不运行游戏或模型。
 */
import { expect, test } from "bun:test";
import { Role, WinCondition } from "../../../../src/domain";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";

const newWords = "netease_2017_day_and_first_night_v1" as const;

const open = "netease_2017_open_v1" as const;

test("source-scoped six-player example strictly resolves the documented clauses and role counts", async () => {
  const raw = JSON.parse(
    await Bun.file(
      new URL(
        "../../../../../configs.example/boards/netease_2017_open_clause_6_v1.json",
        import.meta.url,
      ),
    ).text(),
  );
  const result = parseBoardDefinition(raw, "netease_2017_open_clause_6_v1");
  expect(result.config.lastWords).toEqual({ policy: newWords });
  expect(result.config.disclosure).toEqual({ deathRevealPolicy: open });
  expect(result.config.roleSetups).toEqual([
    { role: Role.Wolf, count: 2 },
    { role: Role.Seer, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Villager, count: 2 },
  ]);
  expect(result.config.winConditions).toEqual([WinCondition.SlaughterCity]);
});
