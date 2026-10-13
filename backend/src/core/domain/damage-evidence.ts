/**
 * 负责一次已解析伤害结果的运行时毒来源证据。输入为真实接受分支保留的原路由；
 * 输出为只读路由查询，原 cause Symbol、源与目标原体均保持，不重查资格、资源或 World。
 * 证据仅存于同一结果的不可枚举属性；身份品牌不保存另一份世界状态。
 * 旧注入结果／Proxy 不访问新增属性；JSON、事件和 schema2 仍仅消费原可枚举事实。
 */
import type { NightPoisonRoute } from "./night_effects";

const POISON_EVIDENCE = Symbol("damage_poison_evidence");
const ownedResults = new WeakSet<object>();
const noRoutes: readonly NightPoisonRoute[] = Object.freeze([]);

type EvidencedDamage = { readonly [POISON_EVIDENCE]: readonly NightPoisonRoute[] };

/**
 * 仅在真实解析结果创建或原延期结果复制处关联证据；不冻结或替换原结果／死亡数组。
 * 路由容器脱离并冻结，内部原生命引用保留；证据不等于已标死或授予死亡行动。
 */
export function attachDamagePoisonEvidence<T extends object>(
  result: T,
  routes: readonly NightPoisonRoute[],
): T {
  Object.defineProperty(result, POISON_EVIDENCE, { value: Object.freeze([...routes]) });
  ownedResults.add(result);
  return result;
}

/** 在原结果身份上读取；外部旧对象即使带同名 Symbol getter 也不触发。 */
export function damagePoisonRoutes(result: object): readonly NightPoisonRoute[] {
  return ownedResults.has(result) ? (result as EvidencedDamage)[POISON_EVIDENCE] : noRoutes;
}
