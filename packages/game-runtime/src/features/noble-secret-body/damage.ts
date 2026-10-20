/**
 * 负责贵族／秘密之身有限板的最终死因数据校验、脱离原引用的复制及单源阻断计划。
 * 输入为救药、原生毒免疫和猎杀／侍从清除之后的有效来源；输出是冻结的来源副本与可空阻断描述。
 * 本模块拥有数据形状与固定优先级，不查询 World、不消费保护库存、不标死或授予行动许可；
 * 付款和原体仍归具体 authority。任一来源畸形时抛原错误，不返回半份快照。
 */
import { types } from "node:util";

/** 单次保护只移除首个存在的原因；顺序是本板规则，不能用原输入数组顺序或通用伤害排序替代。 */
export const SECRET_BODY_CAUSE_ORDER = Object.freeze([
  "wolf_kill",
  "poison",
  "demon_hunt",
  "demon_hunt_backlash",
  "servant_expiry",
] as const);
export type SecretBodyCause = (typeof SECRET_BODY_CAUSE_ORDER)[number];
/** 输入只读视图不代表运行时已校验或冻结；复制入口仍检查全部键、数组及原因。 */
export type SecretBodySources = Readonly<Record<string, readonly SecretBodyCause[]>>;
function playerId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value < Number.MAX_SAFE_INTEGER;
}
function snapshotSources(sources: SecretBodySources): Record<string, SecretBodyCause[]> {
  const copied: Record<string, SecretBodyCause[]> = {};
  // 在反射前拒绝 Proxy；只接收普通或无原型的字典，不执行输入访问器来取得来源。
  if (
    !sources ||
    typeof sources !== "object" ||
    types.isProxy(sources) ||
    Array.isArray(sources) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(sources))
  )
    throw new Error("secret_body_sources_invalid");
  const fields = Object.getOwnPropertyDescriptors(sources);
  for (const key of Reflect.ownKeys(fields)) {
    const field = typeof key === "string" ? fields[key] : undefined;
    if (
      !field ||
      !("value" in field) ||
      typeof key !== "string" ||
      !playerId(Number(key)) ||
      String(Number(key)) !== key
    )
      throw new Error("secret_body_sources_invalid");
    // 玩家键必须符合原 ID 范围并使用规范十进制形式；数组须密集且每项为允许的唯一数据值。
    const raw: unknown = field.value;
    if (types.isProxy(raw) || !Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype)
      throw new Error("secret_body_sources_invalid");
    const items: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
      raw as object,
    );
    const length: unknown = items.length?.value;
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      Reflect.ownKeys(items).length !== length + 1
    )
      throw new Error("secret_body_sources_invalid");
    const causes: SecretBodyCause[] = [];
    for (let index = 0; index < length; index++) {
      const item = items[String(index)];
      if (
        !item ||
        !("value" in item) ||
        !SECRET_BODY_CAUSE_ORDER.includes(item.value) ||
        causes.includes(item.value)
      )
        throw new Error("secret_body_sources_invalid");
      causes.push(item.value);
    }
    if (causes.length) copied[key] = causes;
  }
  return copied;
}
/** 无已付保护时保留全部已校验来源；同时冻结新字典及其数组，不冻结或修改原输入。 */
export function copySecretBodySources(sources: SecretBodySources): SecretBodySources {
  const copied = snapshotSources(sources);
  return Object.freeze(
    Object.fromEntries(Object.entries(copied).map(([key, value]) => [key, Object.freeze(value)])),
  );
}
/** 有效选定目标没有致死来源时回到自身；选择与单源删除只生成计划，付款由 caller 完成。 */
export function planSecretBodyBlock(
  actorId: number,
  selectedId: number | null,
  sources: SecretBodySources,
): Readonly<{
  blocked: Readonly<{ targetId: number; cause: SecretBodyCause }> | null;
  sources: SecretBodySources;
}> {
  if (!playerId(actorId) || (selectedId !== null && !playerId(selectedId)))
    throw new Error("secret_body_target_invalid");
  const copied = snapshotSources(sources);
  const preferred = selectedId ?? actorId;
  const targetId = copied[String(preferred)]?.length ? preferred : actorId;
  const causes = copied[String(targetId)] ?? [];
  const cause = SECRET_BODY_CAUSE_ORDER.find((c) => causes.includes(c));
  if (cause) {
    copied[String(targetId)] = causes.filter((c) => c !== cause);
    if (!copied[String(targetId)]!.length) delete copied[String(targetId)];
  }
  return Object.freeze({
    blocked: cause ? Object.freeze({ targetId, cause }) : null,
    sources: Object.freeze(
      Object.fromEntries(Object.entries(copied).map(([key, value]) => [key, Object.freeze(value)])),
    ),
  });
}
