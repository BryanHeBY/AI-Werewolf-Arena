/** 文件说明：工具 schema 构建辅助函数。 */
/** 生成工具参数属性定义。 */
export function prop(
  type: string | string[],
  description: string,
  enumValues?: string[],
): Record<string, unknown> {
  return {
    type,
    description,
    ...(enumValues ? { enum: enumValues } : {}),
  };
}
