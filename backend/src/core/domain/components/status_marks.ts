import { types } from "node:util";
import { text, type Locale, type MessageKey } from "@ai-werewolf-arena/game-text";
import { PromptRenderable, StatusMark } from "../model";
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
/** Inspect only factory storage; no getter or Proxy and no writable Set escapes. */
export function statusMarkSnapshot(
  component: unknown,
  mark: StatusMark,
): Readonly<StatusMarkSnapshot> | null {
  if (!component || typeof component !== "object" || types.isProxy(component)) return null;
  const original = markOrigins.get(component);
  // A legacy-looking shadow is foreign data; it never becomes the real private storage.
  if (!original || Object.getOwnPropertyDescriptor(component, "marks")) return null;
  return Object.freeze({
    revision: original.revisions.get(mark) ?? 0,
    present: nativeHas.call(original.marks, mark),
  });
}
function revise(original: MarkStorage, mark: StatusMark): void {
  original.revisions.set(mark, (original.revisions.get(mark) ?? 0) + 1);
}
/** Temporary protection and damage marks with a factory-owned mutation ledger. */
export class StatusMarksComponent implements PromptRenderable {
  constructor(
    initialMarks: StatusMark[] = [],
    private readonly locale: Locale = "zh-CN",
  ) {
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
  renderPrompt(locale: Locale = this.locale): string {
    if (nativeSize.call(storage(this).marks) === 0) return text(locale, "component.marks_none");
    return text(locale, "component.marks", {
      marks: this.values()
        .map((mark) => text(locale, `component.mark.${mark}` as MessageKey))
        .join(" "),
    });
  }
}
export function createStatusMarksComponent(locale: Locale = "zh-CN"): StatusMarksComponent {
  return new StatusMarksComponent([], locale);
}
