/**
 * 负责炼金魔女／狼鸦之爪的唯一夜状态绑定与检查点写入。输入为原槽、现场 caster／容器／key
 * 查询与原授权复验；输出为脱离 reader 副本、当前性或按原顺序提交的 next 槽。
 * 本 owner 保存 raw、脱离副本的 JSON 证据及数组／每行／嵌套 targetIds 原引用，不能用同字节
 * 新对象续权。不变量：先复验授权、准备完整绑定，再 defineProperty，最后替换检查点；失败
 * 保留已有写前缀。这里不持 World／生命／阶段、不解封或拥有第二份库存，也不增加 schema。
 */
import {
  readMistOwnData as own,
  readAlchemistState,
  readRavenState,
  type AlchemistState,
  type RavenState,
} from "./state";
export type MistCasterKind = "alchemist" | "raven_claw_wolf";
export type MistCasterState = AlchemistState | RavenState;
type State = MistCasterState;
/**
 * raw 是原库存身份；expected 是 reader 脱离副本的 JSON 内容证据。arrays 另持原数组、
 * 每项／历史行及嵌套 targetIds 引用；已知队友项是数值，历史项是原对象，JSON 同字节不足续权。
 */
interface StateBinding {
  raw: State;
  expected: string;
  arrays: Array<{ key: string; value: unknown; rows: unknown[]; nestedTargets?: unknown[] }>;
}

/** 只提供实际原字段的晚读；不得缓存 caster、容器或 key，原授权由外层持有。 */
interface StateQueries {
  caster(): MistCasterKind;
  privateState(): object;
  key(): "alchemist" | "ravenClaw";
  /** 构造时只捕获唯一原授权复验闭包；安装时才查找／调用原 current，不授予额外许可。 */
  assertCurrent(): State;
}
export class MistCasterStateSlot {
  private binding: StateBinding;
  constructor(
    private readonly queries: StateQueries,
    raw: unknown,
  ) {
    this.binding = this.bind(raw);
  }
  private readState(raw: unknown): State | undefined {
    return this.queries.caster() === "alchemist" ? readAlchemistState(raw) : readRavenState(raw);
  }
  /** reader 是脱离副本；raw 和引用指纹必须另外保留，不能把解析结果安装成原槽。 */
  private bind(raw: unknown): StateBinding {
    const state = this.readState(raw);
    if (!state) throw new Error("mist_caster_state_invalid");
    const names =
      this.queries.caster() === "alchemist"
        ? ["mistHistory", "healHistory"]
        : ["knownTeammateIds", "extraHistory"];
    return {
      raw: raw as State,
      expected: JSON.stringify(state),
      arrays: names.map((key) => {
        const value = own(raw, key) as unknown[];
        const rows = Array.from({ length: own(value, "length") as number }, (_value, index) =>
          own(value, String(index)),
        );
        return {
          key,
          value,
          rows,
          ...(key === "mistHistory"
            ? { nestedTargets: rows.map((row) => own(row, "targetIds")) }
            : {}),
        };
      }),
    };
  }
  isCurrent(): boolean {
    if (own(this.queries.privateState(), this.queries.key()) !== this.binding.raw) return false;
    const value = this.readState(this.binding.raw);
    return (
      !!value &&
      JSON.stringify(value) === this.binding.expected &&
      this.binding.arrays.every(
        (a) =>
          own(this.binding.raw, a.key) === a.value &&
          own(a.value, "length") === a.rows.length &&
          a.rows.every(
            (row, i) =>
              own(a.value, String(i)) === row &&
              (!a.nestedTargets || own(row, "targetIds") === a.nestedTargets[i]),
          ),
      )
    );
  }
  /** 仅复制知识；外层 current 已复验授权，保留原再次 reader 的调用和分配。 */
  read(): State {
    return this.readState(this.binding.raw)!;
  }
  /** current thunk 在进入后调用，Object.defineProperty 的 callee lookup 仍早于现场容器／key。 */
  install(next: State): void {
    this.queries.assertCurrent();
    const binding = this.bind(next);
    Object.defineProperty(this.queries.privateState(), this.queries.key(), {
      value: next,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    this.binding = binding;
  }
}
