/**
 * 负责原十／十二人暗夜星辰的独立归档因果审核。输入纯板、动作、历史事实、夜伤操作与God检查点，输出接受或具名拒绝。
 * 自行重建魅惑隔夜、一次替死、刀毒守救提案、原座位方向最近真狼与巡猎根；不导入World、生产库存／伤害／死亡写者。
 * 原夜伤提案与实际死亡必须由God替死付款桥接；公开结果不授予生命变化。JSON不恢复原body或运行许可，严格同构建执行仍复核原体。
 */
import { Camp, Phase, Role, DeathCause } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_BEAUTY_POLICY as beautyPolicy,
  AWAKENED_BEAUTY_EVENT_TYPES,
  readAwakenedBeautyFact,
  readAwakenedBeautyStateData,
  type AwakenedBeautyState,
  type AwakenedBeautyPayment,
} from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import {
  AWAKENED_PATROL_POLICY as patrolPolicy,
  AWAKENED_PATROL_EVENT_TYPES,
  readAwakenedPatrolFact,
  readAwakenedPatrolStateData,
  type AwakenedPatrolState,
  type AwakenedPatrolPayment,
  type PatrolDirection,
} from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import type { RecordedDecision, ReproductionRecord } from "../../reproduction/format";
const ERROR = "reproduction_awakened_dark_stars_invalid";
function check(v: unknown): asserts v {
  if (!v) throw new Error(ERROR);
}
function same(a: unknown, b: unknown): boolean {
  const stable = (v: unknown): unknown =>
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
}
const clone = <T>(v: T): T => structuredClone(v);
const beautyFact = (type: string) =>
  (AWAKENED_BEAUTY_EVENT_TYPES as readonly string[]).includes(type);
const patrolFact = (type: string) =>
  (AWAKENED_PATROL_EVENT_TYPES as readonly string[]).includes(type);
const family = (d: RecordedDecision) => ["awakened_charm", "awakened_patrol"].includes(d.stage);
const candidate = (d: RecordedDecision) =>
  d.outcome.kind === "action"
    ? d.outcome.action
    : d.outcome.kind === "error"
      ? d.returnedCandidate
      : null;
const sorted = (ids: readonly number[]) => [...ids].sort((a, b) => a - b);
const causes = (v: unknown): string[] => {
  check(
    Array.isArray(v) &&
      new Set(v).size === v.length &&
      v.every((x) => Object.values(DeathCause).includes(x)),
  );
  return [...v].sort();
};
interface Death {
  day: number;
  root: Phase;
  causes: string[];
}
interface Prefix {
  day: number;
  phase: string;
  alive: number[];
  beauty: AwakenedBeautyState;
  patrol: AwakenedPatrolState;
  deaths: Map<number, Death>;
  nativeDamage: Map<number, string[]>;
  nightPublished: boolean;
  lastExile: number | null;
  patrolRequired: boolean;
  pendingPatrol: AwakenedPatrolPayment | null;
}
interface PatrolRun {
  decision: RecordedDecision;
  day: number;
  at: number;
  payment: AwakenedPatrolPayment;
  actual: number | null;
  resolvedAt?: number;
}
/** 只开放已审原牌池；配置中的角色名册不是任意合板许可。 */
function board(r: ReproductionRecord): void {
  const c = r.metadata.normalizedBoard as ReproductionRecord["metadata"]["normalizedBoard"] & {
      awakenedWolfBeauty?: unknown;
      awakenedHunter?: unknown;
    },
    size = c.boardSize;
  const roles = {
    wolf: size === 10 ? 2 : 3,
    awakened_wolf_beauty: 1,
    villager: size === 10 ? 3 : 4,
    seer: 1,
    witch: 1,
    guard: 1,
    awakened_hunter: 1,
  };
  check(
    (size === 10 || size === 12) &&
      c.roleSetups.length === 7 &&
      same(Object.fromEntries(c.roleSetups.map((x) => [x.role, x.count])), roles) &&
      same(c.awakenedWolfBeauty, { policy: beautyPolicy }) &&
      same(c.awakenedHunter, { policy: patrolPolicy }),
  );
  check(
    same(c.winConditions ?? [c.winCondition], ["slaughter_side"]) &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      c.voting?.exilePolicy === "awa_one_pk_v1" &&
      c.guard?.repeatPolicy === "awa_last_action_v1" &&
      c.lastWords?.policy === "awa_initial_wave_v1" &&
      c.disclosure?.deathRevealPolicy === "awa_hidden_v1",
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
    "guard",
    "tieBreaker",
    "voting",
    "disclosure",
    "lastWords",
    "awakenedWolfBeauty",
    "awakenedHunter",
  ]);
  check(Object.keys(c).every((k) => allowed.has(k)));
}
export function validateAwakenedDarkStarsRecord(r: ReproductionRecord): void {
  const c = r.metadata.normalizedBoard as ReproductionRecord["metadata"]["normalizedBoard"] & {
    awakenedWolfBeauty?: unknown;
    awakenedHunter?: unknown;
  };
  // 原骑士牌组由始终装配的独立联合账本先完整审核；这里不扩大原暗夜星辰两板。
  if (c.awakenedGuard || c.awakenedKnight) {
    check(c.awakenedGuard && c.awakenedKnight && c.awakenedWolfBeauty && !c.awakenedHunter);
    return;
  }
  const artifacts =
    r.events.some((e) => beautyFact(e.type) || patrolFact(e.type)) ||
    r.decisions.some(
      (d) =>
        family(d) || d.request.allowedTools.some((t) => ["awakened_charm", "patrol"].includes(t)),
    ) ||
    r.checkpoints.some((cp) =>
      cp.players.some(
        (p) =>
          Object.hasOwn(p.privateState, "awakenedBeauty") ||
          Object.hasOwn(p.privateState, "awakenedPatrol"),
      ),
    );
  if (!c.awakenedWolfBeauty && !c.awakenedHunter) {
    check(
      !artifacts &&
        !c.roleSetups.some((x) => ["awakened_wolf_beauty", "awakened_hunter"].includes(x.role)) &&
        !r.metadata.players.some((x) =>
          ["awakened_wolf_beauty", "awakened_hunter"].includes(x.role),
        ),
    );
    return;
  }
  board(r);
  const originals = new Map(r.metadata.players.map((p) => [p.id, p])),
    beauties = r.metadata.players.filter((p) => (p.role as string) === "awakened_wolf_beauty"),
    hunters = r.metadata.players.filter((p) => (p.role as string) === "awakened_hunter");
  check(
    originals.size === c.boardSize &&
      beauties.length === 1 &&
      hunters.length === 1 &&
      same(
        sorted([...originals.keys()]),
        Array.from({ length: c.boardSize }, (_, i) => i + 1),
      ) &&
      r.metadata.players.every(
        (p) =>
          p.camp === (["wolf", "awakened_wolf_beauty"].includes(p.role) ? Camp.Wolf : Camp.Good),
      ),
  );
  check(
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
  const beauty = beauties[0]!.id,
    hunter = hunters[0]!.id,
    seats = sorted([...originals.keys()]),
    alive = new Set(seats),
    deaths = new Map<number, Death>(),
    prefixes: Prefix[] = [],
    facts = new Map<RecordedDecision, number>(),
    votes = new Map<number, Map<number, number | null>>(),
    guards = new Map<number, number | null>(),
    potions = new Map<number, { heal: number | null; poison: number | null }>(),
    nightAlive = new Map<number, number[]>(),
    nightPublished = new Set<number>(),
    nightOps = r.operations.filter(
      (o) => o.scope === "resolution" && o.op === "night_damage_resolved",
    ),
    patrols: PatrolRun[] = [];
  let day = 1,
    phase: string = Phase.Night,
    beautyState: AwakenedBeautyState = { policy: beautyPolicy, choices: [], replacement: null },
    patrolState: AwakenedPatrolState = { policy: patrolPolicy, payment: null },
    healUsed = false,
    poisonUsed = false,
    lastExile: number | null = null,
    publicReplacementAt: number | undefined,
    patrolRequired = false;
  const snap = (): Prefix => ({
    day,
    phase,
    alive: [...alive],
    beauty: clone(beautyState),
    patrol: clone(patrolState),
    deaths: clone(deaths),
    nativeDamage: raw(day),
    nightPublished: nightPublished.has(day),
    lastExile,
    patrolRequired,
    pendingPatrol: clone(
      patrols.filter((p) => p.resolvedAt === undefined && p.day === day).at(-1)?.payment ?? null,
    ),
  });
  nightAlive.set(1, [...alive]);
  const choose = (p: Prefix, direction: PatrolDirection | null): number | null => {
    if (direction === null) return null;
    const at = seats.indexOf(hunter),
      step = direction === "clockwise" ? 1 : -1;
    for (let distance = 1; distance < seats.length; distance++) {
      const id = seats[(at + distance * step + seats.length) % seats.length]!;
      if (p.alive.includes(id) && originals.get(id)?.camp === Camp.Wolf) return id;
    }
    return null;
  };
  const die = (id: number, root: Phase, source: readonly string[]) => {
    check(alive.has(id));
    alive.delete(id);
    deaths.set(id, { day, root, causes: [...source].sort() });
    if (id === hunter)
      patrolRequired = [...alive].some((id) => originals.get(id)?.camp === Camp.Wolf);
  };
  const knife = (at: number) => {
    const tally = new Map<number, number>();
    for (const id of votes.get(at)?.values() ?? [])
      if (id !== null) tally.set(id, (tally.get(id) ?? 0) + 1);
    return [...tally].sort(([a, na], [b, nb]) => nb - na || a - b)[0]?.[0] ?? null;
  };
  const raw = (at: number): Map<number, string[]> => {
    const start = nightAlive.get(at);
    check(start);
    const damage = new Map<number, string[]>(),
      p = potions.get(at),
      target = knife(at);
    for (const id of start) {
      const cs: string[] = [];
      if (id === target && (guards.get(at) === id) === (p?.heal === id)) cs.push("wolf_kill");
      if (p?.poison === id) cs.push("poison");
      if (cs.length) damage.set(id, cs.sort());
    }
    return damage;
  };
  prefixes[0] = snap();
  const verifyRaw = (at: number) => {
    const damage = raw(at),
      op = nightOps[at - 1];
    if (!op) {
      check(!r.finalized);
      return damage;
    }
    const output = op.output;
    check(
      output &&
        Array.isArray(output.deaths) &&
        output.death_sources &&
        typeof output.death_sources === "object" &&
        !Array.isArray(output.death_sources),
    );
    check(
      same(sorted(output.deaths as number[]), sorted([...damage.keys()])) &&
        same(
          Object.fromEntries(
            Object.entries(output.death_sources).map(([id, cs]) => [id, causes(cs)]),
          ),
          Object.fromEntries([...damage].map(([id, cs]) => [id, cs])),
        ),
    );
    if (op.event_count !== undefined)
      check(
        prefixes[op.event_count]?.day === at && prefixes[op.event_count]?.phase === Phase.Night,
      );
    return damage;
  };
  const eligibleChoice = (p: Prefix, target: number | null): boolean => {
    const prior = p.beauty.choices.filter((x) => x.targetId !== null).at(-1);
    return (
      p.phase === Phase.Night &&
      p.alive.includes(beauty) &&
      !p.beauty.replacement &&
      !p.beauty.choices.some((x) => x.day === p.day) &&
      (!prior || p.day >= prior.day + 2) &&
      (target === null || (target !== beauty && p.alive.includes(target)))
    );
  };
  // 已发表error候选只可落在真实失败前缀，不能让完整CP或成功终局掩盖未完成交付。
  const published = (d: RecordedDecision, index: number) => {
    if (d.outcome.kind === "action") return true;
    if (d.outcome.kind !== "error" || candidate(d) == null) return false;
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
  const decision = (actor: number, stage: string, index: number) => {
    const ds = r.decisions.filter(
      (d) =>
        d.actorId === actor &&
        d.day === day &&
        d.stage === stage &&
        d.openedAtEventCount !== undefined &&
        d.openedAtEventCount <= index &&
        !facts.has(d) &&
        published(d, index),
    );
    check(ds.length === 1);
    return ds[0]!;
  };
  const pending = () => patrols.filter((p) => p.resolvedAt === undefined && p.day === day).at(-1);
  const replacementProposal = (
    paid: AwakenedBeautyPayment,
    index: number,
  ): { root: Phase; source: string[]; initial: boolean } => {
    const p = pending();
    if (p && p.payment.targetId === beauty) {
      check(p.payment.rootPhase !== Phase.Night);
      return { root: p.payment.rootPhase, source: ["awakened_patrol"], initial: false };
    }
    if (!nightPublished.has(day) && paid.rootPhase === Phase.Night) {
      const proposal = verifyRaw(day);
      check(proposal.has(beauty) && !proposal.has(paid.targetId));
      return { root: Phase.Night, source: proposal.get(beauty)!, initial: true };
    }
    check(phase === Phase.Voting && lastExile === beauty);
    return { root: Phase.Voting, source: ["exile"], initial: false };
  };
  const replacementAvailable = (independent: ReadonlySet<number>) => {
    const choice = beautyState.choices.at(-1);
    return (
      !beautyState.replacement &&
      choice?.day === day &&
      choice.targetId !== null &&
      alive.has(beauty) &&
      alive.has(choice.targetId) &&
      !independent.has(choice.targetId)
    );
  };
  const verifyReplacement = (paid: AwakenedBeautyPayment, index: number) => {
    const choice = beautyState.choices.at(-1);
    check(
      !beautyState.replacement &&
        choice?.day === day &&
        choice.targetId === paid.targetId &&
        alive.has(beauty) &&
        alive.has(paid.targetId) &&
        paid.day === day &&
        paid.phase === phase,
    );
    const proposal = replacementProposal(paid, index);
    check(paid.rootPhase === proposal.root && same(causes(paid.preventedCauses), proposal.source));
  };
  for (const [index, e] of r.events.entries()) {
    const p = e.payload;
    if (e.type === "phase_changed") {
      const nextDay = p.day as number,
        next = p.phase as string;
      if (next === Phase.Night) {
        check(nextDay >= day);
        if (nextDay > day) {
          check(nextDay === day + 1);
          nightAlive.set(nextDay, [...alive]);
          lastExile = null;
        }
      }
      if (next !== Phase.Night) check(nextDay === day);
      day = nextDay;
      phase = next;
    }
    if (e.type === "wolf_kill_vote_cast") {
      const who = p.actorId as number,
        map = votes.get(day) ?? new Map<number, number | null>(),
        d = decision(who, "wolf_vote", index),
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!];
      check(
        phase === Phase.Night &&
          opening?.day === day &&
          opening.phase === Phase.Night &&
          alive.has(who) &&
          originals.get(who)?.camp === Camp.Wolf &&
          !map.has(who) &&
          a?.name === "kill_vote",
      );
      const target = p.abstain === true ? null : (p.targetId as number);
      check(
        (a.args.abstain === true ? target === null : a.args.target_id === target) &&
          (target === null || alive.has(target)) &&
          !(who === beauty && target === beauty),
      );
      map.set(who, target);
      votes.set(day, map);
      facts.set(d, index + 1);
    }
    if (e.type === "guard_applied") {
      const who = p.actorId as number,
        d = decision(who, "guard", index),
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!],
        previous = [...guards.values()].at(-1),
        target = p.targetId as number | null;
      check(
        phase === Phase.Night &&
          opening?.day === day &&
          opening.phase === Phase.Night &&
          alive.has(who) &&
          originals.get(who)?.role === Role.Guard &&
          !guards.has(day) &&
          a?.name === "guard" &&
          (a.args.abstain === true ? target === null : a.args.target_id === target) &&
          (target === null || (alive.has(target) && target !== previous)),
      );
      guards.set(day, target);
      facts.set(d, index + 1);
    }
    if (e.type === "witch_potion_used" || e.type === "witch_potion_skipped") {
      const who = p.actorId as number,
        d = decision(who, "witch", index),
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!],
        old = potions.get(day) ?? { heal: null, poison: null };
      check(
        phase === Phase.Night &&
          opening?.day === day &&
          opening.phase === Phase.Night &&
          alive.has(who) &&
          originals.get(who)?.role === Role.Witch &&
          a?.name === "use_potion" &&
          a.args.potion_type === p.potionType,
      );
      if (e.type === "witch_potion_used") {
        const target = p.targetId as number;
        check(a.args.target_id === target && alive.has(target));
        if (p.potionType === "heal") {
          check(
            !healUsed &&
              old.heal === null &&
              knife(day) === target &&
              (target !== who ||
                c.witch?.canSelfHeal === "always" ||
                (day === 1 && c.witch?.canSelfHeal === "first_night_only")),
          );
          healUsed = true;
          old.heal = target;
        } else {
          check(p.potionType === "poison" && !poisonUsed && old.poison === null);
          poisonUsed = true;
          old.poison = target;
        }
      } else check(p.potionType === "none");
      potions.set(day, old);
      facts.set(d, index + 1);
    }
    if (e.type === "vote_summary") lastExile = p.target as number | null;
    if (beautyFact(e.type)) {
      const f = readAwakenedBeautyFact(e.type, p);
      check(f && f.payload.actorId === beauty && f.payload.day === day);
      if (f.type === "awakened_charm_chosen") {
        const d = decision(beauty, "awakened_charm", index),
          a = candidate(d),
          opening = prefixes[d.openedAtEventCount!];
        check(
          opening &&
            opening.day === day &&
            eligibleChoice(opening, f.payload.targetId) &&
            phase === Phase.Night &&
            a?.name === "awakened_charm" &&
            same(a.args, { target_id: f.payload.targetId }) &&
            same(e.audience, [beauty]),
        );
        beautyState = {
          ...beautyState,
          choices: [...beautyState.choices, { day, targetId: f.payload.targetId }],
        };
        facts.set(d, index + 1);
      } else if (f.type === "awakened_beauty_replacement_paid") {
        check(same(e.audience, []));
        const { policy: _policy, actorId: _actor, ...paid } = f.payload;
        verifyReplacement(paid, index);
        beautyState = { ...beautyState, replacement: paid };
      } else {
        const paid = beautyState.replacement;
        check(
          paid &&
            paid.day === day &&
            paid.rootPhase !== Phase.Night &&
            publicReplacementAt === undefined &&
            e.audience === undefined &&
            f.payload.targetId === paid.targetId &&
            f.payload.targetDied === !alive.has(paid.targetId),
        );
        // 原10/12没有阻挡替死来源的第三方保护；实际目标必须先由通用死亡事实证明。
        check(
          f.payload.targetDied &&
            deaths.get(paid.targetId)?.causes.includes("awakened_beauty_replacement"),
        );
        publicReplacementAt = index + 1;
      }
    }
    if (e.type === "night_resolved") {
      const damage = verifyRaw(day);
      check(!nightPublished.has(day));
      if (alive.has(beauty) && !beautyState.replacement) {
        const prior = beautyState.choices.filter((x) => x.targetId !== null).at(-1);
        if (!prior || day >= prior.day + 2) check(beautyState.choices.some((x) => x.day === day));
      }
      const paid = beautyState.replacement;
      if (damage.has(beauty) && !paid) check(!replacementAvailable(new Set(damage.keys())));
      if (
        paid?.day === day &&
        paid.rootPhase === Phase.Night &&
        damage.has(beauty) &&
        same(causes(paid.preventedCauses), damage.get(beauty))
      ) {
        damage.delete(beauty);
        damage.set(paid.targetId, ["awakened_beauty_replacement"]);
      }
      check(
        Array.isArray(p.deaths) && same(sorted(p.deaths as number[]), sorted([...damage.keys()])),
      );
      for (const [id, cs] of damage) die(id, Phase.Night, cs);
      // 初始波先整批标死再进hook；末狼同波死亡不能因遍历ID先后给猎人补出不存在的方向请求。
      if (damage.has(hunter))
        patrolRequired = [...alive].some((id) => originals.get(id)?.camp === Camp.Wolf);
      nightPublished.add(day);
    }
    if (e.type === "voted_out") {
      const id = p.target as number;
      check(phase === Phase.Voting && lastExile === id);
      if (id === beauty) check(!replacementAvailable(new Set([id])));
      die(id, Phase.Voting, ["exile"]);
    }
    if (e.type === "wolf_self_destruct") {
      const id = p.wolfId as number;
      check(id !== beauty && originals.get(id)?.role === Role.Wolf);
      die(id, phase as Phase, ["self_destruct"]);
    }
    if (e.type === "additional_deaths") {
      check(Array.isArray(p.deaths));
      for (const id of p.deaths as number[]) {
        const paid = beautyState.replacement,
          run = pending();
        if (paid?.day === day && paid.targetId === id && alive.has(id)) {
          die(id, paid.rootPhase, ["awakened_beauty_replacement"]);
          if (run?.payment.targetId === beauty) run.actual = id;
        } else {
          check(run && run.payment.targetId === id && run.payment.direction !== null);
          if (id === beauty && run.payment.rootPhase !== Phase.Night)
            check(!replacementAvailable(new Set([id])));
          die(id, run.payment.rootPhase, ["awakened_patrol"]);
          run.actual = id;
        }
      }
    }
    if (patrolFact(e.type)) {
      const f = readAwakenedPatrolFact(e.type, p);
      check(f && f.payload.actorId === hunter && f.payload.day === day);
      if (f.type === "awakened_patrol_paid") {
        const d = decision(hunter, "awakened_patrol", index),
          a = candidate(d),
          opening = prefixes[d.openedAtEventCount!],
          death = deaths.get(hunter);
        check(
          opening &&
            opening.day === day &&
            !opening.alive.includes(hunter) &&
            !patrolState.payment &&
            death?.day === day &&
            death.root === f.payload.rootPhase &&
            death.causes.length > 0 &&
            death.causes.every((x) =>
              ["wolf_kill", "poison", "exile", "awakened_beauty_replacement"].includes(x),
            ) &&
            a?.name === "patrol" &&
            same(a.args, { direction: f.payload.direction }) &&
            f.payload.targetId === choose(snap(), f.payload.direction) &&
            same(e.audience, [hunter]),
        );
        const { policy: _policy, actorId: _actor, ...payment } = f.payload;
        patrolState = { policy: patrolPolicy, payment };
        patrols.push({
          decision: d,
          day,
          at: index + 1,
          payment,
          actual: null,
          resolvedAt: undefined,
        });
        facts.set(d, index + 1);
      } else {
        const run = pending();
        check(
          run &&
            e.audience === undefined &&
            f.payload.direction === run.payment.direction &&
            f.payload.targetId === run.actual &&
            (run.payment.direction === null || run.actual !== null),
        );
        run.resolvedAt = index + 1;
      }
    }
    prefixes[index + 1] = snap();
  }
  // 即使自动替死日志在夜报前失败，已记录的原夜伤操作仍须逐夜核真，不能靠缺夜报跳过原来源。
  for (const [at, op] of nightOps.entries()) {
    if (r.finalized) check(op.event_count !== undefined);
    if (op.event_count !== undefined)
      check(
        op.event_count <= r.events.length &&
          prefixes[op.event_count]?.day === at + 1 &&
          prefixes[op.event_count]?.phase === Phase.Night,
      );
    verifyRaw(at + 1);
  }
  // 每个请求使用开窗前的实际公开序列及本人私有序列，God原伤害不能靠编号／局部seq泄漏。
  for (const d of r.decisions) {
    check(d.openedAtEventCount !== undefined && prefixes[d.openedAtEventCount]);
    const p = prefixes[d.openedAtEventCount]!,
      ctx = d.request.context;
    const expected = r.events
      .slice(0, d.openedAtEventCount)
      .filter(
        (e) =>
          (beautyFact(e.type) || patrolFact(e.type)) &&
          (e.audience === undefined || e.audience.includes(d.actorId)),
      )
      .map((e) => ({ type: e.type, payload: e.payload }));
    check(
      same(
        ctx.visible_events
          .filter((e) => beautyFact(e.type) || patrolFact(e.type))
          .map((e) => ({ type: e.type, payload: e.payload })),
        expected,
      ),
    );
    if (!family(d)) {
      check(ctx.awakened_charm_candidates === undefined && ctx.patrol_seat_order === undefined);
      continue;
    }
    const tool = d.stage === "awakened_charm" ? "awakened_charm" : "patrol";
    check(
      p.day === d.day &&
        d.request.actorId === d.actorId &&
        d.request.phase === p.phase &&
        ctx.day === d.day &&
        ctx.stage === d.stage &&
        same(d.request.allowedTools, [tool]) &&
        ctx.action_failure_policy === "error" &&
        ctx.allow_fallback === false,
    );
    const a = candidate(d);
    if (d.stage === "awakened_charm") {
      check(
        d.actorId === beauty &&
          eligibleChoice(p, null) &&
          same(
            ctx.awakened_charm_candidates,
            p.alive.filter((id) => id !== beauty),
          ) &&
          ctx.patrol_seat_order === undefined,
      );
      if (d.outcome.kind === "action") {
        check(a?.name === "awakened_charm" && eligibleChoice(p, a.args.target_id));
      }
    } else {
      const death = p.deaths.get(hunter);
      check(
        d.actorId === hunter &&
          !p.alive.includes(hunter) &&
          !p.patrol.payment &&
          death?.day === d.day &&
          choose(p, "clockwise") !== null &&
          death.causes.length > 0 &&
          death.causes.every((x) =>
            ["wolf_kill", "poison", "exile", "awakened_beauty_replacement"].includes(x),
          ) &&
          ctx.death_origin_phase === death.root &&
          same(causes(ctx.death_sources), death.causes) &&
          same(ctx.patrol_seat_order, seats) &&
          ctx.awakened_charm_candidates === undefined,
      );
      if (d.outcome.kind === "action")
        check(
          a?.name === "patrol" &&
            (a.args.direction === null ||
              ["clockwise", "counter_clockwise"].includes(a.args.direction)),
        );
    }
  }
  // 付款历史是唯一资源。完整CP精确等于发表前缀；失败CP只容纳同一已知候选的精确末写，不能退款已发表付款。
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
    for (const [d, at] of facts) if (family(d) && at <= cp.eventCount) check(known.includes(d));
    const b = cp.players.find((x) => x.id === beauty),
      h = cp.players.find((x) => x.id === hunter),
      bs = b && readAwakenedBeautyStateData(b.privateState.awakenedBeauty),
      hs = h && readAwakenedPatrolStateData(h.privateState.awakenedPatrol);
    check(bs && hs);
    check(
      cp.players.every(
        (x) =>
          x.role === originals.get(x.id)?.role &&
          x.camp === originals.get(x.id)?.camp &&
          (x.id === beauty || !Object.hasOwn(x.privateState, "awakenedBeauty")) &&
          (x.id === hunter || !Object.hasOwn(x.privateState, "awakenedPatrol")),
      ),
    );
    if (cp.complete) {
      check(
        same(bs, p.beauty) &&
          same(hs, p.patrol) &&
          same(sorted(cp.players.filter((x) => x.alive).map((x) => x.id)), sorted(p.alive)) &&
          known.every(
            (d) => d.outcome.kind === "action" && (facts.get(d) ?? Infinity) <= cp.eventCount,
          ),
      );
      check(
        patrols
          .filter((run) => run.at <= cp.eventCount)
          .every((run) => run.resolvedAt !== undefined && run.resolvedAt <= cp.eventCount),
      );
      if (p.patrolRequired) check(hs.payment && known.some((d) => d.stage === "awakened_patrol"));
      if (bs.replacement && bs.replacement.rootPhase !== Phase.Night)
        check(publicReplacementAt !== undefined && publicReplacementAt <= cp.eventCount);
      continue;
    }
    check(
      same(bs.choices.slice(0, p.beauty.choices.length), p.beauty.choices) &&
        (p.beauty.replacement === null || same(bs.replacement, p.beauty.replacement)) &&
        (p.patrol.payment === null || same(hs, p.patrol)),
    );
    for (const choice of bs.choices.slice(p.beauty.choices.length)) {
      const ds = known.filter(
        (d) =>
          d.stage === "awakened_charm" &&
          d.day === choice.day &&
          (facts.get(d) ?? Infinity) > cp.eventCount,
      );
      check(ds.length === 1);
      const d = ds[0]!,
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!];
      check(
        a?.name === "awakened_charm" &&
          same(a.args, { target_id: choice.targetId }) &&
          opening &&
          opening.day === choice.day &&
          eligibleChoice(opening, choice.targetId),
      );
    }
    if (hs.payment && !p.patrol.payment) {
      const ds = known.filter(
        (d) => d.stage === "awakened_patrol" && (facts.get(d) ?? Infinity) > cp.eventCount,
      );
      check(ds.length === 1);
      const d = ds[0]!,
        a = candidate(d),
        opening = prefixes[d.openedAtEventCount!],
        death = opening?.deaths.get(hunter);
      check(
        a?.name === "patrol" &&
          opening &&
          death &&
          same(hs.payment, {
            day: d.day,
            rootPhase: death.root,
            direction: a.args.direction,
            targetId: choose(opening, a.args.direction),
          }),
      );
    }
    if (bs.replacement && !p.beauty.replacement) {
      // 未发表的自动首写没有Agent动作可代替；只接在当时可证原提案、同日关系与同一实际根之后。
      const choice = bs.choices.at(-1),
        paid = bs.replacement;
      check(
        choice?.day === p.day &&
          choice.targetId === paid.targetId &&
          paid.day === p.day &&
          p.alive.includes(beauty) &&
          p.alive.includes(paid.targetId),
      );
      const knownPatrol = p.pendingPatrol?.targetId === beauty ? p.pendingPatrol : null;
      const source = knownPatrol
        ? (check(knownPatrol.rootPhase !== Phase.Night), ["awakened_patrol"])
        : paid.rootPhase === Phase.Night && !p.nightPublished && !p.nativeDamage.has(paid.targetId)
          ? p.nativeDamage.get(beauty)
          : p.lastExile === beauty && p.phase === Phase.Voting
            ? ["exile"]
            : undefined;
      const root =
        knownPatrol?.rootPhase ?? (paid.rootPhase === Phase.Night ? Phase.Night : Phase.Voting);
      check(
        source &&
          paid.phase === p.phase &&
          paid.rootPhase === root &&
          same(causes(paid.preventedCauses), source),
      );
    }
  }
}
