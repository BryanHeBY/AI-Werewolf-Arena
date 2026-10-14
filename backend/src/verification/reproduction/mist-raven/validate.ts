/**
 * 负责独立审核雾鸦致死、延期与请求因果。输入为归档配置、决定、事实与 checkpoint；
 * 输出为原一致性结果或明确拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import {
  check,
  equal,
  ids,
  exact,
  mistDraw,
  validateMistRavenRequests,
  selectedMistBlast,
} from "./requests";
import { createMistSheriffEvidence } from "./sheriff-evidence";
import { validateMistRavenFeeds } from "./feed-evidence";
import { isMistRavenPreset } from "../../board-support";
import {
  MIST_RAVEN_EVENT_TYPES,
  readMistRavenFact,
} from "@ai-werewolf-arena/game-contract/facts/mist-raven";
import { Camp, Phase, Role } from "@ai-werewolf-arena/game-contract";
import type { RecordedCheckpoint, ReproductionRecord } from "../../../recording/reproduction";

type AlchemistLedger = {
  policy: "awa_mist_raven_v1";
  mistRemaining: number;
  healRemaining: number;
  mistHistory: Array<{ day: number; targetIds: number[] | null }>;
  healHistory: Array<{ day: number; targetId: number | null }>;
};
type RavenLedger = {
  policy: "awa_mist_raven_v1";
  awakenedDay: number | null;
  knownTeammateIds: number[];
  extraRemaining: number;
  extraHistory: Array<{ day: number; targetId: number | null }>;
};
type NightLedger = {
  day: number;
  start: number[];
  mistStock: number;
  snakeStock: number;
  extraStock: number;
  awake: boolean;
  unsealExpected: boolean;
  known: number[];
  unsealSeen: boolean;
  delay: boolean;
  mistSeen: boolean;
  ravenSeen: boolean;
  circle: number[] | null;
  dream: number | null;
  consecutive: boolean;
  dreamSeen: boolean;
  seerSeen: boolean;
  order: number[] | null;
  votes: Map<number, number | null>;
  drawSeen: boolean;
  knife: number | null;
  extra: number | null;
  snakeSeen: boolean;
  healed: number | null;
  settled: boolean;
  blast: boolean;
  damage: { deaths: number[]; death_sources: Record<number, string[]> } | null;
  reasons: Array<{
    actorId: number;
    targetId: number;
    day: number;
    reason: "linked" | "consecutive";
  }>;
  reasonsSeen: number;
  direction: "clockwise" | "counter_clockwise";
  publishedDay: boolean;
};
const privateFields = [
  "mist_candidates",
  "wolf_kill_candidates",
  "snake_target",
  "snake_candidates",
  "raven_candidates",
];
const nativeEvents = new Set<string>([
  ...MIST_RAVEN_EVENT_TYPES,
  "god_private_game_info",
  "phase_changed",
  "game_over",
  "dream_applied",
  "dream_death",
  "seer_checked",
  "day_speech",
  "last_words_granted",
  "last_words_spoken",
  "night_resolved",
  "wolf_tactical_order",
  "wolf_discussion",
  "wolf_discussion_ended",
  "wolf_kill_vote_cast",
  "wolf_self_destruct",
  "vote_cast",
  "vote_summary",
  "voted_out",
  "idiot_revealed",
  "exile_pk_started",
  "sheriff_candidate_declared",
  "sheriff_nomination_summary",
  "sheriff_withdraw_summary",
  "sheriff_candidates_finalized",
  "sheriff_vote_cast",
  "sheriff_vote_summary",
  "sheriff_pk_started",
  "sheriff_elected",
  "sheriff_direction_chosen",
  "sheriff_badge_transferred",
  "sheriff_badge_destroyed",
]);
/** 独立归档账本不查询生产 frame、目标选择器或伤害系统。 */
export function validateMistRavenRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard;
  const owns = board.roleSetups.some(
    (p) => (p.role === Role.Alchemist || p.role === Role.RavenClawWolf) && p.count > 0,
  );
  const artifacts =
    record.events.some((e) => (MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(e.type)) ||
    record.decisions.some(
      (d) =>
        ["alchemist_mist", "alchemist_snake", "raven_knife"].includes(d.stage) ||
        privateFields.some((k) => Object.hasOwn(d.request.context, k)) ||
        d.request.allowedTools.some((t) => ["cast_mist", "use_snake", "raven_knife"].includes(t)),
    ) ||
    record.checkpoints.some((c) =>
      c.players.some(
        (p) =>
          Object.hasOwn(p.privateState, "alchemist") || Object.hasOwn(p.privateState, "ravenClaw"),
      ),
    );
  if (!owns) {
    check(
      !board.mistRaven &&
        !artifacts &&
        !record.metadata.players.some(
          (p) => p.role === Role.Alchemist || p.role === Role.RavenClawWolf,
        ),
    );
    return;
  }
  check(isMistRavenPreset(board) && !record.metadata.faultPlan && !record.metadata.initialDeal);
  const roster = new Map(record.metadata.players.map((p) => [p.id, p]));
  check(
    equal(
      [...roster.keys()].sort((a, b) => a - b),
      Array.from({ length: 12 }, (_, i) => i + 1),
    ),
  );
  const counts: Array<[Role, number]> = [
    [Role.Wolf, 3],
    [Role.RavenClawWolf, 1],
    [Role.Villager, 4],
    [Role.Alchemist, 1],
    [Role.Seer, 1],
    [Role.Dreamer, 1],
    [Role.Idiot, 1],
  ];
  for (const [role, count] of counts)
    check([...roster.values()].filter((p) => p.role === role).length === count);
  for (const p of roster.values())
    check(p.camp === ([Role.Wolf, Role.RavenClawWolf].includes(p.role) ? Camp.Wolf : Camp.Good));
  const actor = (role: Role) => [...roster.values()].find((p) => p.role === role)!.id;
  const alchemist = actor(Role.Alchemist),
    raven = actor(Role.RavenClawWolf),
    dreamer = actor(Role.Dreamer),
    seer = actor(Role.Seer),
    idiot = actor(Role.Idiot);
  const isWolf = (id: number) => roster.get(id)?.camp === Camp.Wolf;
  const alive = new Set(roster.keys());
  const election = createMistSheriffEvidence(record);
  const votes = new Map([...roster.keys()].map((id) => [id, { weight: 1, canVote: true }]));
  const badges = new Map<number, RecordedCheckpoint["players"][number]["badge"]>(
    [...roster.keys()].map((id) => [id, { isSheriff: false, destroyed: false, voteWeight: 1.5 }]),
  );
  let result: RecordedCheckpoint["snapshot"]["result"] = null;
  const a: AlchemistLedger = {
    policy: "awa_mist_raven_v1",
    mistRemaining: 1,
    healRemaining: 1,
    mistHistory: [],
    healHistory: [],
  };
  const r: RavenLedger = {
    policy: "awa_mist_raven_v1",
    awakenedDay: null,
    knownTeammateIds: [],
    extraRemaining: 1,
    extraHistory: [],
  };
  const dreamHistory: Array<{ day: number; targetId: number }> = [];
  const seerHistory: Array<{
    targetId: number;
    isWerewolf: boolean;
    result: { kind: "camp"; camp: Camp };
  }> = [];
  let idiotRevealed = false,
    day = 1,
    phase: Phase = Phase.Night,
    sheriff: number | null = null,
    night: NightLedger | undefined;
  const nights = new Map<number, NightLedger>();
  let exileRound = 1,
    exileCandidates: number[] | null = null,
    exileBallots: Array<{
      actorId: number;
      targetId: number | null;
      abstain: boolean;
      weight: number;
    }> = [],
    exileExpected: number | null = null,
    exileTallied = false;
  const rows = (day: number, stage: string, who?: number) =>
    record.decisions.filter(
      (d) => d.day === day && d.stage === stage && (who === undefined || d.actorId === who),
    );
  const action = (day: number, stage: string, who: number) => {
    const list = rows(day, stage, who);
    check(list.length === 1);
    const d = list[0]!;
    check(d.outcome.kind === "action" && d.outcome.action && d.settleOrder !== undefined);
    return { d, call: d.outcome.action };
  };
  const exileBallot = (who: number) => {
    const stage = exileRound === 1 ? "voting" : "exile_pk_vote",
      list = rows(day, stage, who);
    check(
      list.length >= 1 &&
        list.length <= 4 &&
        alive.has(who) &&
        votes.get(who)!.canVote &&
        !exileCandidates?.includes(who),
    );
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      check(
        d.turn === i + 1 &&
          d.request.phase === Phase.Voting &&
          equal(d.request.allowedTools, ["vote"]) &&
          d.outcome.kind === "action" &&
          d.settleOrder !== undefined,
      );
      if (exileCandidates)
        check(
          equal(d.request.context.exile_candidates, exileCandidates) &&
            d.request.context.round === 2 &&
            d.request.context.max_rounds === 2,
        );
      if (i > 0)
        check(
          d.request.context.retry_attempt === i &&
            d.request.context.retry_max === 3 &&
            list[i - 1]!.settleOrder! <= d.openedAfterSettlement,
        );
      const call = d.outcome.action;
      if (call?.name !== "vote") continue;
      const { target_id: target, abstain } = call.args;
      const legal =
        typeof abstain === "boolean" &&
        (target === null ||
          (typeof target === "number" && Number.isSafeInteger(target) && target > 0)) &&
        (abstain ||
          (typeof target === "number" &&
            alive.has(target) &&
            (!exileCandidates || exileCandidates.includes(target)) &&
            !(target === idiot && idiotRevealed)));
      if (!legal) continue;
      check(i === list.length - 1);
      return {
        actorId: who,
        targetId: target,
        abstain,
        weight: abstain ? 0 : votes.get(who)!.weight,
        ...(i > 0 ? { fallback: true } : {}),
      };
    }
    check(list.length === 4);
    return { actorId: who, targetId: null, abstain: true, weight: 0, fallback: true };
  };
  const badgeChoice = (from: number, reason: unknown) => {
    if (reason === "idiot_revealed") {
      check(
        from === idiot &&
          phase === Phase.Voting &&
          exileExpected === idiot &&
          !idiotRevealed &&
          alive.has(idiot),
      );
      return null;
    }
    check(
      !alive.has(from) && ["self_destruct", "voted_out", "night_death"].includes(reason as string),
    );
    const candidates = [...alive].filter(
      (id) => id !== from && votes.get(id)!.canVote && badges.get(id)!.destroyed === false,
    );
    const list = rows(day, "sheriff_badge_choice", from);
    if (!candidates.length) {
      check(list.length === 0);
      return null;
    }
    check(list.length === 1);
    const d = list[0]!;
    check(d.outcome.kind === "action" && d.settleOrder !== undefined);
    check(
      d.request.phase === phase &&
        equal(d.request.allowedTools, ["choose_badge_successor"]) &&
        equal(d.request.context.badge_candidates, candidates) &&
        d.request.context.allow_fallback === false &&
        d.request.context.trigger === "badge_handoff",
    );
    const call = d.outcome.action;
    return call?.name === "choose_badge_successor" &&
      call.args.target_id !== null &&
      candidates.includes(call.args.target_id)
      ? call.args.target_id
      : null;
  };
  const pack = (n: NightLedger) =>
    n.start.filter((id) => roster.get(id)!.role === Role.Wolf || (id === raven && n.awake));
  const startNight = (number: number): NightLedger => {
    check(!nights.has(number));
    const start = [...alive],
      wolves = start.filter(isWolf),
      unseal = r.awakenedDay === null && start.includes(raven) && wolves.length < 3;
    const n: NightLedger = {
      day: number,
      start,
      mistStock: a.mistRemaining,
      snakeStock: a.healRemaining,
      extraStock: r.extraRemaining,
      awake: r.awakenedDay !== null || unseal,
      unsealExpected: unseal,
      known: unseal
        ? wolves.filter((id) => id !== raven).sort((a, b) => a - b)
        : [...r.knownTeammateIds],
      unsealSeen: false,
      delay: start.includes(alchemist) && a.healRemaining === 1,
      mistSeen: false,
      ravenSeen: false,
      circle: null,
      dream: null,
      consecutive: false,
      dreamSeen: false,
      seerSeen: false,
      order: null,
      votes: new Map(),
      drawSeen: false,
      knife: null,
      extra: null,
      snakeSeen: false,
      healed: null,
      settled: false,
      blast: false,
      damage: null,
      reasons: [],
      reasonsSeen: 0,
      direction: "clockwise",
      publishedDay: false,
    };
    nights.set(number, n);
    return n;
  };
  const requireNight = () => {
    check(night);
    return night;
  };
  const resolveKnife = (n: NightLedger) => {
    const holders = pack(n);
    check(n.votes.size === holders.length && holders.every((id) => n.votes.has(id)));
    const tally = new Map<number, number>();
    for (const target of n.votes.values())
      if (target !== null) tally.set(target, (tally.get(target) ?? 0) + 1);
    if (!tally.size) {
      check(n.circle === null || n.drawSeen);
      return n.knife;
    }
    check(!n.drawSeen);
    const max = Math.max(...tally.values());
    const target = Math.min(...[...tally].filter(([, v]) => v === max).map(([id]) => id));
    check(n.knife === null || n.knife === target);
    n.knife = target;
    return target;
  };
  const finalDamage = (n: NightLedger) => {
    const causes = new Map<number, string[]>();
    const add = (id: number, cause: string) => {
      if (!alive.has(id)) return;
      const list = causes.get(id) ?? [];
      if (!list.includes(cause)) list.push(cause);
      causes.set(id, list);
    };
    if (n.knife !== null && n.knife !== n.dream) add(n.knife, "wolf_kill");
    if (n.dream !== null && n.consecutive) add(n.dream, "dream");
    // 普通伤害先按原席位顺序独立枚举，再追加额外狼刀；
    // 梦境牵连伤害须等法老之蛇结算后才能确认。
    const ordered = new Map([...causes].sort(([a], [b]) => a - b));
    causes.clear();
    for (const [id, list] of ordered) causes.set(id, list);
    if (n.extra !== null) add(n.extra, "raven_claw_knife");
    // 固定直接伤害顺序后，仅移除已付款的普通狼刀来源；同一原体的
    // 鸦爪刀来源仍保留其在梦境死亡列表中的原位置。
    if (n.healed !== null) {
      const retained = (causes.get(n.healed) ?? []).filter((cause) => cause !== "wolf_kill");
      if (retained.length) causes.set(n.healed, retained);
      else causes.delete(n.healed);
    }
    const reasons: NightLedger["reasons"] = [];
    if (n.dream !== null && n.consecutive && causes.has(n.dream))
      reasons.push({ actorId: dreamer, targetId: n.dream, day: n.day, reason: "consecutive" });
    if (n.dream !== null && alive.has(n.dream) && causes.has(dreamer)) {
      add(n.dream, "dream");
      reasons.push({ actorId: dreamer, targetId: n.dream, day: n.day, reason: "linked" });
    }
    n.reasons = reasons;
    return { deaths: [...causes.keys()], death_sources: Object.fromEntries(causes) };
  };
  const checkpoints = new Map<number, RecordedCheckpoint[]>();
  for (const cp of record.checkpoints) {
    const list = checkpoints.get(cp.eventCount) ?? [];
    list.push(cp);
    checkpoints.set(cp.eventCount, list);
  }
  const native = (
    kind: "dream" | "seer_check",
    state: Record<string, unknown>,
    uses: number,
    last: number | null,
  ) => ({
    id: `native:${kind}`,
    kind,
    state,
    source: { kind: "native", role: kind === "dream" ? Role.Dreamer : Role.Seer },
    sourceDisclosed: true,
    startsOnDay: 1,
    maxUses: null,
    uses,
    lastUsedDay: last,
    disabled: false,
  });
  const checkpoint = (cp: RecordedCheckpoint) => {
    check(
      !["ghostBrideSetup", "lonelyGirlSetup", "thiefSetup", "shapeshifterSetup"].some((key) =>
        Object.hasOwn(cp, key),
      ),
    );
    check(cp.players.length === 12 && new Set(cp.players.map((p) => p.id)).size === 12);
    const pending = nights.get(cp.cycle);
    if (
      phase === Phase.Night &&
      pending &&
      !pending.settled &&
      pending.day === day &&
      (pending.ravenSeen || rows(day, "raven_knife").length > 0 || rows(day, "seer").length > 0)
    )
      resolveKnife(pending);
    for (const p of cp.players) {
      check(!["wallNote", "debatePenalty", "lovers"].some((key) => Object.hasOwn(p, key)));
      const original = roster.get(p.id);
      check(
        original &&
          p.role === original.role &&
          p.camp === original.camp &&
          p.name === original.name &&
          p.seat === p.id &&
          p.alive === alive.has(p.id),
      );
      let state: Record<string, unknown> = {};
      if (p.id === alchemist) state = { alchemist: a };
      else if (p.id === raven) state = { ravenClaw: r };
      else if (p.id === idiot) state = { idiot: { revealed: idiotRevealed } };
      else if (p.id === dreamer) {
        const last = dreamHistory.at(-1);
        state = {
          abilities: {
            "native:dream": native(
              "dream",
              {
                lastTarget: last?.targetId ?? null,
                lastDay: last?.day ?? null,
                history: dreamHistory,
                protectionPolicy: "netease_2026_night_immunity_v1",
              },
              dreamHistory.length,
              last?.day ?? null,
            ),
          },
        };
      } else if (p.id === seer) {
        const last = seerHistory.at(-1);
        state = {
          abilities: {
            "native:seer_check": native(
              "seer_check",
              {
                lastTarget: last?.targetId ?? null,
                lastIsWerewolf: last?.isWerewolf ?? null,
                lastResult: last?.result ?? null,
                history: seerHistory,
              },
              seerHistory.length,
              [...nights.values()].filter((n) => n.seerSeen).at(-1)?.day ?? null,
            ),
          },
        };
      }
      check(equal(p.privateState, state));
      check(
        equal(p.vote, votes.get(p.id)) &&
          equal(p.badge, badges.get(p.id)) &&
          equal(p.victory, { affiliations: [{ kind: "faction", faction: original.camp }] }),
      );
      const n = nights.get(cp.cycle),
        knifeMarked =
          phase === Phase.Night &&
          n !== undefined &&
          !n.settled &&
          n.day === day &&
          n.knife === p.id &&
          (n.ravenSeen || rows(n.day, "raven_knife").length > 0 || rows(n.day, "seer").length > 0);
      check(equal(p.marks, knifeMarked ? ["WolfKillMark"] : []));
    }
    if (cp.cycle === 0)
      check(
        cp.complete &&
          cp.snapshot.day === 1 &&
          cp.snapshot.phase === Phase.Night &&
          !cp.snapshot.gameOver,
      );
    if (cp.complete && cp.cycle > 0) {
      const n = nights.get(cp.cycle);
      check(n?.settled && n.reasonsSeen === n.reasons.length);
      check(
        cp.snapshot.day === (result ? day : cp.cycle + 1) &&
          cp.snapshot.phase === (result ? Phase.GameOver : n.blast ? Phase.Night : Phase.Voting),
      );
    } else if (cp.cycle > 0) {
      check(cp.snapshot.day === day && cp.snapshot.phase === phase);
    }
    check(cp.snapshot.gameOver === (result !== null) && equal(cp.snapshot.result, result));
  };
  for (const cp of checkpoints.get(0) ?? []) checkpoint(cp);
  for (let index = 0; index < record.events.length; index++) {
    const e = record.events[index]!,
      p = e.payload;
    check(nativeEvents.has(e.type));
    election.accept(e, { day, phase, alive, idiot, idiotRevealed });
    if (e.type === "phase_changed") {
      check(
        typeof p.day === "number" && Number.isSafeInteger(p.day) && typeof p.phase === "string",
      );
      day = p.day;
      phase = p.phase as Phase;
      if (phase === Phase.Night) night = startNight(day);
      if (phase === Phase.Day) {
        const n = requireNight();
        n.publishedDay = true;
        check(n.day === day && n.mistSeen && n.ravenSeen && n.unsealSeen === n.unsealExpected);
        check(!n.start.includes(dreamer) || n.dreamSeen);
        check(!n.start.includes(seer) || n.seerSeen);
        resolveKnife(n);
      }
      if (phase === Phase.Voting) {
        check(
          requireNight().settled && requireNight().reasonsSeen === requireNight().reasons.length,
        );
        exileRound = 1;
        exileCandidates = null;
        exileBallots = [];
        exileExpected = null;
        exileTallied = false;
      }
      if (phase === Phase.GameOver)
        check(
          requireNight().settled && requireNight().reasonsSeen === requireNight().reasons.length,
        );
    }
    if ((MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(e.type)) {
      const f = readMistRavenFact(e.type, p),
        n = requireNight();
      check(f && f.day === day && day === n.day);
      if ("actorId" in f) check(equal(e.audience, [f.actorId]));
      if (e.type === "raven_unsealed") {
        check(
          phase === Phase.Night &&
            n.unsealExpected &&
            !n.unsealSeen &&
            "knownTeammateIds" in f &&
            f.actorId === raven &&
            equal(f.knownTeammateIds, n.known),
        );
        n.unsealSeen = true;
        r.awakenedDay = day;
        r.knownTeammateIds = [...n.known];
      } else if (e.type === "alchemist_mist_chosen") {
        check(
          phase === Phase.Night &&
            !n.mistSeen &&
            "targetIds" in f &&
            f.actorId === alchemist &&
            n.start.includes(alchemist) &&
            n.mistStock === 1 &&
            n.start.length >= 3,
        );
        const { call } = action(day, "alchemist_mist", alchemist);
        check(call.name === "cast_mist" && equal(call.args, { target_ids: f.targetIds }));
        if (f.targetIds !== null) check(f.targetIds.every((id) => n.start.includes(id)));
        n.circle = f.targetIds === null ? null : [...f.targetIds];
        n.mistSeen = true;
        a.mistHistory.push({ day, targetIds: n.circle === null ? null : [...n.circle] });
        if (n.circle !== null) a.mistRemaining = 0;
      } else if (e.type === "alchemist_mist_skipped") {
        check(phase === Phase.Night && !n.mistSeen && "reason" in f && f.actorId === alchemist);
        const reason = !n.start.includes(alchemist)
          ? "dead"
          : n.mistStock === 0
            ? "spent"
            : "no_targets";
        check(
          f.reason === reason &&
            (reason !== "no_targets" || n.start.length < 3) &&
            rows(day, "alchemist_mist").length === 0,
        );
        n.mistSeen = true;
      } else if (e.type === "raven_knife_chosen") {
        check(
          phase === Phase.Night &&
            !n.ravenSeen &&
            "targetId" in f &&
            "actorId" in f &&
            f.actorId === raven &&
            n.start.includes(raven) &&
            n.awake &&
            n.extraStock === 1,
        );
        resolveKnife(n);
        const { call } = action(day, "raven_knife", raven);
        check(
          call.name === "raven_knife" &&
            equal(call.args, { target_id: f.targetId }) &&
            (f.targetId === null || (n.start.includes(f.targetId) && f.targetId !== raven)),
        );
        n.extra = f.targetId;
        n.ravenSeen = true;
        r.extraHistory.push({ day, targetId: f.targetId });
        if (f.targetId !== null) r.extraRemaining = 0;
      } else if (e.type === "raven_knife_skipped") {
        check(phase === Phase.Night && !n.ravenSeen && "reason" in f && f.actorId === raven);
        resolveKnife(n);
        const reason = !n.start.includes(raven)
          ? "dead"
          : !n.awake
            ? "sealed"
            : n.extraStock === 0
              ? "spent"
              : "no_targets";
        check(
          f.reason === reason &&
            (reason !== "no_targets" || n.start.length <= 1) &&
            rows(day, "raven_knife").length === 0,
        );
        n.ravenSeen = true;
      } else if (e.type === "mist_knife_drawn") {
        check(
          phase === Phase.Night &&
            !n.drawSeen &&
            "candidates" in f &&
            n.circle !== null &&
            equal(f.candidates, n.circle),
        );
        const holders = pack(n);
        check(
          holders.length > 0 &&
            n.votes.size === holders.length &&
            holders.every((id) => n.votes.get(id) === null),
        );
        const draw = mistDraw(record.metadata.random.seed, [
          ...record.metadata.random.path,
          "night",
          `day:${day}:mist-knife`,
        ]);
        check(
          f.targetId === f.candidates[Math.floor(draw * f.candidates.length)] &&
            equal(
              e.audience,
              [...holders].sort((a, b) => a - b),
            ),
        );
        n.drawSeen = true;
        n.knife = f.targetId;
      } else if (e.type === "alchemist_snake_chosen") {
        check(
          phase === Phase.Day &&
            n.delay &&
            !n.settled &&
            !n.snakeSeen &&
            "targetId" in f &&
            "actorId" in f &&
            f.actorId === alchemist,
        );
        const { d, call } = action(day, "alchemist_snake", alchemist),
          legal =
            n.knife !== null && alive.has(n.knife) && (day === 1 || n.knife !== alchemist)
              ? [n.knife]
              : [];
        check(
          call.name === "use_snake" &&
            equal(call.args, { target_id: f.targetId }) &&
            (f.targetId === null || legal.includes(f.targetId)) &&
            d.request.context.snake_target === n.knife &&
            equal(d.request.context.snake_candidates, legal),
        );
        if (!n.blast) {
          const speakers = rows(day, "day_speech");
          const seats = [...alive].sort((a, b) => a - b),
            holder = sheriff === null ? -1 : seats.indexOf(sheriff);
          const order =
            holder < 0
              ? seats
              : Array.from(
                  { length: seats.length },
                  (_, offset) =>
                    seats[
                      (holder +
                        (n.direction === "clockwise" ? 1 : -1) * (offset + 1) +
                        seats.length) %
                        seats.length
                    ]!,
                );
          check(
            equal(
              speakers.map((d) => d.actorId),
              order,
            ) &&
              speakers.every(
                (s) => s.settleOrder !== undefined && s.settleOrder <= d.openedAfterSettlement,
              ),
          );
        }
        n.healed = f.targetId;
        n.snakeSeen = true;
        a.healHistory.push({ day, targetId: f.targetId });
        if (f.targetId !== null) a.healRemaining = 0;
      }
    }
    if (e.type === "dream_applied") {
      const n = requireNight();
      check(exact(p, ["actorId", "targetId", "day", "consecutive"]));
      check(
        phase === Phase.Night &&
          n.mistSeen &&
          !n.dreamSeen &&
          p.actorId === dreamer &&
          p.day === day &&
          n.start.includes(dreamer) &&
          typeof p.targetId === "number" &&
          p.targetId !== dreamer &&
          n.start.includes(p.targetId),
      );
      const { call } = action(day, "dreamer", dreamer);
      check(call.name === "dream" && equal(call.args, { target_id: p.targetId }));
      const last = dreamHistory.at(-1);
      n.dream = p.targetId;
      n.consecutive = last?.day === day - 1 && last.targetId === p.targetId;
      check(p.consecutive === n.consecutive);
      dreamHistory.push({ day, targetId: p.targetId });
      n.dreamSeen = true;
    }
    if (e.type === "seer_checked") {
      const n = requireNight();
      check(exact(p, ["actorId", "targetId", "isWerewolf", "result"]));
      check(
        phase === Phase.Night &&
          n.ravenSeen &&
          !n.seerSeen &&
          p.actorId === seer &&
          n.start.includes(seer) &&
          typeof p.targetId === "number" &&
          p.targetId !== seer &&
          n.start.includes(p.targetId),
      );
      const { call } = action(day, "seer", seer);
      check(
        call.name === "check_identity" &&
          equal(call.args, { target_id: p.targetId }) &&
          p.isWerewolf === isWolf(p.targetId) &&
          equal(p.result, { kind: "camp", camp: isWolf(p.targetId) ? Camp.Wolf : Camp.Good }),
      );
      seerHistory.push({
        targetId: p.targetId,
        isWerewolf: isWolf(p.targetId),
        result: { kind: "camp", camp: isWolf(p.targetId) ? Camp.Wolf : Camp.Good },
      });
      n.seerSeen = true;
    }
    if (e.type === "wolf_tactical_order") {
      const n = requireNight();
      check(
        phase === Phase.Night &&
          n.mistSeen &&
          (!n.start.includes(dreamer) || n.dreamSeen) &&
          n.order === null &&
          ids(p.order) &&
          equal(
            [...p.order].sort((a, b) => a - b),
            pack(n).sort((a, b) => a - b),
          ) &&
          equal(
            e.audience,
            pack(n).sort((a, b) => a - b),
          ),
      );
      n.order = [...p.order];
    }
    if (e.type === "wolf_kill_vote_cast") {
      const n = requireNight();
      check(
        phase === Phase.Night &&
          n.order !== null &&
          typeof p.actorId === "number" &&
          p.actorId === n.order[n.votes.size] &&
          !n.votes.has(p.actorId) &&
          pack(n).includes(p.actorId),
      );
      const { call } = action(day, "wolf_vote", p.actorId);
      check(
        call.name === "kill_vote" &&
          equal(call.args, { target_id: p.targetId, abstain: p.abstain }) &&
          typeof p.abstain === "boolean" &&
          (p.abstain
            ? p.targetId === null
            : typeof p.targetId === "number" && (n.circle ?? n.start).includes(p.targetId)) &&
          !Object.hasOwn(p, "fallback") &&
          equal(
            e.audience,
            pack(n).sort((a, b) => a - b),
          ),
      );
      n.votes.set(p.actorId, p.abstain ? null : (p.targetId as number));
    }
    if (e.type === "wolf_self_destruct") {
      const n = requireNight();
      const selected = selectedMistBlast(
        record.decisions.filter(
          (d) =>
            d.day === n.day &&
            d.stage === p.window &&
            alive.has(d.actorId) &&
            roster.get(d.actorId)?.role === Role.Wolf,
        ),
        undefined,
        [...alive].filter((id) => roster.get(id)?.role === Role.Wolf),
      );
      check(
        ((phase === Phase.Day &&
          ["on_pre_election", "on_daybreak", "on_per_speech_gap"].includes(p.window as string)) ||
          (phase === Phase.Voting && p.window === "on_pre_vote" && n.settled)) &&
          !n.blast &&
          typeof p.wolfId === "number" &&
          roster.get(p.wolfId)?.role === Role.Wolf &&
          selected?.actorId === p.wolfId &&
          alive.has(p.wolfId),
      );
      n.blast = true;
      alive.delete(p.wolfId);
    }
    if (e.type === "night_resolved") {
      const n = requireNight();
      check(phase === Phase.Day && !n.settled && (!n.delay || n.snakeSeen));
      resolveKnife(n);
      n.damage = finalDamage(n);
      check(equal(p.deaths, n.damage.deaths));
      n.settled = true;
      for (const id of n.damage.deaths) alive.delete(id);
    }
    if (e.type === "dream_death") {
      const n = requireNight();
      check(n.settled && equal(p, n.reasons[n.reasonsSeen]));
      n.reasonsSeen++;
    }
    if (e.type === "voted_out") {
      check(
        phase === Phase.Voting &&
          exileTallied &&
          p.target === exileExpected &&
          typeof p.target === "number" &&
          alive.has(p.target),
      );
      alive.delete(p.target);
    }
    if (e.type === "vote_cast") {
      check(
        phase === Phase.Voting &&
          typeof p.actorId === "number" &&
          p.actorId ===
            [...alive].filter((id) => votes.get(id)!.canVote && !exileCandidates?.includes(id))[
              exileBallots.length
            ],
      );
      const expected = exileBallot(p.actorId);
      check(equal(p, expected));
      const { fallback: _fallback, ...publicVote } = expected;
      exileBallots.push(publicVote);
    }
    if (e.type === "vote_summary") {
      check(
        phase === Phase.Voting &&
          (p.round ?? 1) === exileRound &&
          equal(p.votes, exileBallots) &&
          exileBallots.length ===
            [...alive].filter((id) => votes.get(id)!.canVote && !exileCandidates?.includes(id))
              .length,
      );
      const tally: Record<number, number> = {};
      for (const v of exileBallots)
        if (!v.abstain && v.targetId !== null)
          tally[v.targetId] = (tally[v.targetId] ?? 0) + v.weight;
      const max = Math.max(0, ...Object.values(tally)),
        top = Object.entries(tally)
          .filter(([, v]) => v === max && max > 0)
          .map(([id]) => Number(id))
          .sort((a, b) => a - b);
      check(equal(p.tally, tally));
      exileExpected = top.length === 1 ? top[0]! : null;
      check(p.target === exileExpected);
      exileTallied = true;
      if (exileRound === 1 && top.length > 1) exileCandidates = top;
    }
    if (e.type === "exile_pk_started") {
      check(
        phase === Phase.Voting &&
          exileRound === 1 &&
          exileTallied &&
          exileCandidates !== null &&
          equal(p.candidates, exileCandidates),
      );
      exileRound = 2;
      exileBallots = [];
      exileTallied = false;
      exileExpected = null;
    }
    if (e.type === "idiot_revealed") {
      check(
        phase === Phase.Voting &&
          exileTallied &&
          exileExpected === idiot &&
          p.targetId === idiot &&
          !idiotRevealed &&
          alive.has(idiot),
      );
      idiotRevealed = true;
      votes.set(idiot, { weight: 0, canVote: false });
    }
    if (e.type === "sheriff_elected") {
      check(
        sheriff === null &&
          p.winnerId === election.winner &&
          typeof p.winnerId === "number" &&
          alive.has(p.winnerId),
      );
      sheriff = p.winnerId;
      for (const id of alive) {
        badges.set(id, {
          isSheriff: id === sheriff,
          destroyed: false,
          voteWeight: 1.5,
          handoffPolicy: "awa_holder_choice_v1",
        });
        const vote = votes.get(id)!;
        if (vote.canVote) vote.weight = id === sheriff ? 1.5 : 1;
      }
    }
    if (e.type === "sheriff_direction_chosen") {
      const n = requireNight();
      check(
        phase === Phase.Day &&
          p.sheriffId === sheriff &&
          sheriff !== null &&
          alive.has(sheriff) &&
          ["clockwise", "counter_clockwise"].includes(p.direction as string),
      );
      const list = rows(day, "sheriff_choose_direction", sheriff);
      check(list.length === 1 && list[0]!.outcome.kind === "action");
      const outcome = list[0]!.outcome;
      const chosen =
        outcome.kind === "action" &&
        outcome.action?.name === "choose_direction" &&
        ["clockwise", "counter_clockwise"].includes(outcome.action.args.direction)
          ? outcome.action.args.direction
          : "clockwise";
      check(p.direction === chosen);
      n.direction = chosen;
    }
    if (e.type === "sheriff_badge_transferred") {
      check(
        p.fromId === sheriff &&
          typeof p.toId === "number" &&
          alive.has(p.toId) &&
          badgeChoice(sheriff!, p.reason) === p.toId,
      );
      const from = sheriff!;
      const source = badges.get(from)!;
      source.isSheriff = false;
      source.destroyed = true;
      votes.get(from)!.weight = votes.get(from)!.canVote ? 1 : 0;
      badges.set(p.toId, {
        isSheriff: true,
        destroyed: false,
        voteWeight: 1.5,
        ...(source.handoffPolicy ? { handoffPolicy: source.handoffPolicy } : {}),
      });
      votes.get(p.toId)!.weight = 1.5;
      sheriff = p.toId;
    }
    if (e.type === "sheriff_badge_destroyed") {
      check(p.targetId === sheriff && badgeChoice(sheriff!, p.reason) === null);
      const from = sheriff!;
      badges.get(from)!.isSheriff = false;
      badges.get(from)!.destroyed = true;
      votes.get(from)!.weight = votes.get(from)!.canVote ? 1 : 0;
      sheriff = null;
    }
    if (e.type === "game_over") {
      check(requireNight().settled && phase === Phase.GameOver && result === null);
      const expected = [...alive].every((id) => !isWolf(id))
        ? Camp.Good
        : ![...alive].some((id) => roster.get(id)!.role === Role.Villager) ||
            ![...alive].some((id) =>
              [Role.Alchemist, Role.Seer, Role.Dreamer, Role.Idiot].includes(roster.get(id)!.role),
            )
          ? Camp.Wolf
          : null;
      check(
        p.reason === "max_days_reached"
          ? p.winner === null && day >= record.metadata.maxDays
          : p.winner === expected && expected !== null,
      );
      if (expected !== null && p.reason !== "max_days_reached") {
        const winners = [...roster.values()]
          .filter((p) => p.camp === expected)
          .map((p) => p.id)
          .sort((a, b) => a - b);
        check(
          p.reason ===
            (expected === Camp.Good ? "all_wolves_eliminated" : "slaughter_side_completed") &&
            equal(p.outcome, {
              kind: "victory",
              primary: { kind: "faction", faction: expected, winningPlayerIds: winners },
              additional: [],
              winningPlayerIds: winners,
            }),
        );
      }
      result = p as unknown as NonNullable<typeof result>;
    }
    for (const cp of checkpoints.get(index + 1) ?? []) checkpoint(cp);
  }
  for (const cp of record.checkpoints) check(cp.eventCount <= record.events.length);
  validateMistRavenRequests({
    record,
    nights,
    alive,
    alchemistState: a,
    ravenState: r,
    actors: { alchemist, raven, dreamer, seer },
  });
  // 请求／玩家可见前缀与状态账本分别验收；完整伤害操作最后再对原 settled 夜比，
  // 不把 operation.output 直接当作独立预期或重跑生产伤害折叠。
  validateMistRavenFeeds(record, nights);
  const resolved = [...nights.values()].filter((n) => n.settled),
    ops = record.operations.filter(
      (o) => o.scope === "resolution" && o.op === "night_damage_resolved",
    );
  if (record.finalized || ops.length) {
    check(ops.length === resolved.length);
    for (let i = 0; i < ops.length; i++)
      check(equal(ops[i]!.output, resolved[i]!.damage) && ops[i]!.phase === Phase.Night);
  }
}
