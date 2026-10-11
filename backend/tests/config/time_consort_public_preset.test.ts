import { isTimeConsortPreset } from "@ai-werewolf-arena/game-text";
import { bootstrapGame } from "../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../src/runtime/config/board_definition";
import { timeConsortTwelveConfig } from "../../src/runtime/scenarios/time_consort_twelve";
test("Public Time-Wolf Consort preset matches the validated twelve-player scenario", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../../configs.example/boards/awa_time_consort_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  expect(parseBoardDefinition(raw)).toEqual(
    parseBoardDefinition(
      boardDefinitionFromConfig("awa_time_consort_12_v1", timeConsortTwelveConfig),
    ),
  );
});

for (const [label, mutate] of [
  [
    "magician",
    (c) => {
      c.roleSetups[0]!.role = "magician" as (typeof c.roleSetups)[number]["role"];
    },
  ],
  [
    "trickster",
    (c) => {
      c.roleSetups[0]!.role = "trickster" as (typeof c.roleSetups)[number]["role"];
    },
  ],
  [
    "wolf sorcerer",
    (c) => {
      c.roleSetups[0]!.role = "wolf_sorcerer" as (typeof c.roleSetups)[number]["role"];
    },
  ],
  [
    "role count",
    (c) => {
      c.roleSetups[0]!.count++;
    },
  ],
  [
    "duplicate role",
    (c) => {
      c.roleSetups.push(structuredClone(c.roleSetups[0]!));
    },
  ],
  [
    "board size",
    (c) => {
      c.boardSize = 13;
    },
  ],
  [
    "extra mechanism",
    (c) => {
      Object.assign(c, { magician: { firstNight: 1 } });
    },
  ],
  [
    "unknown reflection scope",
    (c) => {
      Object.assign(c.timeConsort!, { reflectionScope: "recursive" });
    },
  ],
  [
    "unknown policy",
    (c) => {
      Object.assign(c.timeConsort!, { policy: "foreign" });
    },
  ],
  [
    "extra policy field",
    (c) => {
      Object.assign(c.timeConsort!, { extra: true });
    },
  ],
  [
    "guard policy",
    (c) => {
      Object.assign(c.guard!, { repeatPolicy: "foreign" });
    },
  ],
  [
    "seer policy",
    (c) => {
      Object.assign(c.seer!, { targetPolicy: "foreign" });
    },
  ],
  [
    "witch policy",
    (c) => {
      Object.assign(c.witch!, { canSelfHeal: "always" });
    },
  ],
  [
    "Prince policy",
    (c) => {
      Object.assign(c.orderPrince!, { policy: "foreign" });
    },
  ],
  [
    "sheriff disabled",
    (c) => {
      c.enableSheriff = false;
    },
  ],
] satisfies Array<[string, (c: typeof timeConsortTwelveConfig) => void]>) {
  test("Time Consort finite preset rejects " + label, () => {
    const config = structuredClone(timeConsortTwelveConfig);
    mutate(config);
    expect(isTimeConsortPreset(config)).toBe(false);
    expect(() => bootstrapGame(config, { locale: "en" })).toThrow();
  });
}
