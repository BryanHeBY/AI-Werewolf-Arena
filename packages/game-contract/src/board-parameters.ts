/**
 * 负责提供完整板子参数的递归只读类型视图。输入为 BoardConfig 字段，输出保留可选性与机器值的只读嵌套记录及数组。
 * 这一数据视图不克隆或冻结调用方对象，不改变可变序列化结构，也不携带 World、处理器或资源能力。
 */
import type { BoardConfig } from "./boards";

// 递归映射保留原字段及可选性；readonly 是类型约束，输入对象与嵌套引用并未复制。
type ReadonlyBoardData<T> = T extends readonly (infer Item)[]
  ? readonly ReadonlyBoardData<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: ReadonlyBoardData<T[Key]> }
    : T;

export type ReadonlyBoardConfig = ReadonlyBoardData<BoardConfig>;
