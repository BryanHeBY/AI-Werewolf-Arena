/**
 * Integration tests for wild child model. Inputs are original model choices, life replacements and real
 * initial/additional death causes. Original literal receipts, reference/getter/error traces, facts and
 * expected state remain the oracle. Actual synchronous public JSON read with table-selected six/twelve URL
 * followed by finite parse/bootstrap, no phase execution. Actual public filesystem or synthetic local
 * transport boundaries are exercised; private config/auth and paid model services are excluded.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, COMPONENT, type RoleComponent } from "../../../src/core";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";

for (const size of [6, 12])
  test(`public ${size}-player finite Wild Child example initializes exactly N cards`, () => {
    const board = parseBoardDefinition(
      JSON.parse(
        readFileSync(
          new URL(
            `../../../../configs.example/boards/awa_lui_meme_wild_child_${size}_v1.json`,
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    expect(board.config.wildChild).toEqual({ policy: "awa_lui_meme_wild_child_v1" });
    const g = bootstrapGame(board.config);
    expect(g.world.entityIds()).toHaveLength(size);
    expect(
      g.world
        .entityIds()
        .filter(
          (id) => g.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.WildChild,
        ),
    ).toHaveLength(1);
  });
