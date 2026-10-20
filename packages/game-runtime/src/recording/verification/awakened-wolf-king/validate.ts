/**
 * 负责觉醒狼王/受传狼爪的独立归档账本。输入是纯板参数、实际决定、事实及检查点，输出接受或拒绝。
 * 本模块自行重建两个原生单位、永久转出、单受传单位与逐次消费，不导入生产库存、许可或死亡写者。
 * 通用死亡历史审核拥有词/徽与中立枪事实规则；本族额外约束来源、按单位付款、首枪后继续及私有受众。
 * JSON没有原生命句柄；已知失败候选必须精确，跨await原体与实际执行兼容仍由同构建严格重放确认。
 */
import { Camp, Phase, Role } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_CLAW_POLICY,
  AWAKENED_CLAW_EVENT_TYPES,
  readAwakenedClawFact,
  readAwakenedClawStateData,
  type AwakenedClawState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import type { RecordedDecision, ReproductionRecord } from "../../reproduction/format";
function check(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_awakened_claw_invalid");
}
function same(a: unknown, b: unknown): boolean {
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
}
const candidate = (d: RecordedDecision) =>
  d.outcome.kind === "action"
    ? d.outcome.action
    : d.outcome.kind === "error"
      ? d.returnedCandidate
      : null;
const clone = <T>(value: T): T => structuredClone(value);
const clawShot = (d: RecordedDecision) =>
  d.stage === "death_shot" && d.request.context.ability_id?.startsWith("awakened_claw:") === true;
function request(d: RecordedDecision, tool: "bequeath_claw" | "shoot"): void {
  check(
    d.actorId === d.request.actorId &&
      d.day === d.request.context.day &&
      d.stage === d.request.context.stage &&
      same(d.request.allowedTools, [tool]) &&
      d.request.context.action_failure_policy === "error" &&
      d.request.context.allow_fallback === false,
  );
}
function initial(): AwakenedClawState {
  return {
    policy: AWAKENED_CLAW_POLICY,
    units: [1, 2].map((index) => ({
      id: `awakened_claw:native:${index}`,
      source: { kind: "native", index: index as 1 | 2 },
      status: "ready",
    })),
    bequests: [],
  };
}
function status(
  stock: AwakenedClawState,
  id: string,
  next: "spent" | "transferred" | "expired",
): AwakenedClawState {
  check(stock.units.some((u) => u.id === id && u.status === "ready"));
  return { ...stock, units: stock.units.map((u) => (u.id === id ? { ...u, status: next } : u)) };
}
function transfer(
  stocks: Map<number, AwakenedClawState>,
  actor: number,
  target: number,
  day: number,
  install = true,
): void {
  const old = stocks.get(actor),
    unit = old?.units.find((u) => u.status === "ready" && u.source.kind === "native");
  check(old && unit && unit.source.kind === "native" && !stocks.has(target));
  const next = status(old, unit.id, "transferred");
  stocks.set(actor, {
    ...next,
    bequests: [...old.bequests, { day, targetId: target, unitId: unit.id }],
  });
  if (install)
    stocks.set(target, {
      policy: AWAKENED_CLAW_POLICY,
      units: [
        {
          id: `awakened_claw:bequest:${actor}:${day}:${unit.source.index}`,
          source: { kind: "bequest", giverId: actor, giverUnitId: unit.id, day },
          status: "ready",
        },
      ],
      bequests: [],
    });
}
function board(record: ReproductionRecord): void {
  const c = record.metadata.normalizedBoard,
    size = c.boardSize,
    awakenedWitch = c.awakenedWitch !== undefined;
  check(size === 10 || size === 12);
  // 觉醒女巫的原十二人是另一份来源牌池；只认本板固定政策，不借metadata角色名册允许任意合板。
  const roles = awakenedWitch
    ? {
        wolf: 3,
        awakened_wolf_king: 1,
        villager: 4,
        seer: 1,
        guard: 1,
        hunter: 1,
        awakened_witch: 1,
      }
    : {
        wolf: size === 10 ? 2 : 3,
        awakened_wolf_king: 1,
        villager: 4,
        seer: 1,
        witch: 1,
        miracle_merchant: 1,
        ...(size === 12 ? { dreamer: 1 } : {}),
      };
  check(
    c.roleSetups.length === Object.keys(roles).length &&
      same(Object.fromEntries(c.roleSetups.map((r) => [r.role, r.count])), roles) &&
      same(c.awakenedWolfKing, { policy: AWAKENED_CLAW_POLICY }) &&
      same(c.winConditions ?? [c.winCondition], ["slaughter_side"]) &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      (awakenedWitch
        ? size === 12 &&
          same(c.awakenedWitch, { policy: "awa_awakened_witch_v1" }) &&
          c.witch === undefined &&
          c.dreamer === undefined &&
          same(c.guard, { repeatPolicy: "awa_last_action_v1" }) &&
          same(c.hunter, { deathActionPolicy: "awa_qualified_sources_v1" }) &&
          same(c.seer, {
            targetPolicy: "awa_alive_v1",
            actionPolicy: "awa_required_when_legal_v1",
          }) &&
          same(c.lastWords, { policy: "awa_initial_wave_v1" }) &&
          same(c.disclosure, { deathRevealPolicy: "awa_hidden_v1" })
        : c.witch?.canSelfHeal === (size === 10 ? "first_night_only" : "disabled")) &&
      c.voting?.exilePolicy === "awa_one_pk_v1" &&
      (awakenedWitch || size === 10
        ? c.dreamer === undefined
        : same(c.dreamer, { protectionPolicy: "awa_night_damage_v1" })),
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
    "tieBreaker",
    "voting",
    "disclosure",
    "lastWords",
    "roleSetups",
    "awakenedWolfKing",
    "dreamer",
    ...(awakenedWitch ? ["awakenedWitch", "guard", "hunter"] : []),
  ]);
  check(Object.keys(c).every((k) => allowed.has(k)));
}
interface Death {
  day: number;
  origin: string;
  causes: string[];
  known: boolean;
}
interface Shot {
  actor: number;
  target: number;
  at: number;
  resolvedAt?: number;
}
interface Prefix {
  day: number;
  phase: string;
  alive: number[];
  stocks: Map<number, AwakenedClawState>;
  deaths: Map<number, Death>;
}
const qualified = (causes: readonly string[]) =>
  causes.length > 0 && causes.every((c) => ["wolf_kill", "exile", "shot"].includes(c));
export function validateAwakenedClawRecord(record: ReproductionRecord): void {
  const c = record.metadata.normalizedBoard,
    owns = c.roleSetups.some((r) => r.role === Role.AwakenedWolfKing && r.count > 0);
  const artifacts =
    record.events.some((e) => (AWAKENED_CLAW_EVENT_TYPES as readonly string[]).includes(e.type)) ||
    record.decisions.some(
      (d) =>
        d.stage === "awakened_claw_bequest" ||
        d.request.allowedTools.includes("bequeath_claw") ||
        clawShot(d),
    ) ||
    record.checkpoints.some((cp) =>
      cp.players.some((p) => Object.hasOwn(p.privateState, "awakenedClaws")),
    );
  if (!owns) {
    check(
      !c.awakenedWolfKing &&
        !artifacts &&
        !record.metadata.players.some((p) => p.role === Role.AwakenedWolfKing),
    );
    return;
  }
  board(record);
  const originals = new Map(record.metadata.players.map((p) => [p.id, p])),
    kings = record.metadata.players.filter((p) => p.role === Role.AwakenedWolfKing);
  check(kings.length === 1 && kings[0]!.camp === Camp.Wolf && originals.size === c.boardSize);
  check(
    same(
      Object.fromEntries(c.roleSetups.map((r) => [r.role, r.count])),
      Object.fromEntries(
        [...new Set(record.metadata.players.map((p) => p.role))].map((role) => [
          role,
          record.metadata.players.filter((p) => p.role === role).length,
        ]),
      ),
    ) &&
      record.metadata.players.every(
        (p) =>
          p.camp === ([Role.Wolf, Role.AwakenedWolfKing].includes(p.role) ? Camp.Wolf : Camp.Good),
      ),
  );
  const king = kings[0]!.id,
    alive = new Set(originals.keys()),
    stocks = new Map<number, AwakenedClawState>([[king, initial()]]),
    deaths = new Map<number, Death>(),
    facts = new Map<RecordedDecision, number>(),
    shots: Shot[] = [];
  const dreams = new Map<number, { actor: number; target: number; consecutive: boolean }>();
  const prefixes: Prefix[] = [],
    nightOps = record.operations.filter(
      (o) => o.scope === "resolution" && o.op === "night_damage_resolved",
    );
  let day = 1,
    phase: string = Phase.Night,
    night = 0;
  const snap = (): Prefix => ({
    day,
    phase,
    alive: [...alive],
    stocks: clone(stocks),
    deaths: clone(deaths),
  });
  prefixes[0] = snap();
  const die = (id: number, causes: string[], origin = phase, known = true) => {
    check(originals.has(id));
    alive.delete(id);
    const prior = deaths.get(id);
    deaths.set(id, {
      day,
      origin,
      causes: [...new Set(prior?.day === day ? [...prior.causes, ...causes] : causes)],
      known: known && (prior?.day === day ? prior.known : true),
    });
  };
  const decision = (actor: number, stage: string, index: number, unit?: string) => {
    const found = record.decisions.filter(
      (d) =>
        d.actorId === actor &&
        d.stage === stage &&
        d.day === day &&
        (unit === undefined || d.request.context.ability_id === unit) &&
        d.outcome.kind === "action" &&
        d.openedAtEventCount !== undefined &&
        d.openedAtEventCount <= index &&
        !facts.has(d),
    );
    check(found.length === 1);
    return found[0]!;
  };
  for (const [index, e] of record.events.entries()) {
    const p = e.payload;
    if (e.type === "phase_changed") {
      day = p.day as number;
      phase = p.phase as string;
    }
    if (e.type === "dream_applied") {
      check(
        c.boardSize === 12 &&
          originals.get(p.actorId as number)?.role === Role.Dreamer &&
          p.day === day &&
          typeof p.targetId === "number" &&
          alive.has(p.targetId) &&
          typeof p.consecutive === "boolean",
      );
      // 梦事实不是保护的自证：同一真实夜唯一、原摄梦人仍活，且必须由此前实际完成的dream决定付款。
      const actor = p.actorId as number,
        d = decision(actor, "dreamer", index),
        opening = prefixes[d.openedAtEventCount!],
        previous = dreams.get(day - 1),
        consecutive = previous?.actor === actor && previous.target === p.targetId;
      check(
        phase === Phase.Night &&
          alive.has(actor) &&
          !dreams.has(day) &&
          opening?.phase === Phase.Night &&
          opening.day === day &&
          opening.alive.includes(actor) &&
          opening.alive.includes(p.targetId) &&
          d.request.actorId === actor &&
          d.request.phase === Phase.Night &&
          d.request.context.day === day &&
          d.request.context.stage === "dreamer" &&
          same(d.request.allowedTools, ["dream"]) &&
          d.outcome.kind === "action" &&
          d.outcome.action?.name === "dream" &&
          same(d.outcome.action.args, { target_id: p.targetId }) &&
          p.consecutive === consecutive,
      );
      facts.set(d, index + 1);
      dreams.set(day, { actor, target: p.targetId, consecutive });
    }
    if (e.type === "night_resolved") {
      // 狼王仍活且有原生爪时，真实夜结算必须先经历唯一传授请求；不能把缺失请求伪装成null空过。
      if (
        alive.has(king) &&
        stocks.get(king)?.units.some((u) => u.source.kind === "native" && u.status === "ready")
      ) {
        const turns = record.decisions.filter(
          (d) =>
            d.actorId === king &&
            d.day === day &&
            d.stage === "awakened_claw_bequest" &&
            d.openedAtEventCount !== undefined &&
            d.openedAtEventCount <= index,
        );
        check(turns.length === 1);
        const d = turns[0]!,
          action = candidate(d);
        check(
          d.outcome.kind === "action" &&
            action?.name === "bequeath_claw" &&
            (action.args.target_id === null || (facts.get(d) ?? Infinity) <= index),
        );
      }
      check(Array.isArray(p.deaths));
      const output = nightOps[night++]?.output;
      if (!output) {
        // 非最终Trace尚未注入Session的操作快照；仅保待证前缀，最终归档不能借此省略真实死因。
        check(!record.finalized);
        for (const id of p.deaths as number[]) die(id, [], Phase.Night, false);
      } else {
        const raw = output.deaths,
          source = output.death_sources;
        check(Array.isArray(raw) && source && typeof source === "object");
        const expected = new Map<number, string[]>();
        for (const id of raw) {
          check(typeof id === "number");
          const causes = (source as Record<string, unknown>)[String(id)];
          check(Array.isArray(causes) && causes.every((x) => typeof x === "string"));
          expected.set(id, [...(causes as string[])]);
        }
        // 原夜伤输出可能早于梦的初始连锁；只从当夜已发表原摄梦关系追加必然Dream来源，不扩到任意公告差集。
        const dream = dreams.get(day);
        if (dream && (dream.consecutive || expected.has(dream.actor)))
          expected.set(dream.target, [
            ...new Set([...(expected.get(dream.target) ?? []), "dream"]),
          ]);
        check(
          same(
            [...expected.keys()].sort((a, b) => a - b),
            [...(p.deaths as number[])].sort((a, b) => a - b),
          ),
        );
        for (const [id, causes] of expected) die(id, causes, Phase.Night);
      }
    }
    if (e.type === "voted_out") die(p.target as number, ["exile"], Phase.Voting);
    if (e.type === "wolf_self_destruct") die(p.wolfId as number, ["self_destruct"]);
    if (e.type === "dream_death")
      die(
        p.targetId as number,
        ["dream"],
        p.reason === "consecutive"
          ? Phase.Night
          : (deaths.get(p.actorId as number)?.origin ?? phase),
      );
    if (e.type === "additional_deaths") {
      check(Array.isArray(p.deaths));
      for (const id of p.deaths as number[]) alive.delete(id);
    }
    if (e.type === "player_shot" || e.type === "hunter_shot" || e.type === "death_shot_blocked") {
      const actor = (e.type === "hunter_shot" ? p.hunterId : p.actorId) as number,
        target = p.targetId as number;
      const pending = shots.filter(
        (s) => s.actor === actor && s.target === target && s.resolvedAt === undefined,
      );
      if (stocks.has(actor)) {
        check(pending.length === 1);
        const dream = dreams.get(day),
          protectedTarget =
            c.boardSize === 12 &&
            deaths.get(actor)?.origin === Phase.Night &&
            dream?.target === target &&
            !dream.consecutive;
        check(
          e.type === "death_shot_blocked"
            ? protectedTarget &&
                !record.events
                  .slice(pending[0]!.at, index)
                  .some((x) => x.type === "dream_death" && x.payload.targetId === target)
            : !protectedTarget,
        );
        pending[0]!.resolvedAt = index + 1;
      }
      if (e.type === "player_shot" || e.type === "hunter_shot")
        die(target, ["shot"], deaths.get(actor)?.origin ?? phase);
    }
    if ((AWAKENED_CLAW_EVENT_TYPES as readonly string[]).includes(e.type)) {
      const f = readAwakenedClawFact(e.type, p);
      check(f && f.payload.day === day);
      const q = f.payload,
        expected =
          f.type === "awakened_claw_bequeathed"
            ? [q.actorId, f.payload.targetId].sort((a, b) => a - b)
            : f.type === "awakened_claw_spent"
              ? [q.actorId]
              : [];
      check(Array.isArray(e.audience) && same(e.audience, expected));
      if (f.type === "awakened_claw_bequeathed") {
        const q = f.payload,
          old = stocks.get(king),
          unit = old?.units.find((u) => u.status === "ready" && u.source.kind === "native");
        check(
          phase === Phase.Night &&
            q.actorId === king &&
            alive.has(king) &&
            alive.has(q.targetId) &&
            q.targetId !== king &&
            originals.get(q.targetId)?.role === Role.Wolf &&
            originals.get(q.targetId)?.camp === Camp.Wolf &&
            !stocks.has(q.targetId) &&
            unit &&
            q.unitId === unit.id &&
            unit.source.kind === "native" &&
            q.receivedUnitId === `awakened_claw:bequest:${king}:${day}:${unit.source.index}`,
        );
        const d = decision(king, "awakened_claw_bequest", index);
        request(d, "bequeath_claw");
        const action = candidate(d);
        check(action?.name === "bequeath_claw" && same(action.args, { target_id: q.targetId }));
        facts.set(d, index + 1);
        transfer(stocks, king, q.targetId, day);
      }
      if (f.type === "awakened_claw_spent") {
        const q = f.payload,
          stock = stocks.get(q.actorId),
          unit = stock?.units.find((u) => u.id === q.unitId),
          death = deaths.get(q.actorId);
        check(
          stock &&
            unit?.status === "ready" &&
            !alive.has(q.actorId) &&
            death &&
            death.day === day &&
            (death.known ? qualified(death.causes) : !record.finalized) &&
            (q.targetId === null || alive.has(q.targetId)),
        );
        const d = decision(q.actorId, "death_shot", index, q.unitId);
        request(d, "shoot");
        const action = candidate(d);
        check(action?.name === "shoot" && same(action.args, { target_id: q.targetId }));
        check(!shots.some((s) => s.actor === q.actorId && s.resolvedAt === undefined));
        stocks.set(q.actorId, status(stock, q.unitId, "spent"));
        facts.set(d, index + 1);
        if (q.targetId !== null)
          shots.push({ actor: q.actorId, target: q.targetId, at: index + 1 });
      }
      if (f.type === "awakened_claws_expired") {
        const q = f.payload,
          stock = stocks.get(q.actorId),
          death = deaths.get(q.actorId);
        check(
          stock &&
            death?.day === day &&
            !alive.has(q.actorId) &&
            (death.known ? !qualified(death.causes) : !record.finalized),
        );
        const ids = stock.units.filter((u) => u.status === "ready").map((u) => u.id);
        check(ids.length > 0 && same(ids, q.unitIds));
        let next = stock;
        for (const id of ids) next = status(next, id, "expired");
        stocks.set(q.actorId, next);
      }
    }
    prefixes[index + 1] = snap();
  }
  // 逐请求核发布前的完整本族知识；双方传授与本人消费不可向其它队友补发，God失效不入玩家feed。
  for (const d of record.decisions) {
    check(d.openedAtEventCount !== undefined && !!prefixes[d.openedAtEventCount]);
    const start = prefixes[d.openedAtEventCount]!;
    if (d.stage === "awakened_claw_bequest" || clawShot(d)) check(start.day === d.day);
    const expected = record.events
      .slice(0, d.openedAtEventCount)
      .filter(
        (e) =>
          (AWAKENED_CLAW_EVENT_TYPES as readonly string[]).includes(e.type) &&
          e.audience?.includes(d.actorId),
      )
      .map((e) => ({ type: e.type, payload: e.payload }));
    const actual = d.request.context.visible_events
      .filter((e) => (AWAKENED_CLAW_EVENT_TYPES as readonly string[]).includes(e.type))
      .map((e) => ({ type: e.type, payload: e.payload }));
    check(same(expected, actual));
    if (d.stage === "awakened_claw_bequest") {
      request(d, "bequeath_claw");
      const stock = start.stocks.get(king);
      check(
        d.actorId === king &&
          start.phase === Phase.Night &&
          d.request.phase === Phase.Night &&
          start.alive.includes(king) &&
          stock?.units.some((u) => u.source.kind === "native" && u.status === "ready"),
      );
      const candidates = start.alive.filter(
        (id) => id !== king && originals.get(id)?.role === Role.Wolf && !start.stocks.has(id),
      );
      check(same(d.request.context.claw_bequest_candidates, candidates));
      const action = candidate(d);
      if (action && action.name === "bequeath_claw")
        check(action.args.target_id === null || candidates.includes(action.args.target_id));
    }
    if (clawShot(d)) {
      request(d, "shoot");
      const stock = start.stocks.get(d.actorId),
        unit = stock?.units.find((u) => u.id === d.request.context.ability_id),
        death = start.deaths.get(d.actorId);
      check(
        unit?.status === "ready" &&
          !start.alive.includes(d.actorId) &&
          death?.day === d.day &&
          (death.known
            ? qualified(death.causes) &&
              same([...(d.request.context.death_sources ?? [])].sort(), [...death.causes].sort())
            : !record.finalized && qualified(d.request.context.death_sources ?? [])) &&
          same(
            d.request.context.shoot_candidates,
            start.alive.filter((id) => id !== d.actorId),
          ) &&
          d.request.phase === start.phase,
      );
      const prior = shots.filter((s) => s.actor === d.actorId && s.at <= d.openedAtEventCount!);
      check(
        prior.every((s) => s.resolvedAt !== undefined && s.resolvedAt <= d.openedAtEventCount!),
      );
      // 仅见首个player_shot还不足以继续。本族原板可能命中受赠枪/受传爪或摄梦人；
      // 后代的实际事实和死亡请求都必须完成，才允许同源下一爪开窗，不把其它独立死亡并作本族链。
      for (const shot of prior) {
        if (
          shot.resolvedAt === undefined ||
          record.events[shot.resolvedAt - 1]?.type !== "player_shot"
        )
          continue;
        const descendants = new Set([shot.target]),
          stop = facts.get(d) ?? record.events.length;
        for (let i = shot.resolvedAt; i < stop; i++) {
          const e = record.events[i]!;
          if (e.type === "phase_changed") break;
          const p = e.payload;
          if (
            (e.type === "player_shot" ||
              e.type === "hunter_shot" ||
              e.type === "death_shot_blocked" ||
              e.type === "dream_death") &&
            typeof (e.type === "hunter_shot" ? p.hunterId : p.actorId) === "number" &&
            descendants.has((e.type === "hunter_shot" ? p.hunterId : p.actorId) as number)
          ) {
            check(i < d.openedAtEventCount!);
            if (e.type !== "death_shot_blocked") descendants.add(p.targetId as number);
          }
          if (
            (e.type === "last_words_granted" || e.type === "last_words_spoken") &&
            descendants.has(p.playerId as number)
          )
            check(i < d.openedAtEventCount!);
          if (
            (e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed") &&
            descendants.has(
              (e.type === "sheriff_badge_destroyed" ? p.targetId : p.fromId) as number,
            )
          )
            check(i < d.openedAtEventCount!);
        }
        for (const child of record.decisions) {
          if (
            child.day !== d.day ||
            !descendants.has(child.actorId) ||
            child.openedAtEventCount === undefined ||
            child.openedAtEventCount < shot.resolvedAt ||
            child.openedAtEventCount >= stop ||
            !child.request.allowedTools.some((t) =>
              ["shoot", "speak", "choose_badge_successor"].includes(t),
            ) ||
            !["death_shot", "last_words", "sheriff_badge_choice"].includes(child.stage)
          )
            continue;
          check(
            child.outcome.kind === "action" &&
              child.settleOrder !== undefined &&
              d.openedAfterSettlement !== undefined &&
              child.settleOrder <= d.openedAfterSettlement &&
              child.openedAtEventCount <= d.openedAtEventCount!,
          );
        }
      }
    }
  }
  for (const cp of record.checkpoints) {
    check(
      cp.decisionCount !== undefined &&
        cp.settlementCount !== undefined &&
        cp.decisionCount <= record.decisions.length,
    );
    const prefix = prefixes[cp.eventCount];
    check(prefix);
    const known = record.decisions
        .slice(0, cp.decisionCount)
        .filter((d) => d.settleOrder !== undefined && d.settleOrder <= cp.settlementCount!),
      expected = prefix.stocks;
    const matches = (book: Map<number, AwakenedClawState>) =>
      cp.players.every((p) => {
        const original = originals.get(p.id);
        check(original && p.role === original.role && p.camp === original.camp);
        const stock = book.get(p.id);
        if (!stock) return !Object.hasOwn(p.privateState, "awakenedClaws");
        const actual = readAwakenedClawStateData(p.privateState.awakenedClaws);
        return actual !== null && same(stock, actual);
      });
    let matched = matches(expected);
    // 未发表付款只在失败CP允许；精确已知候选约束一次首写/次写前缀，不将error改为接受或凭空补库存。
    if (!cp.complete && !matched) {
      for (const d of known) {
        if ((facts.get(d) ?? Infinity) <= cp.eventCount) continue;
        const call = candidate(d),
          start = prefixes[d.openedAtEventCount!];
        if (!call || !start) continue;
        if (
          d.stage === "awakened_claw_bequest" &&
          call.name === "bequeath_claw" &&
          call.args.target_id !== null
        ) {
          const id = call.args.target_id,
            legal = d.request.context.claw_bequest_candidates?.includes(id);
          if (
            !legal ||
            !expected.get(king)?.units.some((u) => u.status === "ready") ||
            expected.has(id)
          )
            continue;
          for (const install of [false, true]) {
            const book = clone(expected);
            transfer(book, king, id, d.day, install);
            matched ||= matches(book);
          }
        }
        if (clawShot(d) && call.name === "shoot") {
          const unit = d.request.context.ability_id!,
            stock = expected.get(d.actorId),
            target = call.args.target_id;
          if (
            !stock?.units.some((u) => u.id === unit && u.status === "ready") ||
            (target !== null && !start.alive.includes(target))
          )
            continue;
          const book = clone(expected);
          book.set(d.actorId, status(stock, unit, "spent"));
          matched ||= matches(book);
        }
      }
      // 禁用死因可在逐单位失效写入后、God事实发表前失败；只接受原库存按固定顺序的一段失效前缀。
      for (const [id, stock] of expected) {
        const death = prefix.deaths.get(id);
        if (!death || (death.known && qualified(death.causes)) || prefix.alive.includes(id))
          continue;
        const book = clone(expected);
        let next = stock;
        for (const unit of stock.units.filter((u) => u.status === "ready")) {
          next = status(next, unit.id, "expired");
          book.set(id, next);
          matched ||= matches(book);
        }
      }
    }
    check(matched);
    check(
      same(
        cp.players
          .filter((p) => p.alive)
          .map((p) => p.id)
          .sort((a, b) => a - b),
        [...prefix.alive].sort((a, b) => a - b),
      ),
    );
    if (cp.complete) {
      for (const d of known)
        if (d.stage === "awakened_claw_bequest" || clawShot(d)) {
          check(d.outcome.kind === "action");
          const action = d.outcome.action;
          check(
            action &&
              ((d.stage === "awakened_claw_bequest" &&
                action.name === "bequeath_claw" &&
                action.args.target_id === null) ||
                (facts.has(d) && facts.get(d)! <= cp.eventCount)),
          );
        }
      for (const [id, stock] of expected)
        if (!prefix.alive.includes(id)) check(!stock.units.some((u) => u.status === "ready"));
      for (const shot of shots)
        if (shot.at <= cp.eventCount)
          check(shot.resolvedAt !== undefined && shot.resolvedAt <= cp.eventCount);
    }
  }
}
