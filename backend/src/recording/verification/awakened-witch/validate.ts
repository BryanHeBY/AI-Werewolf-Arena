/**
 * 负责觉醒女巫原十二人板的独立归档审核。输入纯板、请求/结算游标、历史事实与God检查点，输出接受或拒绝。
 * 自行重建一瓶解药、1/2/3人逐次调毒、全局协助资格、组内交流和隐票，不调用生产authority或伤害折叠器。
 * accepted只证明对应历史首写；全票同意不替代独立finalize。失败检查点可保building及精确已知候选付款，
 * 不能以missing冒充veto、退款或自动补Poison。原生命跨await仍由同构建真实重放验证，不把JSON当运行许可。
 */
import { Camp, Phase, Role } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_WITCH_POLICY as policy,
  isAwakenedWitchEventType,
  readAwakenedWitchFact,
  readAwakenedWitchStateData,
  type AwakenedWitchState,
  type AwakenedWitchNight,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import type { RecordedDecision, ReproductionRecord } from "../../reproduction/format";
const ERROR = "reproduction_awakened_witch_invalid";
function check(value: unknown): asserts value {
  if (!value) throw new Error(ERROR);
}
function same(a: unknown, b: unknown): boolean {
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
const clone = <T>(v: T): T => structuredClone(v);
const family = (d: RecordedDecision) =>
  ["awakened_witch", "brew_discussion", "brew_approval"].includes(d.stage);
const candidate = (d: RecordedDecision) =>
  d.outcome.kind === "action"
    ? d.outcome.action
    : d.outcome.kind === "error"
      ? d.returnedCandidate
      : null;
type Brew = Extract<AwakenedWitchNight, { mode: "poison" }>;
interface Prefix {
  day: number;
  phase: string;
  alive: number[];
  state: AwakenedWitchState;
  knife: number | null;
}
function resources(state: AwakenedWitchState) {
  const poison = state.nights.filter((n): n is Brew => n.mode === "poison");
  return {
    heal: state.nights.some((n) => n.mode === "heal") ? 0 : 1,
    brew: 3 - poison.length,
    used: poison.flatMap((n) => [...n.assistantIds]),
  };
}
function board(r: ReproductionRecord): void {
  const c = r.metadata.normalizedBoard;
  check(
    c.boardSize === 12 &&
      same(Object.fromEntries(c.roleSetups.map((p) => [p.role, p.count])), {
        wolf: 3,
        awakened_wolf_king: 1,
        villager: 4,
        seer: 1,
        guard: 1,
        hunter: 1,
        awakened_witch: 1,
      }) &&
      c.roleSetups.length === 7 &&
      same(c.awakenedWitch, { policy }) &&
      same(c.awakenedWolfKing, { policy: "awa_awakened_wolf_king_v1" }) &&
      c.guard?.repeatPolicy === "awa_last_action_v1" &&
      c.hunter?.deathActionPolicy === "awa_qualified_sources_v1" &&
      same(c.winConditions ?? [c.winCondition], ["slaughter_side"]) &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      c.voting?.exilePolicy === "awa_one_pk_v1" &&
      c.lastWords?.policy === "awa_initial_wave_v1",
  );
  const keys = new Set([
    "boardSize",
    "enableSheriff",
    "initialSheriffSeat",
    "winConditions",
    "winCondition",
    "hooks",
    "selfDestruct",
    "sheriff",
    "seer",
    "guard",
    "hunter",
    "tieBreaker",
    "voting",
    "disclosure",
    "lastWords",
    "roleSetups",
    "awakenedWitch",
    "awakenedWolfKing",
  ]);
  check(Object.keys(c).every((k) => keys.has(k)));
}
/** 只根据该请求开窗时的独立资源/活人和实际狼票形成预期；不相信请求自带可用布尔值。 */
function options(p: Prefix, actor: number) {
  const r = resources(p.state),
    targetIds = [...p.alive],
    assistantIds = targetIds.filter((id) => id !== actor && !r.used.includes(id)),
    required = 4 - r.brew;
  return {
    healRemaining: r.heal,
    brewRemaining: r.brew,
    usedAssistantIds: r.used,
    targetIds,
    assistantIds,
    requiredAssistants: required,
    canPoison: r.brew > 0 && assistantIds.length >= required,
    canHeal: !!r.heal && p.knife !== null && p.knife !== actor && targetIds.includes(p.knife),
    ...(r.heal ? { wolfTarget: p.knife } : {}),
  };
}
function paidChoice(d: RecordedDecision, p: Prefix, actor: number): AwakenedWitchNight | null {
  const a = candidate(d),
    o = options(p, actor);
  if (a?.name !== "awakened_brew") return null;
  const { mode, target_id: target, assistant_ids: assistants } = a.args;
  if (mode === "pass")
    return target === null && assistants.length === 0 ? { day: d.day, mode } : null;
  if (mode === "heal")
    return o.canHeal && target === o.wolfTarget && assistants.length === 0
      ? { day: d.day, mode, targetId: target! }
      : null;
  return mode === "poison" &&
    o.canPoison &&
    target !== null &&
    o.targetIds.includes(target) &&
    assistants.length === o.requiredAssistants &&
    new Set(assistants).size === assistants.length &&
    assistants.every((id) => o.assistantIds.includes(id))
    ? {
        day: d.day,
        mode,
        ordinal: o.requiredAssistants as 1 | 2 | 3,
        targetId: target,
        assistantIds: [...assistants].sort((a, b) => a - b),
        discussions: [],
        approvals: [],
        outcome: "building",
      }
    : null;
}
export function validateAwakenedWitchRecord(r: ReproductionRecord): void {
  const c = r.metadata.normalizedBoard,
    owns = !!c.awakenedWitch,
    artifacts =
      r.events.some((e) => isAwakenedWitchEventType(e.type)) ||
      r.decisions.some(
        (d) =>
          family(d) ||
          d.request.allowedTools.some((t) =>
            ["awakened_brew", "brew_discuss", "brew_approve"].includes(t),
          ),
      ) ||
      r.checkpoints.some((cp) =>
        cp.players.some((p) => Object.hasOwn(p.privateState, "awakenedWitch")),
      );
  if (!owns) {
    check(
      !artifacts &&
        !c.roleSetups.some((p) => p.role === Role.AwakenedWitch) &&
        !r.metadata.players.some((p) => p.role === Role.AwakenedWitch),
    );
    return;
  }
  board(r);
  const original = new Map(r.metadata.players.map((p) => [p.id, p])),
    witches = r.metadata.players.filter((p) => p.role === Role.AwakenedWitch);
  check(
    original.size === 12 &&
      witches.length === 1 &&
      witches[0]!.camp === Camp.Good &&
      same(
        Object.fromEntries(c.roleSetups.map((p) => [p.role, p.count])),
        Object.fromEntries(
          [...new Set(r.metadata.players.map((p) => p.role))].map((role) => [
            role,
            r.metadata.players.filter((p) => p.role === role).length,
          ]),
        ),
      ) &&
      r.metadata.players.every(
        (p) =>
          p.camp === ([Role.Wolf, Role.AwakenedWolfKing].includes(p.role) ? Camp.Wolf : Camp.Good),
      ),
  );
  const actor = witches[0]!.id,
    alive = new Set(original.keys()),
    prefixes: Prefix[] = [],
    facts = new Map<RecordedDecision, number>(),
    started = new Map<number, number>(),
    resolved = new Map<number, number>(),
    chosen = new Map<number, RecordedDecision>(),
    votes = new Map<number, Map<number, number | null>>(),
    guards = new Map<number, number | null>(),
    nightDamage = r.operations.filter(
      (o) => o.scope === "resolution" && o.op === "night_damage_resolved",
    );
  let day = 1,
    phase: string = Phase.Night,
    state: AwakenedWitchState = { policy, nights: [] },
    night = 0;
  const knife = () => {
    const tally = new Map<number, number>();
    for (const id of votes.get(day)?.values() ?? [])
      if (id !== null) tally.set(id, (tally.get(id) ?? 0) + 1);
    return [...tally].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  };
  const snap = (): Prefix => ({
    day,
    phase,
    alive: [...alive],
    state: clone(state),
    knife: knife(),
  });
  prefixes[0] = snap();
  const current = () => {
    const n = state.nights.at(-1);
    check(n?.day === day && n.mode === "poison");
    return n;
  };
  const replace = (n: AwakenedWitchNight) => {
    state = { policy, nights: [...state.nights.slice(0, -1), n] };
  };
  // 批准写入后，delivery.complete仍可能撤权并false-close；生产者会保留该人的已付票事实再抛原错误。
  // 仅这一具名窗口允许精确error候选证明发表，且最终档必须有覆盖它的真实失败CP，完成CP不可掩盖失败。
  const publishedApproval = (d: RecordedDecision, index: number) => {
    if (d.outcome.kind === "action") return true;
    if (d.stage !== "brew_approval" || d.outcome.kind !== "error" || d.returnedCandidate == null)
      return false;
    const position = r.decisions.indexOf(d),
      covers = (cp: ReproductionRecord["checkpoints"][number]) =>
        cp.eventCount > index &&
        cp.decisionCount !== undefined &&
        cp.decisionCount > position &&
        d.settleOrder !== undefined &&
        cp.settlementCount !== undefined &&
        cp.settlementCount >= d.settleOrder;
    return (
      !r.checkpoints.some((cp) => cp.complete && covers(cp)) &&
      (!r.finalized || r.checkpoints.some((cp) => !cp.complete && covers(cp)))
    );
  };
  const decision = (who: number, stage: string, index: number) => {
    const ds = r.decisions.filter(
      (d) =>
        d.actorId === who &&
        d.day === day &&
        d.stage === stage &&
        d.openedAtEventCount !== undefined &&
        d.openedAtEventCount <= index &&
        !facts.has(d) &&
        publishedApproval(d, index),
    );
    check(ds.length === 1);
    return ds[0]!;
  };
  for (const [index, e] of r.events.entries()) {
    const p = e.payload;
    if (e.type === "phase_changed") {
      day = p.day as number;
      phase = p.phase as string;
    }
    if (e.type === "wolf_kill_vote_cast") {
      const map = votes.get(day) ?? new Map();
      check(
        phase === Phase.Night &&
          alive.has(p.actorId as number) &&
          original.get(p.actorId as number)?.camp === Camp.Wolf &&
          !map.has(p.actorId as number),
      );
      const d = decision(p.actorId as number, "wolf_vote", index),
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!];
      check(
        opening?.day === day &&
          opening.phase === Phase.Night &&
          a?.name === "kill_vote" &&
          (a.args.abstain === true
            ? p.abstain === true && p.targetId === null
            : a.args.target_id === p.targetId),
      );
      facts.set(d, index + 1);
      map.set(p.actorId as number, p.abstain === true ? null : (p.targetId as number));
      votes.set(day, map);
    }
    if (e.type === "guard_applied") {
      const who = p.actorId as number,
        d = decision(who, "guard", index),
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!],
        previous = [...guards.values()].at(-1);
      check(
        phase === Phase.Night &&
          alive.has(who) &&
          original.get(who)?.role === Role.Guard &&
          !guards.has(day) &&
          opening?.day === day &&
          opening.phase === Phase.Night &&
          a?.name === "guard" &&
          (a.args.abstain === true ? p.targetId === null : a.args.target_id === p.targetId) &&
          (p.targetId === null || (alive.has(p.targetId as number) && p.targetId !== previous)),
      );
      facts.set(d, index + 1);
      guards.set(day, p.targetId as number | null);
    }
    if (isAwakenedWitchEventType(e.type)) {
      const f = readAwakenedWitchFact(e.type, p);
      check(f && phase === Phase.Night && f.payload.day === day && Array.isArray(e.audience));
      if (f.type === "awakened_brew_chosen") {
        check(f.payload.actorId === actor && alive.has(actor) && !chosen.has(day));
        const d = decision(actor, "awakened_witch", index),
          row = paidChoice(d, prefixes[d.openedAtEventCount!]!, actor);
        check(row && same(e.audience, [actor]));
        const expected = {
          policy,
          day,
          actorId: actor,
          mode: row.mode,
          targetId: row.mode === "pass" ? null : row.targetId,
          assistantIds: row.mode === "poison" ? row.assistantIds : [],
          ordinal: row.mode === "poison" ? row.ordinal : null,
        };
        check(same(f.payload, expected));
        chosen.set(day, d);
        facts.set(d, index + 1);
        state = { policy, nights: [...state.nights, row] };
      } else if (f.type === "brew_started") {
        const row = current();
        check(
          !started.has(day) &&
            same(e.audience, row.assistantIds) &&
            same(f.payload, {
              policy,
              day,
              ordinal: row.ordinal,
              targetId: row.targetId,
              assistantIds: row.assistantIds,
            }),
        );
        started.set(day, index + 1);
      } else if (f.type === "brew_discussion") {
        const row = current(),
          d = decision(f.payload.actorId, "brew_discussion", index),
          a = candidate(d);
        check(
          started.has(day) &&
            row.outcome === "building" &&
            row.assistantIds[row.discussions.length] === f.payload.actorId &&
            row.ordinal === f.payload.ordinal &&
            same(e.audience, row.assistantIds) &&
            a?.name === "brew_discuss" &&
            a.args.text === f.payload.text,
        );
        facts.set(d, index + 1);
        replace({
          ...row,
          discussions: [...row.discussions, { actorId: f.payload.actorId, text: f.payload.text }],
        });
      } else if (f.type === "brew_approval") {
        const row = current(),
          d = decision(f.payload.actorId, "brew_approval", index),
          a = candidate(d);
        check(
          row.discussions.length === row.ordinal &&
            row.outcome === "building" &&
            row.assistantIds.includes(f.payload.actorId) &&
            !row.approvals.some((p) => p.actorId === f.payload.actorId) &&
            row.ordinal === f.payload.ordinal &&
            same(e.audience, [f.payload.actorId]) &&
            a?.name === "brew_approve" &&
            a.args.approve === f.payload.approve,
        );
        facts.set(d, index + 1);
        const approvals = [
          ...row.approvals,
          { actorId: f.payload.actorId, approve: f.payload.approve },
        ].sort(
          (a, b) =>
            r.decisions.find(
              (d) => d.day === day && d.stage === "brew_approval" && d.actorId === a.actorId,
            )!.settleOrder! -
            r.decisions.find(
              (d) => d.day === day && d.stage === "brew_approval" && d.actorId === b.actorId,
            )!.settleOrder!,
        );
        replace({ ...row, approvals });
      } else {
        const row = current(),
          outcome = row.approvals.every((p) => p.approve) ? "poison" : "vetoed";
        check(
          !resolved.has(day) &&
            row.approvals.length === row.ordinal &&
            row.assistantIds.every((id) =>
              r.decisions.some(
                (d) =>
                  d.day === day &&
                  d.stage === "brew_approval" &&
                  d.actorId === id &&
                  d.outcome.kind === "action",
              ),
            ) &&
            same(e.audience, []) &&
            same(f.payload, {
              policy,
              day,
              ordinal: row.ordinal,
              actorId: actor,
              targetId: row.targetId,
              assistantIds: row.assistantIds,
              outcome,
            }),
        );
        resolved.set(day, index + 1);
        replace({ ...row, outcome });
      }
    }
    if (e.type === "night_resolved") {
      const row = state.nights.at(-1),
        has = chosen.get(day);
      if (alive.has(actor))
        check(has && row?.day === day && (row.mode !== "poison" || resolved.has(day)));
      const expected: number[] = [],
        source: Record<string, string[]> = {},
        target = knife(),
        heal = row?.day === day && row.mode === "heal" ? row.targetId : null,
        poison =
          row?.day === day && row.mode === "poison" && row.outcome === "poison"
            ? row.targetId
            : null;
      for (const id of alive) {
        const causes: string[] = [];
        if (id === target && (guards.get(day) === id) === (heal === id)) causes.push("wolf_kill");
        if (id === poison) causes.push("poison");
        if (causes.length) {
          expected.push(id);
          source[String(id)] = causes;
        }
      }
      check(
        Array.isArray(p.deaths) &&
          same(
            [...(p.deaths as number[])].sort((a, b) => a - b),
            expected.sort((a, b) => a - b),
          ),
      );
      const op = nightDamage[night++];
      if (op) {
        const raw = op.output?.death_sources;
        check(raw && typeof raw === "object" && !Array.isArray(raw));
        // 死因是集合；引擎可能先收毒再收刀。只规范次序，不丢重复、未知原因或额外目标。
        const actualSources = Object.fromEntries(
          Object.entries(raw).map(([id, causes]) => {
            check(
              Array.isArray(causes) && causes.every((c) => c === "wolf_kill" || c === "poison"),
            );
            return [id, [...causes].sort()];
          }),
        );
        check(
          same(
            [...(op.output?.deaths as number[])].sort((a, b) => a - b),
            expected,
          ) &&
            same(
              actualSources,
              Object.fromEntries(
                Object.entries(source).map(([id, causes]) => [id, [...causes].sort()]),
              ),
            ),
        );
      } else check(!r.finalized);
      for (const id of expected) alive.delete(id);
    }
    if (e.type === "voted_out") alive.delete(p.target as number);
    if (e.type === "wolf_self_destruct") alive.delete(p.wolfId as number);
    if (e.type === "player_shot" || e.type === "hunter_shot") alive.delete(p.targetId as number);
    if (e.type === "additional_deaths") for (const id of p.deaths as number[]) alive.delete(id);
    prefixes[index + 1] = snap();
  }
  // 每次开窗只接受此前该玩家确实收到的本族事实；旧组不能看新组，女巫不能看讨论/票/结果。
  for (const d of r.decisions) {
    check(d.openedAtEventCount !== undefined && prefixes[d.openedAtEventCount]);
    const p = prefixes[d.openedAtEventCount]!,
      ctx = d.request.context;
    const expected = r.events
      .slice(0, d.openedAtEventCount)
      .filter((e) => isAwakenedWitchEventType(e.type) && e.audience?.includes(d.actorId))
      .map((e) => ({ type: e.type, payload: e.payload }));
    check(
      same(
        ctx.visible_events
          .filter((e) => isAwakenedWitchEventType(e.type))
          .map((e) => ({ type: e.type, payload: e.payload })),
        expected,
      ),
    );
    if (!family(d)) {
      check(ctx.awakened_brew_options === undefined && ctx.brew_collaboration === undefined);
      continue;
    }
    const tool =
      d.stage === "awakened_witch"
        ? "awakened_brew"
        : d.stage === "brew_discussion"
          ? "brew_discuss"
          : "brew_approve";
    check(
      p.day === d.day &&
        p.phase === Phase.Night &&
        d.request.phase === Phase.Night &&
        d.request.actorId === d.actorId &&
        ctx.day === d.day &&
        ctx.stage === d.stage &&
        same(d.request.allowedTools, [tool]) &&
        ctx.action_failure_policy === "error" &&
        ctx.allow_fallback === false &&
        p.alive.includes(d.actorId),
    );
    if (d.stage === "awakened_witch") {
      check(
        d.actorId === actor &&
          ctx.brew_collaboration === undefined &&
          same(ctx.awakened_brew_options, options(p, actor)) &&
          !p.state.nights.some((n) => n.day === d.day),
      );
      if (d.outcome.kind === "action") check(paidChoice(d, p, actor));
    } else {
      const row = p.state.nights.at(-1);
      check(
        row?.day === d.day &&
          row.mode === "poison" &&
          row.assistantIds.includes(d.actorId) &&
          ctx.awakened_brew_options === undefined &&
          same(ctx.brew_collaboration, {
            ordinal: row.ordinal,
            targetId: row.targetId,
            assistantIds: row.assistantIds,
          }) &&
          (started.get(d.day) ?? Infinity) <= d.openedAtEventCount,
      );
      if (d.stage === "brew_discussion")
        check(row.assistantIds[row.discussions.length] === d.actorId);
      else
        check(
          row.discussions.length === row.ordinal &&
            !row.approvals.some((a) => a.actorId === d.actorId) &&
            !ctx.visible_events.some((e) => e.type === "brew_approval" && e.payload.day === d.day),
        );
    }
  }
  // 检查点独立核每一笔已付写入；error的已知候选只能解释精确末端前缀，正常CP不得省任何事实或结果。
  for (const cp of r.checkpoints) {
    check(
      cp.decisionCount !== undefined &&
        cp.settlementCount !== undefined &&
        cp.decisionCount <= r.decisions.length &&
        prefixes[cp.eventCount],
    );
    const known = r.decisions
        .slice(0, cp.decisionCount)
        .filter(
          (d) => d.settleOrder !== undefined && d.settleOrder <= cp.settlementCount! && family(d),
        ),
      p = prefixes[cp.eventCount]!;
    check(
      known.every(
        (d) => d.openedAtEventCount !== undefined && d.openedAtEventCount <= cp.eventCount,
      ),
    );
    // 计数游标不能倒退到已发表付款之前；否则删回执再缩settlementCount会伪装成合法未付前缀。
    for (const [d, at] of facts) if (family(d) && at <= cp.eventCount) check(known.includes(d));
    const player = cp.players.find((p) => p.id === actor),
      actual = player && readAwakenedWitchStateData(player.privateState.awakenedWitch);
    check(actual);
    if (r.finalized && actual.nights.some((n) => n.mode === "poison" && n.outcome === "building"))
      check(!cp.complete && !!r.termination?.errors.length);
    check(
      cp.players.every(
        (p) =>
          p.role === original.get(p.id)?.role &&
          p.camp === original.get(p.id)?.camp &&
          (p.id === actor || !Object.hasOwn(p.privateState, "awakenedWitch")),
      ),
    );
    const choices = known.filter((d) => d.stage === "awakened_witch");
    check(
      choices.every(
        (d) => d.outcome.kind !== "action" || actual.nights.some((n) => n.day === d.day),
      ),
    );
    for (const row of actual.nights) {
      const ds = choices.filter((d) => d.day === row.day);
      check(ds.length === 1);
      const d = ds[0]!,
        opening = prefixes[d.openedAtEventCount!]!,
        base = paidChoice(d, opening, actor);
      check(
        base &&
          same(
            {
              ...row,
              ...(row.mode === "poison"
                ? { discussions: [], approvals: [], outcome: "building" }
                : {}),
            },
            base,
          ),
      );
      if (row.mode !== "poison") continue;
      const discussions = known.filter((d) => d.day === row.day && d.stage === "brew_discussion"),
        approvals = known.filter((d) => d.day === row.day && d.stage === "brew_approval");
      for (const list of [discussions, approvals])
        check(new Set(list.map((d) => d.actorId)).size === list.length);
      for (const receipt of row.discussions) {
        const d = discussions.find((d) => d.actorId === receipt.actorId),
          a = d && candidate(d);
        check(a?.name === "brew_discuss" && a.args.text === receipt.text);
      }
      for (const receipt of row.approvals) {
        const d = approvals.find((d) => d.actorId === receipt.actorId),
          a = d && candidate(d);
        check(a?.name === "brew_approve" && a.args.approve === receipt.approve);
      }
      check(
        discussions.every(
          (d) =>
            d.outcome.kind !== "action" || row.discussions.some((p) => p.actorId === d.actorId),
        ) &&
          approvals.every(
            (d) =>
              d.outcome.kind !== "action" || row.approvals.some((p) => p.actorId === d.actorId),
          ),
      );
      if (row.outcome !== "building")
        check(
          row.approvals.length === row.ordinal &&
            approvals.every((d) => d.outcome.kind === "action") &&
            (row.outcome === "poison") === row.approvals.every((a) => a.approve),
        );
      if (cp.complete)
        check(row.outcome !== "building" && (resolved.get(row.day) ?? Infinity) <= cp.eventCount);
    }
    if (cp.complete) {
      check(
        known.every(
          (d) => d.outcome.kind === "action" && (facts.get(d) ?? Infinity) <= cp.eventCount,
        ) && same(actual, p.state),
      );
    } else {
      // 已发表事实不可回滚；允许其后真实已知决定写入，不允许旧夜或其它字段被候选覆盖。
      for (const n of p.state.nights) {
        const a = actual.nights.find((a) => a.day === n.day);
        check(
          a &&
            (n.mode !== "poison" ||
              n.outcome === "building" ||
              (a.mode === "poison" && a.outcome === n.outcome)),
        );
        if (n.mode === "poison") {
          check(
            a?.mode === "poison" &&
              same(a.discussions.slice(0, n.discussions.length), n.discussions) &&
              n.approvals.every((receipt) => a.approvals.some((p) => same(p, receipt))),
          );
        }
        check(
          a &&
            same(
              {
                ...a,
                ...(a.mode === "poison"
                  ? {
                      discussions: n.mode === "poison" ? n.discussions : [],
                      approvals: n.mode === "poison" ? n.approvals : [],
                      outcome: n.mode === "poison" ? n.outcome : "building",
                    }
                  : {}),
              },
              n,
            ),
        );
      }
    }
  }
}
