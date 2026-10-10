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
  sealedMarks: StatusMarksComponent | null;
  sealedRevision: number | null;
}
const contributions = new WeakMap<object, Contribution>();
/** Capture immediately before the trusted native guard stage's single add(GuardMark). */
export function openNativeGuardContribution(
  world: World,
  targetId: number,
  marks: StatusMarksComponent,
): object {
  const before = statusMarkSnapshot(marks, StatusMark.GuardMark);
  if (!before || world.getComponent(targetId, COMPONENT.StatusMarks) !== marks)
    throw new Error("demon_hunter_guard_mark_unavailable");
  const scope = Object.freeze({});
  contributions.set(scope, {
    world,
    targetId,
    marks,
    before,
    committed: null,
    sealed: false,
    sealedMarks: null,
    sealedRevision: null,
  });
  return scope;
}
/** Does not add a mark. A source must be tied to the one actual native mark write. */
export function commitNativeGuardContribution(scope: object): void {
  const c = contributions.get(scope),
    after = c && statusMarkSnapshot(c.marks, StatusMark.GuardMark);
  if (
    !c ||
    c.committed ||
    c.sealed ||
    !after ||
    !after.present ||
    after.revision !== c.before.revision + 1 ||
    c.world.getComponent(c.targetId, COMPONENT.StatusMarks) !== c.marks
  )
    throw new Error("demon_hunter_guard_mark_commit_invalid");
  c.committed = after;
}
export interface NativeGuardContributions {
  readonly native: boolean;
  readonly unknown: boolean;
}
/** Seal before DamageResolution clears marks; later native stock/life qualification does not erase unknown guards. */
export function sealNativeGuardContribution(scope: object): Readonly<NativeGuardContributions> {
  const c = contributions.get(scope);
  if (!c || !c.committed || c.sealed) throw new Error("demon_hunter_guard_mark_seal_invalid");
  const current = c.world.getComponent(c.targetId, COMPONENT.StatusMarks),
    snapshot = statusMarkSnapshot(current, StatusMark.GuardMark);
  if (!snapshot) throw new Error("demon_hunter_guard_mark_unavailable");
  const native =
    current === c.marks && snapshot.present && snapshot.revision === c.committed.revision;
  const unknown = snapshot.present && (!native || c.before.present);
  c.sealed = true;
  c.sealedMarks = current as StatusMarksComponent;
  c.sealedRevision = snapshot.revision;
  return Object.freeze({ native, unknown });
}

/** The real pipeline consumes sealed marks synchronously. Any later present write is a new unknown contribution. */
export function lateUnknownGuardContribution(scope: object): boolean {
  const c = contributions.get(scope);
  if (!c || !c.sealed) throw new Error("demon_hunter_guard_mark_not_sealed");
  const marks = c.world.getComponent(c.targetId, COMPONENT.StatusMarks);
  if (!marks) return false;
  const snapshot = statusMarkSnapshot(marks, StatusMark.GuardMark);
  if (!snapshot) throw new Error("demon_hunter_guard_mark_unavailable");
  return snapshot.present && (marks !== c.sealedMarks || snapshot.revision !== c.sealedRevision);
}
