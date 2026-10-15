/**
 * 负责千面人对共享实体牌库存、准备状态与选择投影的kind边界。输入为原World、牌组／玩家或slot；
 * 输出本族原引用、选择副本或原拒绝，异族查询不披露库存，ready沿原true及关闭／开夜no-op。
 * 库存与物理换牌只归initial_identity；本入口保先kind后共享调用、原错误前缀及选择slot限制。
 * 显示投影不授予换牌或生命权限，不合并盗贼可保留身份与千面人必须选牌两种政策。
 */
import { type World, type Role } from "../../domain";
// 公共库存出口仍指向原 deal；保 namespace 成员的原读取位置，不从状态查询加载设置窗口。
import * as shared from "../initial-identity/deal-ports";
export type ShapeshifterCard = shared.InitialIdentityCard;
export type ShapeshifterSlot = shared.InitialIdentitySlot;
export type ShapeshifterSetupStatus = shared.InitialIdentitySetupStatus;
export type ShapeshifterDeal = shared.InitialIdentityDeal;
// 只按共享owner已安装kind隔离；不从已换牌后的live角色或玩家知识推断本族许可。
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
/** 先kind与完整共享投影，再核null slot并重建selection；不提前复制／读选择或放宽千面人的原拒绝。 */
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
