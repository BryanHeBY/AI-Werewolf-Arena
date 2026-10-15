/**
 * 负责动物梦境原审计字段的 checkpoint 编码。输入是原 audit 对象和既定字段名单；
 * 输出为原 own-data 描述符筛选及 snapshotPlainData 副本，保持 undefined 省略与拒绝顺序。
 * 本贡献不读取字段 getter、不替换原身份／库存，也不改变动物权威或失败记录政策。
 */
import { snapshotPlainData } from "../../domain/plain-data";
export function auditData(value: unknown, keys: readonly string[]): unknown {
  if (!value || typeof value !== "object") throw Error("animal_audit_data_invalid");
  const descriptors = Object.fromEntries(
    keys.flatMap((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return d ? [[key, d]] : [];
    }),
  );
  if (Object.values(descriptors).some((d) => !("value" in d)))
    throw Error("animal_audit_data_invalid");
  return snapshotPlainData(
    Object.fromEntries(
      Object.entries(descriptors)
        .filter(([, d]) => d.value !== undefined)
        .map(([key, d]) => [key, d.value]),
    ),
  );
}
