/**
 * 负责独立审核白昼学者／寂夜导师选择、加成行动与冲突证据。输入为归档配置、决定、事实与 checkpoint；
 * 输出为原一致性结果或明确拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import { isScholarMentorPreset } from "../../board-support";
import {
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierConflictFact,
  readModifierBonusFact,
} from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
import { Camp, Role, Phase } from "@ai-werewolf-arena/game-contract";
import type { ReproductionRecord } from "../../../recording/reproduction";
function check(v: unknown): asserts v {
  if (!v) throw new Error("reproduction_scholar_mentor_invalid");
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
const eventNames = [
  "modifier_choice_committed",
  "modifier_choice_skipped",
  "modifier_conflict_resolved",
  "modifier_bonus_resolved",
];
type Night = {
  start: number[];
  choices: Set<number>;
  selections: CommittedModifier[];
  resolution: ModifierResolution | null;
  conflict: boolean;
  native: Map<string, number | null>;
  bonus: Set<number>;
  guard: Set<number>;
  heal: Set<number>;
  healActor: number | null;
  poison: Set<number>;
  extraKnife: Set<number>;
  votes: Map<number, number | null>;
  done: boolean;
};
export function validateScholarMentorRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard,
    owns = board.roleSetups.some(
      (p) => (p.role === Role.DayScholar || p.role === Role.NightMentor) && p.count > 0,
    );
  const artifacts =
    record.events.some((e) => eventNames.includes(e.type)) ||
    record.decisions.some(
      (d) =>
        d.stage === "scholar_mentor_choice" ||
        d.stage === "scholar_mentor_bonus" ||
        d.request.allowedTools.some((t) => t === "modify_skill" || t === "bonus_action") ||
        [
          "modifier_modes",
          "modifier_candidates",
          "modifier_bonus_kind",
          "modifier_bonus_candidates",
          "modifier_poison_blocked",
          "wolf_targets",
        ].some((k) => Object.hasOwn(d.request.context, k)),
    ) ||
    record.checkpoints.some((c) =>
      c.players.some((p) => Object.hasOwn(p.privateState, "scholarMentor")),
    );
  if (!owns) {
    check(!board.scholarMentor && !artifacts);
    return;
  }
  check(isScholarMentorPreset(board) && !record.metadata.faultPlan && !record.metadata.initialDeal);
  const expectedRoster = new Map<Role, number>([
    [Role.Wolf, 3],
    [Role.NightMentor, 1],
    [Role.Villager, 4],
    [Role.Seer, 1],
    [Role.Witch, 1],
    [Role.Guard, 1],
    [Role.DayScholar, 1],
  ]);
  check(record.metadata.players.length === 12);
  for (const [role, count] of expectedRoster)
    check(record.metadata.players.filter((p) => p.role === role).length === count);
  for (const p of record.metadata.players)
    check(
      expectedRoster.has(p.role) &&
        p.camp === (p.role === Role.Wolf || p.role === Role.NightMentor ? Camp.Wolf : Camp.Good),
    );
  const nightOperations = record.operations.filter(
    (o) => o.scope === "resolution" && o.op === "night_damage_resolved",
  );
  let nightOperationIndex = 0;
  const original = new Map(record.metadata.players.map((p) => [p.id, p]));
  check(original.size === 12);
  const casters = record.metadata.players.filter(
    (p) => p.role === Role.DayScholar || p.role === Role.NightMentor,
  );
  check(
    casters.length === 2 &&
      casters.some((p) => p.role === Role.DayScholar && p.camp === Camp.Good) &&
      casters.some((p) => p.role === Role.NightMentor && p.camp === Camp.Wolf),
  );
  const states = new Map<number, ModifierState>(
    casters.map((p) => [p.id, createModifierState(p.role as "day_scholar" | "night_mentor")]),
  );
  const alive = new Set(original.keys()),
    nights = new Map<number, Night>();
  let day = 1,
    phase = Phase.Night;
  const night = () => {
    let n = nights.get(day);
    if (!n) {
      n = {
        start: [...alive],
        choices: new Set(),
        selections: [],
        resolution: null,
        conflict: false,
        native: new Map(),
        bonus: new Set(),
        guard: new Set(),
        heal: new Set(),
        healActor: null,
        poison: new Set(),
        extraKnife: new Set(),
        votes: new Map(),
        done: false,
      };
      nights.set(day, n);
    }
    return n;
  };
  const resolution = () => {
    const n = night();
    check(n.choices.size === 2);
    if (!n.resolution)
      n.resolution = resolveModifiers(
        [...original.values()].map((p) => ({
          id: p.id,
          role: p.role,
          camp: p.camp === Camp.Wolf ? "wolf" : "good",
          alive: n.start.includes(p.id),
        })),
        n.selections,
      );
    return n.resolution;
  };
  const key = (actor: number, kind: string) => (kind === "kill" ? "pack:kill" : actor + ":" + kind);
  const knifeActors = (n: Night) =>
    n.start.filter(
      (id) =>
        original.get(id)!.role === Role.Wolf ||
        (original.get(id)!.role === Role.NightMentor &&
          n.start.filter((i) => original.get(i)!.camp === Camp.Wolf).length === 1),
    );
  const knifeTarget = (n: Night) => {
    const tally = new Map<number, number>();
    for (const t of n.votes.values()) if (t !== null) tally.set(t, (tally.get(t) ?? 0) + 1);
    return [...tally].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  };
  const ds = (actor: number, stage: string) =>
    record.decisions.filter((d) => d.day === day && d.actorId === actor && d.stage === stage);
  const action = (actor: number, stage: string) => {
    const rows = ds(actor, stage);
    check(rows.length === 1);
    const d = rows[0]!;
    check(d.outcome.kind === "action" && d.outcome.action);
    return { d, a: d.outcome.action };
  };
  type NativeAbility = {
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
  const good = new Map<number, NativeAbility>();
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
  const prefixes = [structuredClone(states)],
    living = [[...alive]];
  for (const e of record.events) {
    if (e.type === "phase_changed") {
      day = Number(e.payload.day);
      phase = e.payload.phase as Phase;
      if (phase === Phase.Night) night();
    }
    const n = night();
    if (e.type === "modifier_choice_committed" || e.type === "modifier_choice_skipped") {
      check(phase === Phase.Night && !n.done);
      const f =
        e.type === "modifier_choice_committed"
          ? readModifierChoiceFact(e.type, e.payload)
          : readModifierSkipFact(e.type, e.payload);
      check(
        f &&
          f.day === day &&
          states.has(f.actorId) &&
          !n.choices.has(f.actorId) &&
          equal(e.audience, [f.actorId]),
      );
      const state = states.get(f.actorId)!;
      if (e.type === "modifier_choice_skipped") {
        const skip = readModifierSkipFact(e.type, e.payload)!;
        const reason =
          day === 1
            ? "first_night"
            : !alive.has(f.actorId)
              ? "dead"
              : state.remaining.enhance === 0 && state.remaining.weaken === 0
                ? "exhausted"
                : null;
        check(skip.reason === reason && ds(f.actorId, "scholar_mentor_choice").length === 0);
      } else {
        const choice = readModifierChoiceFact(e.type, e.payload)!;
        check(day >= 2 && alive.has(f.actorId));
        const { d, a } = action(f.actorId, "scholar_mentor_choice");
        check(
          a.name === "modify_skill" &&
            a.args.mode === choice.mode &&
            a.args.target_id === choice.targetId,
        );
        check(
          d.request.phase === Phase.Night &&
            d.request.context.day === day &&
            d.request.context.action_failure_policy === "error" &&
            d.request.context.allow_fallback === false &&
            equal(d.request.allowedTools, ["modify_skill"]),
        );
        check(
          equal(d.request.context.modifier_candidates, [...alive]) &&
            equal(
              d.request.context.modifier_modes,
              (["enhance", "weaken"] as const).filter((m) => state.remaining[m] === 1),
            ),
        );
        states.set(f.actorId, selectModifier(state, day, choice.mode, choice.targetId, [...alive]));
        if (choice.mode !== null)
          n.selections.push({
            actorId: f.actorId,
            caster: state.caster,
            mode: choice.mode,
            targetId: choice.targetId!,
          });
      }
      n.choices.add(f.actorId);
    }
    if (e.type === "modifier_conflict_resolved") {
      const f = readModifierConflictFact(e.type, e.payload),
        r = resolution();
      check(
        f &&
          phase === Phase.Night &&
          !n.done &&
          !n.conflict &&
          f.day === day &&
          f.kind === r.conflict &&
          equal(r.pendingDeaths, [f.targetId]) &&
          equal(e.audience, []),
      );
      n.conflict = true;
    }
    const nativeKind =
      e.type === "guard_applied"
        ? "guard"
        : e.type === "seer_checked"
          ? "check"
          : e.type === "witch_potion_used"
            ? e.payload.potionType
            : e.type === "witch_potion_skipped"
              ? "none"
              : null;
    if (nativeKind !== null) {
      const r = resolution(),
        actor = e.payload.actorId,
        target = e.payload.targetId;
      check(
        typeof nativeKind === "string" &&
          ["guard", "check", "heal", "poison", "none"].includes(nativeKind) &&
          typeof actor === "number" &&
          alive.has(actor) &&
          phase === Phase.Night &&
          !n.done &&
          e.payload.abilityId === undefined,
      );
      const kind = nativeKind,
        role = kind === "guard" ? Role.Guard : kind === "check" ? Role.Seer : Role.Witch,
        stage = kind === "guard" ? "guard" : kind === "check" ? "seer" : "witch",
        k = key(actor, kind === "heal" || kind === "none" ? "poison" : kind);
      check(original.get(actor)?.role === role && !n.native.has(k));
      check(
        !r.goodEffects.some(
          (x) =>
            x.targetId === actor &&
            x.mode === "weaken" &&
            (kind === "guard" || kind === "check" || kind === "poison"),
        ),
      );
      const { a } = action(actor, stage);
      if (kind === "guard")
        check(
          a.name === "guard" && a.args.target_id === target && a.args.abstain === e.payload.abstain,
        );
      else if (kind === "check") check(a.name === "check_identity" && a.args.target_id === target);
      else
        check(
          a.name === "use_potion" && a.args.potion_type === kind && a.args.target_id === target,
        );
      const used = kind !== "none" && !(kind === "guard" && e.payload.abstain === true);
      if (used) check(typeof target === "number" && alive.has(target));
      if (kind === "check") {
        check(
          typeof target === "number" &&
            e.payload.isWerewolf === (original.get(target)?.camp === Camp.Wolf),
        );
      }
      if (used && (kind === "guard" || kind === "heal" || kind === "poison"))
        n[kind].add(target as number);
      const ability = good.get(actor);
      check(ability);
      if (kind === "guard") {
        check(target === null || target !== ability.state.lastTarget);
        ability.state.lastTarget = target;
      }
      if (kind === "check") {
        const result = e.payload.result as Record<string, unknown> | undefined;
        check(
          result && result.kind === "camp" && result.camp === original.get(target as number)?.camp,
        );
        ability.state.lastTarget = target;
        ability.state.lastIsWerewolf = e.payload.isWerewolf;
        ability.state.lastResult = structuredClone(result);
        (ability.state.history as unknown[]).push({
          targetId: target,
          isWerewolf: e.payload.isWerewolf,
          result: structuredClone(result),
        });
      }
      if (ability.kind === "potion") {
        ability.state.healUsedThisNight = false;
        ability.state.poisonUsedThisNight = false;
        if (kind === "heal" || kind === "poison") {
          const remaining = ability.state[kind];
          check(typeof remaining === "number" && remaining > 0);
          ability.state[kind] = remaining - 1;
          if (kind === "heal") n.healActor = actor;
          ability.state[kind === "heal" ? "healUsedThisNight" : "poisonUsedThisNight"] = true;
          if (kind === "heal")
            check(
              target !== actor && (target === knifeTarget(n) || n.extraKnife.has(target as number)),
            );
        }
      }
      ability.lastUsedDay = day;
      if (used) ability.uses++;
      n.native.set(k, kind === "none" || kind === "heal" ? null : used ? (target as number) : null);
    }
    if (e.type === "wolf_kill_vote_cast") {
      const r = resolution(),
        actor = e.payload.actorId,
        target = e.payload.targetId;
      check(
        phase === Phase.Night &&
          !n.done &&
          !r.blockWolfKnife &&
          typeof actor === "number" &&
          knifeActors(n).includes(actor) &&
          !n.votes.has(actor),
      );
      check(
        e.payload.abstain === true
          ? target === null
          : e.payload.abstain === false && typeof target === "number" && alive.has(target),
      );
      const rows = ds(actor, "wolf_vote");
      check(rows.length >= 1 && rows.length <= 4);
      const d = rows.at(-1)!,
        a = d.outcome.kind === "action" ? d.outcome.action : null;
      check(
        (a?.name === "kill_vote" &&
          a.args.target_id === target &&
          a.args.abstain === e.payload.abstain) ||
          (rows.length === 4 &&
            e.payload.fallback === true &&
            target === null &&
            e.payload.abstain === true),
      );
      n.votes.set(actor, target as number | null);
      if (n.votes.size === knifeActors(n).length) n.native.set("pack:kill", knifeTarget(n));
    }
    if (e.type === "modifier_bonus_resolved") {
      const f = readModifierBonusFact(e.type, e.payload),
        r = resolution();
      check(
        f &&
          phase === Phase.Night &&
          !n.done &&
          f.day === day &&
          alive.has(f.actorId) &&
          !n.bonus.has(f.actorId) &&
          equal(e.audience, [f.actorId]),
      );
      const expected =
        r.bonusKnifeActorId === f.actorId
          ? "kill"
          : r.goodEffects.find((x) => x.targetId === f.actorId && x.mode === "enhance")?.role;
      check(
        f.kind === (expected === "seer" ? "check" : expected === "witch" ? "poison" : expected),
      );
      const k = key(f.actorId, f.kind);
      check(n.native.has(k));
      const targets = [...alive].filter((id) => id !== n.native.get(k));
      check(f.targetId === null || targets.includes(f.targetId));
      const { d, a } = action(f.actorId, "scholar_mentor_bonus");
      check(
        a.name === "bonus_action" &&
          a.args.kind === f.kind &&
          a.args.target_id === f.targetId &&
          a.args.abstain === f.abstain,
      );
      check(
        d.request.phase === Phase.Night &&
          d.request.context.day === day &&
          d.request.context.action_failure_policy === "error" &&
          d.request.context.allow_fallback === false &&
          equal(d.request.allowedTools, ["bonus_action"]) &&
          d.request.context.modifier_bonus_kind === f.kind &&
          equal(d.request.context.modifier_bonus_candidates, targets),
      );
      if (f.targetId !== null) {
        if (f.kind === "check")
          check(f.isWerewolf === (original.get(f.targetId)?.camp === Camp.Wolf));
        else if (f.kind === "kill") n.extraKnife.add(f.targetId);
        else n[f.kind].add(f.targetId);
      }
      n.bonus.add(f.actorId);
    }
    if (e.type === "night_resolved") {
      const r = resolution();
      check(phase === Phase.Day && !n.done && n.conflict === (r.conflict !== null));
      for (const id of n.start) {
        const role = original.get(id)!.role,
          kind =
            role === Role.Seer
              ? "check"
              : role === Role.Guard
                ? "guard"
                : role === Role.Witch
                  ? "poison"
                  : null;
        if (
          kind &&
          !r.goodEffects.some((x) => x.targetId === id && x.mode === "weaken" && kind !== "poison")
        )
          check(n.native.has(key(id, kind)));
      }
      check(n.votes.size === (r.blockWolfKnife ? 0 : knifeActors(n).length));
      const grants = r.goodEffects.filter((x) => x.mode === "enhance").map((x) => x.targetId);
      if (r.bonusKnifeActorId !== null) grants.push(r.bonusKnifeActorId);
      check(
        equal(
          [...n.bonus].sort((a, b) => a - b),
          grants.sort((a, b) => a - b),
        ),
      );
      const knife = new Set(n.extraKnife),
        primary = knifeTarget(n);
      if (primary !== null) knife.add(primary);
      const expected = n.start
        .filter(
          (id) =>
            r.pendingDeaths.includes(id) ||
            n.poison.has(id) ||
            (knife.has(id) && n.guard.has(id) === n.heal.has(id)),
        )
        .sort((a, b) => a - b);
      check(Array.isArray(e.payload.deaths));
      const actual = e.payload.deaths as number[];
      check(
        new Set(actual).size === actual.length &&
          equal(
            [...actual].sort((a, b) => a - b),
            expected,
          ),
      );
      if (record.finalized) {
        // 只在 finalized 归档按顺序核对原夜伤害操作；expected 先由本地账本独立
        // 算出，不把该操作的 output 当作预期或复用生产伤害结算。
        const op = nightOperations[nightOperationIndex++];
        check(op && op.phase === Phase.Night && op.status === "ok" && op.output);
        check(
          Array.isArray(op.output.deaths) &&
            equal(
              [...op.output.deaths].sort((a, b) => Number(a) - Number(b)),
              expected,
            ),
        );
        const sources: Record<string, string[]> = {};
        for (const id of expected) {
          const causes: string[] = [];
          if (n.poison.has(id)) causes.push("poison");
          if (knife.has(id) && n.guard.has(id) === n.heal.has(id)) causes.push("wolf_kill");
          if (r.pendingDeaths.includes(id)) causes.push("ability");
          sources[id] = causes;
        }
        check(equal(op.output.death_sources, sources));
      }
      for (const id of actual) alive.delete(id);
      n.done = true;
    }
    if (e.type === "voted_out") {
      const id = e.payload.target;
      check(typeof id === "number" && alive.has(id));
      alive.delete(id);
    }
    if (e.type === "wolf_self_destruct") {
      const id = e.payload.wolfId;
      check(typeof id === "number" && original.get(id)?.role === Role.Wolf && alive.has(id));
      alive.delete(id);
    }
    // 选择／资源、存活和原生能力各留同一事件位置的独立前缀；先前已重建选择
    // 保留在对应历史前缀，checkpoint 按 eventCount 取对应历史而非最终态。
    prefixes.push(structuredClone(states));
    living.push([...alive]);
    goodPrefixes.push(structuredClone(good));
  }
  for (const cp of record.checkpoints) {
    check(cp.eventCount >= 0 && cp.eventCount < prefixes.length);
    if (cp.complete && cp.cycle > 0) check(nights.get(cp.cycle)?.done);
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
      const state = prefixes[cp.eventCount]!.get(id);
      if (state) check(equal(p.privateState, { scholarMentor: state }));
      else check(!Object.hasOwn(p.privateState, "scholarMentor"));
      const ability = structuredClone(goodPrefixes[cp.eventCount]!.get(id));
      if (ability) {
        if (
          ability.kind === "potion" &&
          ability.lastUsedDay !== cp.cycle &&
          record.decisions.some(
            (d) =>
              d.day === cp.cycle &&
              d.request.phase === Phase.Night &&
              d.stage !== "scholar_mentor_choice" &&
              nights.get(cp.cycle)?.start.includes(id),
          )
        ) {
          ability.state.healUsedThisNight = false;
          ability.state.poisonUsedThisNight = false;
        }
        check(equal(p.privateState, { abilities: { [ability.id]: ability } }));
      }
    }
  }
  const captured = record.decisions.filter(
    (d) => record.finalized || d.day <= Math.max(0, ...record.checkpoints.map((c) => c.cycle)),
  );
  if (record.finalized) check(nightOperationIndex === nightOperations.length);
  const nightTools: Readonly<Record<string, string>> = {
    scholar_mentor_choice: "modify_skill",
    wolf_discussion: "speak_to_wolves",
    guard: "guard",
    wolf_vote: "kill_vote",
    witch: "use_potion",
    seer: "check_identity",
    scholar_mentor_bonus: "bonus_action",
  };
  for (const d of captured) {
    check(
      original.has(d.actorId) &&
        d.request.actorId === d.actorId &&
        d.request.context.day === d.day &&
        d.request.context.stage === d.stage,
    );
    const expectedTool = nightTools[d.stage];
    if (expectedTool) {
      const constraints = d.request.context.turn_constraints;
      check(
        d.request.phase === Phase.Night &&
          equal(d.request.allowedTools, [expectedTool]) &&
          constraints.min_valid_actions === 1 &&
          constraints.max_valid_actions === 1 &&
          equal(constraints.required_any_tools, [expectedTool]) &&
          d.request.context.action_failure_policy === "error" &&
          d.request.context.allow_fallback === false,
      );
    }
    check(
      (d.stage === "scholar_mentor_choice") === (d.request.context.modifier_modes !== undefined),
    );
    check(
      (d.stage === "scholar_mentor_choice") ===
        (d.request.context.modifier_candidates !== undefined),
    );
    check(
      (d.stage === "scholar_mentor_bonus") ===
        (d.request.context.modifier_bonus_kind !== undefined),
    );
    check(
      (d.stage === "scholar_mentor_bonus") ===
        (d.request.context.modifier_bonus_candidates !== undefined),
    );
    if (d.stage !== "witch")
      check(
        d.request.context.modifier_poison_blocked === undefined &&
          d.request.context.wolf_targets === undefined,
      );
    const n = nights.get(d.day);
    check(n);
    if (expectedTool) {
      check(n.start.includes(d.actorId));
      if (d.stage !== "wolf_discussion")
        check(
          captured.filter(
            (row) => row.day === d.day && row.actorId === d.actorId && row.stage === d.stage,
          ).length === 1,
        );
    }
    if (d.stage === "scholar_mentor_choice") {
      const caster = states.get(d.actorId);
      check(caster && d.day >= 2);
      const prior = caster.history.filter((choice) => choice.day < d.day);
      const available = (["enhance", "weaken"] as const).filter(
        (mode) => !prior.some((choice) => choice.mode === mode),
      );
      check(available.length > 0 && equal(d.request.context.modifier_modes, available));
      check(equal(d.request.context.modifier_candidates, n.start));
    }
    const bonusRank = { guard: 350, kill: 450, poison: 550, check: 650 } as const;
    const rank =
      d.request.phase !== Phase.Night
        ? 1000
        : d.stage === "scholar_mentor_bonus"
          ? bonusRank[d.request.context.modifier_bonus_kind!]
          : ((
              {
                scholar_mentor_choice: 50,
                wolf_discussion: 200,
                guard: 300,
                wolf_vote: 400,
                witch: 500,
                seer: 600,
              } as Record<string, number>
            )[d.stage] ?? -1);
    for (const previous of record.decisions.filter(
      (p) =>
        p.day === d.day &&
        p.stage === "scholar_mentor_choice" &&
        p.settleOrder !== undefined &&
        p.settleOrder <= d.openedAfterSettlement,
    ))
      check(n.choices.has(previous.actorId));
    if (rank <= 50) continue;
    check(n.choices.size === 2);
    const r =
      n.resolution ??
      resolveModifiers(
        [...original.values()].map((p) => ({
          id: p.id,
          role: p.role,
          camp: p.camp === Camp.Wolf ? "wolf" : "good",
          alive: n.start.includes(p.id),
        })),
        n.selections,
      );
    check(n.conflict === (r.conflict !== null));
    if (d.stage === "guard" || d.stage === "seer") {
      check(original.get(d.actorId)?.role === (d.stage === "guard" ? Role.Guard : Role.Seer));
      check(
        !r.goodEffects.some((effect) => effect.targetId === d.actorId && effect.mode === "weaken"),
      );
    }
    if (d.stage === "wolf_discussion") check(original.get(d.actorId)?.role === Role.Wolf);
    if (d.stage === "wolf_vote") check(!r.blockWolfKnife && knifeActors(n).includes(d.actorId));
    if (d.stage === "witch") {
      check(original.get(d.actorId)?.role === Role.Witch && n.start.includes(d.actorId));
      const context = d.request.context;
      check(
        context.modifier_poison_blocked ===
          r.goodEffects.some((effect) => effect.targetId === d.actorId && effect.mode === "weaken"),
      );
      // 请求先于本夜用药；解药只能已在更早的夜间消耗。
      const hasHeal = ![...nights].some(
        ([day, prior]) => day < d.day && prior.healActor === d.actorId,
      );
      if (hasHeal) {
        const primary = knifeTarget(n);
        const targets = [...new Set([primary, ...n.extraKnife].filter((id) => id !== null))];
        check(context.wolf_target === primary && equal(context.wolf_targets, targets));
      } else {
        check(!Object.hasOwn(context, "wolf_target") && !Object.hasOwn(context, "wolf_targets"));
      }
    }
    if (d.stage === "scholar_mentor_bonus") {
      check(d.request.phase === Phase.Night && n.start.includes(d.actorId));
      const grant =
        r.bonusKnifeActorId === d.actorId
          ? "kill"
          : r.goodEffects.find((x) => x.targetId === d.actorId && x.mode === "enhance")?.role;
      const kind = grant === "seer" ? "check" : grant === "witch" ? "poison" : grant;
      check(kind !== undefined && kind === d.request.context.modifier_bonus_kind);
      check(n.native.has(key(d.actorId, kind)));
      check(
        equal(
          d.request.context.modifier_bonus_candidates,
          n.start.filter((id) => id !== n.native.get(key(d.actorId, kind))),
        ),
      );
      check(
        equal(d.request.allowedTools, ["bonus_action"]) &&
          d.request.context.action_failure_policy === "error" &&
          d.request.context.allow_fallback === false,
      );
    }

    for (const id of n.start) {
      const role = original.get(id)!.role,
        kind =
          role === Role.Guard
            ? "guard"
            : role === Role.Seer
              ? "check"
              : role === Role.Witch
                ? "poison"
                : null;
      const priority = kind === "guard" ? 300 : kind === "poison" ? 500 : 600;
      if (
        kind &&
        rank > priority &&
        !r.goodEffects.some((x) => x.targetId === id && x.mode === "weaken" && kind !== "poison")
      )
        check(n.native.has(key(id, kind)));
    }
    if (rank > 400) check(n.votes.size === (r.blockWolfKnife ? 0 : knifeActors(n).length));
    for (const g of r.goodEffects.filter((x) => x.mode === "enhance")) {
      const kind = g.role === "seer" ? "check" : g.role === "witch" ? "poison" : "guard";
      if (rank > bonusRank[kind]) check(n.bonus.has(g.targetId));
    }
    if (r.bonusKnifeActorId !== null && rank > 450) check(n.bonus.has(r.bonusKnifeActorId));
  }
  for (const d of captured)
    for (const e of d.request.context.visible_events) {
      check(e.type !== "modifier_conflict_resolved");
      if (eventNames.includes(e.type)) {
        check(
          e.payload.actorId === d.actorId &&
            Number(e.payload.day) <= d.day &&
            record.events.some(
              (source) => source.type === e.type && equal(source.payload, e.payload),
            ),
        );
        if (e.type === "modifier_choice_committed" || e.type === "modifier_bonus_resolved") {
          const stage =
            e.type === "modifier_choice_committed"
              ? "scholar_mentor_choice"
              : "scholar_mentor_bonus";
          const sources = record.decisions.filter(
            (source) =>
              source.actorId === d.actorId &&
              source.day === e.payload.day &&
              source.stage === stage,
          );
          check(
            sources.length === 1 &&
              sources[0]!.settleOrder !== undefined &&
              sources[0]!.settleOrder! <= d.openedAfterSettlement,
          );
          if (d.stage === stage) check(Number(e.payload.day) < d.day);
        }
      }
    }
}

type ModifierCaster = "day_scholar" | "night_mentor";
type ModifierMode = "enhance" | "weaken";
interface ModifierState {
  policy: "awa_scholar_mentor_twelve_v1";
  caster: ModifierCaster;
  remaining: { enhance: number; weaken: number };
  history: Array<{ day: number; mode: ModifierMode | null; targetId: number | null }>;
}
interface CommittedModifier {
  actorId: number;
  caster: ModifierCaster;
  mode: ModifierMode;
  targetId: number;
}
interface ModifierResolution {
  pendingDeaths: number[];
  conflict: "same_good" | "both_wolves" | null;
  goodEffects: Array<{ targetId: number; role: "seer" | "guard" | "witch"; mode: ModifierMode }>;
  bonusKnifeActorId: number | null;
  blockWolfKnife: boolean;
}
/** 只基于 Tape 的局部账本，不调用实际对局的角色实现。 */
function createModifierState(caster: ModifierCaster): ModifierState {
  return {
    policy: "awa_scholar_mentor_twelve_v1",
    caster,
    remaining: { enhance: 1, weaken: 1 },
    history: [],
  };
}
function selectModifier(
  state: ModifierState,
  day: number,
  mode: ModifierMode | null,
  targetId: number | null,
  living: readonly number[],
): ModifierState {
  check(
    Number.isSafeInteger(day) &&
      day >= 2 &&
      day < Number.MAX_SAFE_INTEGER &&
      (state.history.at(-1)?.day ?? 0) < day,
  );
  check(
    mode === null
      ? targetId === null
      : (mode === "enhance" || mode === "weaken") &&
          targetId !== null &&
          living.includes(targetId) &&
          state.remaining[mode] === 1,
  );
  const next = structuredClone(state);
  if (mode !== null) next.remaining[mode] = 0;
  next.history.push({ day, mode, targetId });
  return next;
}
function resolveModifiers(
  players: readonly { id: number; role: string; camp: "good" | "wolf"; alive: boolean }[],
  selections: readonly CommittedModifier[],
): ModifierResolution {
  const roster = new Map(players.map((p) => [p.id, p])),
    seen = new Set<number>();
  check(roster.size === 12);
  const effects = selections.filter((s) => {
    const source = roster.get(s.actorId),
      target = roster.get(s.targetId);
    check(source?.alive && source.role === s.caster && target?.alive && !seen.has(s.actorId));
    seen.add(s.actorId);
    return target.role !== "day_scholar" && target.role !== "night_mentor";
  });
  const result: ModifierResolution = {
    pendingDeaths: [],
    conflict: null,
    goodEffects: [],
    bonusKnifeActorId: null,
    blockWolfKnife: false,
  };
  check(effects.length <= 2);
  if (effects.length === 2) {
    const one = roster.get(effects[0]!.targetId)!,
      two = roster.get(effects[1]!.targetId)!;
    if (one.camp === "good" && one.id === two.id)
      return { ...result, conflict: "same_good", pendingDeaths: [one.id] };
    if (one.camp === "wolf" && two.camp === "wolf") {
      const mentor = effects.find((e) => e.caster === "night_mentor");
      check(mentor);
      return { ...result, conflict: "both_wolves", pendingDeaths: [mentor.actorId] };
    }
  }
  for (const effect of effects) {
    const target = roster.get(effect.targetId)!;
    if (target.camp === "wolf") {
      if (effect.mode === "weaken") result.blockWolfKnife = true;
      else result.bonusKnifeActorId = target.id;
    } else if (target.role === "seer" || target.role === "guard" || target.role === "witch")
      result.goodEffects.push({ targetId: target.id, role: target.role, mode: effect.mode });
  }
  return result;
}
