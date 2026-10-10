import { COMPONENT, StatusMark, type World } from "../../../../core";
import {
  statusMarkSnapshot,
  type StatusMarksComponent,
  type StatusMarkSnapshot,
} from "../../../../core/domain/components/status_marks";
interface Contribution {
  world: World;
  targetId: number;
  marks: StatusMarksComponent;
  before: Readonly<StatusMarkSnapshot>;
  committed: Readonly<StatusMarkSnapshot> | null;
  sealed: boolean;
}
const contributions = new WeakMap<object, Contribution>();
/** Capture immediately before the trusted native poison stage's single add(PoisonMark). */
export function openNativePoisonContribution(
  world: World,
  targetId: number,
  marks: StatusMarksComponent,
): object {
  const before = statusMarkSnapshot(marks, StatusMark.PoisonMark);
  if (!before || world.getComponent(targetId, COMPONENT.StatusMarks) !== marks)
    throw new Error("demon_hunter_poison_mark_unavailable");
  const scope = Object.freeze({});
  contributions.set(scope, { world, targetId, marks, before, committed: null, sealed: false });
  return scope;
}
/** Does not add a mark. A source must be tied to the one actual native mark write. */
export function commitNativePoisonContribution(scope: object): void {
  const c = contributions.get(scope),
    after = c && statusMarkSnapshot(c.marks, StatusMark.PoisonMark);
  if (
    !c ||
    c.committed ||
    c.sealed ||
    !after ||
    !after.present ||
    after.revision !== c.before.revision + 1 ||
    c.world.getComponent(c.targetId, COMPONENT.StatusMarks) !== c.marks
  )
    throw new Error("demon_hunter_poison_mark_commit_invalid");
  c.committed = after;
}
export interface NativePoisonContributions {
  readonly native: boolean;
  readonly unknown: boolean;
}
/** Seal before DamageResolution clears marks; later native stock/life qualification does not erase unknown toxins. */
export function sealNativePoisonContribution(scope: object): Readonly<NativePoisonContributions> {
  const c = contributions.get(scope);
  if (!c || !c.committed || c.sealed) throw new Error("demon_hunter_poison_mark_seal_invalid");
  const current = c.world.getComponent(c.targetId, COMPONENT.StatusMarks),
    snapshot = statusMarkSnapshot(current, StatusMark.PoisonMark);
  if (!snapshot) throw new Error("demon_hunter_poison_mark_unavailable");
  const native =
    current === c.marks && snapshot.present && snapshot.revision === c.committed.revision;
  const unknown = snapshot.present && (!native || c.before.present);
  c.sealed = true;
  return Object.freeze({ native, unknown });
}
