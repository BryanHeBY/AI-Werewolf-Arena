/**
 * 负责四族原生／学习死亡枪的数据创建、原槽安装、武装、捕获复验和库存消费。
 * 输入为原角色、原学习对象与晚取查询；输出保留同一槽／枪引用和原每次 hook 的捕获表。
 * 原生安装不克隆、不冻库存；学习模板仅创建自己的全新枪，已有整学习数据的复制仍由各族安装 owner 执行。
 * 本 owner 安装两个原生槽并写原枪字段，原体、生命、死因及请求许可仍在结算／具体权威复验；只读类型不是权限屏障。
 * 学习枪先晚取原查询并裸调用、读 skill，再在原阵营点调用显式 source；不存 Camp 引用。
 * 猎魔板子先捕获原审计库存，支付仍由同一权威执行；setter／编码或后续发表失败均不退款。
 */
import type { CurrentCampSource } from "../../../core/domain/components/camp";
import type {
  HunterState,
  HunterReadState,
  WolfKingState,
  WolfKingReadState,
  MechanicalReadState as MechanicalState,
  MechanicalReadLearning as MechanicalLearning,
  MechanicalReadSkill as MechanicalSkill,
  MechanicalReadState,
  AwakenedReadState as AwakenedState,
  AwakenedReadLearning as AwakenedLearning,
  AwakenedReadSkill as AwakenedSkill,
  AwakenedReadState,
} from "@ai-werewolf-arena/game-contract";
import { Camp, Role } from "../../../core/domain/model";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { World } from "../../../core/domain/world";
import type { RoleInitContext } from "./contracts";
import type { openDemonHunterStockFrame } from "./demon_hunter/native-gun-ports";

/** 创建仍逐次读取原配置 getter，不缓存 boardConfig／policy；分支保持原字段可选性。 */
export function createHunterState(ctx: Pick<RoleInitContext, "boardConfig">): HunterState {
  return {
    canShoot: true,
    ...(ctx.boardConfig?.hunter?.deathActionPolicy === "awa_knife_or_exile_v1"
      ? { deathActionPolicy: ctx.boardConfig.hunter.deathActionPolicy }
      : {}),
  };
}
export function createWolfKingState(ctx: Pick<RoleInitContext, "boardConfig">): WolfKingState {
  return {
    canShoot: true,
    ...(ctx.boardConfig?.wolfKing?.deathActionPolicy !== undefined &&
    ctx.boardConfig.wolfKing.deathActionPolicy !== "awa_qualified_sources_v1"
      ? { deathActionPolicy: ctx.boardConfig.wolfKing.deathActionPolicy }
      : {}),
  };
}

/** get 仍可调用原槽 getter；set 原左值赋入同对象，不新增 schema 或 descriptor 拒绝。 */
export function setHunterState(roleComp: RoleComponent, state: HunterState): HunterReadState {
  (roleComp.privateState as { hunter: HunterState })["hunter"] = state;
  return state;
}

export function getHunterState(roleComp: RoleComponent): HunterReadState | undefined {
  return (roleComp.privateState as { readonly hunter?: unknown })["hunter"] as
    HunterReadState | undefined;
}

export function setWolfKingState(roleComp: RoleComponent, state: WolfKingState): WolfKingReadState {
  (roleComp.privateState as { wolf_king: WolfKingState })["wolf_king"] = state;
  return state;
}

export function getWolfKingState(roleComp: RoleComponent): WolfKingReadState | undefined {
  return (roleComp.privateState as { readonly wolf_king?: unknown })["wolf_king"] as
    WolfKingReadState | undefined;
}

export type LearnedNativeGun = Extract<MechanicalSkill, { kind: "hunter" }>;
/** 学习得到新满库存模板，不从目标玩家复制已花费资源或原体许可。 */
export function createLearnedNativeGun(): { kind: "hunter"; canShoot: boolean; armed: boolean } {
  return { kind: "hunter", canShoot: true, armed: false };
}
/** 实际夜／激活检查仍由本族调用方先完成；只在原赋值点武装同一枪，不补偿其他字段。 */
function armLearnedNativeGun(gun: LearnedNativeGun): void {
  (gun as { armed: boolean }).armed = true;
}

/** 机械枪必须进入实际 ready 夜；保持 kind→ready→原 skill 左值读取，不因模式或查询补武装。 */
export function armMechanicalNativeGun(learned: MechanicalLearning, day: number): void {
  if (learned.skill.kind === "hunter" && day >= learned.readyOnNight)
    armLearnedNativeGun(learned.skill);
}
/** 觉醒枪仅在原整次激活通过后武装；activationNight／activeFromNight 仍在其后原点更新。 */
export function armAwakenedNativeGun(learned: AwakenedLearning): void;
export function armAwakenedNativeGun(learned: AwakenedLearning, mayCommit: () => boolean): boolean;
export function armAwakenedNativeGun(learned: AwakenedLearning, mayCommit?: () => boolean): boolean | void {
  if (learned.skill.kind === "hunter") {
    if (mayCommit) {
      // 原 callee→skill 引用先读取，再在首次 armed 赋值之前拒绝；不额外读取 armed。
      const arm = armLearnedNativeGun, gun = learned.skill;
      if (!mayCommit()) return false;
      arm(gun);
    } else armLearnedNativeGun(learned.skill);
  }
  // 原无回调调用保 void；机械已学习开夜武装与 paid reader 不使用此新入口。
  if (mayCommit) return true;
}

/** 生产每次 hook 独立持有原捕获表；这里不另验 World，换学习／原枪后返回 undefined。 */
export function createMechanicalGunReader(runtime: {
  readonly getMechanicalState: (role: RoleComponent | undefined) => MechanicalReadState | undefined;
}): (role: RoleComponent, currentCamp: CurrentCampSource) => LearnedNativeGun | undefined {
  const owners = new Map<
    RoleComponent,
    {
      state: MechanicalState;
      learning: MechanicalLearning;
      gun: Extract<MechanicalSkill, { kind: "hunter" }>;
    }
  >();
  return (role, currentCamp) => {
    const query = runtime.getMechanicalState;
    const state = query(role),
      learning = state?.learned,
      skill = learning?.skill;
    if (currentCamp()?.camp !== Camp.Wolf || !state || !learning || skill?.kind !== "hunter" || !skill.armed)
      return undefined;
    const prior = owners.get(role);
    if (prior && (state !== prior.state || learning !== prior.learning || skill !== prior.gun))
      return undefined;
    if (!prior) owners.set(role, { state, learning, gun: skill });
    return skill;
  };
}

/** 生产每次 hook 独立持有原捕获表；这里不另验 World，换学习／原枪后返回 undefined。 */
export function createAwakenedGunReader(runtime: {
  readonly getAwakenedState: (role: RoleComponent | undefined) => AwakenedReadState | undefined;
}): (role: RoleComponent, currentCamp: CurrentCampSource) => LearnedNativeGun | undefined {
  const owners = new Map<
    RoleComponent,
    {
      state: AwakenedState;
      learned: AwakenedLearning;
      gun: Extract<AwakenedSkill, { kind: "hunter" }>;
      targetId: number;
      role: AwakenedLearning["role"];
      day: number;
      activationNight: number;
      activeFromNight: number;
    }
  >();
  return (role, currentCamp) => {
    const query = runtime.getAwakenedState;
    const state = query(role),
      learned = state?.learned,
      gun = learned?.skill;
    if (
      currentCamp()?.camp !== Camp.Wolf ||
      !state ||
      !learned ||
      learned.role !== Role.Hunter ||
      learned.activationNight === null ||
      learned.activeFromNight === null ||
      gun?.kind !== "hunter" ||
      !gun.armed
    )
      return undefined;
    const prior = owners.get(role);
    if (
      prior &&
      (state !== prior.state ||
        learned !== prior.learned ||
        gun !== prior.gun ||
        learned.targetId !== prior.targetId ||
        learned.role !== prior.role ||
        learned.day !== prior.day ||
        learned.activationNight !== prior.activationNight ||
        learned.activeFromNight !== prior.activeFromNight)
    )
      return undefined;
    if (!prior)
      owners.set(role, {
        state,
        learned,
        gun,
        targetId: learned.targetId,
        role: learned.role,
        day: learned.day,
        activationNight: learned.activationNight,
        activeFromNight: learned.activeFromNight,
      });
    return gun;
  };
}

/** 晚取原猎魔命令；非 Hunter 分支不读命令，类型引用不会初始化 authority。 */
export interface NativeDeathGunStockQueries {
  readonly openHunterStock?: typeof openDemonHunterStockFrame;
}
export function captureNativeGunStock(
  kind: Role,
  queries: NativeDeathGunStockQueries,
  world: World,
  actorId: number,
  state: object,
): ReturnType<typeof openDemonHunterStockFrame> {
  if (kind !== "hunter") return null;
  const command = queries.openHunterStock!;
  return command(world, actorId, state);
}
/** 付款不补资格：原 stock 自验并写审计；普通分支只写原 canShoot。失败保原写入前缀。 */
export function consumeNativeDeathGun(
  state: { readonly canShoot: boolean },
  stock: ReturnType<typeof openDemonHunterStockFrame>,
): void {
  if (stock) stock.consume();
  else (state as { canShoot: boolean }).canShoot = false;
}
