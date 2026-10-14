/**
 * 负责黎明前有限夜间效果的完整组合：封存明辉效果、创建原梦实例、核对白昼学者／寂夜导师增益，
 * 再按原字段顺序调用领域伤害结算。输入为原检查点的延迟参数，输出为同一梦句柄和原伤害结果。
 * 具体效果仍持原生命／当前性回调；领域 DamageResolutionSystem 唯一折叠来源和消费印记。
 * resolve 的 callee／receiver 先于 World 和对象参数读取，角色查询 callee 也先于 Role 参数；
 * 本组合不提前收齐 input、不复制结果、不存第二份效果、不退款或隐藏已付／失败前缀。
 */
import { Role, type EntityId, type ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { World } from "../core/domain/world";
import type { DreamNightEffects } from "../core/domain/dream-night-effects";
import type { DamageResolutionSystem } from "../core/domain/systems/damage_resolution_system";
import type { NightStageContext, NightStageState } from "../game/mechanisms/stages/night/contracts";
import { DreamNightFrame } from "../game/mechanisms/roles/dreamer/night_frame";
import { readDreamNightLinks } from "../game/mechanisms/roles/dreamer/night-ports";
import { sealRadiantNightEffects } from "../game/mechanisms/roles/radiant_eclipse/ports";
import { assertScholarMentorBonusEffects } from "../game/mechanisms/roles/scholar_mentor/night_stages";

/** 只声明这一组合实际读取的原字段；这是同一阶段状态的类型视图，不创建或冻结副本。 */
type NightDamageClaims = Pick<
  NightStageState,
  | "modifierDeaths"
  | "poisonClaims"
  | "retaliationAttacks"
  | "nightImmunities"
  | "inspectionAttacks"
  | "foxInspections"
  | "guardClaims"
  | "merchantBacklashes"
  | "blackMarketBacklashes"
  | "mechanicalEffects"
  | "awakenedEffects"
>;

export interface NightDamageCompositionRuntime {
  ownsRadiant(): boolean;
  world(): World;
  day(): number;
  claims(): NightDamageClaims;
  config(): Pick<ReadonlyBoardConfig, "scholarMentor">;
  stageContext(): NightStageContext;
  solver(): Pick<DamageResolutionSystem, "resolve">;
  /** Role 参数延迟到原方法 callee 查找之后，不能在组合入口先取 enum 属性。 */
  aliveByRole(role: () => Role): EntityId[];
}

/** 同步完成原四步组合，不改变前后记录／try-finally，也不重新打开已提交效果。 */
export function composeNightDamage(runtime: NightDamageCompositionRuntime): {
  dreamFrame: DreamNightEffects;
  damage: ReturnType<DamageResolutionSystem["resolve"]>;
} {
  const radiantEffects = runtime.ownsRadiant()
    ? sealRadiantNightEffects(runtime.world(), runtime.day())
    : undefined;
  // 保原 constructor callee、claims 与 shelters 参数顺序；读取同数组，不重建已付／原生命绑定。
  const dreamFrame = new DreamNightFrame(readDreamNightLinks(runtime.claims()), radiantEffects?.shelters);
  if (runtime.config().scholarMentor) assertScholarMentorBonusEffects(runtime.stageContext());
  const damage = runtime.solver().resolve(runtime.world(), {
    intentNight: runtime.day(),
    radiantShelters: radiantEffects?.shelters,
    radiantBacklashes: radiantEffects?.backlashes,
    modifierDeaths: runtime.claims().modifierDeaths,
    protectedTargets: dreamFrame.protectedTargets(runtime.world()),
    immuneNightTargets: dreamFrame.immuneNightTargets(runtime.world()),
    consecutiveDeaths: dreamFrame.consecutiveDeaths(runtime.world()),
    poisonClaims: runtime.claims().poisonClaims,
    retaliationAttacks: runtime.claims().retaliationAttacks,
    nightImmunities: runtime.claims().nightImmunities,
    inspectionAttacks: runtime.claims().inspectionAttacks,
    foxInspections: runtime.claims().foxInspections,
    wolfImmuneTargets: runtime.aliveByRole(() => Role.CursedFox),
    guardClaims: runtime.claims().guardClaims,
    merchantBacklashes: runtime.claims().merchantBacklashes,
    blackMarketBacklashes: runtime.claims().blackMarketBacklashes,
    mechanicalEffects: runtime.claims().mechanicalEffects,
    awakenedEffects: runtime.claims().awakenedEffects,
  });
  return { dreamFrame, damage };
}
