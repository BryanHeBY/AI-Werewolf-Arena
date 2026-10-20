/**
 * 负责盗贼对共享初始身份库存、准备状态和选择投影的kind隔离。输入为原World、牌组／玩家或选择；
 * 输出原库存引用、脱离投影或原族错误，不把另一种已安装机制当成盗贼deal。
 * 唯一库存、发牌和提交仍归initial_identity；异族库存／投影返回undefined，布尔验证沿原false，ready为true，关闭／开夜不操作异族。
 * 先核安装kind再调用原共享方法，不以当前玩家角色标签重新分配权限，也不创建第二份库存。
 */
import { type World, type Role } from "../../domain";
// 公共库存出口仍指向原 deal；保 namespace 成员的原读取位置，不从状态查询加载设置窗口。
import * as shared from "../initial-identity/deal-ports";
export type ThiefCard = shared.InitialIdentityCard;
export type ThiefSlot = shared.InitialIdentitySlot;
export type ThiefSetupStatus = shared.InitialIdentitySetupStatus;
export type ThiefDeal = shared.InitialIdentityDeal;
// 安装kind来自同一共享owner；身份已换牌也不改本入口归属，不提前缓存World或共享查询。
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
/** 错族先给原盗贼错误；只有本族才进入共享open和其原重入／状态检查，失败不补开窗口。 */
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
/** 先kind隔离，再读共享投影；保原新外层对象及共享selection副本，不披露异族牌面或新授选择。 */
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
