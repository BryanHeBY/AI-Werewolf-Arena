/**
 * 负责独立审核贵族契约与秘身挡伤证据，并返回贵族审计结果。输入为归档配置、决定、事实与 checkpoint；
 * 输出为独立重建的审计结果或原拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import { createMistSheriffEvidence } from "../mist-raven/sheriff-evidence";
import { isNobleSecretBodyPreset } from "../../board-support";
import {
  NOBLE_SECRET_BODY_EVENT_TYPES,
  readNobleSecretBodyFact,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import { Role, Camp, Phase } from "@ai-werewolf-arena/game-contract";
import type { RecordedCheckpoint, RecordedDecision, ReproductionRecord } from "../../../recording/reproduction";
import type { RecordedNobleBodyState } from "../../../recording/noble_secret_body_checkpoint";
import { sanitizeSpeechText } from "../../../utils/speech_text";
export function nobleRecordCheck(v: unknown): asserts v {
  if (!v) throw Error("reproduction_noble_secret_body_invalid");
}
export function nobleRecordEqual(a: unknown, b: unknown): boolean {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, x]) => x !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
}
const check: (v: unknown) => asserts v = nobleRecordCheck,
  equal = nobleRecordEqual,
  policy = "awa_noble_secret_body_v1";
type Sources = Record<string, string[]>;
export interface NobleNightAudit {
  day: number;
  start: number[];
  requiresBody: boolean;
  requiresNoble: boolean;
  knife: number | null;
  heal: number | null;
  poison: number | null;
  hunt: { day: number; targetId: number | null } | null;
  huntDamage: { targetId: number; cause: string } | null;
  clear: Record<string, unknown> | null;
  beforeBody: Sources;
  blocked: { targetId: number; cause: string } | null;
  final: Sources;
}
/** 交给猎魔人核验的独立审计数据；at 按原 checkpoint identity 取历史副本，nights 保原 Map 写性。 */
export interface NobleRecordAudit {
  at: (cp: RecordedCheckpoint) => RecordedNobleBodyState;
  nights: Map<number, NobleNightAudit>;
}
/** 对归档独立推导；不用运行时 owner、状态迁移、伤害折叠器、
 * World 权限选择器或生产可见性实现生成校验预期。 */
export function validateNobleSecretBodyRecord(record: ReproductionRecord): NobleRecordAudit | null {
  const board = record.metadata.normalizedBoard,
    owns = !!board.nobleSecretBody;
  if (!owns) {
    check(
      !board.nightNoble &&
        !board.awakenedIdiot &&
        !board.roleSetups.some((r) => [Role.NightNoble, Role.AwakenedIdiot].includes(r.role)) &&
        !record.operations.some(
          (o) =>
            o.op.startsWith("noble_") ||
            o.op.startsWith("secret_body_") ||
            (!board.fragrantPairSeer && !board.animalDream && o.event_count !== undefined),
        ) &&
        !record.decisions.some(
          (d) =>
            (!board.fragrantPairSeer && !board.animalDream && d.openedAtEventCount !== undefined) ||
            ["secret_body", "night_noble", "awakened_idiot_reveal_speech"].includes(d.stage) ||
            d.request.allowedTools.some((t) =>
              ["choose_servant", "protect_secret_body"].includes(t),
            ),
        ) &&
        !record.checkpoints.some((cp) =>
          cp.players.some(
            (p) =>
              Object.hasOwn(p.privateState, "noble") || Object.hasOwn(p.privateState, "secretBody"),
          ),
        ),
    );
    check(
      !record.checkpoints.some(
        (cp) =>
          cp.nobleBody ||
          (!board.fragrantPairSeer &&
            !board.animalDream &&
            (cp.operationCount !== undefined ||
              cp.settlementCount !== undefined ||
              cp.decisionCount !== undefined)),
      ) &&
        !record.events.some((e) =>
          (NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(e.type),
        ),
    );
    return null;
  }
  check(isNobleSecretBodyPreset(board) && !record.metadata.initialDeal);
  const roster = new Map(record.metadata.players.map((p) => [p.id, p])),
    roleId = (r: Role) => {
      const found = [...roster.values()].find((p) => p.role === r);
      check(found);
      return found.id;
    },
    nobleId = roleId(Role.NightNoble),
    bodyId = roleId(Role.AwakenedIdiot),
    witchId = roleId(Role.Witch),
    demonId = roleId(Role.DemonHunter),
    seerId = roleId(Role.Seer);
  check(
    record.metadata.players.length === 12 &&
      roster.size === 12 &&
      equal(
        [...roster.keys()],
        Array.from({ length: 12 }, (_, i) => i + 1),
      ) &&
      board.roleSetups.every(
        (row) => [...roster.values()].filter((p) => p.role === row.role).length === row.count,
      ),
  );
  for (const p of roster.values())
    check(p.camp === ([Role.Wolf, Role.NightNoble].includes(p.role) ? Camp.Wolf : Camp.Good));
  const state: RecordedNobleBodyState = {
    nobleId,
    bodyId,
    noble: {
      policy,
      wolfActionPolicy: board.nightNoble!.wolfActionPolicy,
      lastChoice: null,
      contracts: [],
    },
    body: {
      policy,
      protectionRepeatPolicy: board.awakenedIdiot!.protectionRepeatPolicy,
      lastChoice: null,
      body: { kind: "intact" },
    },
    knowledge: {
      noble: {
        wolfActionPolicy: board.nightNoble!.wolfActionPolicy,
        lastNotifiedNight: 0,
        lastChoice: null,
        contracts: [],
      },
      body: {
        protectionRepeatPolicy: board.awakenedIdiot!.protectionRepeatPolicy,
        lastNotifiedNight: 0,
        lastChoice: null,
        resource: "intact",
        publicRevealDay: null,
      },
    },
    notices: [],
    nights: [],
  };
  const alive = new Set(roster.keys()),
    marks = new Map([...roster.keys()].map((id) => [id, [] as string[]])),
    announcedDead = new Set<number>(),
    nights = new Map<number, NobleNightAudit>(),
    snapshots = new Map<RecordedCheckpoint, RecordedNobleBodyState>(),
    votes = new Map([...roster.keys()].map((id) => [id, { weight: 1, canVote: true }])),
    badges = new Map(
      [...roster.keys()].map(
        (id) => [id, { isSheriff: false, destroyed: false, voteWeight: 1.5 }] as const,
      ),
    );
  const election = createMistSheriffEvidence(record);
  let exileExpected: number | null = null,
    votedOut: number | null = null,
    exileCandidates: number[] | null = null,
    exileRound = 1,
    pendingBlast: number | null = null;
  let day = 1,
    phase: Phase = Phase.Night,
    sheriff: number | null = null,
    healStock = 1,
    poisonStock = 1;
  const rows = (d: number, stage: string, actor?: number) =>
    record.decisions.filter(
      (q) => q.day === d && q.stage === stage && (actor === undefined || q.actorId === actor),
    );
  const action = (d: number, stage: string, actor: number) => {
    const ds = rows(d, stage, actor);
    check(ds.length === 1 && ds[0]!.outcome.kind === "action");
    return ds[0]!.outcome.action;
  };
  const pending = () => state.noble.contracts.find((c) => c.status.kind === "pending");
  const night = () => state.nights.find((n) => n.day === day)!;
  const begin = () => {
    if (nights.has(day)) return;
    check(
      ![...state.nights].some((n) => n.day >= day) &&
        !state.noble.contracts.some((c) => c.status.kind === "pending" && c.expiresNight < day),
    );
    nights.set(day, {
      day,
      start: [...alive].sort((a, b) => a - b),
      requiresBody: alive.has(bodyId) && state.body.body.kind === "intact",
      requiresNoble: day >= 2 && alive.has(nobleId) && !pending(),
      knife: null,
      heal: null,
      poison: null,
      hunt: null,
      huntDamage: null,
      clear: null,
      beforeBody: {},
      blocked: null,
      final: {},
    });
    state.nights.push({
      day,
      status: "open",
      bodyChosen: false,
      nobleChosen: false,
      expiryProcessed: false,
      bodyResolved: false,
      revealOpened: false,
      revealCompleted: false,
    });
  };
  const makeClosed = (
    c: RecordedNobleBodyState["noble"]["contracts"][number],
    status: "cleared" | "expired" | "target_dead",
  ) => ({
    policy,
    actorId: nobleId,
    day,
    contractId: c.id,
    targetId: c.targetId,
    createdNight: c.createdNight,
    expiresNight: c.expiresNight,
    status,
    ...(status === "expired" ? { proposedCause: "servant_expiry" } : {}),
  });
  const derive = (n: NobleNightAudit) => {
    const add = (id: number, cause: string) => {
      check(alive.has(id));
      const list = (n.beforeBody[id] ??= []);
      check(!list.includes(cause));
      list.push(cause);
    };
    n.knife = deriveKnife(n);
    if (n.start.includes(witchId)) {
      const a = action(day, "witch", witchId);
      check(a?.name === "use_potion");
      if (a.args.potion_type === "heal") {
        check(healStock === 1 && a.args.target_id === n.knife && a.args.target_id !== witchId);
        healStock = 0;
        n.heal = a.args.target_id;
      } else if (a.args.potion_type === "poison") {
        check(poisonStock === 1 && n.start.includes(a.args.target_id));
        poisonStock = 0;
        n.poison = a.args.target_id;
      } else check(a.args.potion_type === "none");
    } else check(rows(day, "witch").length === 0);
    if (day >= 2 && n.start.includes(demonId)) {
      const a = action(day, "demon_hunter", demonId);
      check(
        a?.name === "demon_hunt" &&
          typeof a.args.abstain === "boolean" &&
          (a.args.abstain
            ? a.args.target_id === null
            : typeof a.args.target_id === "number" &&
              a.args.target_id !== demonId &&
              n.start.includes(a.args.target_id)),
      );
      n.hunt = { day, targetId: a.args.target_id };
    } else check(rows(day, "demon_hunter").length === 0);
    const c = pending(),
      h = n.hunt?.targetId;
    if (h !== null && h !== undefined) {
      if (c && c.targetId === h) {
        n.clear = makeClosed(c, "cleared");
      } else
        n.huntDamage = {
          targetId: roster.get(h)!.camp === Camp.Wolf ? h : demonId,
          cause: roster.get(h)!.camp === Camp.Wolf ? "demon_hunt" : "demon_hunt_backlash",
        };
    }
    if (n.poison !== null && n.poison !== demonId) add(n.poison, "poison");
    if (n.knife !== null && n.heal !== n.knife) add(n.knife, "wolf_kill");
    if (n.huntDamage) add(n.huntDamage.targetId, n.huntDamage.cause);
    if (c && !n.clear && c.expiresNight === day) add(c.targetId, "servant_expiry");
  };
  const deriveKnife = (n: NobleNightAudit): number | null => {
    const wolves = n.start.filter((id) => roster.get(id)!.camp === Camp.Wolf),
      vs = rows(day, "wolf_vote"),
      tally = new Map<number, number>();
    check(
      equal(
        vs.map((d) => d.actorId).sort((a, b) => a - b),
        wolves,
      ),
    );
    for (const d of vs) {
      check(d.outcome.kind === "action" && d.outcome.action?.name === "kill_vote");
      const a = d.outcome.action.args;
      check(typeof a.abstain === "boolean");
      if (!a.abstain) {
        check(
          typeof a.target_id === "number" &&
            n.start.includes(a.target_id) &&
            !(
              board.nightNoble!.wolfActionPolicy === "no_blast_no_self_knife" &&
              a.target_id === nobleId
            ),
        );
        tally.set(a.target_id, (tally.get(a.target_id) ?? 0) + 1);
      }
    }
    return [...tally].sort(([a, x], [b, y]) => y - x || a - b)[0]?.[0] ?? null;
  };
  const prepared = new Set<number>(),
    closures = new Set<string>(),
    sourceCommits = new Set<number>();
  const prepare = () => {
    begin();
    if (!prepared.has(day)) {
      derive(nights.get(day)!);
      prepared.add(day);
    }
    return nights.get(day)!;
  };
  const close = (payload: Record<string, unknown>) => {
    const c = state.noble.contracts.find((c) => c.id === payload.contractId);
    check(
      c && payload.actorId === nobleId && !closures.has(c.id) && payload.targetId === c.targetId,
    );
    if (payload.status === "target_dead") check(!alive.has(c.targetId));
    else {
      check(eventSeen.has(`native/${day}`));
      const n = prepare();
      if (payload.status === "cleared") check(equal(payload, n.clear));
      else check(payload.status === "expired" && !n.clear && c.expiresNight === day);
    }
    check(equal(payload, makeClosed(c, payload.status as "cleared" | "expired" | "target_dead")));
    if (c.status.kind === "pending")
      c.status = { kind: payload.status as "cleared" | "expired" | "target_dead", day };
    else check(c.status.kind === payload.status && c.status.day === day);
    closures.add(c.id);
  };
  const sources = () => {
    check(eventSeen.has(`native/${day}`));
    const n = prepare();
    check(!sourceCommits.has(day));
    const current = night();
    check(current && current.status === "open");
    const bodyRequired = n.start.includes(bodyId) && state.body.body.kind === "intact";
    check(!bodyRequired || current.bodyChosen);
    check(!n.requiresNoble || current.nobleChosen);
    const expected = structuredClone(n.beforeBody),
      priority = [
        "wolf_kill",
        "poison",
        "demon_hunt",
        "demon_hunt_backlash",
        "servant_expiry",
      ] as const;
    if (current.bodyChosen && state.body.body.kind === "intact") {
      const selected = state.body.lastChoice!.targetId ?? bodyId,
        target = expected[selected]?.length ? selected : bodyId,
        cause = priority.find((c) => expected[target]?.includes(c));
      if (cause) {
        n.blocked = { targetId: target, cause };
        expected[target] = expected[target]!.filter((c) => c !== cause);
        if (!expected[target]!.length) delete expected[target];
        state.body.body = {
          kind: "night_spent",
          day,
          targetId: target,
          cause: cause as "wolf_kill",
        };
      }
    }
    n.final = expected;
    current.status = "normal";
    current.expiryProcessed = true;
    current.bodyResolved = true;
    sourceCommits.add(day);
    return n;
  };
  const eventSeen = new Set<string>();
  const mark = (key: string) => {
    check(!eventSeen.has(key));
    eventSeen.add(key);
  };
  let initialInfoSeen = false;
  const seenNotice = new Set<string>(),
    observed = new Map(
      [...roster.keys()].map((id) => [
        id,
        [] as Array<{ seq: number; type: string; payload: Record<string, unknown> }>,
      ]),
    );
  const publicTypes = new Set([
    "phase_changed",
    "day_speech",
    "night_resolved",
    "vote_summary",
    "voted_out",
    "game_over",
    "wolf_self_destruct",
    "last_words_granted",
    "last_words_spoken",
    "sheriff_nomination_summary",
    "sheriff_withdraw_summary",
    "sheriff_candidates_finalized",
    "sheriff_pk_started",
    "exile_pk_started",
    "sheriff_vote_summary",
    "sheriff_badge_transferred",
    "sheriff_badge_destroyed",
    "sheriff_direction_chosen",
  ]);
  const project = (
    type: string,
    p: Record<string, unknown>,
    audience: readonly number[] | undefined,
    id: number,
  ): Record<string, unknown> | null => {
    if ((NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(type)) {
      if (
        ["noble_contract_closed", "secret_body_blocked"].includes(type) ||
        type.startsWith("noble_body_")
      )
        return null;
      if (["secret_body_revealed", "secret_body_reveal_speech"].includes(type))
        return structuredClone(p);
      return p.actorId === id && equal(audience, [id]) ? structuredClone(p) : null;
    }
    if (type === "demon_hunter_chosen")
      return id === demonId ? { policy: p.policy, day: p.day, targetId: p.targetId } : null;
    if (
      [
        "wolf_tactical_order",
        "wolf_discussion",
        "wolf_discussion_ended",
        "wolf_kill_vote_cast",
      ].includes(type)
    )
      return audience?.includes(id) ? structuredClone(p) : null;
    if (["seer_checked", "witch_potion_used", "witch_potion_skipped"].includes(type))
      return p.actorId === id ? structuredClone(p) : null;
    if (!publicTypes.has(type)) return null;
    if (type === "vote_summary") {
      const { tally: _tally, ...rest } = p;
      return structuredClone(rest);
    }
    return structuredClone(p);
  };
  const feedAt = new Map<number, Map<number, unknown>>();
  const openingAt = new Map<
    number,
    { day: number; phase: Phase; alive: number[]; state: RecordedNobleBodyState }
  >();
  const acceptEvent = (e: ReproductionRecord["events"][number]) => {
    const p = e.payload;
    if (e.type === "god_private_game_info") {
      check(
        !initialInfoSeen &&
          equal(p, {
            boardSize: 12,
            players: record.metadata.players.map((p, i) => ({
              id: p.id,
              seat: i + 1,
              name: p.name,
              role: p.role,
              camp: p.camp,
            })),
          }),
      );
      initialInfoSeen = true;
    }
    if (
      [
        "wolf_tactical_order",
        "wolf_discussion",
        "wolf_discussion_ended",
        "wolf_kill_vote_cast",
      ].includes(e.type)
    )
      check(
        equal(
          e.audience,
          [...alive].filter((id) => roster.get(id)!.camp === Camp.Wolf).sort((a, b) => a - b),
        ),
      );

    if (e.type === "phase_changed") {
      day = Number(p.day);
      phase = p.phase as Phase;
      if (phase === Phase.Voting) {
        exileExpected = null;
        votedOut = null;
        exileCandidates = null;
        exileRound = 1;
      }
    }
    election.accept(e, { day, phase, alive, idiot: -1, idiotRevealed: false });
    if (e.type === "witch_potion_used" || e.type === "witch_potion_skipped") {
      check(phase === Phase.Night && eventSeen.has(`knife/${day}`));
      mark(`potion/${day}`);
      const a = action(day, "witch", witchId);
      check(
        a?.name === "use_potion" &&
          equal(p, {
            actorId: witchId,
            targetId: a.args.target_id,
            potionType: a.args.potion_type,
          }),
      );
      check(
        e.type === (a.args.potion_type === "none" ? "witch_potion_skipped" : "witch_potion_used"),
      );
      if (a.args.potion_type !== "none") {
        check(alive.has(a.args.target_id));
        marks
          .get(a.args.target_id)!
          .push(a.args.potion_type === "heal" ? "HealMark" : "PoisonMark");
      }
    }
    if (e.type === "vote_summary") {
      check(phase === Phase.Voting && (p.round ?? 1) === exileRound);
      const stage = exileRound === 1 ? "voting" : "exile_pk_vote",
        eligible = [...alive].filter((id) => !exileCandidates?.includes(id)).sort((a, b) => a - b),
        tally: Record<string, number> = {},
        expectedVotes: unknown[] = [];
      check(
        equal(
          [...new Set(rows(day, stage).map((d) => d.actorId))].sort((a, b) => a - b),
          eligible,
        ),
      );
      for (const id of eligible) {
        const ds = rows(day, stage, id);
        let accepted: { target: number | null; abstain: boolean } | undefined;
        for (const d of ds) {
          if (d.outcome.kind !== "action" || d.outcome.action?.name !== "vote") continue;
          const a = d.outcome.action.args;
          if (typeof a.abstain !== "boolean") continue;
          if (a.abstain) {
            accepted = { target: null, abstain: true };
            break;
          }
          if (
            typeof a.target_id === "number" &&
            alive.has(a.target_id) &&
            (!exileCandidates || exileCandidates.includes(a.target_id))
          ) {
            accepted = { target: a.target_id, abstain: false };
            break;
          }
        }
        const vote = accepted ?? { target: null, abstain: true };
        expectedVotes.push({
          actorId: id,
          targetId: vote.target,
          abstain: vote.abstain,
          weight: vote.abstain ? 0 : votes.get(id)!.weight,
          ...(!accepted ? { fallback: true } : {}),
        });
        if (vote.target !== null)
          tally[vote.target] = (tally[vote.target] ?? 0) + votes.get(id)!.weight;
      }
      const entries = Object.entries(tally).sort(
          ([a, x], [b, y]) => y - x || Number(a) - Number(b),
        ),
        top = entries.length
          ? entries.filter(([, v]) => v === entries[0]![1]).map(([id]) => Number(id))
          : [];
      exileExpected = top.length === 1 ? top[0]! : null;
      check(equal(p.tally, tally) && p.target === exileExpected && equal(p.votes, expectedVotes));
      if (exileRound === 1 && top.length > 1) exileCandidates = top;
    }
    if (e.type === "exile_pk_started") {
      check(
        phase === Phase.Voting &&
          exileRound === 1 &&
          exileCandidates &&
          equal(p.candidates, exileCandidates),
      );
      exileRound = 2;
    }
    if ((NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(e.type)) {
      check(readNobleSecretBodyFact(e.type, p) && p.day === day);
      if (e.type === "noble_body_knife_committed") {
        mark(`knife/${day}`);
        check(phase === Phase.Night && p.actorId === nobleId);
        begin();
        const target = deriveKnife(nights.get(day)!);
        check(p.targetId === target);
        if (target !== null) marks.get(target)!.push("WolfKillMark");
      }
      if (e.type === "noble_body_native_damage_committed") {
        mark(`native/${day}`);
        check(phase === Phase.Night && p.actorId === bodyId && eventSeen.has(`knife/${day}`));
        const n = nights.get(day)!;
        check((!n.requiresBody || night().bodyChosen) && (!n.requiresNoble || night().nobleChosen));
        if (n.start.includes(witchId)) check(eventSeen.has(`potion/${day}`));
        if (n.start.includes(seerId)) {
          const a = action(day, "seer", seerId);
          check(a?.name === "check_identity" && n.start.includes(a.args.target_id));
        }
        prepare();
        for (const list of marks.values()) list.length = 0;
      }

      if (e.type === "noble_body_night_opened") {
        mark(`open/${day}`);
        begin();
        check(
          phase === Phase.Night &&
            p.actorId === nobleId &&
            equal(
              p.notifiedActorIds,
              [nobleId, bodyId].filter((id) => alive.has(id)),
            ),
        );
        for (const id of [nobleId, bodyId].filter((id) => alive.has(id)))
          check(seenNotice.has(`${day}/${id}`));
      }
      if (e.type === "noble_night_notified" || e.type === "secret_body_night_notified") {
        check(phase === Phase.Night);
        begin();
        const key = `${day}/${p.actorId}`;
        check(!seenNotice.has(key) && alive.has(Number(p.actorId)));
        seenNotice.add(key);
        if (e.type === "noble_night_notified") {
          check(p.actorId === nobleId);
          state.knowledge.noble = {
            wolfActionPolicy: state.noble.wolfActionPolicy,
            lastNotifiedNight: day,
            lastChoice: structuredClone(state.noble.lastChoice),
            contracts: structuredClone(state.noble.contracts),
          };
          check(equal(p, { policy, actorId: nobleId, day, ...state.knowledge.noble }));
          state.notices.push({
            kind: "night_noble",
            actorId: nobleId,
            day,
            known: structuredClone(state.knowledge.noble),
          });
        } else {
          check(p.actorId === bodyId);
          state.knowledge.body = {
            protectionRepeatPolicy: state.body.protectionRepeatPolicy,
            lastNotifiedNight: day,
            lastChoice: structuredClone(state.body.lastChoice),
            resource:
              state.body.body.kind === "intact"
                ? "intact"
                : state.body.body.kind === "exile_revealed"
                  ? "exile_revealed"
                  : "spent",
            publicRevealDay: state.body.body.kind === "exile_revealed" ? state.body.body.day : null,
          };
          check(equal(p, { policy, actorId: bodyId, day, ...state.knowledge.body }));
          state.notices.push({
            kind: "secret_body",
            actorId: bodyId,
            day,
            known: structuredClone(state.knowledge.body),
          });
        }
      }
      if (e.type === "secret_body_chosen" || e.type === "noble_servant_chosen") {
        check(phase === Phase.Night);
        begin();
        const body = e.type === "secret_body_chosen",
          id = body ? bodyId : nobleId,
          n = night(),
          a = action(day, body ? "secret_body" : "night_noble", id);
        check(
          p.actorId === id &&
            alive.has(id) &&
            a?.name === (body ? "protect_secret_body" : "choose_servant") &&
            equal(a.args, { target_id: p.targetId }) &&
            (p.targetId === null || alive.has(Number(p.targetId))),
        );
        if (body) {
          check(
            n.status === "open" &&
              nights.get(day)!.requiresBody &&
              !n.bodyChosen &&
              state.body.body.kind === "intact",
          );
          const old = state.body.lastChoice;
          check(
            state.body.protectionRepeatPolicy === "awa_repeat_v1" ||
              p.targetId === null ||
              old?.day !== day - 1 ||
              old.targetId !== p.targetId,
          );
          n.bodyChosen = true;
          state.body.lastChoice = { day, targetId: p.targetId as number | null };
          state.knowledge.body.lastChoice = structuredClone(state.body.lastChoice);
        } else {
          check(
            n.status === "open" &&
              nights.get(day)!.requiresNoble &&
              day >= 2 &&
              !n.nobleChosen &&
              !pending() &&
              p.targetId !== id,
          );
          n.nobleChosen = true;
          state.noble.lastChoice = { day, targetId: p.targetId as number | null };
          state.knowledge.noble.lastChoice = structuredClone(state.noble.lastChoice);
          if (p.targetId !== null) {
            const c = {
              id: `servant:night:${day}`,
              targetId: p.targetId as number,
              createdNight: day,
              expiresNight: day + 1,
              status: { kind: "pending" as const },
            };
            state.noble.contracts.push(c);
            state.knowledge.noble.contracts.push(structuredClone(c));
          }
        }
      }
      if (e.type === "noble_body_sources_committed") {
        mark(`sources/${day}`);
        const n = sourceCommits.has(day) ? nights.get(day)! : sources();
        check(
          equal(p, {
            policy,
            actorId: bodyId,
            day,
            blocked: n.blocked,
            deaths: Object.keys(n.final).map(Number),
            deathSources: n.final,
          }),
        );
      }
      if (e.type === "secret_body_blocked") {
        const n = sources();
        check(equal(p, { policy, actorId: bodyId, day, ...n.blocked }) && n.blocked !== null);
      }
      if (e.type === "noble_contract_closed") {
        mark(`closed/${p.contractId}`);
        if (!closures.has(String(p.contractId))) close(p);
        else {
          const c = state.noble.contracts.find((c) => c.id === p.contractId)!;
          check(c && c.status.kind !== "pending" && equal(p, makeClosed(c, c.status.kind)));
        }
      }
      if (e.type === "noble_body_death_committed") {
        mark(`death/${p.actorId}`);
        const id = Number(p.actorId);
        check(alive.has(id));
        if (phase === Phase.Night) check(equal(p.causes, nights.get(day)?.final[id]));
        else if (pendingBlast === id) {
          check(equal(p.causes, ["self_destruct"]));
          pendingBlast = null;
        } else
          check(
            phase === Phase.Voting &&
              votedOut === id &&
              exileExpected === id &&
              equal(p.causes, ["exile"]),
          );
        alive.delete(id);
        const c = pending();
        if (c?.targetId === id) c.status = { kind: "target_dead", day };
      }
      if (e.type === "secret_body_revealed") {
        check(
          phase === Phase.Voting &&
            exileExpected === bodyId &&
            p.actorId === bodyId &&
            alive.has(bodyId) &&
            state.body.body.kind === "intact",
        );
        state.body.body = { kind: "exile_revealed", day };
        state.knowledge.body.resource = "exile_revealed";
        state.knowledge.body.publicRevealDay = day;
      }
      if (e.type === "secret_body_reveal_speech") {
        check(
          phase === Phase.Voting &&
            exileExpected === bodyId &&
            p.actorId === bodyId &&
            state.body.body.kind === "exile_revealed",
        );
        const a = action(day, "awakened_idiot_reveal_speech", bodyId);
        check(a?.name === "speak" && p.text === sanitizeSpeechText(a.args.text));
        night().revealOpened = true;
        night().revealCompleted = true;
      }
    }
    if (e.type === "night_resolved") {
      check(
        phase === Phase.Night &&
          sourceCommits.has(day) &&
          equal(p.deaths, Object.keys(nights.get(day)!.final).map(Number)),
      );
      for (const id of p.deaths as number[]) {
        check(!alive.has(id));
        announcedDead.add(id);
      }
    }
    if (e.type === "voted_out") {
      check(phase === Phase.Voting && exileExpected === p.target && alive.has(Number(p.target)));
      votedOut = Number(p.target);
      announcedDead.add(Number(p.target));
    }
    if (e.type === "wolf_self_destruct") {
      check(
        ["on_pre_election", "on_pre_vote"].includes(String(p.window)) &&
          alive.has(Number(p.wolfId)) &&
          roster.get(Number(p.wolfId))?.camp === Camp.Wolf &&
          !(p.wolfId === nobleId && board.nightNoble!.wolfActionPolicy !== "standard"),
      );
      const confirmed = rows(day, String(p.window))
        .filter(
          (d) =>
            d.outcome.kind === "action" &&
            d.outcome.action?.name === "self_destruct" &&
            d.outcome.action.args.confirm === true,
        )
        .map((d) => d.actorId)
        .sort((a, b) => a - b);
      check(confirmed[0] === p.wolfId);
      pendingBlast = Number(p.wolfId);
      announcedDead.add(Number(p.wolfId));
    }
    if (e.type === "sheriff_elected") {
      check(sheriff === null && p.winnerId === election.winner && alive.has(Number(p.winnerId)));
      sheriff = Number(p.winnerId);
      for (const id of alive) {
        votes.set(id, { weight: id === sheriff ? 1.5 : 1, canVote: true });
        badges.set(id, {
          isSheriff: id === sheriff,
          destroyed: false,
          voteWeight: 1.5,
          handoffPolicy: "awa_holder_choice_v1",
        } as any);
      }
    }
    if (e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed") {
      const from = e.type === "sheriff_badge_transferred" ? Number(p.fromId) : Number(p.targetId),
        to = e.type === "sheriff_badge_transferred" ? Number(p.toId) : null;
      check(sheriff === from && !alive.has(from) && (to === null || alive.has(to)));
      const choices = rows(day, "sheriff_badge_choice", from);
      check(choices.length === 1 && choices[0]!.outcome.kind === "action");
      const a = choices[0]!.outcome.action,
        target = a?.name === "choose_badge_successor" ? a.args.target_id : null,
        valid =
          typeof target === "number" &&
          Number.isSafeInteger(target) &&
          alive.has(target) &&
          badges.get(target)?.destroyed === false;
      check(to === (valid ? target : null));
      badges.set(from, { ...badges.get(from)!, isSheriff: false, destroyed: true } as any);
      votes.set(from, { weight: 1, canVote: true });
      sheriff = to;
      if (to !== null) {
        badges.set(to, {
          isSheriff: true,
          destroyed: false,
          voteWeight: 1.5,
          handoffPolicy: "awa_holder_choice_v1",
        } as any);
        votes.set(to, { weight: 1.5, canVote: true });
      }
    }
    if (e.type === "game_over") {
      const wolves = [...alive].filter((id) => roster.get(id)!.camp === Camp.Wolf),
        gods = [...alive].filter(
          (id) => roster.get(id)!.camp === Camp.Good && roster.get(id)!.role !== Role.Villager,
        ),
        villagers = [...alive].filter((id) => roster.get(id)!.role === Role.Villager),
        winner =
          wolves.length === 0
            ? Camp.Good
            : gods.length === 0 || villagers.length === 0
              ? Camp.Wolf
              : null;
      check(winner !== null && p.winner === winner);
    }
    for (const id of roster.keys()) {
      const p = project(e.type, e.payload, e.audience, id);
      if (p) {
        const list = observed.get(id)!;
        list.push({ seq: list.length + 1, type: e.type, payload: p });
      }
    }
  };
  const acceptOp = (op: ReproductionRecord["operations"][number]) => {
    const p = op.output;
    if (op.op === "noble_contract_closed") {
      check(p && p.day === day && op.phase === phase && op.status === "ok");
      close(p);
    }
    if (op.op === "noble_body_night_opened") {
      begin();
      check(
        p &&
          p.day === day &&
          equal(
            p.notifiedActorIds,
            [nobleId, bodyId].filter((id) => alive.has(id)),
          ),
      );
    }
  };
  const cpAt = new Map<string, RecordedCheckpoint[]>();
  for (const cp of record.checkpoints) {
    check(
      cp.nobleBody &&
        cp.operationCount !== undefined &&
        cp.settlementCount !== undefined &&
        cp.decisionCount !== undefined,
    );
    const key = `${cp.eventCount}/${record.finalized ? cp.operationCount : 0}`,
      list = cpAt.get(key) ?? [];
    list.push(cp);
    cpAt.set(key, list);
  }
  const checkpoint = (cp: RecordedCheckpoint) => {
    check(cp.decisionCount! <= record.decisions.length && cp.settlementCount! <= cp.decisionCount!);
    check(
      cp.decisionCount ===
        record.decisions.filter(
          (d) =>
            d.openedAtEventCount !== undefined &&
            d.openedAtEventCount <= cp.eventCount &&
            d.day <= cp.cycle,
        ).length,
    );
    check(
      cp.cycle === 0
        ? cp.settlementCount === 0 && cp.snapshot.day === 1
        : cp.complete
          ? cp.settlementCount === cp.decisionCount
          : cp.settlementCount! >=
            Math.max(
              0,
              ...record.decisions
                .slice(0, cp.decisionCount)
                .filter((d) => d.settleOrder !== undefined)
                .map((d) => d.settleOrder ?? 0),
            ),
    );
    const advanced = cp.complete && !cp.snapshot.gameOver && cp.cycle > 0,
      completedNight = state.nights.at(-1);
    check(!advanced || (completedNight && completedNight.day === cp.cycle));
    check(
      cp.snapshot.phase === phase && cp.snapshot.day === (advanced ? completedNight!.day + 1 : day),
    );
    const expected = structuredClone(state),
      n = expected.nights.at(-1);
    if (!cp.complete && n) {
      if (!n.bodyResolved) n.status = "aborted";
      const reveal = rows(cp.cycle, "awakened_idiot_reveal_speech", bodyId);
      if (reveal.length) n.revealOpened = true;
    }
    check(equal(cp.nobleBody, expected));
    snapshots.set(cp, expected);
    for (const p of cp.players) {
      const original = roster.get(p.id);
      check(
        original &&
          p.role === original.role &&
          p.camp === original.camp &&
          p.name === original.name &&
          p.seat === p.id &&
          p.alive === alive.has(p.id) &&
          equal(p.vote, votes.get(p.id)) &&
          equal(p.badge, badges.get(p.id)) &&
          equal(p.marks, marks.get(p.id)) &&
          equal(p.victory, { affiliations: [{ kind: "faction", faction: original.camp }] }),
      );
    }
  };
  let oi = 0;
  const ops = record.finalized ? record.operations : [];
  for (let ei = 0; ei <= record.events.length; ei++) {
    const verify = () => {
      for (const cp of cpAt.get(`${ei}/${oi}`) ?? []) checkpoint(cp);
    };
    verify();
    while (oi < ops.length && ops[oi]!.event_count === ei) {
      acceptOp(ops[oi]!);
      oi++;
      verify();
    }
    if (oi < ops.length)
      check(
        ops[oi]!.event_count !== undefined &&
          ops[oi]!.event_count! > ei &&
          ops[oi]!.event_count! <= record.events.length,
      );
    openingAt.set(ei, { day, phase, alive: [...alive], state: structuredClone(state) });
    feedAt.set(ei, new Map([...observed].map(([id, feed]) => [id, structuredClone(feed)])));
    if (ei < record.events.length) acceptEvent(record.events[ei]!);
  }
  check(oi === ops.length && snapshots.size === record.checkpoints.length);
  if (record.finalized) {
    const last = record.checkpoints.at(-1)!;
    check(
      last.eventCount === record.events.length &&
        last.operationCount === record.operations.length &&
        last.decisionCount === record.decisions.length &&
        last.settlementCount === record.decisions.filter((d) => d.settleOrder !== undefined).length,
    );
  }

  check(initialInfoSeen);
  const settled = record.decisions
    .filter((d) => d.settleOrder !== undefined)
    .map((d) => d.settleOrder!)
    .sort((a, b) => a - b);
  check(
    equal(
      settled,
      Array.from({ length: settled.length }, (_, i) => i + 1),
    ),
  );
  for (const d of record.decisions)
    check(
      d.settleOrder === undefined
        ? d.outcome.kind === "pending"
        : d.openedAfterSettlement < d.settleOrder,
    );
  for (const d of record.decisions) {
    check(
      d.request.actorId === d.actorId &&
        d.request.context.day === d.day &&
        d.request.context.stage === d.stage &&
        roster.has(d.actorId),
    );

    const o = d.openedAtEventCount === undefined ? undefined : openingAt.get(d.openedAtEventCount);
    check(o && o.phase !== Phase.GameOver && o.day === d.day && d.request.phase === o.phase);
    if (["secret_body", "night_noble"].includes(d.stage)) {
      const body = d.stage === "secret_body",
        actor = body ? bodyId : nobleId,
        tool = body ? "protect_secret_body" : "choose_servant",
        n = nights.get(d.day);
      check(
        o.phase === Phase.Night &&
          o.alive.includes(actor) &&
          d.actorId === actor &&
          d.turn === 1 &&
          n &&
          (body ? n.requiresBody : n.requiresNoble) &&
          equal(d.request.allowedTools, [tool]) &&
          d.request.context.allow_fallback === false &&
          d.request.context.action_failure_policy === "error" &&
          d.request.context.turn_constraints.min_valid_actions === 1 &&
          d.request.context.turn_constraints.max_valid_actions === 1 &&
          equal(d.request.context.turn_constraints.required_any_tools, [tool]),
      );
      const eventIndex = record.events.findIndex(
        (e) =>
          e.type === (body ? "secret_body_chosen" : "noble_servant_chosen") &&
          e.payload.day === d.day,
      );
      if (eventIndex >= 0) check(d.openedAtEventCount! <= eventIndex);
      const last = o.state.body.lastChoice,
        targets = o.alive
          .filter((id) =>
            body
              ? !(
                  board.awakenedIdiot!.protectionRepeatPolicy === "awa_nonconsecutive_nights_v1" &&
                  last?.day === d.day - 1 &&
                  last.targetId === id
                )
              : id !== nobleId,
          )
          .sort((a, b) => a - b);
      check(
        equal(
          body ? d.request.context.secret_body_candidates : d.request.context.servant_candidates,
          targets,
        ),
      );
    }
    const f = d.request.context.visible_events,
      expected =
        d.openedAtEventCount === undefined
          ? undefined
          : feedAt.get(d.openedAtEventCount)?.get(d.actorId);
    check(d.openedAtEventCount !== undefined && equal(expected, f));
  }

  if (record.finalized) {
    for (const type of [
      "noble_body_night_opened",
      "noble_body_knife_committed",
      "noble_body_native_damage_committed",
      "noble_body_sources_committed",
      "noble_body_death_committed",
    ]) {
      const es = record.events.map((e, index) => ({ e, index })).filter((x) => x.e.type === type),
        os = record.operations.filter((o) => o.op === type);
      check(es.length === os.length);
      for (let i = 0; i < es.length; i++) {
        const { e, index } = es[i]!,
          op = os[i]!,
          p = e.payload;
        const output =
          type === "noble_body_death_committed"
            ? { policy, playerId: p.actorId, day: p.day, causes: p.causes }
            : p;
        const eventPhase = openingAt.get(index + 1)!.phase;
        check(
          op.scope ===
            (["noble_body_night_opened", "noble_body_knife_committed"].includes(type)
              ? "phase_pipeline"
              : "resolution") &&
            op.status === "ok" &&
            op.phase === eventPhase &&
            op.actor_id === undefined &&
            op.input === undefined &&
            op.reason === undefined &&
            op.event_count === index + 1 &&
            equal(op.output, output),
        );
      }
    }
  }
  return {
    at: (cp) => {
      const found = snapshots.get(cp);
      check(found);
      return structuredClone(found);
    },
    nights,
  };
}
