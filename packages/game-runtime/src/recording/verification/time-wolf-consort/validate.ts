/**
 * 负责独立审核蚀时狼妃的锁定、触发与反射证据。输入为归档配置、决定、事实与 checkpoint；
 * 输出为原一致性结果或明确拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import { isTimeConsortPreset } from "../board-support";
import {
  readTimeConsortChoiceFact,
  readTimeConsortSkipFact,
  readTimeConsortReflectionFact,
  type TimeConsortReflectionFact,
} from "@ai-werewolf-arena/game-contract/facts/time-wolf-consort";
import { Camp, Role, Phase } from "@ai-werewolf-arena/game-contract";
import type { ReproductionRecord } from "../../reproduction/format";
const choice = "time_consort_lock_committed",
  skip = "time_consort_lock_skipped",
  reflection = "time_consort_reflected";
function check(v: unknown): asserts v {
  if (!v) throw new Error("reproduction_time_consort_invalid");
}
function equal(a: unknown, b: unknown): boolean {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, stable(x)]),
          )
        : v;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
export function validateTimeConsortRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard,
    owns = board.roleSetups.some((r) => r.role === Role.TimeWolfConsort && r.count > 0);
  const artifacts =
    record.events.some((e) => [choice, skip, reflection].includes(e.type)) ||
    record.decisions.some(
      (d) =>
        d.stage === "time_consort_lock" ||
        d.request.allowedTools.includes("lock_time") ||
        d.request.context.consort_candidates !== undefined,
    ) ||
    record.checkpoints.some((c) =>
      c.players.some((p) => Object.hasOwn(p.privateState, "timeConsort")),
    );
  if (!owns) {
    check(
      !board.timeConsort &&
        !artifacts &&
        !record.metadata.players.some((p) => p.role === Role.TimeWolfConsort),
    );
    return;
  }
  check(isTimeConsortPreset(board) && !record.metadata.faultPlan && !record.metadata.initialDeal);
  const config = board.timeConsort!,
    original = new Map(record.metadata.players.map((p) => [p.id, p])),
    actors = record.metadata.players.filter((p) => p.role === Role.TimeWolfConsort);
  check(original.size === 12 && actors.length === 1 && actors[0]!.camp === Camp.Wolf);
  const actor = actors[0]!.id,
    alive = new Set(original.keys()),
    history: Array<{ day: number; targetId: number | null }> = [];
  let triggeredDay: number | null = null,
    day = 1,
    phase: Phase = Phase.Night,
    pending: TimeConsortReflectionFact | null = null;
  const choices = new Map<number, number | null>(),
    skipped = new Set<number>(),
    resolved = new Set<number>(),
    seen = new Set<string>(),
    nightAlive = new Map<number, number[]>([[1, [...alive]]]);
  const prefixes: Array<{
      history: Array<{ day: number; targetId: number | null }>;
      triggeredDay: number | null;
    }> = [{ history: structuredClone(history), triggeredDay }],
    living = [[...alive]];

  type GoodAbility = {
    id: string;
    kind: string;
    source: { kind: "native"; role: Role };
    state: Record<string, unknown>;
    sourceDisclosed: boolean;
    startsOnDay: number;
    maxUses: null;
    uses: number;
    lastUsedDay: number | null;
    disabled: boolean;
  };
  const good = new Map<number, GoodAbility>();
  for (const [id, p] of original) {
    const kind =
      p.role === Role.Guard
        ? "guard"
        : p.role === Role.Seer
          ? "seer_check"
          : p.role === Role.Witch
            ? "potion"
            : null;
    if (!kind) continue;
    const state: Record<string, unknown> =
      kind === "guard"
        ? { lastTarget: null }
        : kind === "seer_check"
          ? { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] }
          : {
              heal: 1,
              poison: 1,
              selfHealRule: "disabled",
              canSelfHeal: false,
              healUsedThisNight: false,
              poisonUsedThisNight: false,
            };
    good.set(id, {
      id: "native:" + kind,
      kind,
      source: { kind: "native", role: p.role },
      state,
      sourceDisclosed: true,
      startsOnDay: 1,
      maxUses: null,
      uses: 0,
      lastUsedDay: null,
      disabled: false,
    });
  }
  const goodPrefixes = [structuredClone(good)];
  const nightEffects = new Map<
    number,
    {
      guard: Set<number>;
      heal: Set<number>;
      poison: Set<number>;
      votes: Map<number, number | null>;
    }
  >();
  const effects = () => {
    let value = nightEffects.get(day);
    if (!value) {
      value = { guard: new Set(), heal: new Set(), poison: new Set(), votes: new Map() };
      nightEffects.set(day, value);
    }
    return value;
  };

  const targets = (n: number, lives: readonly number[]) => {
    const previous = history.filter((h) => h.day < n).at(-1);
    return lives.filter((id) => previous?.day !== n - 1 || previous.targetId !== id);
  };
  const expectedRole = (kind: string) =>
    kind === "guard" ? Role.Guard : kind === "check" ? Role.Seer : Role.Witch;
  const reflectable = (source: number, raw: number, kind: string) =>
    ["guard", "check", "poison"].includes(kind) &&
    original.get(source)?.camp === Camp.Good &&
    choices.get(day) === raw &&
    (triggeredDay === null || (triggeredDay === day && config.reflectionScope === "whole_night"));
  for (let i = 0; i < record.events.length; i++) {
    const e = record.events[i]!;
    if (e.type === "phase_changed") {
      check(!pending);
      day = Number(e.payload.day);
      phase = e.payload.phase as Phase;
      if (phase === Phase.Night) nightAlive.set(day, [...alive]);
    }
    if (e.type === choice || e.type === skip) {
      check(
        phase === Phase.Night &&
          !choices.has(day) &&
          !skipped.has(day) &&
          !resolved.has(day) &&
          equal(e.audience, [actor]),
      );
      if (e.type === skip) {
        const f = readTimeConsortSkipFact(e.type, e.payload);
        check(f && f.actorId === actor && f.day === day);
        check(
          f.reason === "dead"
            ? !alive.has(actor)
            : alive.has(actor) && triggeredDay !== null && triggeredDay < day,
        );
        check(!record.decisions.some((d) => d.day === day && d.stage === "time_consort_lock"));
        skipped.add(day);
      } else {
        const f = readTimeConsortChoiceFact(e.type, e.payload);
        check(
          f && f.actorId === actor && f.day === day && alive.has(actor) && triggeredDay === null,
        );
        const candidates = targets(day, [...alive]);
        check(candidates.length > 0 && (f.targetId === null || candidates.includes(f.targetId)));
        const ds = record.decisions.filter((d) => d.day === day && d.stage === "time_consort_lock");
        check(ds.length === 1);
        const d = ds[0]!;
        check(
          d.actorId === actor &&
            d.request.actorId === actor &&
            d.request.phase === Phase.Night &&
            d.request.context.day === day &&
            d.request.context.stage === d.stage,
        );
        check(
          d.request.context.action_failure_policy === "error" &&
            d.request.context.allow_fallback === false &&
            equal(d.request.allowedTools, ["lock_time"]) &&
            equal(d.request.context.consort_candidates, candidates),
        );
        check(d.outcome.kind === "action" && d.outcome.action?.name === "lock_time");
        const a = d.outcome.action.args;
        check(
          a.abstain
            ? a.target_id === null && f.targetId === null
            : a.target_id !== null && a.target_id === f.targetId,
        );
        history.push({ day, targetId: f.targetId });
        choices.set(day, f.targetId);
      }
    }
    if (e.type === choice || e.type === skip) {
      for (const [id, a] of good)
        if (a.kind === "potion" && alive.has(id)) {
          a.state.healUsedThisNight = false;
          a.state.poisonUsedThisNight = false;
        }
    }
    // 反射事实先成为待匹配证据；后续对应原生效果必须核源、请求号码和技能种类，
    // 该事实不代替后续对应技能结果的核验，阶段切换／夜结算／归档尾部均不允许残留 pending。
    if (e.type === reflection) {
      const f = readTimeConsortReflectionFact(e.type, e.payload);
      check(
        f &&
          !pending &&
          phase === Phase.Night &&
          f.day === day &&
          f.actorId === actor &&
          !resolved.has(day) &&
          equal(e.audience, []),
      );
      check(
        original.get(f.sourceId)?.role === expectedRole(f.kind) &&
          alive.has(f.sourceId) &&
          alive.has(f.requestedId) &&
          reflectable(f.sourceId, f.requestedId, f.kind),
      );
      pending = f;
      triggeredDay = day;
    }
    const kind =
      e.type === "guard_applied"
        ? "guard"
        : e.type === "seer_checked"
          ? "check"
          : e.type === "witch_potion_used"
            ? e.payload.potionType
            : e.type === "witch_potion_skipped"
              ? "none"
              : null;
    if (kind !== null) {
      check(
        typeof kind === "string" && ["guard", "check", "heal", "poison", "none"].includes(kind),
      );
      const source = e.payload.actorId,
        raw = e.payload.targetId;
      check(
        typeof source === "number" &&
          original.get(source)?.role === expectedRole(kind) &&
          alive.has(source) &&
          phase === Phase.Night &&
          !resolved.has(day) &&
          (choices.has(day) || skipped.has(day)) &&
          e.payload.abilityId === undefined,
      );
      const stage = kind === "guard" ? "guard" : kind === "check" ? "seer" : "witch",
        key = day + ":" + stage;
      check(!seen.has(key));
      seen.add(key);
      const ds = record.decisions.filter(
        (d) => d.day === day && d.actorId === source && d.stage === stage,
      );
      check(ds.length === 1);
      const d = ds[0]!;
      check(d.outcome.kind === "action" && d.outcome.action);
      const a = d.outcome.action;
      if (kind === "guard")
        check(
          a.name === "guard" && a.args.target_id === raw && a.args.abstain === e.payload.abstain,
        );
      else if (kind === "check") check(a.name === "check_identity" && a.args.target_id === raw);
      else
        check(a.name === "use_potion" && a.args.potion_type === kind && a.args.target_id === raw);
      const used = kind !== "none" && !(kind === "guard" && e.payload.abstain === true);
      let effective = raw;
      if (used) {
        check(typeof raw === "number" && alive.has(raw));
        if (pending) {
          check(
            pending.sourceId === source && pending.requestedId === raw && pending.kind === kind,
          );
          effective = pending.effectiveId;
          pending = null;
        } else check(!reflectable(source, raw, kind));
      } else check(!pending);
      if (kind === "check") {
        check(typeof effective === "number");
        check(e.payload.isWerewolf === (original.get(effective)?.camp === Camp.Wolf));
        const result = e.payload.result as Record<string, unknown> | undefined;
        check(result && result.kind === "camp" && result.camp === original.get(effective)?.camp);
      }
      if (used && (kind === "guard" || kind === "heal" || kind === "poison")) {
        check(typeof effective === "number");
        effects()[kind].add(effective);
      }
      const ability = good.get(source);
      check(ability);
      ability.lastUsedDay = day;
      if (used) ability.uses++;
      if (kind === "guard") ability.state.lastTarget = raw;
      if (kind === "check") {
        const result = structuredClone(e.payload.result),
          isWerewolf = e.payload.isWerewolf;
        ability.state.lastTarget = raw;
        ability.state.lastIsWerewolf = isWerewolf;
        ability.state.lastResult = result;
        (ability.state.history as unknown[]).push({ targetId: raw, isWerewolf, result });
      }
      if (kind === "heal" || kind === "poison") {
        const remaining = ability.state[kind];
        check(typeof remaining === "number" && remaining > 0);
        ability.state[kind] = remaining - 1;
        ability.state[kind === "heal" ? "healUsedThisNight" : "poisonUsedThisNight"] = true;
      }
    }
    if (e.type === "wolf_kill_vote_cast") {
      check(phase === Phase.Night && !resolved.has(day) && (choices.has(day) || skipped.has(day)));
      const actorId = e.payload.actorId,
        target = e.payload.targetId,
        abstain = e.payload.abstain,
        night = effects();
      check(
        typeof actorId === "number" &&
          alive.has(actorId) &&
          original.get(actorId)?.camp === Camp.Wolf &&
          !night.votes.has(actorId),
      );
      check(
        typeof abstain === "boolean" &&
          (abstain ? target === null : typeof target === "number" && alive.has(target)),
      );
      const ds = record.decisions.filter(
        (d) => d.day === day && d.actorId === actorId && d.stage === "wolf_vote",
      );
      check(ds.length >= 1 && ds.length <= 4 && ds.every((d) => d.outcome.kind !== "error"));
      const d = ds.at(-1)!,
        action = d.outcome.kind === "action" ? d.outcome.action : null;
      const matches =
        action?.name === "kill_vote" &&
        action.args.target_id === target &&
        action.args.abstain === abstain;
      check(
        matches || (ds.length === 4 && e.payload.fallback === true && abstain && target === null),
      );
      check(ds.length === 1 ? e.payload.fallback === undefined : e.payload.fallback === true);
      night.votes.set(actorId, abstain ? null : (target as number));
    }
    if (e.type === "night_resolved") {
      check(
        !pending &&
          phase === Phase.Day &&
          !resolved.has(day) &&
          (choices.has(day) || skipped.has(day)),
      );
      for (const [id, p] of original)
        if (alive.has(id)) {
          const stage =
            p.role === Role.Guard
              ? "guard"
              : p.role === Role.Seer
                ? "seer"
                : p.role === Role.Witch
                  ? "witch"
                  : null;
          if (stage) check(seen.has(day + ":" + stage));
        }
      const night = effects(),
        atStart = nightAlive.get(day);
      check(atStart);
      for (const id of atStart)
        if (original.get(id)?.camp === Camp.Wolf) check(night.votes.has(id));
      const tally = new Map<number, number>();
      for (const target of night.votes.values())
        if (target !== null) tally.set(target, (tally.get(target) ?? 0) + 1);
      const wolfTarget = [...tally].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
      const expected = atStart
        .filter(
          (id) =>
            night.poison.has(id) ||
            (id === wolfTarget && night.guard.has(id) === night.heal.has(id)),
        )
        .sort((a, b) => a - b);
      check(
        Array.isArray(e.payload.deaths) &&
          e.payload.deaths.every((id) => typeof id === "number" && original.has(id)),
      );
      const actual = e.payload.deaths as number[];
      check(
        new Set(actual).size === actual.length &&
          equal(
            [...actual].sort((a, b) => a - b),
            expected,
          ),
      );
      for (const id of actual) alive.delete(id);
      resolved.add(day);
    }
    if (e.type === "voted_out") {
      const id = e.payload.target;
      check(typeof id === "number" && alive.has(id));
      alive.delete(id);
    }
    if (e.type === "wolf_self_destruct") {
      const id = e.payload.wolfId;
      check(typeof id === "number" && original.get(id)?.camp === Camp.Wolf && alive.has(id));
      alive.delete(id);
    }
    // 锁定历史、触发日、存活与原生库存各保存事件前缀，随后按 checkpoint 的
    // eventCount 验收；这里重建纯归档账本，不读 live World 或恢复旧许可。
    prefixes.push({ history: structuredClone(history), triggeredDay });
    living.push([...alive]);
    goodPrefixes.push(structuredClone(good));
  }
  check(!pending);
  const cycle = Math.max(0, ...record.checkpoints.map((c) => c.cycle));
  for (const d of record.decisions) {
    if (!record.finalized && d.day > cycle) continue;
    const rank =
      d.request.phase !== Phase.Night
        ? 1000
        : ((
            {
              time_consort_lock: 50,
              guard: 300,
              wolf_discussion: 200,
              wolf_vote: 400,
              witch: 500,
              seer: 600,
            } as Record<string, number>
          )[d.stage] ?? -1);
    if (rank > 50) check(choices.has(d.day) || skipped.has(d.day));
    for (const id of nightAlive.get(d.day) ?? []) {
      const role = original.get(id)?.role,
        stage =
          role === Role.Guard
            ? "guard"
            : role === Role.Witch
              ? "witch"
              : role === Role.Seer
                ? "seer"
                : null;
      const before = stage === "guard" ? 300 : stage === "witch" ? 500 : 600;
      if (stage && rank > before) check(seen.has(d.day + ":" + stage));
    }
    if (d.stage === "time_consort_lock") {
      const lives = nightAlive.get(d.day);
      check(
        lives &&
          lives.includes(actor) &&
          d.actorId === actor &&
          d.request.phase === Phase.Night &&
          equal(d.request.context.consort_candidates, targets(d.day, lives)),
      );
      if (record.checkpoints.some((c) => c.cycle >= d.day && c.complete)) check(choices.has(d.day));
    } else check(d.request.context.consort_candidates === undefined);
    for (const e of d.request.context.visible_events) {
      check(e.type !== reflection);
      if (e.type === choice || e.type === skip) {
        check(
          d.actorId === actor &&
            Number(e.payload.day) <= d.day &&
            !(d.stage === "time_consort_lock" && Number(e.payload.day) === d.day) &&
            record.events.some(
              (source) => source.type === e.type && equal(source.payload, e.payload),
            ),
        );
      }
    }
  }
  for (const cp of record.checkpoints) {
    check(cp.eventCount >= 0 && cp.eventCount < prefixes.length);
    if (cp.complete && cp.cycle > 0) check(resolved.has(cp.cycle));
    const players = new Map(cp.players.map((p) => [p.id, p]));
    check(players.size === original.size);
    for (const [id, initial] of original) {
      const p = players.get(id);
      check(
        p &&
          p.role === initial.role &&
          p.camp === initial.camp &&
          p.name === initial.name &&
          p.alive === living[cp.eventCount]!.includes(id),
      );
      if (id === actor)
        check(
          equal(p.privateState, {
            timeConsort: {
              policy: config.policy,
              reflectionScope: config.reflectionScope,
              ...prefixes[cp.eventCount],
            },
          }),
        );
      else check(!Object.hasOwn(p.privateState, "timeConsort"));
      const ability = goodPrefixes[cp.eventCount]!.get(id);
      if (ability) check(equal(p.privateState, { abilities: { [ability.id]: ability } }));
    }
  }
}
