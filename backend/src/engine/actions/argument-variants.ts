/**
 * 负责从既有输入结构生成明确的模型参数分支，同时保留原结构作为兼容入口。
 * 输入为原 schema 与静态分支覆盖，输出为模型结构和明确旧格式，不执行参数修复。
 * 这里只组合静态 JSON Schema，不查询世界或决定技能资格；历史档案不经过本转换。
 */
type Schema = Record<string, unknown>;
interface Variant {
  properties?: Record<string, Schema>;
  omit?: string[];
}

/** 每个分支都是完整对象，避免 JSON Schema 转换器遗漏根节点的 required／额外字段约束。 */
export function withArgumentVariants(legacyParameters: Schema, variants: Variant[]) {
  const original = legacyParameters.properties as Record<string, Schema>;
  const branches = variants.map(({ properties: overrides, omit = [] }) => ({
    ...legacyParameters,
    properties: Object.fromEntries(
      Object.entries({ ...original, ...overrides }).filter(([key]) => !omit.includes(key)),
    ),
    required: (legacyParameters.required as string[]).filter((key) => !omit.includes(key)),
  }));
  return {
    parameters: branches.length === 1 ? branches[0]! : { anyOf: branches },
    legacyParameters,
  };
}

/** 显式弃权使用 null；选择目标时每个目标字段必须非空。目标之间的关系仍由具体机制校验。 */
export function withTargetOrAbstain(legacyParameters: Schema, keys = ["target_id"]) {
  const properties = legacyParameters.properties as Record<string, Schema>;
  return withArgumentVariants(legacyParameters, [
    {
      properties: {
        abstain: { type: "boolean", const: false },
        ...Object.fromEntries(
          keys.map((key) => {
            const target = properties[key]!;
            return [
              key,
              {
                ...target,
                type: Array.isArray(target.type)
                  ? target.type.filter((type: string) => type !== "null")
                  : target.type,
              },
            ];
          }),
        ),
      },
    },
    {
      properties: {
        abstain: { type: "boolean", const: true },
        ...Object.fromEntries(keys.map((key) => [key, { type: "null" }])),
      },
    },
  ]);
}
