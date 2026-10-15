/**
 * 负责状态印记的原工厂库存、修订与只读计数查询。输入为初始印记及具体修改，输出保留
 * 原组件、原 Set 顺序和修订语义；Proxy 与外来库存仍被拒绝，不返回可写 Set。
 * 展示语言、文案与 map 调用移到游戏观察层，领域不格式化印记或改变资源权限。
 */
import { types } from "node:util";
import { StatusMark } from "@ai-werewolf-arena/game-contract";
interface MarkStorage {
  marks: Set<StatusMark>;
  revisions: Map<StatusMark, number>;
}
const markOrigins = new WeakMap<object, MarkStorage>();
const nativeHas = Set.prototype.has,
  nativeAdd = Set.prototype.add,
  nativeDelete = Set.prototype.delete,
  nativeClear = Set.prototype.clear,
  nativeValues = Set.prototype.values;
const nativeSize = Object.getOwnPropertyDescriptor(Set.prototype, "size")!.get!;
export interface StatusMarkSnapshot {
  readonly revision: number;
  readonly present: boolean;
}
function storage(component: object): MarkStorage {
  const original = !types.isProxy(component) && markOrigins.get(component);
  if (!original) throw new Error("status_marks_component_invalid");
  return original;
}
/** 只检查工厂库存；不执行 getter 或 Proxy，也不返回可写 Set。 */
export function statusMarkSnapshot(
  component: unknown,
  mark: StatusMark,
): Readonly<StatusMarkSnapshot> | null {
  if (!component || typeof component !== "object" || types.isProxy(component)) return null;
  const original = markOrigins.get(component);
  // 外来旧形状影子不属于真实私有库存，不能通过此处读取原状态。
  if (!original || Object.getOwnPropertyDescriptor(component, "marks")) return null;
  return Object.freeze({
    revision: original.revisions.get(mark) ?? 0,
    present: nativeHas.call(original.marks, mark),
  });
}
function revise(original: MarkStorage, mark: StatusMark): void {
  original.revisions.set(mark, (original.revisions.get(mark) ?? 0) + 1);
}
/** 临时防护与伤害印记；变更台账只属于原工厂库存。 */
export class StatusMarksComponent {
  constructor(initialMarks: StatusMark[] = []) {
    const original: MarkStorage = { marks: new Set(), revisions: new Map() };
    markOrigins.set(this, original);
    for (const mark of initialMarks) {
      nativeAdd.call(original.marks, mark);
      revise(original, mark);
    }
  }
  add(mark: StatusMark): void {
    const original = storage(this);
    nativeAdd.call(original.marks, mark);
    revise(original, mark);
  }
  has(mark: StatusMark): boolean {
    return nativeHas.call(storage(this).marks, mark);
  }
  remove(mark: StatusMark): void {
    const original = storage(this);
    nativeDelete.call(original.marks, mark);
    revise(original, mark);
  }
  clear(): void {
    const original = storage(this);
    nativeClear.call(original.marks);
    for (const mark of Object.values(StatusMark)) revise(original, mark);
  }
  values(): StatusMark[] {
    return Array.from(nativeValues.call(storage(this).marks));
  }
}
export function createStatusMarksComponent(): StatusMarksComponent {
  return new StatusMarksComponent([]);
}

/** 原生计数读口不执行 values 方法；展示可保持空集合时的原短路与失败顺序。 */
export function statusMarksSize(component: StatusMarksComponent): number {
  return nativeSize.call(storage(component).marks);
}
