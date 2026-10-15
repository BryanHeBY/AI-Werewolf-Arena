/**
 * Configuration filesystem integration test verifies the original source-scoped public death example resolves documented clauses and role counts.
 * Input: The same public JSON URL and original fixed board ID through the strict parser.
 * Output and oracle: Exact machine policy/count/win-condition values retain original assertions; source bytes are read unchanged without any game or model.
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
