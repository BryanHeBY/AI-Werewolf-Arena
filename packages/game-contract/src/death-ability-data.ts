/**
 * Defines passive death-gun data and its finite live read view.
 * Inputs are original grant/transfer data; outputs preserve gun metadata,
 * single-use stock and deeply readonly gift/transfer source fields.
 * These structures never store live World/life ownership, arm a resource,
 * validate a permission or consume stock. Runtime owners retain the same refs.
 */
import type { AbilitySource } from "./night-ability-data";

export interface DeathGun {
  id: string;
  kind: "gun";
  source: Extract<AbilitySource, { kind: "gift" | "transfer" }>;
  sourceDisclosed: false;
  grantedNight: number;
  armedOnNight: number | null;
  remaining: 0 | 1;
  disabled: boolean;
  deathExpired: boolean;
}

export type DeathGunReadView = Readonly<Omit<DeathGun, "source">> & {
  readonly source: Readonly<DeathGun["source"]>;
};
