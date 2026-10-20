/**
 * 负责严格归档版本 wrapper 的独立单元测试；输入为实际入口读取的手写版本／metadata 与坏属性描述符。
 * 输出核对声明 2／3、schema getter 零调用及 metadata 失败先于新 descriptor 反射，错误原对象不被覆盖。
 * 最小 payload 只服务 envelope 边界，不实例化 World、不伪称完整 Tape 合法或跨 sourceHash 可重放。
 */
import { expect, test } from "bun:test";
import { createReproductionArchive } from "../../../src/recording/archive-identity";
import type { ReproductionRecord } from "../../../src/recording/reproduction/format";

/** wrapper 只消费这两个字段；完整记录的严格 shape 由独立 parser 审核，本测试不调用它。 */
function wrapperInput(schemaVersion: 2 | 3): ReproductionRecord {
  return {
    schemaVersion,
    metadata: {
      engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
      ruleset: { id: "awa_classic", version: "1.0.0" },
      random: { algorithm: "mulberry32-fnv1a-utf16-v1", streamPolicy: "named-path-v1", path: [] },
    },
  } as unknown as ReproductionRecord;
}

test("strict archive wrapper declares its own data version without changing public envelope v1", () => {
  for (const version of [2, 3] as const) {
    const archive = createReproductionArchive(wrapperInput(version));
    expect(archive.envelopeVersion).toBe(1);
    expect(archive.payloadSchemaVersion).toBe(version);
    expect(archive.payload.schemaVersion).toBe(version);
  }
});

test("strict archive wrapper rejects schema accessors without executing them and preserves metadata failure priority", () => {
  const accessor = wrapperInput(3);
  let schemaReads = 0;
  Object.defineProperty(accessor, "schemaVersion", {
    enumerable: true,
    get() {
      schemaReads++;
      return 3;
    },
  });
  expect(() => createReproductionArchive(accessor)).toThrow("archive");
  expect(schemaReads).toBe(0);
  const original = new Error("literal_metadata_failure");
  let descriptorReads = 0;
  const metadataFailure = new Proxy(wrapperInput(3), {
    get(target, key, receiver) {
      if (key === "metadata") throw original;
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === "schemaVersion") descriptorReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  let observed: unknown;
  try {
    createReproductionArchive(metadataFailure);
  } catch (error) {
    observed = error;
  }
  expect(observed).toBe(original);
  expect(descriptorReads).toBe(0);
});
