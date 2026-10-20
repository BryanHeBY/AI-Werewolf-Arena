/**
 * 负责按原 World 对象绑定唯一不可变板子参数。输入为完整自有数据配置；输出为深只读
 * 执行视图、独立归档 DTO 或明确的数据／修订错误。Node Proxy 检测先于反射；不执行
 * accessor、迭代器或继承字段。只冻结校验后副本，不冻结调用方对象、World 或处理器。
 * 相等完整输入复用原所有者；同一 World 不支持参数替换或重置。绑定不读 World 方法、
 * 时钟或 RNG，也不授予行动权限；安全结构预检保留原板子拒绝优先级，再做完整 schema 校验。
 */
import { types } from "node:util";
import {
  boardConfigSchema,
  type BoardConfig,
  type ReadonlyBoardConfig,
} from "@ai-werewolf-arena/game-contract";
import { boardPresetViolation } from "./board-support";

// 权威按 World 原对象身份保存；工厂实例与私有构造凭据分别防止外部伪造已编译参数。
const owners = new WeakMap<object, BoardParameters>();
const factoryInstances = new WeakSet<object>();
const constructionToken = Symbol("board-parameters-construction");
const dataError = "rule_parameters_not_data";

/** 先验证自有描述符；只有已证明的纯数据才传给 structuredClone，拒绝路径不触发 getter。 */
function assertData(value: unknown, ancestors: Set<object>, depth: number): void {
  if (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return;
  if (typeof value !== "object" || types.isProxy(value) || depth > 16 || ancestors.has(value))
    throw new Error(dataError);
  // 数组必须是稠密标准数组；普通对象仅接受标准或 null 原型，symbol／accessor 不进入后续克隆。
  const array = Array.isArray(value),
    prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    throw new Error(dataError);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string"))
    throw new Error(dataError);
  if (array) {
    const length = descriptors.length?.value;
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      Object.keys(descriptors).length !== length + 1 ||
      !Array.from({ length }, (_, index) => Object.hasOwn(descriptors, String(index))).every(
        Boolean,
      )
    )
      throw new Error(dataError);
  }
  // 只记录当前递归祖先：拒绝环，允许不同路径共享同一数据对象；finally 保持分支隔离。
  ancestors.add(value);
  try {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) throw new Error(dataError);
      assertData(descriptor.value, ancestors, depth + 1);
    }
  } finally {
    ancestors.delete(value);
  }
}

/** 递归冻结已复制并解析的数据；不把外部输入引用变成只读。 */
function freezeData(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    freezeData(descriptor.value);
  }
  Object.freeze(value);
}

/** 比较完整数据值而非字段插入顺序；两侧均已校验，不读取可替换上下文别名。 */
function equalData(left: unknown, right: unknown): boolean {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
    return Object.is(left, right);
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort(),
    rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        equalData(
          Object.getOwnPropertyDescriptor(left, key)!.value,
          Object.getOwnPropertyDescriptor(right, key)!.value,
        ),
    )
  );
}

/** 唯一参数所有者持有深冻结配置；encode 返回可修改的独立归档副本，不修改运行规则。 */
export class BoardParameters {
  readonly #board: BoardConfig;

  private constructor(token: typeof constructionToken, board: BoardConfig) {
    if (token !== constructionToken) throw new Error("rule_parameters_constructor_forbidden");
    freezeData(board);
    this.#board = board;
    Object.freeze(this);
    factoryInstances.add(this);
  }

  static compile(input: unknown): BoardParameters {
    assertData(input, new Set(), 0);
    const copied = structuredClone(input);
    // 这里只预检原板子分派会解引用的两份结构；不代表完整规范化通过，也不是运行时许可。
    if (
      !copied ||
      typeof copied !== "object" ||
      Array.isArray(copied) ||
      !Array.isArray(Object.getOwnPropertyDescriptor(copied, "roleSetups")?.value)
    )
      throw new Error("rule_parameters_invalid");
    const rows: unknown[] = Object.getOwnPropertyDescriptor(copied, "roleSetups")!.value;
    const conditions: unknown = Object.getOwnPropertyDescriptor(copied, "winConditions")?.value;
    if (
      (conditions !== undefined && !Array.isArray(conditions)) ||
      rows.some(
        (row) =>
          !row ||
          typeof row !== "object" ||
          Array.isArray(row) ||
          typeof Object.getOwnPropertyDescriptor(row, "role")?.value !== "string" ||
          typeof Object.getOwnPropertyDescriptor(row, "count")?.value !== "number",
      )
    )
      throw new Error("rule_parameters_invalid");
    // 先保留原板子拒绝的错误优先级；后续严格 schema 成功才允许创建参数所有者。
    const violation = boardPresetViolation(copied as ReadonlyBoardConfig);
    if (violation) throw new Error(violation);
    const parsed = boardConfigSchema.safeParse(copied);
    if (!parsed.success) throw new Error("rule_parameters_invalid");
    return new BoardParameters(constructionToken, parsed.data);
  }

  /** 返回所有者的同一只读引用，供运行期按身份核验。 */
  get board(): ReadonlyBoardConfig {
    return this.#board;
  }

  /** 每次产生独立副本；归档数据不能反向替换 World 已绑定的执行参数。 */
  encode(): BoardConfig {
    return structuredClone(this.#board);
  }
}
Object.freeze(BoardParameters.prototype);
Object.freeze(BoardParameters);

function isFactoryParameters(input: object): input is BoardParameters {
  return factoryInstances.has(input);
}

/** 只发布一次；同值新输入仍先校验／编译再复用旧所有者，异值修订按原错误拒绝。 */
export function bindBoardParameters(
  worldIdentity: object,
  input: ReadonlyBoardConfig | BoardParameters,
): BoardParameters {
  const previous = owners.get(worldIdentity);
  // 唯有已绑定视图的同一引用直接返回；其它候选失败不改变旧绑定，首次编译成功后才写入。
  if (previous && input === previous.board) return previous;
  if (types.isProxy(input)) throw new Error(dataError);
  const candidate = isFactoryParameters(input) ? input : BoardParameters.compile(input);
  if (previous) {
    if (!equalData(previous.board, candidate.board))
      throw new Error("rule_parameters_revision_not_supported");
    return previous;
  }
  owners.set(worldIdentity, candidate);
  return candidate;
}

/** 只查原 World 身份的权威绑定；缺失即失败，不信任可替换上下文，也不临时编译新来源。 */
export function requireBoardParameters(worldIdentity: object): BoardParameters {
  const parameters = owners.get(worldIdentity);
  if (!parameters) throw new Error("rule_parameters_not_bound");
  return parameters;
}
