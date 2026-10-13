/**
 * Integration tests for lonely girl setup. Inputs are original required choices, getter/revocation matrices
 * and public board configuration. Original literal receipts, reference/getter/error traces, facts and
 * expected state remain the oracle. Actual Bun.file loads two public example board JSON files and
 * parses/bootstrap-initializes each exact N-card configuration. Actual public filesystem or synthetic local
 * transport boundaries are exercised; private config/auth and paid model services are excluded.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { LONELY_GIRL_POLICY } from "../../../src/game/mechanisms/roles/lonely_girl/state";
import { projectLonelyGirlSetup } from "../../../src/game/mechanisms/roles/lonely_girl/lifecycle";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";

for (const size of [6, 12])
  test(`public ${size}-seat sample parses and initializes the exact normal-N setup`, async () => {
    const json = await Bun.file(
      new URL(
        `../../../../configs.example/boards/awa_netease_lonely_girl_${size}_v1.json`,
        import.meta.url,
      ),
    ).json();
    const { config } = parseBoardDefinition(json);
    expect(config.lonelyGirl?.policy).toBe(LONELY_GIRL_POLICY);
    const g = bootstrapGame(config);
    expect(g.world.entityIds()).toHaveLength(size);
    expect(projectLonelyGirlSetup(g.world)?.status).toBe("pending");
  });
