/**
 * 负责原十二人觉醒骑士板的独立联合账本。输入纯配置、原身份、动作、夜伤操作、事实及God检查点，
 * 输出接受或具名拒绝；自行重建全天盾→狼美人替死→替身盾→真实死亡以及成功决斗续窗。
 * 不导入生产角色库存、authority、致死准备或板支持谓词；声明／付款不是Alive，归档不恢复运行原体权限。
 * 周期和尝试只有各自一份历史；失败检查点仅接受已知候选可证明的末写，不能退款已发表前缀。
 */
import { Camp, Phase, DeathCause, ActionWindow } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_BEAUTY_POLICY as bp,
  readAwakenedBeautyFact,
  readAwakenedBeautyStateData,
  AWAKENED_BEAUTY_EVENT_TYPES,
  type AwakenedBeautyState,
  type AwakenedBeautyPayment,
} from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import {
  AWAKENED_GUARD_POLICY as gp,
  readAwakenedGuardFact,
  readAwakenedGuardStateData,
  isAwakenedGuardEventType,
  awakenedGuardFactAudience,
  type AwakenedGuardState,
  type AwakenedGuardCycle,
} from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import {
  AWAKENED_DUEL_POLICY as kp,
  readAwakenedDuelFact,
  readAwakenedKnightStateData,
  isAwakenedDuelEventType,
  type AwakenedKnightState,
  type AwakenedDuelAttempt,
} from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import type { RecordedDecision, ReproductionRecord } from "../../reproduction/format";
const ERROR = "reproduction_awakened_day_roles_invalid";
function check(v: unknown): asserts v {
  if (!v) throw Error(ERROR);
}
const same = (a: unknown, b: unknown): boolean => {
  const stable = (v: any): any =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, stable(v)]),
          )
        : v;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
};
const sorted = (v: readonly number[]) => [...v].sort((a, b) => a - b);
const clone = <T>(v: T): T => structuredClone(v);
const beautyFact = (type: string) =>
  (AWAKENED_BEAUTY_EVENT_TYPES as readonly string[]).includes(type);
const fact = (type: string) =>
  beautyFact(type) || isAwakenedGuardEventType(type) || isAwakenedDuelEventType(type);
const stages = [
  "awakened_charm",
  "awakened_protection_night",
  "awakened_protection_day",
  "awakened_duel",
  "awakened_duel_continue",
];
const family = (d: RecordedDecision) => stages.includes(d.stage);
const candidate = (d: RecordedDecision) =>
  d.outcome.kind === "action"
    ? d.outcome.action
    : d.outcome.kind === "error"
      ? d.returnedCandidate
      : null;
const source = (v: unknown): string[] => {
  check(
    Array.isArray(v) &&
      v.length &&
      new Set(v).size === v.length &&
      v.every((x) => Object.values(DeathCause).includes(x)),
  );
  return [...v].sort();
};
interface Chain {
  id: number;
  day: number;
  target: number;
  branch: "wolf" | "good";
  at: number;
  resolvedAt?: number;
  endedAt?: number;
}
interface Wave {
  kind: "night" | "exile" | "duel" | "blast";
  root: Phase;
  proposed: Map<number, string[]>;
  remaining: Map<number, string[]>;
  committed: boolean;
  blocked: number[];
  replacement: AwakenedBeautyPayment | null;
  roots: Map<number, Phase>;
  hasNight: boolean;
  nightReported: boolean;
}
interface Prefix {
  day: number;
  phase: string;
  alive: number[];
  beauty: AwakenedBeautyState;
  guard: AwakenedGuardState;
  knight: AwakenedKnightState;
  expired: boolean;
  chain: Chain | null;
  wave: Wave | null;
  exile: number | null;
  revealPending: boolean;
  detailPending: number | null;
  replacementPublished: boolean;
  wordsComplete: boolean;
  nightPublished: boolean;
  nativeDamage: Map<number, string[]>;
  blast: { actor: number; window: string; at: number } | null;
}
/** 有限原板逐字段核对；生产support声明不能替代本账本自己的牌池与政策预期。 */
function board(r: ReproductionRecord): void {
  const c = r.metadata.normalizedBoard,
    roles = {
      wolf: 3,
      awakened_wolf_beauty: 1,
      villager: 4,
      seer: 1,
      witch: 1,
      awakened_guard: 1,
      awakened_knight: 1,
    };
  check(
    c.boardSize === 12 &&
      c.roleSetups.length === 7 &&
      new Set(c.roleSetups.map((x) => x.role)).size === 7 &&
      same(Object.fromEntries(c.roleSetups.map((x) => [x.role, x.count])), roles) &&
      same(c.awakenedWolfBeauty, { policy: bp }) &&
      same(c.awakenedGuard, { policy: gp }) &&
      same(c.awakenedKnight, { policy: kp }) &&
      !c.awakenedHunter,
  );
  check(
    same(c.winConditions ?? [c.winCondition], ["slaughter_side"]) &&
      c.voting?.exilePolicy === "awa_one_pk_v1" &&
      c.disclosure?.deathRevealPolicy === "awa_hidden_v1" &&
      c.lastWords?.policy === "awa_initial_wave_v1" &&
      c.witch?.canSelfHeal === "disabled" &&
      c.witch?.knifeVisibility === "awa_with_heal_v1" &&
      c.witch?.potionPolicy === "awa_one_native_v1" &&
      c.seer?.targetPolicy === "awa_alive_v1" &&
      c.seer?.actionPolicy === "awa_required_when_legal_v1",
  );
  const allowed = new Set([
    "boardSize",
    "enableSheriff",
    "initialSheriffSeat",
    "roleSetups",
    "winCondition",
    "winConditions",
    "hooks",
    "selfDestruct",
    "sheriff",
    "seer",
    "witch",
    "tieBreaker",
    "voting",
    "disclosure",
    "lastWords",
    "awakenedWolfBeauty",
    "awakenedGuard",
    "awakenedKnight",
  ]);
  check(Object.keys(c).every((k) => allowed.has(k)));
}
export function validateAwakenedDayRolesRecord(r: ReproductionRecord): void {
  const c = r.metadata.normalizedBoard,
    has = !!c.awakenedGuard || !!c.awakenedKnight;
  const artifacts =
    r.events.some((e) => isAwakenedGuardEventType(e.type) || isAwakenedDuelEventType(e.type)) ||
    r.decisions.some(
      (d) =>
        stages.slice(1).includes(d.stage) ||
        d.request.allowedTools.some((t) => t === "awakened_protect" || t === "awakened_duel"),
    ) ||
    r.checkpoints.some((cp) =>
      cp.players.some(
        (p) =>
          Object.hasOwn(p.privateState, "awakenedGuard") ||
          Object.hasOwn(p.privateState, "awakenedKnight"),
      ),
    );
  if (!has) {
    check(
      !artifacts &&
        !c.roleSetups.some((x) => ["awakened_guard", "awakened_knight"].includes(x.role)) &&
        !r.metadata.players.some((x) => ["awakened_guard", "awakened_knight"].includes(x.role)),
    );
    return;
  }
  board(r);
  check(
    !r.events.some((e) => e.type.startsWith("awakened_patrol")) &&
      !r.decisions.some(
        (d) => d.stage === "awakened_patrol" || d.request.allowedTools.includes("patrol"),
      ) &&
      !r.checkpoints.some((cp) =>
        cp.players.some((p) => Object.hasOwn(p.privateState, "awakenedPatrol")),
      ),
  );
  const originals = new Map(r.metadata.players.map((p) => [p.id, p]));
  check(
    originals.size === 12 &&
      same(
        sorted([...originals.keys()]),
        Array.from({ length: 12 }, (_, i) => i + 1),
      ) &&
      r.metadata.players.every(
        (p) =>
          p.camp === (["wolf", "awakened_wolf_beauty"].includes(p.role) ? Camp.Wolf : Camp.Good),
      ) &&
      same(
        Object.fromEntries(c.roleSetups.map((x) => [x.role, x.count])),
        Object.fromEntries(
          [...new Set(r.metadata.players.map((x) => x.role))].map((role) => [
            role,
            r.metadata.players.filter((p) => p.role === role).length,
          ]),
        ),
      ),
  );
  const actor = (role: string) => {
      const ids = r.metadata.players.filter((p) => p.role === role);
      check(ids.length === 1);
      return ids[0]!.id;
    },
    beauty = actor("awakened_wolf_beauty"),
    guard = actor("awakened_guard"),
    knight = actor("awakened_knight"),
    witch = actor("witch");
  const alive = new Set(originals.keys()),
    prefixes: Prefix[] = [],
    used = new Map<RecordedDecision, number>(),
    votes = new Map<number, Map<number, number | null>>(),
    potions = new Map<number, { heal: number | null; poison: number | null }>(),
    nightAlive = new Map<number, number[]>(),
    ops = r.operations.filter((o) => o.scope === "resolution" && o.op === "night_damage_resolved"),
    publishedNights = new Set<number>();
  let day = 1,
    phase: string = Phase.Night,
    bs: AwakenedBeautyState = { policy: bp, choices: [], replacement: null },
    gs: AwakenedGuardState = { policy: gp, cycles: [] },
    ks: AwakenedKnightState = { policy: kp, attempts: [] },
    expired = false,
    chain: Chain | null = null,
    wave: Wave | null = null,
    exile: number | null = null,
    healUsed = false,
    poisonUsed = false,
    lastDetail: number | null = null,
    revealed = false,
    revealPending = false,
    replacementPublished = false,
    blast: { actor: number; window: string; at: number } | null = null;
  const blasted = new Set<string>();
  const deferred: Array<{
    id: number;
    day: number;
    chain: number;
    phase: string;
    at: number;
    grantAt?: number;
    spokenAt?: number;
  }> = [];
  nightAlive.set(1, [...alive]);
  const snap = (): Prefix => ({
    day,
    phase,
    alive: [...alive],
    beauty: clone(bs),
    guard: clone(gs),
    knight: clone(ks),
    expired,
    chain: clone(chain),
    wave: clone(wave),
    exile,
    revealPending,
    detailPending: lastDetail,
    replacementPublished,
    nightPublished: publishedNights.has(day),
    nativeDamage: raw(day),
    blast: clone(blast),
    wordsComplete: deferred
      .filter((w) => w.day === day && w.chain === chain?.id)
      .every((w) => w.spokenAt !== undefined),
  });
  const knife = (at: number) => {
    const tally = new Map<number, number>();
    for (const id of votes.get(at)?.values() ?? [])
      if (id !== null) tally.set(id, (tally.get(id) ?? 0) + 1);
    return [...tally].sort(([a, na], [b, nb]) => nb - na || a - b)[0]?.[0] ?? null;
  };
  const raw = (at: number) => {
    const start = nightAlive.get(at);
    check(start);
    const out = new Map<number, string[]>(),
      p = potions.get(at),
      target = knife(at);
    for (const id of start) {
      const cs: string[] = [];
      if (id === target && p?.heal !== id) cs.push("wolf_kill");
      if (p?.poison === id) cs.push("poison");
      if (cs.length) out.set(id, cs.sort());
    }
    return out;
  };
  const verifyRaw = (at: number, index: number) => {
    const out = raw(at),
      op = ops[at - 1];
    // 实时build尚不附logicOps；最终归档才必须带真实操作，缺失不可让finalized绕审。
    if (!op) {
      check(!r.finalized);
      return out;
    }
    check(
      op &&
        op.output &&
        Array.isArray(op.output.deaths) &&
        op.output.death_sources &&
        typeof op.output.death_sources === "object",
    );
    check(
      same(sorted(op.output.deaths as number[]), sorted([...out.keys()])) &&
        same(
          Object.fromEntries(
            Object.entries(op.output.death_sources).map(([id, cs]) => [id, source(cs)]),
          ),
          Object.fromEntries(out),
        ),
    );
    if (op.event_count !== undefined)
      check(
        op.event_count <= index &&
          prefixes[op.event_count]?.day === at &&
          prefixes[op.event_count]?.phase === Phase.Night,
      );
    return out;
  };
  const eligibleCharm = (p: Prefix, target: number | null) => {
    const prev = p.beauty.choices.filter((x) => x.targetId !== null).at(-1);
    return (
      p.phase === Phase.Night &&
      p.alive.includes(beauty) &&
      !p.beauty.replacement &&
      !p.beauty.choices.some((x) => x.day === p.day) &&
      (!prev || p.day >= prev.day + 2) &&
      (target === null || (target !== beauty && p.alive.includes(target)))
    );
  };
  const guardTargets = (p: Prefix) => {
    const prev = p.guard.cycles.at(-2);
    return p.alive.filter((id) => prev?.status !== "protected" || prev.targetId !== id);
  };
  const duelTargets = (p: Prefix) =>
    p.alive.filter((id) => id !== knight && !p.knight.attempts.some((a) => a.targetId === id));
  const shield = () => {
    const row = gs.cycles.at(-1);
    return !expired && row?.day === day && row.status === "protected" && alive.has(row.targetId)
      ? row.targetId
      : null;
  };
  const published = (d: RecordedDecision, index: number) => {
    if (d.outcome.kind === "action") return true;
    if (d.outcome.kind !== "error" || !candidate(d)) return false;
    const n = r.decisions.indexOf(d),
      covers = (cp: ReproductionRecord["checkpoints"][number]) =>
        cp.eventCount > index &&
        cp.decisionCount !== undefined &&
        cp.decisionCount > n &&
        d.settleOrder !== undefined &&
        cp.settlementCount !== undefined &&
        cp.settlementCount >= d.settleOrder;
    return (
      (!r.finalized || !!r.termination?.errors.length) &&
      !r.checkpoints.some((cp) => cp.complete && covers(cp)) &&
      (!r.finalized || r.checkpoints.some((cp) => !cp.complete && covers(cp)))
    );
  };
  const decision = (
    who: number,
    stage: string,
    index: number,
    accepts: (d: RecordedDecision) => boolean = () => true,
  ) => {
    const ds = r.decisions.filter(
      (d) =>
        d.actorId === who &&
        d.day === day &&
        d.stage === stage &&
        d.openedAtEventCount !== undefined &&
        d.openedAtEventCount <= index &&
        !used.has(d) &&
        published(d, index) &&
        accepts(d),
    );
    check(ds.length === 1);
    return ds[0]!;
  };
  const beginWave = (index: number): Wave => {
    if (wave && !wave.committed) return wave;
    let kind: Wave["kind"], root: Phase, map: Map<number, string[]>;
    const roots = new Map<number, Phase>();
    let hasNight = false;
    if (chain && !chain.resolvedAt && !chain.endedAt) {
      kind = "duel";
      root = phase as Phase;
      map = new Map(
        (chain.branch === "wolf" ? [chain.target] : [knight, chain.target]).map((id) => [
          id,
          ["awakened_duel"],
        ]),
      );
    } else if (blast) {
      kind = "blast";
      root = phase as Phase;
      // 警前自爆与未结夜伤属于一次DR首波，但公开夜报只列Night根，随后自爆回执只列原自爆者。
      // 合并提案先完整判盾／替死，再分两份实际发表；同号夜伤+自爆保原因并集而根取真实Day覆盖。
      hasNight = !publishedNights.has(day);
      map = hasNight ? verifyRaw(day, index) : new Map();
      for (const id of map.keys()) roots.set(id, Phase.Night);
      map.set(blast.actor, [...new Set([...(map.get(blast.actor) ?? []), "self_destruct"])].sort());
      roots.set(blast.actor, root);
    } else if (!publishedNights.has(day)) {
      kind = "night";
      root = Phase.Night;
      map = verifyRaw(day, index);
    } else {
      check(phase === Phase.Voting && exile !== null && alive.has(exile));
      kind = "exile";
      root = Phase.Voting;
      map = new Map([[exile, ["exile"]]]);
    }
    for (const id of map.keys()) if (!roots.has(id)) roots.set(id, root);
    wave = {
      roots,
      hasNight,
      nightReported: false,
      kind,
      root,
      proposed: clone(map),
      remaining: map,
      committed: false,
      blocked: [],
      replacement: null,
    };
    return wave;
  };
  const canReplace = (w: Wave) => {
    const choice = bs.choices.at(-1);
    return (
      !bs.replacement &&
      choice?.day === day &&
      choice.targetId !== null &&
      alive.has(beauty) &&
      alive.has(choice.targetId) &&
      !w.remaining.has(choice.targetId) &&
      w.remaining.has(beauty)
    );
  };
  const commit = (ids: readonly number[], kind: Wave["kind"], index: number) => {
    const w = beginWave(index),
      splitNight = w.kind === "blast" && w.hasNight && kind === "night";
    const expected = splitNight
      ? [...w.remaining].filter(([id]) => w.roots.get(id) === Phase.Night)
      : [...w.remaining];
    check(
      (w.kind === kind || splitNight) &&
        !w.committed &&
        (!splitNight || !w.nightReported) &&
        (kind === "duel"
          ? same(
              ids,
              expected.map(([id]) => id),
            )
          : same(sorted(ids), sorted(expected.map(([id]) => id)))) &&
        expected.every(([id]) => id !== shield()) &&
        !canReplace(w),
    );
    for (const id of ids) {
      check(alive.has(id));
      alive.delete(id);
      if (kind === "duel") {
        check(chain);
        deferred.push({ id, day, chain: chain.id, phase, at: index + 1 });
      }
    }
    if (splitNight) {
      for (const [id] of expected) w.remaining.delete(id);
      w.nightReported = true;
    } else w.committed = true;
    return w;
  };
  prefixes[0] = snap();
  for (const [index, e] of r.events.entries()) {
    const p = e.payload;
    // 生产桥接为同步相邻发表；失败允许在末尾停住，正常后续不能跳过应公开的亮牌／命中公告。
    if (revealPending) check(e.type === "awakened_protection_revealed");
    if (lastDetail !== null) check(e.type === "awakened_protection_blocked");
    const pendingDawn = wave as Wave | null;
    if (pendingDawn?.kind === "blast" && pendingDawn.nightReported && blast)
      check(
        [
          "awakened_protection_block_detail",
          "awakened_protection_blocked",
          "awakened_self_destruct_resolved",
        ].includes(e.type),
      );
    if (e.type === "phase_changed") {
      const nd = p.day as number,
        np = p.phase as string;
      if (np === Phase.Night && nd > day) {
        check(
          nd === day + 1 &&
            (!gs.cycles.length || expired) &&
            (!chain || chain.endedAt !== undefined) &&
            !blast &&
            (!wave || (wave as Wave).committed),
        );
        nightAlive.set(nd, [...alive]);
        exile = null;
        wave = null;
        blast = null;
        chain = null;
        revealed = false;
      } else check(nd === day);
      day = nd;
      phase = np;
    }
    if (e.type === "wolf_kill_vote_cast") {
      const who = p.actorId as number,
        d = decision(who, "wolf_vote", index),
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!],
        map = votes.get(day) ?? new Map<number, number | null>(),
        target = p.abstain === true ? null : (p.targetId as number);
      check(
        phase === Phase.Night &&
          opening?.day === day &&
          opening.phase === Phase.Night &&
          alive.has(who) &&
          originals.get(who)?.camp === Camp.Wolf &&
          !map.has(who) &&
          a?.name === "kill_vote" &&
          (a.args.abstain === true ? target === null : a.args.target_id === target) &&
          (target === null || alive.has(target)) &&
          !(who === beauty && target === beauty),
      );
      map.set(who, target);
      votes.set(day, map);
      used.set(d, index + 1);
    }
    if (e.type === "witch_potion_used" || e.type === "witch_potion_skipped") {
      const d = decision(witch, "witch", index),
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!],
        old = potions.get(day) ?? { heal: null, poison: null };
      check(
        p.actorId === witch &&
          phase === Phase.Night &&
          opening?.day === day &&
          opening.phase === Phase.Night &&
          alive.has(witch) &&
          a?.name === "use_potion" &&
          a.args.potion_type === p.potionType,
      );
      if (e.type === "witch_potion_used") {
        const target = p.targetId as number;
        check(a.args.target_id === target && alive.has(target));
        if (p.potionType === "heal") {
          check(!healUsed && old.heal === null && knife(day) === target && target !== witch);
          healUsed = true;
          old.heal = target;
        } else {
          check(p.potionType === "poison" && !poisonUsed && old.poison === null);
          poisonUsed = true;
          old.poison = target;
        }
      } else check(p.potionType === "none");
      potions.set(day, old);
      used.set(d, index + 1);
    }
    if (e.type === "guard_applied" || e.type === "wolf_self_destruct") check(false);
    if (e.type === "vote_summary") exile = p.target as number | null;
    if (beautyFact(e.type)) {
      const f = readAwakenedBeautyFact(e.type, p);
      check(f && f.payload.day === day && f.payload.actorId === beauty);
      if (f.type === "awakened_charm_chosen") {
        const d = decision(beauty, "awakened_charm", index),
          a = candidate(d),
          opening = prefixes[d.openedAtEventCount!];
        check(
          opening?.day === day &&
            eligibleCharm(opening, f.payload.targetId) &&
            a?.name === "awakened_charm" &&
            same(a.args, { target_id: f.payload.targetId }) &&
            same(e.audience, [beauty]),
        );
        bs = { ...bs, choices: [...bs.choices, { day, targetId: f.payload.targetId }] };
        used.set(d, index + 1);
      } else if (f.type === "awakened_beauty_replacement_paid") {
        const w = beginWave(index),
          choice = bs.choices.at(-1);
        check(
          canReplace(w) &&
            choice?.targetId === f.payload.targetId &&
            shield() !== beauty &&
            same(e.audience, []) &&
            f.payload.phase === phase &&
            f.payload.rootPhase === w.roots.get(beauty) &&
            same(source(f.payload.preventedCauses), w.remaining.get(beauty)),
        );
        const { policy: _p, actorId: _a, ...paid } = f.payload;
        bs = { ...bs, replacement: paid };
        w.replacement = paid;
        w.remaining.delete(beauty);
        w.roots.delete(beauty);
        w.remaining.set(paid.targetId, ["awakened_beauty_replacement"]);
        w.roots.set(paid.targetId, paid.rootPhase);
      } else {
        const w = wave as Wave | null,
          paid = bs.replacement;
        check(
          w?.committed &&
            paid &&
            paid.day === day &&
            paid.rootPhase !== Phase.Night &&
            e.audience === undefined &&
            paid.targetId === f.payload.targetId &&
            f.payload.targetDied === !alive.has(paid.targetId) &&
            !replacementPublished,
        );
        replacementPublished = true;
      }
    }
    if (isAwakenedGuardEventType(e.type)) {
      const f = readAwakenedGuardFact(e.type, p);
      check(f && f.payload.day === day && same(e.audience, awakenedGuardFactAudience(f)));
      if (f.type === "awakened_guard_cycle_started") {
        check(
          f.payload.actorId === guard &&
            phase === Phase.Night &&
            alive.has(guard) &&
            day === gs.cycles.length + 1,
        );
        gs = {
          policy: gp,
          cycles: [
            ...gs.cycles.map((x) =>
              x.status === "open" ? { day: x.day, status: "unused" as const } : x,
            ),
            { day, status: "open" },
          ],
        };
        expired = false;
        revealed = false;
      } else if (f.type === "awakened_protection_chosen") {
        const stage =
            f.payload.timing === "night" ? "awakened_protection_night" : "awakened_protection_day",
          d = decision(guard, stage, index),
          a = candidate(d),
          opening = prefixes[d.openedAtEventCount!];
        check(
          f.payload.actorId === guard &&
            alive.has(guard) &&
            gs.cycles.at(-1)?.status === "open" &&
            gs.cycles.at(-1)?.day === day &&
            !expired &&
            opening?.day === day &&
            a?.name === "awakened_protect" &&
            same(a.args, { mode: f.payload.mode, target_id: f.payload.targetId }) &&
            (f.payload.mode !== "protect" || guardTargets(opening).includes(f.payload.targetId!)),
        );
        if (f.payload.mode !== "wait") {
          const row: AwakenedGuardCycle =
            f.payload.mode === "protect"
              ? {
                  day,
                  status: "protected",
                  targetId: f.payload.targetId!,
                  timing: f.payload.timing,
                }
              : { day, status: "passed" };
          gs = { policy: gp, cycles: [...gs.cycles.slice(0, -1), row] };
        } else check(f.payload.outcome === "wait");
        if (f.payload.timing === "day" && f.payload.mode === "protect") revealPending = true;
        used.set(d, index + 1);
      } else if (f.type === "awakened_protection_revealed") {
        const row = gs.cycles.at(-1);
        check(
          f.payload.actorId === guard &&
            row?.status === "protected" &&
            row.day === day &&
            row.timing === "day" &&
            row.targetId === f.payload.targetId &&
            !revealed,
        );
        revealed = true;
        revealPending = false;
      } else if (f.type === "awakened_protection_expired") {
        check(f.payload.actorId === guard && gs.cycles.at(-1)?.day === day && !expired);
        gs = {
          policy: gp,
          cycles: gs.cycles.map((x) =>
            x.status === "open" ? { day: x.day, status: "unused" as const } : x,
          ),
        };
        expired = true;
      } else if (f.type === "awakened_protection_block_detail") {
        const w = beginWave(index);
        check(
          f.payload.actorId === guard &&
            f.payload.phase === phase &&
            f.payload.rootPhase === w.roots.get(f.payload.targetId) &&
            shield() === f.payload.targetId &&
            same(source(f.payload.causes), w.remaining.get(f.payload.targetId)),
        );
        w.remaining.delete(f.payload.targetId);
        w.blocked.push(f.payload.targetId);
        lastDetail = f.payload.targetId;
      } else if (f.type === "awakened_protection_blocked") {
        check(lastDetail === f.payload.targetId);
        lastDetail = null;
        const blockedWave = wave as Wave | null;
        if (blockedWave?.kind === "exile" && blockedWave.remaining.size === 0)
          blockedWave.committed = true;
      } else if (f.type === "awakened_self_destruct_declared") {
        const d = decision(f.payload.actorId, f.payload.window, index, (d) => {
            const a = candidate(d);
            return a?.name === "self_destruct" && a.args.confirm === true;
          }),
          opening = prefixes[d.openedAtEventCount!];
        check(
          !blast &&
            !blasted.has(`${day}:${f.payload.actorId}`) &&
            alive.has(f.payload.actorId) &&
            opening?.day === day &&
            opening.phase === phase &&
            phase === (f.payload.window === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day) &&
            c.selfDestruct?.enabledWindows.includes(f.payload.window) === true &&
            originals.get(f.payload.actorId)?.role === "wolf" &&
            [Phase.Day, Phase.Voting].includes(phase as Phase),
        );
        used.set(d, index + 1);
        blasted.add(`${day}:${f.payload.actorId}`);
        blast = { actor: f.payload.actorId, window: f.payload.window, at: index + 1 };
      } else {
        check(blast && blast.actor === f.payload.actorId && blast.window === f.payload.window);
        commit(f.payload.deaths, "blast", index);
        blast = null;
      }
    }
    if (isAwakenedDuelEventType(e.type)) {
      const f = readAwakenedDuelFact(e.type, p);
      check(
        f &&
          f.payload.day === day &&
          f.payload.actorId === knight &&
          e.audience === undefined &&
          [Phase.Day, Phase.Voting].includes(phase as Phase),
      );
      if (f.type === "awakened_duel_committed") {
        const continuing: boolean = !!chain && !chain.endedAt,
          stage = continuing ? "awakened_duel_continue" : "awakened_duel",
          d = decision(knight, stage, index, (d) => {
            const a = candidate(d);
            return a?.name === "awakened_duel" && a.args.target_id === f.payload.targetId;
          }),
          a = candidate(d),
          opening = prefixes[d.openedAtEventCount!],
          branch = originals.get(f.payload.targetId)?.camp === Camp.Wolf ? "wolf" : "good",
          ordinal: number = continuing ? chain!.id : (ks.attempts.at(-1)?.chain ?? 0) + 1;
        check(
          alive.has(knight) &&
            alive.has(f.payload.targetId) &&
            opening?.day === day &&
            duelTargets(opening).includes(f.payload.targetId) &&
            (!continuing || !!chain?.resolvedAt) &&
            a?.name === "awakened_duel" &&
            same(a.args, { target_id: f.payload.targetId }) &&
            f.payload.branch === branch &&
            f.payload.chain === ordinal,
        );
        ks = {
          policy: kp,
          attempts: [...ks.attempts, { day, chain: ordinal, targetId: f.payload.targetId, branch }],
        };
        chain = { id: ordinal, day, target: f.payload.targetId, branch, at: index + 1 };
        wave = null;
        used.set(d, index + 1);
      } else if (f.type === "awakened_duel_resolved") {
        check(
          chain &&
            !chain.resolvedAt &&
            chain.id === f.payload.chain &&
            chain.target === f.payload.targetId,
        );
        commit(f.payload.deaths, "duel", index);
        chain.resolvedAt = index + 1;
      } else {
        check(chain && chain.resolvedAt && !chain.endedAt && chain.id === f.payload.chain);
        const targets = duelTargets(snap());
        if (f.payload.reason === "miss") check(chain.branch === "good");
        else if (f.payload.reason === "actor_lost")
          check(chain.branch === "wolf" && !alive.has(knight));
        else if (f.payload.reason === "no_targets")
          check(chain.branch === "wolf" && alive.has(knight) && targets.length === 0);
        else {
          const d = decision(knight, "awakened_duel_continue", index),
            a = candidate(d);
          check(
            chain.branch === "wolf" &&
              alive.has(knight) &&
              a?.name === "awakened_duel" &&
              a.args.target_id === null,
          );
          used.set(d, index + 1);
        }
        check(
          deferred
            .filter((w) => w.day === day && w.chain === chain!.id)
            .every((w) => w.spokenAt !== undefined),
        );
        chain.endedAt = index + 1;
      }
    }
    if (e.type === "night_resolved") {
      check(!publishedNights.has(day));
      commit(p.deaths as number[], "night", index);
      publishedNights.add(day);
    }
    if (e.type === "voted_out") {
      check(exile === p.target);
      commit([p.target as number], "exile", index);
    }
    if (e.type === "additional_deaths") {
      check(Array.isArray(p.deaths));
      if ((wave as Wave | null)?.kind === "duel" && (wave as Wave | null)!.committed) {
        check(
          (p.deaths as number[]).every(
            (id) => !alive.has(id) && wave!.replacement?.targetId === id,
          ),
        );
      } else commit(p.deaths as number[], "exile", index);
    }
    if (
      (e.type === "last_words_granted" || e.type === "last_words_spoken") &&
      chain &&
      !chain.endedAt
    ) {
      const next = deferred.find(
        (w) => w.day === day && w.chain === chain!.id && w.spokenAt === undefined,
      );
      check(
        next &&
          next.id === p.playerId &&
          next.phase === p.phase &&
          p.day === day &&
          chain.resolvedAt !== undefined,
      );
      if (e.type === "last_words_granted") {
        check(next.grantAt === undefined);
        next.grantAt = index + 1;
      } else {
        check(next.grantAt !== undefined);
        const d = decision(next.id, "last_words", index),
          a = candidate(d);
        check(
          a?.name === "speak" && a.args.text === p.text && d.openedAtEventCount! >= next.grantAt,
        );
        next.spokenAt = index + 1;
        used.set(d, index + 1);
      }
    }
    prefixes[index + 1] = snap();
  }
  // 原刀毒来源即使在实际夜报前失败也必须可审；不把God最终名单反向当原提案。
  for (const [i, op] of ops.entries()) {
    check(op.event_count !== undefined && op.event_count <= r.events.length);
    verifyRaw(i + 1, r.events.length);
  }
  for (const d of r.decisions) {
    check(d.openedAtEventCount !== undefined && prefixes[d.openedAtEventCount]);
    const p = prefixes[d.openedAtEventCount]!,
      ctx = d.request.context,
      a = candidate(d);
    const expected = r.events
      .slice(0, d.openedAtEventCount)
      .filter((e) => fact(e.type) && (e.audience === undefined || e.audience.includes(d.actorId)))
      .map((e) => ({ type: e.type, payload: e.payload }));
    check(
      same(
        ctx.visible_events
          .filter((e) => fact(e.type))
          .map((e) => ({ type: e.type, payload: e.payload })),
        expected,
      ),
    );
    if (!family(d)) {
      check(
        ctx.awakened_charm_candidates === undefined &&
          ctx.awakened_protect_options === undefined &&
          ctx.awakened_duel_options === undefined,
      );
      continue;
    }
    const tool =
      d.stage === "awakened_charm"
        ? "awakened_charm"
        : d.stage.startsWith("awakened_protection")
          ? "awakened_protect"
          : "awakened_duel";
    check(
      p.day === d.day &&
        ctx.day === d.day &&
        ctx.stage === d.stage &&
        d.request.actorId === d.actorId &&
        d.request.phase === p.phase &&
        same(d.request.allowedTools, [tool]) &&
        ctx.action_failure_policy === "error" &&
        ctx.allow_fallback === false,
    );
    check(
      ctx.patrol_seat_order === undefined &&
        (tool === "awakened_charm" || ctx.awakened_charm_candidates === undefined) &&
        (tool === "awakened_protect" || ctx.awakened_protect_options === undefined) &&
        (tool === "awakened_duel" || ctx.awakened_duel_options === undefined),
    );
    if (tool === "awakened_charm")
      check(
        d.actorId === beauty &&
          eligibleCharm(p, null) &&
          same(
            ctx.awakened_charm_candidates,
            p.alive.filter((id) => id !== beauty),
          ),
      );
    else if (tool === "awakened_protect") {
      const timing = d.stage === "awakened_protection_night" ? "night" : "day",
        row = p.guard.cycles.at(-1);
      check(
        d.actorId === guard &&
          p.alive.includes(guard) &&
          row?.day === d.day &&
          row.status === "open" &&
          !p.expired &&
          (timing === "night"
            ? p.phase === Phase.Night
            : [Phase.Day, Phase.Voting].includes(p.phase as Phase)) &&
          same(ctx.awakened_protect_options, { timing, last: false, targetIds: guardTargets(p) }),
      );
      if (d.outcome.kind === "action")
        check(
          a?.name === "awakened_protect" &&
            ((a.args.mode === "protect" &&
              ctx.awakened_protect_options!.targetIds.includes(a.args.target_id!)) ||
              (["wait", "pass"].includes(a.args.mode) && a.args.target_id === null)),
        );
    } else {
      const continuing = d.stage === "awakened_duel_continue",
        last = p.chain;
      check(
        d.actorId === knight &&
          p.alive.includes(knight) &&
          [Phase.Day, Phase.Voting].includes(p.phase as Phase) &&
          same(ctx.awakened_duel_options, { continuing, targetIds: duelTargets(p) }) &&
          (continuing
            ? last &&
              last.day === d.day &&
              last.branch === "wolf" &&
              last.resolvedAt !== undefined &&
              last.resolvedAt <= d.openedAtEventCount &&
              !last.endedAt
            : !last || !!last.endedAt),
      );
      if (d.outcome.kind === "action")
        check(
          a?.name === "awakened_duel" &&
            (a.args.target_id === null || duelTargets(p).includes(a.args.target_id)),
        );
      if (continuing)
        check(
          !r.events
            .slice(last!.at, d.openedAtEventCount)
            .some((e) => e.type === "last_words_granted" || e.type === "last_words_spoken"),
        );
      // 若盾尚未使用且施者仍活，该安全边界的Guard交付必须已先完成，不可把未来wait借给Knight。
      const row = p.guard.cycles.at(-1);
      if (p.alive.includes(guard) && row?.day === d.day && row.status === "open" && !p.expired) {
        const prior = r.decisions.filter(
          (g) =>
            g.actorId === guard &&
            g.stage === "awakened_protection_day" &&
            g.day === d.day &&
            g.openedAtEventCount !== undefined &&
            g.openedAtEventCount <= d.openedAtEventCount! &&
            g.settleOrder !== undefined &&
            g.settleOrder <= (d.openedAfterSettlement ?? 0) &&
            (continuing ? g.openedAtEventCount >= last!.resolvedAt! : true),
        );
        check(prior.length > 0);
      }
    }
    if (d.outcome.kind === "action" && tool === "awakened_charm")
      check(a?.name === "awakened_charm" && eligibleCharm(p, a.args.target_id));
  }
  // 每份完整CP与发表前缀精确一致；失败CP可以拥有已付但sink未发表的一项，不得替换、删除或退款旧行。
  for (const cp of r.checkpoints) {
    check(
      cp.decisionCount !== undefined &&
        cp.settlementCount !== undefined &&
        cp.decisionCount <= r.decisions.length &&
        prefixes[cp.eventCount],
    );
    const p = prefixes[cp.eventCount]!,
      known = r.decisions
        .slice(0, cp.decisionCount)
        .filter(
          (d) => family(d) && d.settleOrder !== undefined && d.settleOrder <= cp.settlementCount!,
        );
    check(
      known.every(
        (d) => d.openedAtEventCount !== undefined && d.openedAtEventCount <= cp.eventCount,
      ),
    );
    for (const [d, at] of used)
      if (at <= cp.eventCount)
        check(
          r.decisions.indexOf(d) < cp.decisionCount &&
            d.settleOrder !== undefined &&
            d.settleOrder <= cp.settlementCount,
        );
    const b = cp.players.find((x) => x.id === beauty),
      g = cp.players.find((x) => x.id === guard),
      k = cp.players.find((x) => x.id === knight),
      bstate = b && readAwakenedBeautyStateData(b.privateState.awakenedBeauty),
      gstate = g && readAwakenedGuardStateData(g.privateState.awakenedGuard),
      kstate = k && readAwakenedKnightStateData(k.privateState.awakenedKnight);
    check(bstate && gstate && kstate);
    check(
      cp.players.every(
        (x) =>
          x.role === originals.get(x.id)?.role &&
          x.camp === originals.get(x.id)?.camp &&
          (x.id === beauty || !Object.hasOwn(x.privateState, "awakenedBeauty")) &&
          (x.id === guard || !Object.hasOwn(x.privateState, "awakenedGuard")) &&
          (x.id === knight || !Object.hasOwn(x.privateState, "awakenedKnight")),
      ),
    );
    if (cp.complete) {
      check(
        same(bstate, p.beauty) &&
          same(gstate, p.guard) &&
          same(kstate, p.knight) &&
          same(sorted(cp.players.filter((x) => x.alive).map((x) => x.id)), sorted(p.alive)) &&
          known.every(
            (d) =>
              d.outcome.kind === "action" &&
              (used.has(d) ||
                (candidate(d)?.name === "awakened_duel" &&
                  same(candidate(d)?.args, { target_id: null }))),
          ),
      );
      check(!p.revealPending && p.detailPending === null && p.blast === null);
      if (p.beauty.replacement && p.beauty.replacement.rootPhase !== Phase.Night)
        check(p.replacementPublished);
      if (p.chain) check(p.chain.endedAt !== undefined && p.wordsComplete);
      if (p.wave) check(p.wave.committed);
      continue;
    }
    // 失败也不能复活已发表的真实死亡。只允许当前有据提案在实际mark后、发表前留下的首写子集。
    let unpublished =
      p.wave && !p.wave.committed ? new Map(p.wave.remaining) : new Map<number, string[]>();
    if (!p.wave || p.wave.committed) {
      if (p.chain && !p.chain.resolvedAt && !p.chain.endedAt)
        unpublished = new Map(
          (p.chain.branch === "wolf" ? [p.chain.target] : [knight, p.chain.target]).map((id) => [
            id,
            ["awakened_duel"],
          ]),
        );
      else if (p.blast) {
        unpublished = p.nightPublished ? new Map() : new Map(p.nativeDamage);
        unpublished.set(
          p.blast.actor,
          [...new Set([...(unpublished.get(p.blast.actor) ?? []), "self_destruct"])].sort(),
        );
      } else if (p.phase === Phase.Voting && p.exile !== null && p.alive.includes(p.exile))
        unpublished.set(p.exile, ["exile"]);
      else if (!p.nightPublished) {
        const op = ops[p.day - 1];
        if (
          p.phase !== Phase.Night ||
          (op && op.event_count !== undefined && op.event_count <= cp.eventCount)
        )
          unpublished = new Map(p.nativeDamage);
      }
    }
    const shieldRow = p.guard.cycles.at(-1),
      shieldTarget =
        !p.expired && shieldRow?.day === p.day && shieldRow.status === "protected"
          ? shieldRow.targetId
          : null;
    if (shieldTarget !== null) unpublished.delete(shieldTarget);
    const beforeReplacement = new Map(unpublished);
    const payment = bstate.replacement;
    if (payment?.day === p.day && unpublished.has(beauty)) {
      unpublished.delete(beauty);
      unpublished.set(payment.targetId, ["awakened_beauty_replacement"]);
      if (shieldTarget === payment.targetId) unpublished.delete(payment.targetId);
    }
    check(
      cp.players.every((x) =>
        p.alive.includes(x.id) ? x.alive || unpublished.has(x.id) : !x.alive,
      ),
    );
    check(
      same(bstate.choices.slice(0, p.beauty.choices.length), p.beauty.choices) &&
        (p.beauty.replacement === null || same(bstate.replacement, p.beauty.replacement)) &&
        same(kstate.attempts.slice(0, p.knight.attempts.length), p.knight.attempts),
    );
    const extras = known.filter((d) => (used.get(d) ?? Infinity) > cp.eventCount);
    check(
      bstate.choices.length <= p.beauty.choices.length + 1 &&
        kstate.attempts.length <= p.knight.attempts.length + 1,
    );
    for (const choice of bstate.choices.slice(p.beauty.choices.length)) {
      const ds = extras.filter(
        (d) =>
          d.stage === "awakened_charm" &&
          d.day === choice.day &&
          candidate(d)?.name === "awakened_charm" &&
          same(candidate(d)?.args, { target_id: choice.targetId }),
      );
      check(
        ds.length === 1 && eligibleCharm(prefixes[ds[0]!.openedAtEventCount!]!, choice.targetId),
      );
    }
    for (const attempt of kstate.attempts.slice(p.knight.attempts.length)) {
      const ds = extras.filter(
        (d) =>
          d.stage.startsWith("awakened_duel") &&
          d.day === attempt.day &&
          candidate(d)?.name === "awakened_duel" &&
          same(candidate(d)?.args, { target_id: attempt.targetId }),
      );
      check(ds.length === 1);
      const d = ds[0]!,
        opening = prefixes[d.openedAtEventCount!]!,
        continuing = d.stage === "awakened_duel_continue";
      check(
        duelTargets(opening).includes(attempt.targetId) &&
          attempt.branch ===
            (originals.get(attempt.targetId)?.camp === Camp.Wolf ? "wolf" : "good") &&
          attempt.chain ===
            (continuing ? opening.chain?.id : (opening.knight.attempts.at(-1)?.chain ?? 0) + 1),
      );
    }
    if (!same(gstate, p.guard)) {
      const row = gstate.cycles.at(-1),
        previous = p.guard.cycles.at(-1);
      // 自动开周期与正常到期也可能在首个sink前已写；只接同一实际夜／日终，不以额外资源冒充动作。
      const began =
        p.phase === Phase.Night &&
        r.events
          .slice(0, cp.eventCount)
          .some(
            (e) =>
              e.type === "phase_changed" &&
              e.payload.day === p.day &&
              e.payload.phase === Phase.Night,
          ) &&
        p.alive.includes(guard) &&
        p.day === p.guard.cycles.length + 1 &&
        same(gstate.cycles, [
          ...p.guard.cycles.map((c) =>
            c.status === "open" ? { day: c.day, status: "unused" } : c,
          ),
          { day: p.day, status: "open" },
        ]);
      const allDead = (camp: Camp) =>
        r.metadata.players.filter((x) => x.camp === camp).every((x) => !p.alive.includes(x.id));
      const godsGone = r.metadata.players
        .filter((x) => ["seer", "witch", "awakened_guard", "awakened_knight"].includes(x.role))
        .every((x) => !p.alive.includes(x.id));
      const villagersGone = r.metadata.players
        .filter((x) => x.role === "villager")
        .every((x) => !p.alive.includes(x.id));
      const normalEnd =
        allDead(Camp.Wolf) ||
        godsGone ||
        villagersGone ||
        p.phase === Phase.GameOver ||
        (p.wave?.committed && (p.wave.kind === "exile" || p.wave.kind === "blast")) ||
        (p.chain?.endedAt !== undefined && p.chain.branch === "wolf");
      const ended =
        normalEnd &&
        previous?.status === "open" &&
        same(gstate.cycles, [...p.guard.cycles.slice(0, -1), { day: p.day, status: "unused" }]);
      if (!began && !ended) {
        check(
          gstate.cycles.length === p.guard.cycles.length &&
            same(gstate.cycles.slice(0, -1), p.guard.cycles.slice(0, -1)) &&
            previous?.status === "open",
        );
        const ds = extras.filter(
          (d) => d.stage.startsWith("awakened_protection") && d.day === row?.day,
        );
        check(ds.length === 1);
        const d = ds[0]!,
          a = candidate(d),
          opening = prefixes[d.openedAtEventCount!]!;
        check(
          a?.name === "awakened_protect" &&
            same(
              row,
              a.args.mode === "protect"
                ? {
                    day: d.day,
                    status: "protected",
                    targetId: a.args.target_id,
                    timing: d.stage === "awakened_protection_night" ? "night" : "day",
                  }
                : a.args.mode === "pass"
                  ? { day: d.day, status: "passed" }
                  : null,
            ) &&
            (a.args.mode !== "protect" || guardTargets(opening).includes(a.args.target_id!)),
        );
      }
    }
    if (bstate.replacement && !p.beauty.replacement) {
      const paid = bstate.replacement,
        choice = bstate.choices.at(-1),
        w = p.wave;
      const root =
        w && !w.committed
          ? w.roots.get(beauty)
          : p.chain && !p.chain.resolvedAt
            ? p.phase
            : !p.nightPublished
              ? Phase.Night
              : Phase.Voting;
      check(
        choice?.day === p.day &&
          choice.targetId === paid.targetId &&
          p.alive.includes(beauty) &&
          p.alive.includes(paid.targetId) &&
          paid.day === p.day &&
          paid.phase === p.phase &&
          root === paid.rootPhase &&
          beforeReplacement.has(beauty) &&
          !beforeReplacement.has(paid.targetId) &&
          same(source(paid.preventedCauses), beforeReplacement.get(beauty)),
      );
    }
  }
}
