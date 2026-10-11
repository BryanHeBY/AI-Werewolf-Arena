import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isScholarMentorPreset } from "@ai-werewolf-arena/game-text";
import { bootstrapGame } from "../../src/app/bootstrap";
import { scholarMentorTwelveConfig } from "../../src/runtime/scenarios/scholar_mentor_twelve";
import { Role, type BoardConfig } from "../../src/core";
const publicDefinition = JSON.parse(
  readFileSync(
    new URL("../../../configs.example/boards/awa_scholar_mentor_12_v1.json", import.meta.url),
    "utf8",
  ),
);
const publicConfig = parseBoardDefinition(publicDefinition, "awa_scholar_mentor_12_v1").config;
test("Scholar Mentor public finite preset boots", () => {
  expect(isScholarMentorPreset(publicConfig)).toBe(true);
  expect(() => bootstrapGame(publicConfig)).not.toThrow();
  expect(boardDefinitionFromConfig("awa_scholar_mentor_12_v1", publicConfig)).toEqual(
    publicDefinition,
  );
  expect(boardDefinitionFromConfig("awa_scholar_mentor_12_v1", scholarMentorTwelveConfig)).toEqual(
    publicDefinition,
  );
});
const invalid: Array<[string, (c: BoardConfig) => void]> = [
  [
    "policy missing",
    (c) => {
      delete c.scholarMentor;
    },
  ],
  [
    "scholar absent",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.DayScholar)!.role = Role.Villager;
    },
  ],
  [
    "mentor absent",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.NightMentor)!.role = Role.Wolf;
    },
  ],
  [
    "extra scholar",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.DayScholar)!.count = 2;
      c.roleSetups.find((r) => r.role === Role.Villager)!.count = 3;
    },
  ],
  [
    "extra mentor",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.NightMentor)!.count = 2;
      c.roleSetups.find((r) => r.role === Role.Wolf)!.count = 2;
    },
  ],
  [
    "foreign role",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.Guard)!.role = Role.Hunter;
    },
  ],
  [
    "wrong size",
    (c) => {
      c.boardSize = 13;
    },
  ],
  [
    "sheriff disabled",
    (c) => {
      c.enableSheriff = false;
    },
  ],
  [
    "empty win",
    (c) => {
      c.winConditions = [];
    },
  ],
  [
    "guard policy missing",
    (c) => {
      delete c.guard;
    },
  ],
  [
    "witch policy missing",
    (c) => {
      delete c.witch;
    },
  ],
  [
    "seer policy missing",
    (c) => {
      delete c.seer;
    },
  ],
  [
    "disclosure missing",
    (c) => {
      delete c.disclosure;
    },
  ],
  [
    "last words missing",
    (c) => {
      delete c.lastWords;
    },
  ],
];
for (const [name, mutate] of invalid)
  test("Scholar Mentor public preset rejects " + name, () => {
    const c = structuredClone(publicConfig);
    mutate(c);
    expect(isScholarMentorPreset(c)).toBe(false);
    expect(() => bootstrapGame(c)).toThrow();
  });
