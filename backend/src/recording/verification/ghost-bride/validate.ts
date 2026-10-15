/**
 * 负责独立审核婚约关系、婚刀资格和发表前缀。输入为归档配置、决定、事实与 checkpoint；
 * 输出为原一致性结果或明确拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import { z } from "zod";
import {
  GHOST_BRIDE_POLICY,
  GHOST_BRIDE_GOAL,
  GHOST_BRIDE_EVENT_TYPES,
  readGhostBrideState,
  readGhostBrideEventFact,
  readWeddingPair,
  readWeddingGroup,
  readWeddingKnifeCapture,
  readWeddingSetup,
  readWeddingTool,
  type WeddingPair,
  type WeddingGroup,
  type WeddingKnifeCapture,
  type WeddingVote,
} from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { isGhostBridePreset } from "../board-support";
import { Role, Camp, Phase } from "@ai-werewolf-arena/game-contract";
import type {
  ReproductionRecord,
  RecordedCheckpoint,
  RecordedDecision,
} from "../../reproduction/format";
const setupStages = [
  "ghost_bride_groom",
  "ghost_bride_chat",
  "ghost_bride_chat",
  "ghost_bride_witness",
  "ghost_bride_witness",
];
const weddingTools = [
  "choose_bridegroom",
  "speak_to_partner",
  "choose_wedding_witness",
  "wedding_kill_vote",
];
const isFact = (type: string) => (GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(type);
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function assert(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_ghost_bride_state_invalid");
}
function audience(actual: readonly number[] | undefined, expected: readonly number[]) {
  assert(
    equal(
      actual,
      [...new Set(expected)].sort((a, b) => a - b),
    ),
  );
}
/** 婚约归档的局部因果账本：关系、聊天、刀口捕获和票来自原证据，不是运行时婚约回执。 */
interface Prefix {
  pair: WeddingPair | null;
  group: WeddingGroup | null;
  votes: WeddingVote[];
  chats: Map<number, number>;
  captures: Map<number, WeddingKnifeCapture>;
  ballots: Map<number, Array<{ actorId: number; targetId: number | null; abstain: boolean }>>;
  resolved: Set<number>;
}
function blank(): Prefix {
  return {
    pair: null,
    group: null,
    votes: [],
    chats: new Map(),
    captures: new Map(),
    ballots: new Map(),
    resolved: new Set(),
  };
}
/** 语义审核只消费严格序列化事实，不导入正在执行的引擎。 */
export function validateGhostBrideRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard;
  const owns = board.roleSetups.some((r) => r.role === Role.GhostBride && r.count > 0);
  const artifacts =
    record.events.some((e) => e.type.startsWith("ghost_bride_")) ||
    record.checkpoints.some(
      (c) =>
        c.ghostBrideSetup || c.players.some((p) => Object.hasOwn(p.privateState, "ghostBride")),
    ) ||
    record.decisions.some(
      (d) =>
        d.stage.startsWith("ghost_bride_") ||
        d.request.context.proposedWitnessId !== undefined ||
        d.request.allowedTools.some((t) => weddingTools.includes(t)),
    );
  if (!owns) {
    assert(
      !artifacts &&
        !board.ghostBride &&
        !board.winConditions?.includes(GHOST_BRIDE_GOAL as never) &&
        board.winCondition !== (GHOST_BRIDE_GOAL as never),
    );
    return;
  }
  assert(isGhostBridePreset(board));
  assert(!record.metadata.initialDeal);
  const ids = record.metadata.players.map((p) => p.id),
    idSet = new Set(ids);
  assert(ids.length === 12 && idSet.size === 12);
  const original = new Map(record.metadata.players.map((p) => [p.id, p]));
  const bride = record.metadata.players.filter((p) => p.role === Role.GhostBride);
  assert(bride.length === 1);
  const brideId = bride[0]!.id;
  const actualCounts = new Map<Role, number>();
  for (const p of record.metadata.players)
    actualCounts.set(p.role, (actualCounts.get(p.role) ?? 0) + 1);
  assert(
    actualCounts.size === board.roleSetups.length &&
      board.roleSetups.every((r) => actualCounts.get(r.role) === r.count),
  );
  for (const p of record.metadata.players)
    assert(
      p.camp ===
        (p.role === Role.GhostBride
          ? Camp.ThirdParty
          : p.role === Role.Wolf
            ? Camp.Wolf
            : Camp.Good),
    );
  const allKnown = (values: readonly number[]) => values.every((id) => idSet.has(id));
  const before = (eventIndex: number): RecordedCheckpoint => {
    const c = record.checkpoints.filter((c) => c.eventCount <= eventIndex).at(-1);
    assert(c);
    return c;
  };
  const memberIds = (group: WeddingGroup) => [group.brideId, group.groomId, group.witnessId];
  const captured = (group: WeddingGroup, day: number, eventIndex: number): WeddingKnifeCapture => {
    const c = before(eventIndex),
      alive = new Set(c.players.filter((p) => p.alive).map((p) => p.id));
    const prior = record.checkpoints[c.cycle - 1];
    const cycleEvents = record.events.slice(prior?.eventCount ?? 0, c.eventCount);
    const lastPhase = cycleEvents.filter((e) => e.type === "phase_changed").at(-1);
    const interruptedHandoff =
      c.snapshot.phase === Phase.Night &&
      cycleEvents.some((e) => e.type === "wolf_self_destruct") &&
      lastPhase?.payload.phase === Phase.Night &&
      lastPhase.payload.day === day;
    assert(
      c.complete &&
        c.snapshot.day === day &&
        !c.snapshot.gameOver &&
        (c.cycle === 0
          ? c.snapshot.phase === Phase.Night
          : c.snapshot.phase === Phase.Voting || interruptedHandoff),
    );
    const singles = record.metadata.players
      .filter((p) => p.role === Role.Wolf && !memberIds(group).includes(p.id) && alive.has(p.id))
      .map((p) => p.id)
      .sort((a, b) => a - b);
    const pair = [group.brideId, group.groomId],
      pairLive = pair.every((id) => alive.has(id)),
      pairDead = pair.every((id) => !alive.has(id));
    const owner = singles.length
      ? "ordinary_pack"
      : pairLive
        ? "pair"
        : pairDead && alive.has(group.witnessId)
          ? "witness"
          : "none";
    return {
      policy: GHOST_BRIDE_POLICY,
      groupId: group.groupId,
      day,
      owner,
      actorIds:
        owner === "ordinary_pack"
          ? singles
          : owner === "pair"
            ? pair
            : owner === "witness"
              ? [group.witnessId]
              : [],
    };
  };
  const states: Prefix[] = [blank()];
  let phase = Phase.Night,
    day = 1;
  const deathEdges = new Set<string>();
  for (let index = 0; index < record.events.length; index++) {
    const event = record.events[index]!,
      prev = states.at(-1)!,
      s: Prefix = {
        pair: prev.pair,
        group: prev.group,
        votes: [...prev.votes],
        chats: new Map(prev.chats),
        captures: new Map(prev.captures),
        ballots: new Map([...prev.ballots].map(([d, v]) => [d, [...v]])),
        resolved: new Set(prev.resolved),
      };
    if (event.type === "phase_changed") {
      phase = event.payload.phase as Phase;
      day = event.payload.day as number;
    }
    if (event.type.startsWith("ghost_bride_")) {
      assert(isFact(event.type));
      const p = readGhostBrideEventFact(event.type, event.payload);
      assert(p);
      assert(phase !== Phase.GameOver && p.groupId === `ghost-bride:1:${brideId}` && p.day === day);
      if (event.type !== "ghost_bride_partner_death") assert(phase === Phase.Night);
      if (event.type === "ghost_bride_pair_chosen") {
        const pair = readWeddingPair(p);
        assert(
          pair && !s.pair && day === 1 && pair.brideId === brideId && allKnown([pair.groomId]),
        );
        audience(event.audience, [pair.brideId, pair.groomId]);
        s.pair = pair;
      } else if (event.type === "ghost_bride_group_chosen") {
        const group = readWeddingGroup(p);
        assert(
          group &&
            s.pair &&
            !s.group &&
            equal(
              {
                policy: group.policy,
                groupId: group.groupId,
                brideId: group.brideId,
                groomId: group.groomId,
                day: group.day,
              },
              s.pair,
            ) &&
            allKnown(memberIds(group)) &&
            s.votes.length === 2 &&
            s.votes.every((v) => v.targetId === group.witnessId),
        );
        audience(event.audience, memberIds(group));
        s.group = group;
      } else {
        assert(s.pair);
        const pairIds = [s.pair.brideId, s.pair.groomId];
        if (event.type === "ghost_bride_partner_chat") {
          const n = s.chats.get(day) ?? 0;
          assert(n < 2 && p.actorId === pairIds[n] && p.recipientId === pairIds[1 - n]);
          if (day === 1) assert(!s.group && s.votes.length === 0);
          else {
            assert(s.group && s.captures.has(day));
            const c = before(index);
            assert(pairIds.every((id) => c.players.find((p) => p.id === id)?.alive));
          }
          audience(event.audience, pairIds);
          s.chats.set(day, n + 1);
        } else if (event.type === "ghost_bride_witness_vote") {
          assert(
            !s.group &&
              day === 1 &&
              s.chats.get(1) === 2 &&
              s.votes.length < 2 &&
              p.actorId === pairIds[s.votes.length] &&
              p.voteIndex === s.votes.length + 1 &&
              typeof p.targetId === "number" &&
              allKnown([p.targetId]) &&
              !pairIds.includes(p.targetId),
          );
          audience(event.audience, []);
          s.votes.push({ actorId: p.actorId as number, targetId: p.targetId });
        } else {
          assert(s.group);
          if (event.type === "ghost_bride_knife_captured") {
            const cap = readWeddingKnifeCapture(p);
            assert(
              cap &&
                !s.captures.has(day) &&
                day === s.captures.size + 1 &&
                equal(cap, captured(s.group, day, index)),
            );
            audience(event.audience, []);
            s.captures.set(day, cap);
            s.ballots.set(day, []);
          } else if (event.type === "ghost_bride_knife_vote") {
            const cap = s.captures.get(day),
              votes = s.ballots.get(day);
            assert(cap && votes && !s.resolved.has(day));
            const base = before(index),
              needsChat =
                day > 1 && pairIds.every((id) => base.players.find((p) => p.id === id)?.alive);
            assert(!needsChat || s.chats.get(day) === 2);
            assert(
              p.owner === cap.owner &&
                p.actorId === cap.actorIds[votes.length] &&
                (p.targetId === null ||
                  (typeof p.targetId === "number" &&
                    allKnown([p.targetId]) &&
                    base.players.find((q) => q.id === p.targetId)?.alive)),
            );
            if (cap.owner === "pair")
              assert(p.targetId === null || !pairIds.includes(p.targetId as number));
            if (cap.owner === "witness") assert(p.targetId !== p.actorId);
            audience(event.audience, cap.owner === "ordinary_pack" ? [] : [p.actorId as number]);
            votes.push({
              actorId: p.actorId as number,
              targetId: p.targetId as number | null,
              abstain: p.abstain as boolean,
            });
          } else if (event.type === "ghost_bride_knife_resolved") {
            const { targetId, ...capFact } = p,
              cap = s.captures.get(day),
              votes = s.ballots.get(day);
            assert(
              cap &&
                votes &&
                equal(capFact, cap) &&
                !s.resolved.has(day) &&
                votes.length === cap.actorIds.length,
            );
            const tally = new Map<number, number>();
            for (const v of votes)
              if (v.targetId !== null) tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + 1);
            const selected = [...tally].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
            assert(targetId === selected);
            audience(event.audience, cap.owner === "ordinary_pack" ? [] : cap.actorIds);
            s.resolved.add(day);
          } else if (event.type === "ghost_bride_partner_death") {
            const edge = `${p.actorId}:${p.targetId}`;
            assert(
              p.phase === phase &&
                pairIds.includes(p.actorId as number) &&
                pairIds.includes(p.targetId as number) &&
                !deathEdges.has(edge),
            );
            audience(event.audience, []);
            deathEdges.add(edge);
          }
        }
      }
    }
    if (
      event.type === "wolf_kill_vote_cast" ||
      ["wolf_tactical_order", "wolf_discussion", "wolf_discussion_ended"].includes(event.type)
    ) {
      const cap = s.captures.get(day);
      assert(phase === Phase.Night && cap?.owner === "ordinary_pack");
      audience(event.audience, cap.actorIds);
      if (event.type === "wolf_kill_vote_cast") {
        const vote = s.ballots.get(day)?.at(-1);
        assert(
          vote &&
            event.payload.actorId === vote.actorId &&
            event.payload.targetId === vote.targetId &&
            event.payload.abstain === vote.abstain &&
            !event.payload.fallback,
        );
      }
    }
    states.push(s);
  }
  for (const c of record.checkpoints) {
    assert(
      c.eventCount <= record.events.length &&
        !c.thiefSetup &&
        !c.shapeshifterSetup &&
        !c.lonelyGirlSetup,
    );
    const setup = readWeddingSetup(c.ghostBrideSetup),
      s = states[c.eventCount]!;
    assert(
      setup &&
        setup.actorId === brideId &&
        c.players.length === 12 &&
        new Set(c.players.map((p) => p.id)).size === 12 &&
        allKnown(c.players.map((p) => p.id)),
    );
    assert(
      setup.groomId === (s.pair?.groomId ?? null) &&
        setup.witnessId === (s.group?.witnessId ?? null) &&
        equal(setup.witnessVotes, s.votes),
    );
    if (s.group) assert(setup.status === "complete");
    else if (setup.status === "complete") assert(false);
    else if (s.pair && !["failed", "cancelled"].includes(setup.status))
      assert(setup.status === "paired");
    else if (!s.pair && !["failed", "cancelled"].includes(setup.status))
      assert(["pending", "active"].includes(setup.status));
    if (c.cycle === 0)
      assert(setup.status === "pending" && c.complete && c.players.every((p) => p.alive));
    if (c.cycle > 0 && !c.complete && !s.group)
      assert(["failed", "cancelled"].includes(setup.status));
    if (c.cycle > 0 && c.complete)
      assert(
        setup.status === "complete" &&
          s.resolved.has(c.snapshot.gameOver ? c.snapshot.day : c.snapshot.day - 1),
      );
    for (const p of c.players) {
      const native = original.get(p.id)!;
      assert(nativeInventory(p.role, p.privateState, idSet, c.cycle === 0, c.snapshot.day));
      assert(p.role === native.role && p.camp === native.camp && !p.lovers);
      const members = s.group ? memberIds(s.group) : s.pair ? [s.pair.brideId, s.pair.groomId] : [];
      const faction = members.includes(p.id) ? Camp.ThirdParty : native.camp;
      assert(equal(p.victory.affiliations, [{ kind: "faction", faction }]));
      if (p.id === brideId) {
        const brideState = readGhostBrideState(p.privateState.ghostBride);
        assert(
          brideState &&
            Object.keys(p.privateState).length === 1 &&
            brideState.groomId === setup.groomId,
        );
        assert(brideState.remaining === (["pending", "active"].includes(setup.status) ? 1 : 0));
      } else assert(!Object.hasOwn(p.privateState, "ghostBride"));
    }
    if (c.snapshot.result?.outcome.kind === "victory") {
      const outcome = c.snapshot.result.outcome;
      assert(
        s.group &&
          outcome.primary.kind === "faction" &&
          outcome.additional.length === 0 &&
          c.snapshot.result.reason === "three_factions_eliminated",
      );
      const winningFaction = outcome.primary.faction;
      const aliveFactions = new Set(
        c.players
          .filter((p) => p.alive)
          .map((p) =>
            p.victory.affiliations[0]!.kind === "faction"
              ? (p.victory.affiliations[0] as { faction: string }).faction
              : "",
          ),
      );
      assert(aliveFactions.size === 1 && aliveFactions.has(outcome.primary.faction));
      const winners = c.players
        .filter((p) =>
          p.victory.affiliations.some((a) => a.kind === "faction" && a.faction === winningFaction),
        )
        .map((p) => p.id)
        .sort((a, b) => a - b);
      assert(
        equal(outcome.winningPlayerIds, winners) &&
          equal(outcome.primary.winningPlayerIds, winners),
      );
    }
    if (c.snapshot.result?.reason === "three_factions_all_dead")
      assert(c.snapshot.result.outcome.kind === "no_winner" && c.players.every((p) => !p.alive));
  }
  const weddingDecisions = record.decisions.filter((d) => d.stage.startsWith("ghost_bride_"));
  let groomId: number | null = null,
    witness: number | null = null,
    setupCount = 0;
  for (const d of record.decisions) {
    for (const event of d.request.context.visible_events)
      if (event.type.startsWith("ghost_bride_")) {
        const p = readGhostBrideEventFact(event.type, event.payload);
        assert(p);
        if (event.type === "ghost_bride_pair_chosen")
          assert([p.brideId, p.groomId].includes(d.actorId));
        else if (event.type === "ghost_bride_group_chosen")
          assert([p.brideId, p.groomId, p.witnessId].includes(d.actorId));
        else if (event.type === "ghost_bride_partner_chat")
          assert([p.actorId, p.recipientId].includes(d.actorId));
        else if (event.type === "ghost_bride_knife_vote")
          assert(p.owner !== "ordinary_pack" && p.actorId === d.actorId);
        else if (event.type === "ghost_bride_knife_resolved")
          assert(p.owner !== "ordinary_pack" && (p.actorIds as number[]).includes(d.actorId));
        else assert(false);
      }
    if (setupCount < 5) {
      assert(
        d.stage === setupStages[setupCount] &&
          d.day === 1 &&
          d.request.phase === Phase.Night &&
          d.actorId ===
            (setupCount === 0 || setupCount === 1 || setupCount === 3 ? brideId : groomId),
      );
      assert(d.turn === 1 && d.openedAfterSettlement === setupCount);
      strictRequest(d);
      if (d.outcome.kind !== "action") {
        assert(d === record.decisions.at(-1));
        break;
      }
      const call = readWeddingTool(d.outcome.action);
      assert(call);
      if (setupCount === 0) {
        assert(
          call.name === "choose_bridegroom" &&
            idSet.has(call.args.target_id) &&
            call.args.target_id !== brideId,
        );
        groomId = call.args.target_id;
      } else if (setupCount === 1 || setupCount === 2) assert(call.name === "speak_to_partner");
      else {
        assert(
          call.name === "choose_wedding_witness" &&
            idSet.has(call.args.target_id) &&
            ![brideId, groomId].includes(call.args.target_id),
        );
        if (setupCount === 3) {
          witness = call.args.target_id;
          assert(d.request.context.proposedWitnessId === undefined);
        } else assert(d.request.context.proposedWitnessId === witness);
      }
      setupCount++;
    } else {
      assert(!["ghost_bride_groom", "ghost_bride_witness"].includes(d.stage));
      if (
        d.stage === "ghost_bride_chat" ||
        d.stage === "ghost_bride_knife" ||
        d.stage === "wolf_vote"
      )
        strictRequest(d);
      if (d.request.allowedTools.includes("self_destruct"))
        assert(![brideId, groomId, witness].includes(d.actorId));
    }
  }
  assert(weddingDecisions.length >= Math.min(setupCount, 5));
  const final = states.at(-1)!;
  if (record.finalized) {
    const success = record.decisions.filter(
      (d) =>
        d.outcome.kind === "action" &&
        (d.stage.startsWith("ghost_bride_") || d.stage === "wolf_vote"),
    );
    const facts = record.events.filter((e) =>
      [
        "ghost_bride_pair_chosen",
        "ghost_bride_partner_chat",
        "ghost_bride_witness_vote",
        "ghost_bride_knife_vote",
      ].includes(e.type),
    );
    assert(success.length === facts.length);
    success.forEach((d, i) => {
      const call = readWeddingTool(d.outcome.kind === "action" ? d.outcome.action : null),
        p = facts[i]!.payload;
      assert(call);
      assert(
        d.actorId === (facts[i]!.type === "ghost_bride_pair_chosen" ? p.brideId : p.actorId) &&
          d.day === p.day,
      );
      if (call.name === "speak_to_partner") assert(call.args.text === p.text);
      else if (call.name === "choose_bridegroom") assert(call.args.target_id === p.groomId);
      else {
        assert(call.args.target_id === p.targetId);
        if (call.name === "kill_vote" || call.name === "wedding_kill_vote")
          assert(call.args.abstain === p.abstain);
      }
    });
    if (!final.group)
      assert(
        record.decisions.every((d) => d.stage.startsWith("ghost_bride_")) &&
          record.checkpoints.at(-1)!.complete === false,
      );
  }
}
function strictRequest(d: RecordedDecision): void {
  const r = d.request;
  assert(
    r.phase === Phase.Night &&
      r.allowedTools.length === 1 &&
      r.context.allow_fallback === false &&
      r.context.action_failure_policy === "error" &&
      r.context.turn_constraints.min_valid_actions === 1 &&
      r.context.turn_constraints.max_valid_actions === 1 &&
      equal(r.context.turn_constraints.required_any_tools, r.allowedTools),
  );
  const tool =
    d.stage === "ghost_bride_groom"
      ? "choose_bridegroom"
      : d.stage === "ghost_bride_chat"
        ? "speak_to_partner"
        : d.stage === "ghost_bride_witness"
          ? "choose_wedding_witness"
          : d.stage === "wolf_vote"
            ? "kill_vote"
            : "wedding_kill_vote";
  assert(r.allowedTools[0] === tool);
}

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nullableId = positive.nullable();
const result = z.strictObject({ kind: z.literal("camp"), camp: z.enum(Camp) });
const histories = z.array(z.strictObject({ targetId: positive, isWerewolf: z.boolean(), result }));
const nativeStates = {
  seer: z.strictObject({
    lastTarget: nullableId,
    lastIsWerewolf: z.boolean().nullable(),
    lastResult: result.nullable(),
    history: histories,
  }),
  witch: z.strictObject({
    heal: z.union([z.literal(0), z.literal(1)]),
    poison: z.union([z.literal(0), z.literal(1)]),
    selfHealRule: z.literal("disabled"),
    canSelfHeal: z.literal(false),
    healUsedThisNight: z.boolean(),
    poisonUsedThisNight: z.boolean(),
  }),
  guard: z.strictObject({
    lastTarget: nullableId,
    repeatPolicy: z.literal("netease_consecutive_nights_v1"),
  }),
};
/** 精确核对原生库存封装：本板子不会复制、赠予或转移资源。 */
function nativeInventory(
  role: Role,
  value: Record<string, unknown>,
  ids: ReadonlySet<number>,
  initial: boolean,
  day: number,
): boolean {
  if (role === Role.GhostBride) return true; // 含三个键的角色状态已结合上文开局事实校验。
  if (role === Role.Wolf || role === Role.Villager) return Object.keys(value).length === 0;
  if (role === Role.Hunter) {
    const p = z
      .strictObject({
        hunter: z.strictObject({
          canShoot: z.boolean(),
          deathActionPolicy: z.literal("awa_knife_or_exile_v1"),
        }),
      })
      .safeParse(value);
    return p.success && (!initial || p.data.hunter.canShoot);
  }
  const kind =
    role === Role.Seer
      ? "seer_check"
      : role === Role.Witch
        ? "potion"
        : role === Role.Guard
          ? "guard"
          : null;
  if (!kind) return false;
  const state =
    role === Role.Seer
      ? nativeStates.seer
      : role === Role.Witch
        ? nativeStates.witch
        : nativeStates.guard;
  const key = `native:${kind}`;
  const p = z
    .strictObject({
      abilities: z.strictObject({
        [key]: z.strictObject({
          id: z.literal(key),
          kind: z.literal(kind),
          state,
          source: z.strictObject({ kind: z.literal("native"), role: z.literal(role) }),
          sourceDisclosed: z.literal(true),
          startsOnDay: z.literal(1),
          maxUses: z.null(),
          uses: z.number().int().nonnegative(),
          lastUsedDay: positive.nullable(),
          disabled: z.literal(false),
        }),
      }),
    })
    .safeParse(value);
  if (!p.success) return false;
  const ability = p.data.abilities[key]!,
    native = ability.state;
  if (ability.lastUsedDay !== null && ability.lastUsedDay > day) return false;
  if (initial && (ability.uses !== 0 || ability.lastUsedDay !== null)) return false;
  if ("lastTarget" in native && native.lastTarget !== null && !ids.has(native.lastTarget))
    return false;
  if ("history" in native) {
    if (
      ability.uses !== native.history.length ||
      native.history.some(
        (h) => !ids.has(h.targetId) || h.isWerewolf !== (h.result.camp === Camp.Wolf),
      )
    )
      return false;
    const last = native.history.at(-1);
    if (initial && native.history.length !== 0) return false;
    if (
      last
        ? native.lastTarget !== last.targetId ||
          native.lastIsWerewolf !== last.isWerewolf ||
          !equal(native.lastResult, last.result)
        : native.lastTarget !== null || native.lastIsWerewolf !== null || native.lastResult !== null
    )
      return false;
  }
  if ("heal" in native) {
    if (
      ability.uses !== 2 - native.heal - native.poison ||
      (native.healUsedThisNight && native.poisonUsedThisNight)
    )
      return false;
    if (
      initial &&
      (native.heal !== 1 ||
        native.poison !== 1 ||
        native.healUsedThisNight ||
        native.poisonUsedThisNight)
    )
      return false;
  }
  if (initial && "lastTarget" in native && native.lastTarget !== null) return false;
  return true;
}
