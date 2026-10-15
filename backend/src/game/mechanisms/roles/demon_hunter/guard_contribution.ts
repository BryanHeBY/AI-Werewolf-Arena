/**
 * 负责追踪原生守卫一次真实标记写入的贡献回执。输入为原 World、目标和 StatusMarks；
 * 输出为不透明 scope、native／unknown 封存结果及后续未知写查询。捕获、提交、封存各保原组件和 revision 规则，
 * 不替调用方 add 标记，也不把未知保护误归原生来源；异常不回滚此前付款或标记。
 */
import { COMPONENT, StatusMark, type World } from "../../../../domain";
import {
  statusMarkSnapshot,
  type StatusMarksComponent,
  type StatusMarkSnapshot,
} from "../../../../domain/components/status-marks";
/** 私有回执固定原组件／写前 revision，提交后记录写后快照，封存再固定当时组件和 revision。 */
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
/** 在可信原生守卫阶段那一次 add(GuardMark) 前立即捕获组件和标记快照。 */
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
/** 不添加标记；只接纳同组件、实际新增一次 revision 且标记 present 的贡献。 */
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
/** 在伤害结算清标记之前封存；原已有或新增未知守护不能因后续原生库存／生命撤权而被抹去。 */
export function sealNativeGuardContribution(scope: object): Readonly<NativeGuardContributions> {
  const c = contributions.get(scope);
  if (!c || !c.committed || c.sealed) throw new Error("demon_hunter_guard_mark_seal_invalid");
  const current = c.world.getComponent(c.targetId, COMPONENT.StatusMarks),
    snapshot = statusMarkSnapshot(current, StatusMark.GuardMark);
  if (!snapshot) throw new Error("demon_hunter_guard_mark_unavailable");
  const native =
    current === c.marks && snapshot.present && snapshot.revision === c.committed.revision;
  // 旧标记已 present 时，即使这次原生写匹配，也必须同时保 unknown，避免吞掉其他来源。
  const unknown = snapshot.present && (!native || c.before.present);
  c.sealed = true;
  c.sealedMarks = current as StatusMarksComponent;
  c.sealedRevision = snapshot.revision;
  return Object.freeze({ native, unknown });
}

/** 真实管线同步消费已封存标记；封存后仍 present 且组件／revision 已变的写视为新未知贡献。 */
export function lateUnknownGuardContribution(scope: object): boolean {
  const c = contributions.get(scope);
  if (!c || !c.sealed) throw new Error("demon_hunter_guard_mark_not_sealed");
  const marks = c.world.getComponent(c.targetId, COMPONENT.StatusMarks);
  if (!marks) return false;
  const snapshot = statusMarkSnapshot(marks, StatusMark.GuardMark);
  if (!snapshot) throw new Error("demon_hunter_guard_mark_unavailable");
  return snapshot.present && (marks !== c.sealedMarks || snapshot.revision !== c.sealedRevision);
}
