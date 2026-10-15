/**
 * Integration tests for thief setup. Inputs are original N+2 deals, reserve card/lease mutations and strict
 * provider failure tapes. Original literal receipts, reference/getter/error traces, facts and expected
 * state remain the oracle. Actual fs reads public six/twelve board example files, then
 * parse/reverse/bootstrap initialization; no game cycle. Actual public filesystem or synthetic local
 * transport boundaries are exercised; private config/auth and paid model services are excluded.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/domain";
import { initialThiefDeal } from "../../../src/features/thief/deal";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";

test("public six/twelve Thief examples roundtrip N role parameters and execute actual N+2 initialization", async () => {
  for (const size of [6, 12]) {
    const raw = JSON.parse(
        await fs.readFile(
          path.resolve(process.cwd(), `../configs.example/boards/lui_meme_thief_${size}_v1.json`),
          "utf8",
        ),
      ),
      resolved = parseBoardDefinition(raw),
      g = bootstrapGame(resolved.config, { random: createRandom(`thief-example:${size}`) });
    expect(resolved.config.boardSize).toBe(size);
    expect(resolved.config.roleSetups.reduce((n, row) => n + row.count, 0)).toBe(size);
    expect(resolved.config.thief?.policy).toBe("lui_meme_thief_two_extra_villagers_v1");
    expect(g.playerIds).toHaveLength(size);
    expect(initialThiefDeal(g.world)).toHaveLength(size + 2);
  }
});
