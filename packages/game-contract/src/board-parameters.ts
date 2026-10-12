/**
 * Owns the readonly public view of complete serialized board parameter data.
 * Inputs are the existing BoardConfig fields; output keeps every optional field
 * and machine value with readonly nested records and arrays. This type grants
 * no component, World, handler or resource capability and never compiles rules,
 * freezes caller objects or changes the mutable serialization DTO's shape.
 */
import type { BoardConfig } from "./boards";

type ReadonlyBoardData<T> = T extends readonly (infer Item)[]
  ? readonly ReadonlyBoardData<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: ReadonlyBoardData<T[Key]> }
    : T;

export type ReadonlyBoardConfig = ReadonlyBoardData<BoardConfig>;
