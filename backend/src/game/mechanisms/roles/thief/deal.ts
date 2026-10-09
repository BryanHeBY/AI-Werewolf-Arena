/** Legacy Thief boundary: shared storage is never exposed as another role's Thief deal. */
import { type World, type Role } from "../../../../core/domain";
import * as shared from "../initial_identity/deal";
export type ThiefCard = shared.InitialIdentityCard;
export type ThiefSlot = shared.InitialIdentitySlot;
export type ThiefSetupStatus = shared.InitialIdentitySetupStatus;
export type ThiefDeal = shared.InitialIdentityDeal;
export const readThiefCard = shared.readInitialIdentityCard;
const owns = (world: World) => shared.initialIdentityKind(world) === "thief";
export function installThiefDeal(
  world: World,
  roles: readonly Role[],
  playerIds: readonly number[],
): void {
  shared.installInitialIdentityDeal(world, roles, playerIds, "thief");
}
export const thiefDeal = (world: World): ThiefDeal | undefined =>
  owns(world) ? shared.initialIdentityStock(world) : undefined;
export const initialThiefDeal = (world: World): readonly Role[] | undefined =>
  owns(world) ? shared.initialIdentityDeal(world) : undefined;
export const thiefCandidateCounts = (world: World): ReadonlyMap<Role, number> | undefined =>
  owns(world) ? shared.initialIdentityCandidateCounts(world) : undefined;
export const thiefSetupStatus = (world: World): ThiefSetupStatus | undefined =>
  owns(world) ? shared.initialIdentitySetupStatus(world) : undefined;
export const hasActiveThiefSetup = (world: World): boolean =>
  owns(world) && shared.hasActiveInitialIdentitySetup(world);
export const thiefSetupReady = (world: World): boolean =>
  !owns(world) || shared.initialIdentitySetupReady(world);
export const pendingThiefDealValid = (world: World): boolean =>
  owns(world) && shared.pendingInitialIdentityDealValid(world);
export function openThiefSetup(world: World): ThiefDeal {
  if (!owns(world)) throw new Error("thief_setup_unavailable");
  return shared.openInitialIdentitySetup(world);
}
export function closeThiefSetup(world: World, status: Exclude<ThiefSetupStatus, "pending">): void {
  if (owns(world)) shared.closeInitialIdentitySetup(world, status);
}
export function selectThiefCard(world: World, actorId: number, slot: ThiefSlot | null): Role {
  if (!owns(world)) throw new Error("thief_selection_unavailable");
  return shared.selectInitialIdentityCard(world, actorId, slot);
}
export function projectThiefSetup(world: World) {
  if (!owns(world)) return;
  const data = shared.projectInitialIdentitySetup(world);
  return data ? { ...data, policy: shared.INITIAL_IDENTITY_POLICIES.thief } : undefined;
}
export const hasActiveThiefNight = (world: World): boolean =>
  owns(world) && shared.hasActiveInitialIdentityNight(world);
export const hasThiefNightCommit = (world: World, day: number): boolean =>
  owns(world) && shared.hasInitialIdentityNightCommit(world, day);
export function openThiefNight(world: World, day: number): () => void {
  return owns(world) ? shared.openInitialIdentityNight(world, day) : () => {};
}
