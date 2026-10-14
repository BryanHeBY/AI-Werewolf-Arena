/**
 * 负责独立审核双生知识、配对、来源与公开次序。输入为归档配置、决定、事实与 checkpoint；
 * 输出为原一致性结果或明确拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import { fragrantFeedAt } from "./feed-evidence";
import { createMistSheriffEvidence } from "../mist-raven/sheriff-evidence";
import { sanitizeSpeechText } from "../../../utils/speech_text";
import {
  FRAGRANT_PAIR_POLICY,
  FRAGRANT_PAIR_EVENT_TYPES,
  readFragrantPairFact,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import { isFragrantPairSeerPreset } from "../../board-support";
import { Camp, Role, Phase } from "@ai-werewolf-arena/game-contract";
import type { ReproductionRecord, RecordedDecision, RecordedCheckpoint } from "../../../recording/reproduction";
import type { RecordedFragrantState } from "../../../recording/checkpoint/fragrant-pair-format";

function check(v: unknown): asserts v {
  if (!v) throw Error("reproduction_fragrant_pair_invalid");
}
function equal(a: unknown, b: unknown): boolean {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, x]) => x !== undefined)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
}
/** 按既定 FNV／Mulberry 规则独立推导一次抽样，不使用运行时 RNG 实现。 */
function knownIndex(seed: string, path: readonly string[]): number {
  const s = JSON.stringify([seed, ...path, "night", "fragrant-known-wolf"]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  let x = (h + 0x6d2b79f5) >>> 0;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return Math.floor((((x ^ (x >>> 14)) >>> 0) / 4294967296) * 3);
}
function call(d: RecordedDecision) {
  return d.outcome.kind === "action" ? d.outcome.action : null;
}
function pair(value: unknown, alive: ReadonlySet<number>): [number, number] {
  check(
    Array.isArray(value) &&
      value.length === 2 &&
      value.every((v) => typeof v === "number" && alive.has(v)) &&
      value[0] !== value[1],
  );
  return value[0] < value[1] ? [value[0], value[1]] : [value[1], value[0]];
}
type Sources = Record<string, string[]>;
/** 对归档独立推导数值与状态；不用生产 owner、目标作用域、状态迁移、
 * 伤害折叠器或 RNG 工厂生成校验预期。 */
export function validateFragrantPairRecord(r: ReproductionRecord): void {
  const board = r.metadata.normalizedBoard,
    owns = !!board.fragrantPairSeer;
  if (!owns) {
    check(
      !board.roleSetups.some((p) => [Role.FragrantPhantom, Role.AwakenedSeer].includes(p.role)) &&
        !r.events.some((e) => (FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(e.type)) &&
        !r.operations.some((o) => o.op.startsWith("fragrant_")) &&
        !r.decisions.some(
          (d) =>
            ["fragrant_bind", "pair_inspection"].includes(d.stage) ||
            d.request.allowedTools.some((t) => ["bind_fragrant_pair", "check_pair"].includes(t)) ||
            d.request.context.fragrant_pair_candidates !== undefined ||
            d.request.context.pair_check_candidates !== undefined,
        ) &&
        !r.checkpoints.some(
          (cp) =>
            cp.fragrantPair ||
            cp.players.some(
              (p) =>
                p.privateState.fragrant !== undefined ||
                p.privateState.pairSeer !== undefined ||
                Object.values(p.privateState.abilities ?? {}).some(
                  (a) => a && typeof a === "object" && "kind" in a && a.kind === "pair_check",
                ),
            ),
        ),
    );
    return;
  }
  check(isFragrantPairSeerPreset(board) && !r.metadata.initialDeal && !r.metadata.faultPlan);
  const roster = new Map(r.metadata.players.map((p) => [p.id, p])),
    ids = [...roster.keys()].sort((a, b) => a - b),
    roleId = (role: Role) => {
      const p = [...roster.values()].filter((p) => p.role === role);
      check(p.length === 1);
      return p[0]!.id;
    },
    phantomId = roleId(Role.FragrantPhantom),
    seerId = roleId(Role.AwakenedSeer),
    witchId = roleId(Role.Witch),
    guardId = roleId(Role.Guard),
    hunterId = roleId(Role.Hunter),
    wolves = [...roster.values()]
      .filter((p) => p.role === Role.Wolf)
      .map((p) => p.id)
      .sort((a, b) => a - b),
    alive = new Set(ids);
  check(
    ids.length === 12 &&
      [...roster.values()].filter((p) => p.role === Role.Villager).length === 4 &&
      wolves.length === 3 &&
      ids.every((id, i) => id === i + 1) &&
      [...roster.values()].every(
        (p) =>
          p.camp === ([Role.Wolf, Role.FragrantPhantom].includes(p.role) ? Camp.Wolf : Camp.Good),
      ),
  );
  const state: RecordedFragrantState = {
    phantomId,
    seerId,
    fragrant: {
      policy: FRAGRANT_PAIR_POLICY,
      knownWolfId: null,
      knowledgeNight: null,
      lastChoice: null,
      bindings: [],
      trigger: null,
    },
    pairSeer: { policy: FRAGRANT_PAIR_POLICY, history: [] },
    known: {
      knownWolfId: null,
      lastOpenedNight: 0,
      lastChoice: null,
      activeBinding: null,
      used: false,
      knifeNotices: [],
    },
    nights: [],
  };
  const at = new Map<
      number,
      {
        state: RecordedFragrantState;
        alive: Set<number>;
        phase: Phase;
        day: number;
        native: Record<string, unknown>;
        marks: Map<number, string[]>;
        sheriff: number | null;
        destroyed: Set<number>;
        badgeAssigned: boolean;
      }
    >(),
    openings = new Map<number, Set<number>>(),
    noticeDays = new Set<number>(),
    expiryDays = new Set<number>(),
    completed = new Set<RecordedDecision>(),
    matched = new Set<RecordedDecision>(),
    nativeDamage = new Map<number, Sources>(),
    consumedNight = new Set<number>(),
    announcedNights = new Set<number>(),
    pendingPublic = new Set<number>(),
    pendingLinks = new Map<number, Record<string, unknown>>();
  const native: Record<string, any> = {
      [witchId]: {
        abilities: {
          "native:potion": {
            id: "native:potion",
            kind: "potion",
            state: {
              heal: 1,
              poison: 1,
              selfHealRule: "disabled",
              canSelfHeal: false,
              healUsedThisNight: false,
              poisonUsedThisNight: false,
            },
            source: { kind: "native", role: Role.Witch },
            sourceDisclosed: true,
            startsOnDay: 1,
            maxUses: null,
            uses: 0,
            lastUsedDay: null,
            disabled: false,
          },
        },
      },
      [guardId]: {
        abilities: {
          "native:guard": {
            id: "native:guard",
            kind: "guard",
            state: { lastTarget: null, repeatPolicy: "netease_consecutive_nights_v1" },
            source: { kind: "native", role: Role.Guard },
            sourceDisclosed: true,
            startsOnDay: 1,
            maxUses: null,
            uses: 0,
            lastUsedDay: null,
            disabled: false,
          },
        },
      },
      [hunterId]: { hunter: { canShoot: true } },
    },
    marks = new Map(ids.map((id) => [id, [] as string[]])),
    destroyed = new Set<number>();
  const election = createMistSheriffEvidence(r);
  let badgeAssigned = false;
  let sheriff: number | null = null,
    exileRound = 1,
    exileCandidates: number[] | null = null,
    exileTarget: number | null = null;
  const deathFacts = new Map<
      number,
      { day: number; phase: string; initial: boolean; causes: string[] }
    >(),
    granted = new Set<string>(),
    spoken = new Set<string>();
  const publicSpeeches = new Set<RecordedDecision>();
  const wordsEligible = (f: { day: number; phase: string; initial: boolean; causes: string[] }) =>
    f.initial &&
    ((f.causes.includes("exile") && [Phase.Day, Phase.Voting].includes(f.phase as Phase)) ||
      (f.day === 1 && f.phase === Phase.Night));
  let day = 1,
    phase = Phase.Night,
    nightStart = new Set(ids),
    guardPrevious: number | null = null,
    healAvailable = true,
    poisonAvailable = true;
  const rows = (stage: string, actor?: number, d = day) =>
    r.decisions.filter(
      (q) => q.day === d && q.stage === stage && (actor === undefined || q.actorId === actor),
    );
  const settled = (stage: string, actor?: number) =>
    rows(stage, actor).filter((q) => call(q) !== null);
  const currentNight = () => {
    const n = state.nights.at(-1);
    check(n && n.day === day);
    return n;
  };
  const validateNativeNight = () => {
    if (nativeDamage.has(day)) return nativeDamage.get(day)!;
    const n = currentNight(),
      pack = wolves.filter((id) => nightStart.has(id)),
      killers = pack.length ? pack : nightStart.has(phantomId) && n.knife ? [phantomId] : [],
      voteRows = settled("wolf_vote"),
      tally = new Map<number, number>();
    check(
      equal(
        [...new Set(voteRows.map((q) => q.actorId))].sort((a, b) => a - b),
        killers,
      ),
    );
    for (const id of killers) {
      const votes = voteRows.filter((q) => q.actorId === id);
      check(votes.length === 1);
      const c = call(votes[0]!)!;
      check(c.name === "kill_vote");
      if (c.args.abstain === true || c.args.target_id === null) continue;
      check(typeof c.args.target_id === "number" && nightStart.has(c.args.target_id));
      tally.set(c.args.target_id, (tally.get(c.args.target_id) ?? 0) + 1);
    }
    const knife = [...tally].sort(([a, an], [b, bn]) => bn - an || a - b)[0]?.[0] ?? null,
      gs = rows("guard", guardId),
      ps = rows("witch", witchId);
    check(
      gs.length === (nightStart.has(guardId) ? 1 : 0) &&
        ps.length === (nightStart.has(witchId) ? 1 : 0),
    );
    let guarded: number | null = null,
      healed: number | null = null,
      poisoned: number | null = null;
    if (gs.length && call(gs[0]!)?.name === "guard") {
      const c = call(gs[0]!)!;
      check(c.name === "guard");
      if (c.args.abstain !== true && c.args.target_id !== null) {
        check(
          typeof c.args.target_id === "number" &&
            nightStart.has(c.args.target_id) &&
            c.args.target_id !== guardPrevious,
        );
        guarded = c.args.target_id;
      }
      guardPrevious = guarded;
    }
    if (ps.length && call(ps[0]!)?.name === "use_potion") {
      const c = call(ps[0]!)!;
      check(c.name === "use_potion");
      const t = c.args.potion_type,
        id = c.args.target_id;
      if (t === "heal") {
        check(healAvailable && knife !== null && id === knife && id !== witchId);
        healAvailable = false;
        healed = knife;
      } else if (t === "poison") {
        check(poisonAvailable && typeof id === "number" && nightStart.has(id));
        poisonAvailable = false;
        poisoned = id;
      } else check(t === "none");
    }
    const s: Sources = {};
    for (const id of [...nightStart].sort((a, b) => a - b)) {
      const causes: string[] = [];
      if (id === poisoned) causes.push("poison");
      if (id === knife && (id === guarded) === (id === healed)) causes.push("wolf_kill");
      if (causes.length) s[id] = causes;
    }
    nativeDamage.set(day, s);
    return s;
  };
  const publicDeaths = (values: unknown, nightAnnouncement = false) => {
    check(Array.isArray(values));
    for (const id of values) {
      check(
        typeof id === "number" &&
          !alive.has(id) &&
          (pendingPublic.has(id) ||
            (nightAnnouncement &&
              deathFacts.get(id)?.day === day &&
              deathFacts.get(id)?.causes.includes("self_destruct") &&
              Object.hasOwn(nativeDamage.get(day) ?? {}, id))),
      );
      pendingPublic.delete(id);
    }
    if (
      state.known.activeBinding &&
      state.known.activeBinding.createdNight === day &&
      values.some((id) => state.known.activeBinding!.pairIds.includes(id))
    ) {
      state.known.activeBinding = null;
      state.known.used = true;
    }
  };
  // eventCount、decisionCount、settlementCount 分别限定同一已发表位置；
  // pending 请求不能被完整归档尾段的成功状态补齐。
  const checkpoint = (cp: RecordedCheckpoint) => {
    check(
      cp.fragrantPair &&
        cp.operationCount !== undefined &&
        cp.settlementCount !== undefined &&
        cp.decisionCount !== undefined,
    );
    check(
      cp.cycle === 0 ? cp === r.checkpoints[0] : cp.cycle === cp.fragrantPair.nights.at(-1)?.day,
    );
    const prefix = r.decisions.slice(0, cp.decisionCount);
    check(cp.settlementCount === Math.max(0, ...prefix.map((d) => d.settleOrder ?? 0)));
    const v = at.get(cp.eventCount);
    check(v);
    const expected = structuredClone(v.state),
      n = expected.nights.at(-1);
    if (!cp.complete && n?.status === "open") n.status = "aborted";
    check(equal(cp.fragrantPair, expected));
    check(
      cp.decisionCount ===
        r.decisions.filter((d) => d.openedAtEventCount! <= cp.eventCount && d.day <= cp.cycle)
          .length && cp.settlementCount <= cp.decisionCount,
    );
    if (cp.complete) check(cp.settlementCount === cp.decisionCount);
    const advanced = cp.complete && cp.cycle > 0 && !cp.snapshot.gameOver;
    check(cp.snapshot.phase === v.phase && cp.snapshot.day === (advanced ? n!.day + 1 : v.day));
    if (cp.complete)
      for (const [id, fact] of deathFacts)
        if (fact.day <= cp.cycle && wordsEligible(fact))
          check(granted.has(`${fact.day}/${id}`) && rows("last_words", id, fact.day).length === 1);
    const terminal = r.events
      .slice(0, cp.eventCount)
      .reverse()
      .find((e) => e.type === "game_over");
    if (terminal) check(equal(cp.snapshot.result, terminal.payload));
    check(
      cp.players.length === 12 &&
        cp.players.every((p) => {
          const origin = roster.get(p.id);
          return (
            origin &&
            p.role === origin.role &&
            p.camp === origin.camp &&
            p.name === origin.name &&
            p.seat === p.id &&
            p.alive === v.alive.has(p.id) &&
            equal(p.victory, { affiliations: [{ kind: "faction", faction: origin.camp }] })
          );
        }),
    );
    for (const p of cp.players) {
      const stock =
        p.id === hunterId && cp.complete && !v.alive.has(hunterId)
          ? { hunter: { canShoot: false } }
          : v.native[p.id];
      if (stock) check(equal(p.privateState, stock));
      check(equal(p.marks, v.marks.get(p.id)));
      check(equal(p.vote, { weight: p.id === v.sheriff ? 1.5 : 1, canVote: true }));
      check(
        equal(p.badge, {
          isSheriff: p.id === v.sheriff,
          destroyed: v.destroyed.has(p.id),
          voteWeight: 1.5,
          ...(v.badgeAssigned ? { handoffPolicy: "awa_holder_choice_v1" } : {}),
        }),
      );
    }
    const f = cp.players.find((p) => p.id === phantomId)!,
      s = cp.players.find((p) => p.id === seerId)!,
      abilities = s.privateState.abilities as Record<string, Record<string, unknown>>,
      ability = abilities?.["native:pair_check"];
    check(
      equal(f.privateState.fragrant, expected.fragrant) &&
        equal(s.privateState.pairSeer, expected.pairSeer) &&
        equal(ability, {
          id: "native:pair_check",
          kind: "pair_check",
          state: expected.pairSeer,
          source: { kind: "native", role: Role.AwakenedSeer },
          sourceDisclosed: true,
          startsOnDay: 1,
          maxUses: null,
          uses: expected.pairSeer.history.length,
          lastUsedDay: expected.pairSeer.history.at(-1)?.day ?? null,
          disabled: false,
        }),
    );
  };
  const save = (cursor: number) =>
    at.set(cursor, {
      state: structuredClone(state),
      alive: new Set(alive),
      phase,
      day,
      native: structuredClone(native),
      marks: structuredClone(marks),
      sheriff,
      destroyed: new Set(destroyed),
      badgeAssigned,
    });
  save(0);
  for (let i = 0; i < r.events.length; i++) {
    const e = r.events[i]!,
      p = e.payload;
    if (e.type === "phase_changed") {
      check(typeof p.day === "number" && p.day >= day);
      day = p.day;
      phase = p.phase as Phase;
    }
    if (e.type === "fragrant_night_opened") {
      check(
        phase === Phase.Night &&
          p.actorId === phantomId &&
          p.knowledgeDrawCount === (day === 1 ? 1 : 0),
      );
      check(!state.nights.some((n) => n.day === day));
      nightStart = new Set(alive);
      openings.set(day, new Set(alive));
      exileRound = 1;
      exileCandidates = null;
      exileTarget = null;
      const potion = native[witchId].abilities["native:potion"];
      if (alive.has(witchId)) {
        potion.state.healUsedThisNight = false;
        potion.state.poisonUsedThisNight = false;
      }
      for (const b of state.fragrant.bindings)
        if (b.status.kind === "pending") {
          b.status = { kind: "expired", day: b.expiresNight };
          expiryDays.add(day);
        }
      if (day === 1) {
        check(state.fragrant.knownWolfId === null);
        state.fragrant.knownWolfId =
          wolves[knownIndex(r.metadata.random.seed, r.metadata.random.path)]!;
        state.fragrant.knowledgeNight = 1;
      }
      const knife = alive.has(phantomId) && wolves.every((id) => !alive.has(id));
      state.nights.push({ day, status: "open", knife, bindCommitted: false, pairCommitted: false });
      state.known.lastOpenedNight = day;
      state.known.activeBinding = null;
      state.known.knownWolfId = state.fragrant.knownWolfId;
      if (alive.has(phantomId)) {
        state.known.knifeNotices.push({ day, eligible: knife });
      }
    }
    if (e.type === "phase_changed" && phase === Phase.Day) {
      const n = currentNight();
      check(
        equal(
          rows("wolf_discussion")
            .filter((d) => d.request.context.round === 1)
            .map((d) => d.actorId)
            .sort((a, b) => a - b),
          wolves.filter((id) => nightStart.has(id)),
        ),
      );
      validateNativeNight();
      check(
        n.bindCommitted ===
          (!state.fragrant.trigger && nightStart.has(phantomId) && nightStart.size >= 2),
      );
      check(n.pairCommitted === (nightStart.has(seerId) && nightStart.size >= 2));
      n.status = "normal";
      for (const list of marks.values()) list.length = 0;
    }
    if ((FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(e.type)) {
      const fact = readFragrantPairFact(e.type, p);
      check(fact && fact.day === day);
      if (e.type === "fragrant_night_notified") {
        check(
          phase === Phase.Night &&
            p.actorId === phantomId &&
            alive.has(phantomId) &&
            !noticeDays.has(day) &&
            equal(p.known, state.known),
        );
        noticeDays.add(day);
      } else if (e.type === "fragrant_binding_expired") {
        const b = state.fragrant.bindings.find((b) => b.id === p.bindingId);
        check(
          phase === Phase.Night &&
            p.actorId === phantomId &&
            expiryDays.delete(day) &&
            b &&
            b.status.kind === "expired" &&
            equal(p.pairIds, b.pairIds) &&
            p.createdNight === b.createdNight,
        );
      } else if (e.type === "fragrant_pair_chosen" || e.type === "fragrant_pair_inspected") {
        const isBind = e.type === "fragrant_pair_chosen",
          actor = isBind ? phantomId : seerId,
          stage = isBind ? "fragrant_bind" : "pair_inspection",
          tool = isBind ? "bind_fragrant_pair" : "check_pair",
          n = currentNight();
        check(
          phase === Phase.Night &&
            p.actorId === actor &&
            alive.has(actor) &&
            !(isBind ? n.bindCommitted : n.pairCommitted),
        );
        const choices = settled(stage, actor).filter(
          (d) => !matched.has(d) && d.openedAtEventCount! <= i,
        );
        check(choices.length === 1);
        const d = choices[0]!,
          c = call(d)!;
        check(
          c.name === tool &&
            Object.keys(c.args).length === 1 &&
            Object.hasOwn(c.args, "target_ids"),
        );
        const targets =
          isBind && c.args.target_ids === null ? null : pair(c.args.target_ids, alive);
        matched.add(d);
        completed.add(d);
        if (isBind) {
          check(!state.fragrant.trigger && equal(p.pairIds, targets));
          n.bindCommitted = true;
          state.fragrant.lastChoice = { day, pairIds: targets };
          state.known.lastChoice = { day, pairIds: targets };
          state.known.activeBinding =
            targets === null
              ? null
              : { createdNight: day, expiresNight: day + 1, pairIds: targets };
          if (targets)
            state.fragrant.bindings.push({
              id: `fragrant:night:${day}`,
              createdNight: day,
              expiresNight: day + 1,
              pairIds: targets,
              status: { kind: "pending" },
            });
        } else {
          check(targets);
          const result = targets.some((id) => roster.get(id)!.camp === Camp.Wolf);
          check(equal(p.targetIds, targets) && p.containsWerewolf === result);
          n.pairCommitted = true;
          state.pairSeer.history.push({ day, targetIds: targets, containsWerewolf: result });
        }
      } else if (e.type === "fragrant_wave_committed") {
        check(p.actorId === phantomId && Array.isArray(p.deaths));
        const deaths = p.deaths as number[],
          sources = p.deathSources as Sources,
          origins = p.deathPhases as Record<string, string>,
          roots = deaths.filter((id) => !sources[id]?.includes("fragrant_link"));
        check(deaths.every((id) => alive.has(id)) && roots.length > 0);
        let expected: Sources = {},
          rootOrder: number[] = [];
        const allNight = roots.every((id) => origins[id] === "night"),
          blast = roots.filter((id) => sources[id]?.includes("self_destruct")),
          exile = roots.filter((id) => sources[id]?.includes("exile")),
          shots = roots.filter((id) => sources[id]?.includes("shot"));
        if (allNight || blast.length) {
          check(p.initialWave === true);
          if (!consumedNight.has(day)) {
            expected = structuredClone(validateNativeNight());
            rootOrder = Object.keys(expected).map(Number);
            consumedNight.add(day);
          } else check(!allNight);
          if (blast.length) {
            check(blast.length === 1);
            const id = blast[0]!,
              q = settled("on_pre_election", id)
                .concat(settled("on_pre_vote", id))
                .find((d) => call(d)?.name === "self_destruct");
            check(q && wolves.includes(id));
            if (!Object.hasOwn(expected, id)) rootOrder.push(id);
            expected[id] = [...new Set([...(expected[id] ?? []), "self_destruct"])];
          }
        } else if (exile.length) {
          check(
            exile.length === 1 &&
              roots.length === 1 &&
              p.initialWave === true &&
              phase === Phase.Voting &&
              exile[0] === exileTarget &&
              r.events
                .slice(0, i)
                .some((x) => x.type === "voted_out" && x.payload.target === exile[0]),
          );
          expected[exile[0]!] = ["exile"];
          rootOrder = [exile[0]!];
        } else if (shots.length) {
          check(p.initialWave === false && shots.length === 1 && roots.length === 1);
          const id = shots[0]!,
            q = settled("hunter_shot", hunterId).find(
              (d) =>
                (call(d) as { args: Record<string, unknown> } | null)?.args.target_id === id &&
                d.openedAtEventCount! < i,
            );
          check(
            q &&
              !alive.has(hunterId) &&
              r.events
                .slice(0, i)
                .some(
                  (x) =>
                    x.type === "hunter_shot" &&
                    x.payload.hunterId === hunterId &&
                    x.payload.targetId === id,
                ),
          );
          expected[id] = ["shot"];
          rootOrder = [id];
        } else check(false);
        const b = state.fragrant.bindings.find(
            (b) => b.status.kind === "pending" && b.createdNight === day,
          ),
          root = b && roots.find((id) => b.pairIds.includes(id));
        if (b && root !== undefined) {
          check(!state.fragrant.trigger);
          const other = b.pairIds.find((id) => id !== root)!,
            added = Object.hasOwn(expected, other) ? null : alive.has(other) ? other : null;
          b.status = { kind: "triggered", day };
          state.fragrant.trigger = { bindingId: b.id, day, rootId: root, addedTargetId: added };
          if (added !== null) {
            expected[added] = ["fragrant_link"];
            check(deaths.at(-1) === added && origins[added] === origins[root]);
          }
          const link = {
            policy: FRAGRANT_PAIR_POLICY,
            actorId: phantomId,
            day,
            bindingId: b.id,
            pairIds: b.pairIds,
            rootId: root,
            addedTargetId: added,
            rootPhase: origins[root],
            initialWave: p.initialWave,
          };
          pendingLinks.set(i + 1, link);
          if (exile.length || shots.length || blast.length) {
            state.known.used = true;
            state.known.activeBinding = null;
          }
        }
        check(
          roots.every(
            (id) =>
              origins[id] ===
              (expected[id]?.includes("self_destruct")
                ? phase
                : expected[id]?.includes("exile")
                  ? Phase.Voting
                  : expected[id]?.includes("shot")
                    ? phase
                    : Phase.Night),
          ) &&
            equal(sources, expected) &&
            equal(roots, rootOrder),
        );
        for (const id of deaths) {
          alive.delete(id);
          deathFacts.set(id, {
            day,
            phase: origins[id]!,
            initial: p.initialWave === true,
            causes: [...sources[id]!],
          });
          if (!exile.includes(id) && !shots.includes(id) && !blast.includes(id))
            pendingPublic.add(id);
        }
      } else if (e.type === "fragrant_link_triggered") {
        check(equal(p, pendingLinks.get(i)));
        pendingLinks.delete(i);
      }
    }
    if (
      [
        "wolf_tactical_order",
        "wolf_discussion",
        "wolf_discussion_ended",
        "wolf_kill_vote_cast",
      ].includes(e.type)
    ) {
      const pack = wolves.filter((id) => alive.has(id)),
        expected =
          e.type === "wolf_kill_vote_cast" &&
          pack.length === 0 &&
          alive.has(phantomId) &&
          currentNight().knife
            ? [phantomId]
            : pack;
      check(phase === Phase.Night && equal(e.audience, expected));
      if (e.type === "wolf_tactical_order")
        check(
          equal(
            [...(p.order as number[])].sort((a, b) => a - b),
            pack,
          ),
        );
    }
    if (e.type === "wolf_discussion" || e.type === "wolf_discussion_ended") {
      const ds = rows("wolf_discussion", Number(p.actorId)).filter(
          (d) => d.request.context.round === p.round,
        ),
        d = ds[0],
        c = d && call(d);
      check(ds.length === 1 && c?.name === "speak_to_wolves");
      check(
        e.type === (c.args.end_chat ? "wolf_discussion_ended" : "wolf_discussion") &&
          (e.type === "wolf_discussion_ended" ? p.reason : p.text) ===
            sanitizeSpeechText(c.args.text),
      );
    }
    if (e.type === "guard_applied") {
      const d = rows("guard", guardId)[0],
        c = d && call(d);
      check(phase === Phase.Night && c?.name === "guard" && p.actorId === guardId);
      const abstain = c.args.abstain === true,
        target = abstain ? null : c.args.target_id;
      check(equal(p, { actorId: guardId, abstain, targetId: target }));
      const a = native[guardId].abilities["native:guard"];
      a.lastUsedDay = day;
      a.uses += abstain ? 0 : 1;
      a.state.lastTarget = target;
      if (typeof target === "number") marks.get(target)!.push("GuardMark");
    }
    if (e.type === "wolf_kill_vote_cast") {
      const pack = wolves.filter((id) => nightStart.has(id)),
        killers = pack.length
          ? pack
          : currentNight().knife && nightStart.has(phantomId)
            ? [phantomId]
            : [];
      const previous = r.events
        .slice(0, i + 1)
        .filter((e, j) => e.type === "wolf_kill_vote_cast" && at.get(j)?.day === day);
      if (previous.length === killers.length) {
        const tally = new Map<number, number>();
        for (const q of previous)
          if (q.payload.abstain === false && typeof q.payload.targetId === "number")
            tally.set(q.payload.targetId, (tally.get(q.payload.targetId) ?? 0) + 1);
        const target = [...tally].sort(([a, x], [b, y]) => y - x || a - b)[0]?.[0];
        if (target !== undefined) marks.get(target)!.push("WolfKillMark");
      }
    }
    if (e.type === "witch_potion_used" || e.type === "witch_potion_skipped") {
      const d = rows("witch", witchId)[0],
        c = d && call(d);
      check(phase === Phase.Night);
      if (c === null) {
        check(
          e.type === "witch_potion_skipped" &&
            equal(p, { actorId: witchId, targetId: null, potionType: "none", reason: "no_action" }),
        );
      } else {
        check(
          phase === Phase.Night &&
            c?.name === "use_potion" &&
            equal(p, {
              actorId: witchId,
              targetId: c.args.target_id,
              potionType: c.args.potion_type,
            }),
        );
      }
      if (c === null) {
        save(i + 1);
        continue;
      }
      const a = native[witchId].abilities["native:potion"],
        t = c.args.potion_type;
      a.lastUsedDay = day;
      if (t !== "none") {
        check(t === "heal" || t === "poison");
        a.state[t]--;
        a.state[t === "heal" ? "healUsedThisNight" : "poisonUsedThisNight"] = true;
        a.uses++;
        marks.get(c.args.target_id)!.push(t === "heal" ? "HealMark" : "PoisonMark");
      }
    }
    if (e.type === "hunter_shot") native[hunterId].hunter.canShoot = false;
    if (e.type === "hunter_silent_due_to_poison") native[hunterId].hunter.canShoot = false;
    election.accept(e, { day, phase, alive, idiot: -1, idiotRevealed: false });
    if (e.type === "sheriff_vote_summary" && typeof p.winnerId === "number") {
      sheriff = p.winnerId;
      badgeAssigned = true;
    }
    if (e.type === "vote_summary") {
      check(phase === Phase.Voting && (p.round ?? 1) === exileRound);
      const stage = exileRound === 1 ? "voting" : "exile_pk_vote",
        eligible = [...alive].filter((id) => !exileCandidates?.includes(id)).sort((a, b) => a - b),
        ballots: unknown[] = [],
        tally: Record<string, number> = {};
      check(
        equal(
          [...new Set(rows(stage).map((d) => d.actorId))].sort((a, b) => a - b),
          eligible,
        ),
      );
      for (const id of eligible) {
        const ds = rows(stage, id);
        let selected: { target: number | null; abstain: boolean } | null = null;
        for (const d of ds) {
          const c = call(d);
          if (c?.name !== "vote" || typeof c.args.abstain !== "boolean") continue;
          if (c.args.abstain) {
            selected = { target: null, abstain: true };
            break;
          }
          if (
            typeof c.args.target_id === "number" &&
            alive.has(c.args.target_id) &&
            (!exileCandidates || exileCandidates.includes(c.args.target_id))
          ) {
            selected = { target: c.args.target_id, abstain: false };
            break;
          }
        }
        const v = selected ?? { target: null, abstain: true },
          weight = v.abstain ? 0 : id === sheriff ? 1.5 : 1;
        ballots.push({
          actorId: id,
          targetId: v.target,
          abstain: v.abstain,
          weight,
          ...(!selected ? { fallback: true } : {}),
        });
        if (v.target !== null) tally[v.target] = (tally[v.target] ?? 0) + weight;
      }
      const top = Object.entries(tally).sort(([a, x], [b, y]) => y - x || Number(a) - Number(b)),
        leaders = top.filter(([, n]) => n === top[0]?.[1]).map(([id]) => Number(id));
      exileTarget = leaders.length === 1 ? leaders[0]! : null;
      check(equal(p.votes, ballots) && equal(p.tally, tally) && p.target === exileTarget);
      if (exileRound === 1 && leaders.length > 1) exileCandidates = leaders;
    }
    if (e.type === "exile_pk_started") {
      check(exileRound === 1 && exileCandidates && equal(p.candidates, exileCandidates));
      exileRound = 2;
    }
    if (e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed") {
      const from = p.fromId ?? p.playerId ?? p.sheriffId;
      check(from === sheriff && !alive.has(sheriff!));
      const d: RecordedDecision | undefined = rows("sheriff_badge_choice", sheriff!)[0];
      const c = d ? call(d) : null;
      const target: unknown = c?.name === "choose_badge_successor" ? c.args.target_id : null;
      destroyed.add(Number(from));
      if (e.type === "sheriff_badge_transferred") {
        check(typeof p.toId === "number" && alive.has(p.toId) && target === p.toId);
        sheriff = p.toId;
      } else {
        check(target === null || !alive.has(Number(target)));
        destroyed.add(Number(from));
        sheriff = null;
      }
    }
    if (e.type === "last_words_granted" || e.type === "last_words_spoken") {
      check(typeof p.playerId === "number");
      const f = deathFacts.get(p.playerId),
        key = `${day}/${p.playerId}`;
      check(f && f.day === day && wordsEligible(f));
      if (e.type === "last_words_granted") {
        check(!granted.has(key));
        granted.add(key);
      } else {
        const d = rows("last_words", p.playerId)[0],
          c = d && call(d);
        check(
          granted.has(key) &&
            !spoken.has(key) &&
            c?.name === "speak" &&
            p.text === sanitizeSpeechText(c.args.text),
        );
        spoken.add(key);
      }
    }
    if (e.type === "day_speech") {
      check(typeof p.actorId === "number" && alive.has(p.actorId));
      const candidates = r.decisions.filter(
        (d) =>
          d.day === day &&
          d.actorId === p.actorId &&
          [
            "day_speech",
            "sheriff_campaign_speech",
            "sheriff_pk_speech",
            "exile_pk_speech",
          ].includes(d.stage) &&
          !publicSpeeches.has(d) &&
          d.openedAtEventCount! <= i,
      );
      check(candidates.length === 1);
      const d = candidates[0],
        c = d && call(d);
      check(c?.name === "speak" && p.text === sanitizeSpeechText(c.args.text));
      publicSpeeches.add(d!);
    }
    if (e.type === "night_resolved") {
      check(!announcedNights.has(day));
      announcedNights.add(day);
      check(consumedNight.has(day) || Object.keys(validateNativeNight()).length === 0);
      check(equal(p.deaths, Object.keys(validateNativeNight()).map(Number)));
      publicDeaths(p.deaths, true);
    }
    if (e.type === "additional_deaths") publicDeaths(p.deaths);
    if (e.type === "voted_out") {
      check(phase === Phase.Voting && typeof p.target === "number" && alive.has(p.target));
    }
    if (e.type === "game_over") {
      check(pendingPublic.size === 0 && pendingLinks.size === 0 && phase === Phase.GameOver);
      const remaining = [...alive].map((id) => roster.get(id)!);
      const wolf = remaining.filter((p) => p.camp === Camp.Wolf),
        villagers = remaining.filter((p) => p.role === Role.Villager),
        gods = remaining.filter((p) => p.camp === Camp.Good && p.role !== Role.Villager),
        winner =
          wolf.length === 0
            ? Camp.Good
            : gods.length === 0 || villagers.length === 0
              ? Camp.Wolf
              : null;
      const winners = [...roster.values()]
        .filter((p) => p.camp === winner)
        .map((p) => p.id)
        .sort((a, b) => a - b);
      check(
        equal(p.outcome, {
          kind: "victory",
          primary: { kind: "faction", faction: winner, winningPlayerIds: winners },
          additional: [],
          winningPlayerIds: winners,
        }),
      );
      check(
        winner !== null &&
          p.winner === winner &&
          p.reason ===
            (winner === Camp.Good ? "all_wolves_eliminated" : "slaughter_side_completed"),
      );
    }
    save(i + 1);
  }
  for (const cp of r.checkpoints) checkpoint(cp);
  for (const d of r.decisions) {
    check(
      equal(d.request.context.visible_events, fragrantFeedAt(r, d.openedAtEventCount!, d.actorId)),
    );
    const v = at.get(d.openedAtEventCount!);
    check(
      v &&
        d.actorId === d.request.actorId &&
        d.day === d.request.context.day &&
        d.stage === d.request.context.stage &&
        d.request.phase === v.phase &&
        d.day === v.day &&
        d.openedAfterSettlement <= (d.settleOrder ?? Number.MAX_SAFE_INTEGER),
    );
    if (["fragrant_bind", "pair_inspection"].includes(d.stage)) {
      const bind = d.stage === "fragrant_bind",
        actor = bind ? phantomId : seerId,
        tool = bind ? "bind_fragrant_pair" : "check_pair",
        ctx = d.request.context;
      check(
        d.actorId === actor &&
          v.phase === Phase.Night &&
          v.alive.has(actor) &&
          v.state.nights.at(-1)?.day === d.day &&
          v.state.nights.at(-1)?.status === "open" &&
          !(bind
            ? v.state.nights.at(-1)?.bindCommitted || v.state.fragrant.trigger
            : v.state.nights.at(-1)?.pairCommitted) &&
          equal(d.request.allowedTools, [tool]) &&
          ctx.allow_fallback === false &&
          ctx.action_failure_policy === "error" &&
          equal(ctx.turn_constraints.required_any_tools, [tool]) &&
          ctx.turn_constraints.min_valid_actions === 1 &&
          ctx.turn_constraints.max_valid_actions === 1 &&
          equal(
            bind ? ctx.fragrant_pair_candidates : ctx.pair_check_candidates,
            [...v.alive].sort((a, b) => a - b),
          ),
      );
      check(rows(d.stage, d.actorId, d.day).length === 1);
      if (!bind) {
        const prefix = r.events.slice(0, d.openedAtEventCount),
          start = openings.get(d.day)!;
        check(
          !start.has(phantomId) || v.state.fragrant.trigger || v.state.nights.at(-1)?.bindCommitted,
        );
        check(
          !start.has(witchId) ||
            prefix.some(
              (e) =>
                ["witch_potion_used", "witch_potion_skipped"].includes(e.type) &&
                e.payload.actorId === witchId &&
                at.get(r.events.indexOf(e) + 1)?.day === d.day,
            ),
        );
        check(
          !start.has(guardId) ||
            call(rows("guard", guardId, d.day)[0]!) === null ||
            prefix.some(
              (e) => e.type === "guard_applied" && at.get(r.events.indexOf(e) + 1)?.day === d.day,
            ),
        );
        const earlier = r.decisions.filter(
          (q) =>
            q.day === d.day &&
            ["fragrant_bind", "guard", "witch", "wolf_vote"].includes(q.stage) &&
            q.settleOrder !== undefined,
        );
        check(earlier.every((q) => q.settleOrder! <= d.openedAfterSettlement));
      }
      check(bind ? ctx.ability_id === undefined : ctx.ability_id === "native:pair_check");
      if (d.outcome.kind === "action") check(completed.has(d));
    }
    if (d.request.allowedTools.some((t) => t === "speak_to_wolves" || t === "kill_vote"))
      check(
        d.request.context.allow_fallback === false &&
          d.request.context.action_failure_policy === "error",
      );
    if (
      v.phase === Phase.Night &&
      [
        "fragrant_bind",
        "pair_inspection",
        "wolf_discussion",
        "wolf_vote",
        "guard",
        "witch",
      ].includes(d.stage)
    ) {
      const start = openings.get(d.day);
      check(start && v.state.nights.at(-1)?.day === d.day);
      if (start.has(phantomId))
        check(
          r.events
            .slice(0, d.openedAtEventCount)
            .some((e) => e.type === "fragrant_night_notified" && e.payload.day === d.day),
        );
      if (d.stage !== "fragrant_bind" && start.has(phantomId) && !v.state.fragrant.trigger)
        check(v.state.nights.at(-1)?.bindCommitted);
    }
    if (d.request.allowedTools.includes("speak_to_wolves")) check(d.actorId !== phantomId);
    if (d.request.allowedTools.includes("self_destruct")) check(d.actorId !== phantomId);
    if (d.request.allowedTools.includes("kill_vote"))
      check(
        wolves.includes(d.actorId) ||
          (d.actorId === phantomId && v.state.nights.at(-1)?.knife === true),
      );
  }
  const settledOrders = r.decisions
    .filter((d) => d.settleOrder !== undefined)
    .map((d) => d.settleOrder!)
    .sort((a, b) => a - b);
  check(settledOrders.every((n, i) => n === i + 1));
  check(r.checkpoints.every((cp, i) => cp.cycle === i));
  if (r.finalized) {
    const last = r.checkpoints.at(-1)!;
    check(
      last.eventCount === r.events.length &&
        last.decisionCount === r.decisions.length &&
        last.operationCount === r.operations.length,
    );
  }
  // 归档成功完成 finalize 时，游标须与领域操作一致。
  if (r.finalized) {
    let previous = 0;
    for (const o of r.operations) {
      check(
        o.event_count !== undefined &&
          o.event_count >= previous &&
          o.event_count <= r.events.length,
      );
      previous = o.event_count;
    }
    for (const o of r.operations.filter((o) => o.op.startsWith("fragrant_"))) {
      check(o.status === "ok");
      if (o.op === "fragrant_night_opened") {
        check(
          o.scope === "phase_pipeline" &&
            o.phase === Phase.Night &&
            o.actor_id === undefined &&
            o.output,
        );
        const output = o.output,
          di = output.day,
          ev = r.events.findIndex(
            (e) => e.type === "fragrant_night_opened" && e.payload.day === di,
          ),
          notice = r.events.find(
            (e) => e.type === "fragrant_night_notified" && e.payload.day === di,
          );
        check(
          ev >= 0 &&
            equal(output, {
              policy: FRAGRANT_PAIR_POLICY,
              day: di,
              notice: notice
                ? { actorId: notice.payload.actorId, day: di, known: notice.payload.known }
                : null,
              knowledgeDrawCount: di === 1 ? 1 : 0,
            }) &&
            o.event_count! >= ev + 1 &&
            o.event_count! <= ev + 3,
        );
      } else {
        check(
          [
            "fragrant_pair_chosen",
            "fragrant_pair_inspected",
            "fragrant_wave_committed",
            "fragrant_link_triggered",
          ].includes(o.op),
        );
        const choice = o.op === "fragrant_pair_chosen" || o.op === "fragrant_pair_inspected";
        check(
          o.scope === (choice ? "phase_pipeline" : "resolution") &&
            (!choice || o.phase === Phase.Night) &&
            o.phase !== Phase.GameOver &&
            o.actor_id ===
              (choice ? (o.op === "fragrant_pair_chosen" ? phantomId : seerId) : undefined),
        );
        const ei = r.events.findIndex((e) => e.type === o.op && equal(e.payload, o.output));
        check(
          ei >= 0 &&
            o.event_count! >= ei + 1 &&
            o.event_count! <= ei + 2 &&
            o.phase === at.get(ei + 1)?.phase,
        );
      }
    }
    for (const cp of r.checkpoints) {
      check(cp.operationCount! <= r.operations.length);
      check(
        cp.operationCount === r.operations.filter((o) => o.event_count! <= cp.eventCount).length,
      );
    }
    for (const [day, start] of openings) {
      const cp = r.checkpoints.find((cp) => cp.cycle === day);
      if (!cp?.complete) continue;
      const n = r.operations.filter(
        (o) => o.op === "fragrant_night_opened" && o.output?.day === day,
      );
      check(n.length === 1 && n[0]!.output?.knowledgeDrawCount === (day === 1 ? 1 : 0));
      check(!start.has(phantomId) || noticeDays.has(day));
    }
    for (let i = 0; i < r.events.length; i++) {
      const e = r.events[i]!;
      if (
        ![
          "fragrant_pair_chosen",
          "fragrant_pair_inspected",
          "fragrant_wave_committed",
          "fragrant_link_triggered",
        ].includes(e.type)
      )
        continue;
      const ops = r.operations.filter((o) => o.op === e.type && equal(o.output, e.payload));
      const cp = r.checkpoints.find((cp) => cp.eventCount >= i + 1);
      if (cp?.complete) check(ops.length === 1);
      else check(ops.length <= 1);
      for (const o of ops) check(o.event_count! >= i + 1 && o.event_count! <= i + 2);
    }
  }
  check(pendingLinks.size === 0 || r.checkpoints.at(-1)?.complete === false);
}
