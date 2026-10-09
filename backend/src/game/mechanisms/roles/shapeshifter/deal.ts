/** Own-role boundary over the common physical stock. */
import { type World, type Role } from "../../../../core/domain";
import * as shared from "../initial_identity/deal";
export type ShapeshifterCard = shared.InitialIdentityCard;
export type ShapeshifterSlot = shared.InitialIdentitySlot;
export type ShapeshifterSetupStatus = shared.InitialIdentitySetupStatus;
export type ShapeshifterDeal = shared.InitialIdentityDeal;
export const readShapeshifterCard = shared.readInitialIdentityCard;
const owns = (world: World) => shared.initialIdentityKind(world) === "shapeshifter";
export function installShapeshifterDeal(
  world: World,
  roles: readonly Role[],
  playerIds: readonly number[],
): void {
  shared.installInitialIdentityDeal(world, roles, playerIds, "shapeshifter");
}
export const shapeshifterDeal = (world: World): ShapeshifterDeal | undefined =>
  owns(world) ? shared.initialIdentityStock(world) : undefined;
export const initialShapeshifterDeal = (world: World): readonly Role[] | undefined =>
  owns(world) ? shared.initialIdentityDeal(world) : undefined;
export const shapeshifterCandidateCounts = (world: World): ReadonlyMap<Role, number> | undefined =>
  owns(world) ? shared.initialIdentityCandidateCounts(world) : undefined;
export const shapeshifterSetupStatus = (world: World): ShapeshifterSetupStatus | undefined =>
  owns(world) ? shared.initialIdentitySetupStatus(world) : undefined;
export const hasActiveShapeshifterSetup = (world: World): boolean =>
  owns(world) && shared.hasActiveInitialIdentitySetup(world);
export const shapeshifterSetupReady = (world: World): boolean =>
  !owns(world) || shared.initialIdentitySetupReady(world);
export const pendingShapeshifterDealValid = (world: World): boolean =>
  owns(world) && shared.pendingInitialIdentityDealValid(world);
export function openShapeshifterSetup(world: World): ShapeshifterDeal {
  if (!owns(world)) throw new Error("shapeshifter_setup_unavailable");
  return shared.openInitialIdentitySetup(world);
}
export function closeShapeshifterSetup(
  world: World,
  status: Exclude<ShapeshifterSetupStatus, "pending">,
): void {
  if (owns(world)) shared.closeInitialIdentitySetup(world, status);
}
export function selectShapeshifterCard(
  world: World,
  actorId: number,
  slot: ShapeshifterSlot,
): Role {
  if (!owns(world)) throw new Error("shapeshifter_selection_unavailable");
  return shared.selectInitialIdentityCard(world, actorId, slot);
}
export function projectShapeshifterSetup(world: World) {
  if (!owns(world)) return;
  const data = shared.projectInitialIdentitySetup(world);
  if (!data) return;
  const selection = data.selection;
  if (selection?.slot === null) throw new Error("shapeshifter_selection_invalid");
  return {
    ...data,
    policy: shared.INITIAL_IDENTITY_POLICIES.shapeshifter,
    selection: selection ? { ...selection, slot: selection.slot } : null,
  };
}
export const hasActiveShapeshifterNight = (world: World): boolean =>
  owns(world) && shared.hasActiveInitialIdentityNight(world);
export const hasShapeshifterNightCommit = (world: World, day: number): boolean =>
  owns(world) && shared.hasInitialIdentityNightCommit(world, day);
export function openShapeshifterNight(world: World, day: number): () => void {
  return owns(world) ? shared.openInitialIdentityNight(world, day) : () => {};
}
