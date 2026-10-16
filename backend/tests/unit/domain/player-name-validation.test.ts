/**
 * 单元测试验证可选昵称的数据边界；输入为字面身份、访问器及代理，不构造机制或启动对局。
 * 预期为手写的接受／拒绝集合与零 getter 调用；缺省昵称只允许普通对象上的真正缺席。
 */
import { expect, test } from "bun:test";
import {
  createIdentityComponent,
  hasValidOptionalPlayerName,
} from "../../../src/domain/entities/player";

test("昵称允许字符串或真正缺席，不把缺省名字写回身份", () => {
  const identity = createIdentityComponent(1, 1);
  expect(hasValidOptionalPlayerName(identity)).toBe(true);
  expect(Object.hasOwn(identity, "name")).toBe(false);
  expect(hasValidOptionalPlayerName(createIdentityComponent(1, 1, "贝叶丝"))).toBe(true);
  expect(hasValidOptionalPlayerName(Object.assign(Object.create(null), identity))).toBe(true);
  // 是否为空、长度等配置约束仍归配置解析；这里仅校验字段来源与数据类型。
  expect(hasValidOptionalPlayerName({ name: "" })).toBe(true);
});

test("昵称校验拒绝访问器、继承值、代理和显式 undefined，且不执行外来代码", () => {
  let reads = 0;
  const accessor = {
    get name() {
      reads++;
      throw new Error("昵称 getter 不应执行");
    },
  };
  const proxy = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        reads++;
        throw new Error("昵称代理不应执行");
      },
    },
  );
  for (const identity of [
    accessor,
    Object.create(accessor),
    Object.create({ name: "继承名字" }),
    Object.create({}),
    proxy,
    { name: undefined },
    { name: null },
    { name: 1 },
    [],
    null,
  ])
    expect(hasValidOptionalPlayerName(identity)).toBe(false);
  expect(reads).toBe(0);
});
