/**
 * 负责盗贼／千面人及共享初始身份 scope 的原字段读取契约，直接拥有完整纯函数，不叠加转发。
 * 输入为未知原对象与字段名；输出原 own data descriptor 的值或 undefined，不复制／冻结输入。
 * 先按原布尔、类型和数组分支短路，再反射 descriptor／hasOwn；不额外要求可写、可枚举或可配置。
 * 反射仍可能触发 Proxy trap 或抛错，不是 Node 准入、完整状态 schema、身份校验或行动许可。
 * 这里不持 World、scope、库存或随机源；状态形状及提交权限仍归各原读取／权威所有者。
 */
export function dataField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}
