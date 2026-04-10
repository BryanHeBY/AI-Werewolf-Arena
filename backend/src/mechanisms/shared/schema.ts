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

