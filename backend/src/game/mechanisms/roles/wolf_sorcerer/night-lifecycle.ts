/**
 * Owns Wolf Sorcerer's cleanup under the existing shared Magician transfer gate.
 * Inputs are its original delegated World and the same readonly ownership view;
 * outputs retain configured failure abort and manager normal/abort calls.
 * No independent handedOff/acquired flag is created. Priority-100 opening,
 * composed target receipts and paid number history stay in their native owners.
 * Manager argument reads never skip after normal close; frame authority alone
 * decides repeat-close errors. This unit never captures actors or resolves targets.
 */
import type { World } from "../../../../core/domain/world";
import type { MagicianNightCleanupOwnership } from "../magician/ports";
import { closeWolfSorcererNight, abortWolfSorcererNight } from "./night_frame";

export interface WolfSorcererNightRuntime {
  readonly world: World;
}

export const wolfSorcererNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeWolfSorcererNight(world, day);
  },
  abort(world: World): void {
    abortWolfSorcererNight(world);
  },
});

export class WolfSorcererNightUnit {
  /** Manager receives this same ownership instance; terminal functions keep fresh arguments. */
  readonly closeNormally = wolfSorcererNightTerminal.closeNormally;
  readonly abort = wolfSorcererNightTerminal.abort;

  constructor(
    private readonly runtime: WolfSorcererNightRuntime,
    private readonly ownership: MagicianNightCleanupOwnership,
  ) {}

  abortIfOwned(): void {
    if (!this.ownership.isTransferred()) abortWolfSorcererNight(this.runtime.world);
  }
}
