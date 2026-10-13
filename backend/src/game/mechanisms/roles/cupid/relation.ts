/**
 * 负责恋人原生命绑定、已授权关系查询及殉情死亡闭包。输入为原 World、关系记录、死因与梦效果句柄；
 * 输出为仍当前的关系、追加死因和逐关联去重的事件，bindings 唯一持有关系及 emitted 前缀。
 * 殉情保原独立根／来源规则，梦关系通过运行接口在原时点参与闭包；不复制效果、不标死或判胜。
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import type { LoversComponent } from "../../../../core/domain/components/lovers";
import type { World } from "../../../../core/domain/world";
import type { NightLifeScope } from "../../../../core/domain/night_effects";
import {
  DeathCause,
  type DeathSources,
  type EntityId,
  type GameEvent,
} from "../../../../core/domain/model";
import type { DreamNightEffects } from "../../../../core/domain/dream-night-effects";

interface Binding {
  record: LoversComponent;
  lives: readonly [NightLifeScope, NightLifeScope];
  emitted: Set<string>;
}
const bindings = new WeakMap<World, Binding>();
export function bindLovers(
  world: World,
  record: LoversComponent,
  lives: readonly [NightLifeScope, NightLifeScope],
): void {
  if (bindings.has(world)) throw new Error("cupid_relation_already_committed");
  world.addComponent(record.actorId, COMPONENT.Lovers, record);
  bindings.set(world, { record, lives, emitted: new Set() });
}
export function hasCupidNightCommit(world: World, day: number): boolean {
  return day === 1 && bindings.has(world);
}
export function projectLover(world: World, actorId: EntityId) {
  const binding = bindings.get(world),
    record = loversRecord(world);
  const life = binding?.lives.find((scope) => scope.id === actorId);
  return record && life && binding!.lives.every((scope) => sameBody(world, scope))
    ? {
        partnerId: record.pairIds.find((id) => id !== actorId)!,
        mayNotVotePartner: record.policy === "lui_meme_lovers_only_v1",
      }
    : null;
}
export function loversRecord(world: World): LoversComponent | null {
  const binding = bindings.get(world);
  return binding && world.getComponent(binding.record.actorId, COMPONENT.Lovers) === binding.record
    ? binding.record
    : null;
}
function sameBody(world: World, scope: NightLifeScope): boolean {
  return (
    world.getComponent(scope.id, COMPONENT.Alive) === scope.life &&
    aliveLifeVersion(scope.life) === scope.version + (scope.life.alive ? 0 : 1)
  );
}
export function livingOriginalLovers(world: World): boolean {
  const binding = bindings.get(world);
  return (
    !!loversRecord(world) &&
    !!binding?.lives.every((scope) => sameBody(world, scope) && scope.life.alive)
  );
}
export function prohibitsLoversVote(world: World, actor: EntityId, target: EntityId): boolean {
  const binding = bindings.get(world),
    record = loversRecord(world);
  return (
    !!record &&
    record.policy === "lui_meme_lovers_only_v1" &&
    !!binding?.lives.every((scope) => sameBody(world, scope) && scope.life.alive) &&
    record.pairIds.includes(actor) &&
    record.pairIds.includes(target) &&
    actor !== target
  );
}
/** 在枪／遗言／死亡钩子前展开外部死因波；殉情不作为独立根去抑制原来源。
 * 已付摄梦关系可追加独立根，闭包仍以原 ID／死因为界；运行梦接口不复制或重新支付效果。 */
export function expandLoversWave(
  world: World,
  ids: EntityId[],
  sources: DeathSources,
  events: GameEvent[],
  nightOrigin: Set<EntityId>,
  eligibleDead: ReadonlySet<EntityId>,
  dreams?: DreamNightEffects,
): EntityId[] {
  if (!loversRecord(world)) return [];
  const before = new Set(ids),
    members = new Set(ids),
    roots = new Set(ids);
  const binding = bindings.get(world),
    record = loversRecord(world);
  const expandedRoots = new Set<EntityId>();
  let changed = true;
  while (changed) {
    changed = false;
    if (record && binding && binding.lives.every((scope) => sameBody(world, scope))) {
      const independentPair = record.pairIds.every((id) => roots.has(id));
      for (const root of record.pairIds) {
        if (!roots.has(root) || expandedRoots.has(root)) continue;
        expandedRoots.add(root);
        const target = record.pairIds.find((id) => id !== root)!;
        const targetLife = binding.lives.find((scope) => scope.id === target)!;
        if (!targetLife.life.alive && !members.has(target) && !eligibleDead.has(target)) continue;
        if (!members.has(target)) {
          members.add(target);
          ids.push(target);
          changed = true;
        }
        if (!roots.has(target) || independentPair) {
          if (!(sources[target] ?? []).includes(DeathCause.Lovers)) {
            sources[target] = [...(sources[target] ?? []), DeathCause.Lovers];
            changed = true;
          }
          if (nightOrigin.has(root)) nightOrigin.add(target);
          const key = `${root}:${target}`;
          if (!binding.emitted.has(key)) {
            binding.emitted.add(key);
            events.push({
              timestamp: Date.now(),
              type: "lovers_death",
              payload: { actorId: root, targetId: target },
            });
          }
        }
      }
    }
    if (dreams && nightOrigin.size) {
      for (const id of dreams.linkedDeaths(
        world,
        [...nightOrigin],
        new Set([...eligibleDead, ...members]),
      )) {
        if (!members.has(id)) {
          members.add(id);
          ids.push(id);
          changed = true;
        }
        if (!(sources[id] ?? []).includes(DeathCause.Dream)) {
          sources[id] = [...(sources[id] ?? []), DeathCause.Dream];
          changed = true;
        }
        if (!roots.has(id)) {
          roots.add(id);
          changed = true;
        }
        nightOrigin.add(id);
      }
    }
  }
  return ids.filter((id) => !before.has(id));
}
