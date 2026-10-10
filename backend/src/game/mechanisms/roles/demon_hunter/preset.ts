import type { BoardConfig } from "../../../../core";
import { isDemonHunterPreset as readPreset } from "@ai-werewolf-arena/game-text";
import { DEMON_HUNTER_POLICY, demonSnapshot } from "./state";
export type DemonHunterBoard = BoardConfig & {
  demonHunter: { policy: typeof DEMON_HUNTER_POLICY };
};
export function isDemonHunterPreset(input: unknown): boolean {
  try {
    return readPreset(demonSnapshot(input));
  } catch {
    return false;
  }
}
export function assertDemonHunterPreset(input: BoardConfig): asserts input is DemonHunterBoard {
  if (!isDemonHunterPreset(input)) throw new Error("demon_hunter_preset_invalid");
}
