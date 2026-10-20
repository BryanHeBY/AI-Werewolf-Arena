/**
 * 负责典狱长纯归档的独立因果验算。只读配置、真实决定、秘密事实和检查点，不导入生产交易／伤害owner。
 * 独立重建全局一次参与、双方sealed回执、四格收益、原生强制目标、存活前缀和玩家可见子序列。
 * checkpoint不是授权：其新增历史必须由同一已成功交付动作精确支持，缺失／迟到不会补作trade。
 * 输入是纯ReproductionRecord；输出为通过或具名异常，不授予运行时World或付款权限。
 */
import { Role, Camp, Phase } from "@ai-werewolf-arena/game-contract";
import {
  WARDEN_EVENT_TYPES,
  readWardenFact,
  readWardenStateData,
  WARDEN_POLICY,
  WARDEN_FORCE_POLICY,
  type WardenNight,
  type WardenDecision,
} from "@ai-werewolf-arena/game-contract/facts/warden";
import type { ReproductionRecord, RecordedDecision } from "../../reproduction/format";
function check(v: unknown): asserts v {
  if (!v) throw new Error("reproduction_warden_invalid");
}
const same = (a: unknown, b: unknown): boolean => {
  const stable = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(stable)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.entries(x)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, stable(v)]),
          )
        : x;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
};
const family = (t: string) => (WARDEN_EVENT_TYPES as readonly string[]).includes(t);
function board(r: ReproductionRecord): void {
  const c = r.metadata.normalizedBoard;
  check(
    c.boardSize === 12 &&
      c.roleSetups.length === 7 &&
      same(Object.fromEntries(c.roleSetups.map((x) => [x.role, x.count])), {
        wolf: 3,
        warden: 1,
        villager: 4,
        seer: 1,
        witch: 1,
        hunter: 1,
        dreamer: 1,
      }),
  );
  check(
    c.warden?.policy === WARDEN_POLICY &&
      c.warden.forcePolicy === WARDEN_FORCE_POLICY &&
      same(c.winConditions ?? [c.winCondition], ["slaughter_side"]) &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      c.voting?.exilePolicy === "awa_one_pk_v1",
  );
  const allowed = new Set([
    "boardSize",
    "enableSheriff",
    "initialSheriffSeat",
    "winConditions",
    "winCondition",
    "hooks",
    "selfDestruct",
    "sheriff",
    "witch",
    "seer",
    "hunter",
    "dreamer",
    "tieBreaker",
    "voting",
    "disclosure",
    "lastWords",
    "roleSetups",
    "warden",
  ]);
  check(Object.keys(c).every((k) => allowed.has(k)));
}
function removed(type: string, p: Record<string, unknown>): readonly number[] {
  if (type === "night_resolved" || type === "additional_deaths") return p.deaths as number[];
  if (type === "voted_out") return [p.target as number];
  if (type === "wolf_self_destruct") return [p.wolfId as number];
  if (["hunter_shot", "player_shot", "wolf_king_shot"].includes(type))
    return [p.targetId as number];
  return [];
}
function action(d: RecordedDecision) {
  return d.outcome.kind === "action" ? d.outcome.action : null;
}
function strict(d: RecordedDecision, tool: "warden_pair" | "warden_decide"): void {
  check(
    d.day >= 2 &&
      d.turn === 1 &&
      d.stage === tool &&
      d.request.context.stage === tool &&
      d.request.phase === Phase.Night &&
      same(d.request.allowedTools, [tool]) &&
      d.request.context.action_failure_policy === "error" &&
      d.request.context.allow_fallback === false,
  );
}
/** 与生产无共同函数的字面收益表：本人四格覆盖普通表，团刀不在表中。 */
function result(
  actor: number,
  pair: readonly [number, number],
  a: WardenDecision,
  b: WardenDecision,
) {
  if (pair.includes(actor))
    return { outcome: "deal", dealIds: [a === b ? actor : pair.find((x) => x !== actor)!] };
  if (a === "trade" && b === "trade") return { outcome: "protect", dealIds: [] };
  if (a === "betray" && b === "betray") return { outcome: "force", dealIds: [] };
  return { outcome: "deal", dealIds: [a === "trade" ? pair[0] : pair[1]] };
}
export function validateWardenRecord(r: ReproductionRecord): void {
  const c = r.metadata.normalizedBoard,
    owns = c.roleSetups.some((x) => x.role === Role.Warden && x.count > 0);
  const artifacts =
    r.events.some((e) => family(e.type)) ||
    r.decisions.some(
      (d) =>
        ["warden_pair", "warden_decide"].includes(d.stage) ||
        d.request.allowedTools.some((t) => t.startsWith("warden_")) ||
        d.request.context.warden_forced_target !== undefined,
    ) ||
    r.checkpoints.some((cp) => cp.players.some((p) => Object.hasOwn(p.privateState, "warden")));
  if (!owns) {
    check(!c.warden && !artifacts && !r.metadata.players.some((p) => p.role === Role.Warden));
    return;
  }
  board(r);
  const originals = new Map(r.metadata.players.map((p) => [p.id, p])),
    actors = r.metadata.players.filter((p) => p.role === Role.Warden);
  check(originals.size === 12 && actors.length === 1 && actors[0]!.camp === Camp.Wolf);
  const actor = actors[0]!.id,
    alive = new Set(originals.keys()),
    aliveAt: number[][] = [[...alive]],
    used = new Set<number>();
  const pairs = new Map<number, readonly [number, number] | null>(),
    receipts = new Map<number, Map<number, WardenDecision>>(),
    resolved = new Map<number, ReturnType<typeof result>>(),
    factFor = new Map<RecordedDecision, number>();
  const pairAt = new Map<number, number>(),
    resolvedAt = new Map<number, number>(),
    prefixPoints: Array<{ day: number; phase: string }> = [{ day: 1, phase: Phase.Night }];
  let day = 1,
    phase: string = Phase.Night;
  const decision = (stage: string, id: number, d: number) => {
    const all = r.decisions.filter((x) => x.stage === stage && x.actorId === id && x.day === d);
    check(all.length === 1);
    return all[0]!;
  };
  for (let index = 0; index < r.events.length; index++) {
    const e = r.events[index]!,
      p = e.payload;
    if (e.type === "phase_changed") {
      day = p.day as number;
      phase = p.phase as string;
    }
    if (family(e.type)) {
      const f = readWardenFact(e.type, p);
      check(f && f.payload.day === day && phase === Phase.Night);
      check(
        f.type === "warden_resolved" ? same(e.audience, []) : same(e.audience, [f.payload.actorId]),
      );
      if (f.type === "warden_pair_chosen") {
        check(f.payload.actorId === actor && !pairs.has(day) && alive.has(actor));
        const d = decision("warden_pair", actor, day);
        strict(d, "warden_pair");
        const a = action(d);
        check(
          a?.name === "warden_pair" &&
            same(a.args, { target_ids: f.payload.pair }) &&
            d.openedAtEventCount !== undefined &&
            d.openedAtEventCount <= index,
        );
        const candidates = aliveAt[d.openedAtEventCount!]!.filter((id) => !used.has(id));
        check(same(d.request.context.warden_candidates, candidates));
        if (f.payload.pair)
          for (const id of f.payload.pair) {
            check(alive.has(id) && !used.has(id));
            used.add(id);
          }
        pairs.set(day, f.payload.pair);
        pairAt.set(day, index + 1);
        receipts.set(day, new Map());
        factFor.set(d, index + 1);
      } else if (f.type === "warden_partner_notified") {
        const pair = pairs.get(day);
        check(
          pair &&
            pair.includes(f.payload.actorId) &&
            pair.find((id) => id !== f.payload.actorId) === f.payload.partnerId,
        );
        check(
          !r.events
            .slice(0, index)
            .some(
              (e) =>
                e.type === "warden_partner_notified" &&
                e.payload.day === day &&
                e.payload.actorId === f.payload.actorId,
            ),
        );
      } else if (f.type === "warden_decision") {
        const pair = pairs.get(day),
          own = receipts.get(day);
        check(pair && own && pair.includes(f.payload.actorId) && !own.has(f.payload.actorId));
        const d = decision("warden_decide", f.payload.actorId, day);
        strict(d, "warden_decide");
        const a = action(d);
        check(
          a?.name === "warden_decide" &&
            same(a.args, { choice: f.payload.choice }) &&
            d.openedAtEventCount !== undefined &&
            d.openedAtEventCount <= index,
        );
        check(d.request.context.warden_partner_id === pair.find((id) => id !== d.actorId));
        own.set(f.payload.actorId, f.payload.choice);
        factFor.set(d, index + 1);
      } else {
        const pair = pairs.get(day),
          own = receipts.get(day);
        check(
          pair &&
            own &&
            own.size === 2 &&
            !resolved.has(day) &&
            f.payload.actorId === actor &&
            same(f.payload.pair, pair),
        );
        const choices = [own.get(pair[0])!, own.get(pair[1])!] as const,
          expected = result(actor, pair, choices[0], choices[1]);
        check(
          same(f.payload.choices, choices) &&
            f.payload.outcome === expected.outcome &&
            same(f.payload.dealIds, expected.dealIds),
        );
        resolved.set(day, expected);
        resolvedAt.set(day, index + 1);
      }
    }
    const outcome = resolved.get(day),
      pair = pairs.get(day);
    if (
      outcome?.outcome === "force" &&
      pair &&
      ["seer_checked", "witch_potion_used", "dream_applied"].includes(e.type) &&
      pair.includes(p.actorId as number)
    )
      check(p.targetId === pair.find((id) => id !== p.actorId));
    for (const id of removed(e.type, p)) alive.delete(id);
    aliveAt[index + 1] = [...alive];
    prefixPoints[index + 1] = { day, phase };
  }
  // 初始夜伤与后续夜源枪分开验。Deal必须在真实伤害来源中双向对应，不能只凭公开死亡名单冒充狼刀。
  const nightDamage = new Map<number, { cursor: number; deaths: number[] }>();
  for (const op of r.operations) {
    if (op.scope !== "resolution" || op.op !== "night_damage_resolved") continue;
    const cursor = op.event_count,
      point = cursor === undefined ? undefined : prefixPoints[cursor],
      output = op.output,
      deaths = output?.deaths,
      sources = output?.death_sources;
    check(
      cursor !== undefined &&
        point &&
        point.phase === Phase.Night &&
        op.phase === Phase.Night &&
        op.status === "ok" &&
        !nightDamage.has(point.day) &&
        output &&
        Array.isArray(deaths) &&
        new Set(deaths).size === deaths.length &&
        sources &&
        typeof sources === "object" &&
        !Array.isArray(sources),
    );
    const entries = Object.entries(sources as Record<string, unknown>);
    check(
      same(
        deaths.map(Number).sort((a, b) => a - b),
        entries.map(([id]) => Number(id)).sort((a, b) => a - b),
      ),
    );
    for (const [id, list] of entries)
      check(
        aliveAt[cursor]!.includes(Number(id)) &&
          Array.isArray(list) &&
          list.length > 0 &&
          list.every((cause) => ["wolf_kill", "poison", "dream", "deal"].includes(cause)) &&
          new Set(list).size === list.length,
      );
    const pair = pairs.get(point.day),
      outcome = resolved.get(point.day);
    if (point.day >= 2 && aliveAt[cursor]!.includes(actor)) {
      check(pairs.has(point.day) && (pairAt.get(point.day) ?? Infinity) <= cursor);
      if (pair !== null) check(outcome && (resolvedAt.get(point.day) ?? Infinity) <= cursor);
    }
    const expectedDeal = outcome?.outcome === "deal" ? outcome.dealIds : [];
    const actualDeal = entries
      .filter(([, list]) => (list as string[]).includes("deal"))
      .map(([id]) => Number(id));
    check(
      same(
        [...expectedDeal].sort((a, b) => a - b),
        actualDeal.sort((a, b) => a - b),
      ),
    );
    if (outcome?.outcome === "protect" && pair)
      for (const id of pair) {
        const list = (sources as Record<string, unknown>)[id];
        check(
          !Array.isArray(list) ||
            !list.some((cause) => ["wolf_kill", "poison", "dream"].includes(cause)),
        );
      }
    nightDamage.set(point.day, { cursor, deaths: deaths as number[] });
  }
  // 实时Trace前缀尚未附领域ops；终档（含失败终档）必须核真实来源，不把实时缺席当最终N/A。
  for (const [index, event] of r.events.entries())
    if ((r.finalized || r.operations.length > 0) && event.type === "night_resolved") {
      const night = nightDamage.get(prefixPoints[index]!.day);
      check(night && night.cursor <= index && same(event.payload.deaths, night.deaths));
    }
  for (const d of r.decisions) {
    const wardenFields = Object.keys(d.request.context).filter((key) => key.startsWith("warden_"));
    check(
      same(
        wardenFields,
        d.stage === "warden_pair"
          ? ["warden_candidates"]
          : d.stage === "warden_decide"
            ? ["warden_partner_id"]
            : d.request.context.warden_forced_target === undefined
              ? []
              : ["warden_forced_target"],
      ),
    );
    check(d.openedAtEventCount !== undefined && !!aliveAt[d.openedAtEventCount]);
    const expected = r.events
      .slice(0, d.openedAtEventCount)
      .filter(
        (e) => family(e.type) && e.type !== "warden_resolved" && same(e.audience, [d.actorId]),
      )
      .map((e) => ({ type: e.type, payload: e.payload }));
    const actual = d.request.context.visible_events
      .filter((e) => family(e.type))
      .map((e) => ({ type: e.type, payload: e.payload }));
    check(same(actual, expected));
    if (d.stage === "warden_pair") {
      strict(d, "warden_pair");
      check(d.actorId === actor);
    }
    if (d.stage === "warden_decide") {
      strict(d, "warden_decide");
      const pair = pairs.get(d.day);
      check(
        pair &&
          pair.includes(d.actorId) &&
          d.request.context.warden_partner_id === pair.find((id) => id !== d.actorId),
      );
      check(
        expected.some(
          (e) =>
            e.type === "warden_partner_notified" &&
            e.payload.day === d.day &&
            e.payload.partnerId === d.request.context.warden_partner_id,
        ),
      );
    }
    const outcome = resolved.get(d.day),
      pair = pairs.get(d.day),
      kind = originals.get(d.actorId)?.role;
    const native =
      (kind === Role.Seer && d.stage === "seer") ||
      (kind === Role.Witch && d.stage === "witch") ||
      (kind === Role.Dreamer && d.stage === "dreamer");
    const point = prefixPoints[d.openedAtEventCount];
    if (native || d.stage === "warden_pair" || d.stage === "warden_decide")
      check(point?.day === d.day && point.phase === Phase.Night && d.request.phase === Phase.Night);
    // 归档的最终夜表不是过去请求的许可；双方真实结算事实须已在本次开窗前落地。
    const forced =
      outcome?.outcome === "force" &&
      (resolvedAt.get(d.day) ?? Infinity) <= d.openedAtEventCount &&
      pair?.includes(d.actorId) &&
      native;
    if (forced) {
      const target = pair!.find((id) => id !== d.actorId)!;
      check(
        d.request.context.warden_forced_target === target &&
          d.request.context.action_failure_policy === "error" &&
          d.request.context.allow_fallback === false,
      );
      const a = action(d);
      if (a) {
        check(a.name === "check_identity" || a.name === "use_potion" || a.name === "dream");
        if (a.name !== "use_potion" || a.args.potion_type !== "none")
          check(a.args.target_id === target);
      }
    } else check(d.request.context.warden_forced_target === undefined);
  }
  for (const cp of r.checkpoints) {
    check(
      cp.decisionCount !== undefined &&
        cp.settlementCount !== undefined &&
        cp.decisionCount <= r.decisions.length &&
        !!aliveAt[cp.eventCount],
    );
    const known = r.decisions
      .slice(0, cp.decisionCount)
      .filter(
        (d) =>
          d.settleOrder !== undefined &&
          d.settleOrder <= cp.settlementCount! &&
          d.outcome.kind === "action",
      )
      .sort((a, b) => a.settleOrder! - b.settleOrder!);
    const history: WardenNight[] = [];
    for (const d of known) {
      const a = action(d);
      if (d.stage === "warden_pair") {
        check(a?.name === "warden_pair");
        history.push({
          day: d.day,
          pair: a.args.target_ids,
          decisions: [],
          resolved: a.args.target_ids === null,
        });
      }
      if (d.stage === "warden_decide") {
        check(a?.name === "warden_decide");
        const h = history.find((h) => h.day === d.day);
        check(
          h?.pair &&
            h.pair.includes(d.actorId) &&
            !h.decisions.some((x) => x.playerId === d.actorId),
        );
        const ix = history.indexOf(h),
          decisions = [...h.decisions, { playerId: d.actorId, choice: a.args.choice }];
        history[ix] = { ...h, decisions, resolved: decisions.length === 2 };
      }
    }
    const state = readWardenStateData(cp.players.find((p) => p.id === actor)?.privateState.warden);
    check(state && same(state.history, history));
    check(
      same(
        cp.players
          .filter((p) => p.alive)
          .map((p) => p.id)
          .sort((a, b) => a - b),
        [...aliveAt[cp.eventCount]!].sort((a, b) => a - b),
      ),
    );
    for (const p of cp.players) {
      const original = originals.get(p.id);
      check(original && original.role === p.role && original.camp === p.camp);
      if (p.id !== actor) check(!Object.hasOwn(p.privateState, "warden"));
    }
    if (cp.complete) {
      check(history.every((h) => h.resolved));
      for (const d of known)
        if (d.stage === "warden_pair" || d.stage === "warden_decide")
          check((factFor.get(d) ?? Infinity) <= cp.eventCount);
    }
  }
}
