/**
 * 负责杠精辩论窗口、一次提交登记及原生命绑定的禁票处罚。输入为原参与者和已校验选择，
 * 输出为窗口、提交及处罚查询；参与者捕获／复验归中立数据所有者，不在此复制其政策。
 * 不变量：关闭仅退休同一窗口；原已提交选择不退款，处罚仍在实际查询时按原生命版本失效。
 */
import { COMPONENT, type World, type DebatePenaltyComponent } from "../../domain";
import { captureNightLife, livingNightLife, type NightLifeScope } from "../../domain/night-effects";

import type { OriginalParticipant as DebateParticipant } from "../../domain/original-participant";

export interface DebateAuthority {
  id: string;
  day: number;
  actorId: number;
  targetId: number;
  stage: "challenge" | "speech" | "ballot";
  participants: ReadonlyMap<number, DebateParticipant>;
}
const active = new WeakMap<World, DebateAuthority>();
export function hasActiveDebate(world: World): boolean {
  return active.has(world);
}
const sequences = new WeakMap<World, number>();
export function nextDebateId(world: World, day: number, actorId: number, targetId: number): string {
  if (active.has(world)) throw new Error("debate_window_reentry");
  const sequence = (sequences.get(world) ?? 0) + 1;
  sequences.set(world, sequence);
  return `debate:${day}:${actorId}:${targetId}:${sequence}`;
}
const commits = new WeakMap<World, Set<number>>();
const penalties = new WeakMap<
  World,
  Map<number, { record: DebatePenaltyComponent; life: NightLifeScope }>
>();
export function openDebate(world: World, authority: DebateAuthority): void {
  if (active.has(world)) throw new Error("debate_window_reentry");
  active.set(world, authority);
}
export function closeDebate(world: World, authority: DebateAuthority): void {
  if (active.get(world) === authority) active.delete(world);
}
export function debateAuthority(world: World, token: string | undefined): DebateAuthority | null {
  const a = active.get(world);
  return a && a.id === token ? a : null;
}
export function hasDebateCommit(world: World, id: number): boolean {
  return commits.get(world)?.has(id) === true;
}
export function commitDebate(world: World, id: number): void {
  if (hasDebateCommit(world, id)) throw new Error("debate_already_committed");
  let ids = commits.get(world);
  if (!ids) {
    ids = new Set();
    commits.set(world, ids);
  }
  ids.add(id);
}
export function blockDebateVote(world: World, id: number, sourceId: number, day: number): void {
  const life = captureNightLife(world, id);
  if (!life) return;
  const record: DebatePenaltyComponent = { day, sourceId, lifeVersion: life.version };
  let entries = penalties.get(world);
  if (!entries) {
    entries = new Map();
    penalties.set(world, entries);
  }
  entries.set(id, { record, life });
  world.addComponent(id, COMPONENT.DebatePenalty, record);
}
export function debateVoteBlocked(world: World, id: number, day: number | undefined): boolean {
  const b = penalties.get(world)?.get(id);
  return (
    !!b &&
    (day === undefined || b.record.day === day) &&
    world.getComponent(id, COMPONENT.DebatePenalty) === b.record &&
    livingNightLife(world, b.life)
  );
}
