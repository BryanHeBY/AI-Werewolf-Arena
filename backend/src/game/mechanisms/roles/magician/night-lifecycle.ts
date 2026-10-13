/**
 * Owns the single Magician-configured cleanup transfer used by the three exchange families.
 * Inputs are the original late configured value and delegated World reads;
 * outputs are the shared readonly ownership query and Magician terminal calls.
 * Wolf Sorcerer and Trickster use this same transfer value, not separate flags.
 * Stage opening stays at priority 80; cleanup needs no acquired/closed guard.
 * Manager close and repeated abort retain current arguments and native errors.
 * This unit never remaps targets, spends numbers, refunds history or advances phases.
 */
import type { World } from "../../../../core/domain/world";
import { closeMagicianNight, abortMagicianNight } from "./night_frame";

export interface MagicianNightRuntime {
  readonly world: World;
}

export interface MagicianNightCleanupOwnership {
  readonly isTransferred: () => boolean;
}

export const magicianNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeMagicianNight(world, day);
  },
  abort(world: World): void {
    abortMagicianNight(world);
  },
});

export class MagicianNightUnit {
  /** Manager receives this same ownership instance; terminal functions keep fresh arguments. */
  readonly closeNormally = magicianNightTerminal.closeNormally;
  readonly abort = magicianNightTerminal.abort;

  private transferred = false;
  readonly cleanupOwnership: MagicianNightCleanupOwnership = Object.freeze({
    isTransferred: () => this.transferred,
  });

  constructor(private readonly runtime: MagicianNightRuntime) {}

  transferToManager(configured: boolean): void {
    this.transferred = configured;
  }

  abortIfOwned(): void {
    if (!this.transferred) abortMagicianNight(this.runtime.world);
  }
}
