/**
 * Owns Mist/Raven test board input loading and its fixed role/variant declarations.
 * Input is the tracked public configs.example Mist/Raven board JSON; output is the
 * original parsed board definition. The existing readFile/JSON/board parser path
 * stays intact. This builder writes no file, runs no game or model, and computes
 * no expected settlement outcome; handwritten expectations retain their oracle.
 */
import { Role } from "../../../../../src/core";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";

export const MIST_ROLES = [
  Role.Alchemist,
  Role.Seer,
  Role.Dreamer,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.RavenClawWolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
] as const;

export type MistRecordVariant =
  | "linked"
  | "saved-dreamer"
  | "protected-heal"
  | "draw"
  | "pure-saved-dreamer"
  | "consecutive-heal"
  | "ordinary-double"
  | "mixed-order"
  | "self-heal"
  | "blast-pre-election"
  | "blast-daybreak"
  | "blast-speech-gap"
  | "blast-pre-vote"
  | "blast-raw-target"
  | "blast-badge-chain"
  | "blast-last-wolf"
  | "blast-parallel"
  | "blast-parallel-raw-loser"
  | "blast-parallel-second-gap"
  | "last-villager-pass"
  | "last-villager-heal"
  | "last-god"
  | "last-god-illegal-self";

export async function mistBoard() {
  return parseBoardDefinition(
    JSON.parse(
      await readFile(
        new URL("../../../../../../configs.example/boards/awa_mist_raven_12_v1.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}
