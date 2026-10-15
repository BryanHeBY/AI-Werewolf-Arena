/**
 * 负责恶夜骑士一夜原体绑定 Map 的唯一存储及反射／夜枪运行查询。
 * 输入为原 NightStageState 身份与开夜捕获的同一 Map；输出为原 binding 或捕获同一 Map 的夜枪闭包。
 * 原 binding 包含生命、库存引用和当前性回调，不是玩家 DTO 或 JSON，也不因查询而获得反射付款权限。
 * 原体捕获／资格归 reflection，免疫提案归 night_frame，余量写入归 state-slot；本模块不查询 World、不复制 Map 或重抓角色。
 * 旧通用 map 属性／返回 map 注入接口退出；更换状态对象不接续旧 Map，已有结果闭包保原捕获引用。
 */
import type { EntityId } from "../../../../domain/identity";
import type { NightStageState } from "../../stages/night/contracts";
import type { captureEvilKnight } from "./reflection";

type EvilKnightNightBinding = NonNullable<ReturnType<typeof captureEvilKnight>>;
type EvilKnightNightBindings = Map<EntityId, EvilKnightNightBinding>;

// 只有本族这一份按夜间状态身份登记的 Map；免疫列表仍是原独立提案数组，不挂通用镜像。
const bindingsByNight = new WeakMap<NightStageState, EvilKnightNightBindings>();

/** 仅核原重入检查点是否已安装；不调用 binding.isCurrent 或推导资格。 */
export function hasEvilKnightNightBindings(state: NightStageState): boolean {
  return bindingsByNight.has(state);
}

/** 在原赋值点登记同一 Map；values 迭代或随后免疫写入失败仍保留已经安装的前缀。 */
export function installEvilKnightNightBindings(
  state: NightStageState,
  bindings: EvilKnightNightBindings,
): void {
  bindingsByNight.set(state, bindings);
}

/** 反射在原参数读取点取得原 binding；原付款命令继续负责当前性、来源和资源复核。 */
export function evilKnightNightBinding(
  state: NightStageState,
  targetId: EntityId,
): EvilKnightNightBinding | null {
  return bindingsByNight.get(state)?.get(targetId) ?? null;
}

/**
 * 在原输出字段点只捕获同一 Map，不读取 World／目标／政策。闭包调用时保持原 get、
 * isCurrent 再 shotPolicy 的短路顺序及 receiver；只返回夜枪保护，不暴露可替换的 Map。
 */
export function captureEvilKnightNightShotProtection(
  state: NightStageState,
): (targetId: EntityId) => boolean {
  const bindings = bindingsByNight.get(state);
  return (targetId) => {
    const binding = bindings?.get(targetId);
    return (
      !!binding && binding.isCurrent() && binding.state.shotPolicy === "night_shot_immune"
    );
  };
}
