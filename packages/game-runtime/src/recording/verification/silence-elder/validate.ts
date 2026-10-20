/**
 * 负责禁言长老严格归档的独立因果验算，输入为纯配置、决定、事实与检查点，输出接受或明确拒绝。
 * 本账本独立重建夜选、匿名公告、普通/PK动作及个人翻译，不导入生产窗口、资格函数或状态写者作oracle。
 * 只验证档案已记录的原文与顺序；原生命句柄不在JSON中，精确执行身份仍由同构建严格重放验证。
 * 失败检查点保合法已付历史和已公开动作前缀，已知候选必须逐字段约束，不能用错误标签伪造成功。
 */
import { Camp, Phase, Role } from "@ai-werewolf-arena/game-contract";
import {
  SILENCE_ELDER_EVENT_TYPES,
  SILENCE_ELDER_POLICY,
  readSilenceElderFact,
  readSilenceElderStateData,
  silenceElderFactAudience,
  type SilenceElderChoice,
  type SilenceExpressionRound,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import type { RecordedDecision, ReproductionRecord } from "../../reproduction/format";

const stages = new Set(["silence_elder", "silence_gesture", "silence_translation"]);
const tools = new Set(["silence", "gesture", "translate_silence"]);
function check(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_silence_elder_invalid");
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
function strict(
  d: RecordedDecision,
  phase: Phase,
  tool: "silence" | "gesture" | "translate_silence",
): void {
  check(
    d.request.actorId === d.actorId &&
      d.request.phase === phase &&
      d.request.context.day === d.day &&
      d.request.context.stage === d.stage &&
      equal(d.request.allowedTools, [tool]) &&
      d.request.context.action_failure_policy === "error" &&
      d.request.context.allow_fallback === false,
  );
}
const returned = (d: RecordedDecision) =>
  d.outcome.kind === "action"
    ? d.outcome.action
    : d.outcome.kind === "error"
      ? d.returnedCandidate
      : null;

/** 不借生产preset判定；原生牌组、唯一屠边与单一政策共同构成有限板闭包。 */
function board(record: ReproductionRecord): void {
  const c = record.metadata.normalizedBoard;
  check(
    c.boardSize === 12 &&
      c.roleSetups.length === 6 &&
      equal(Object.fromEntries(c.roleSetups.map((r) => [r.role, r.count])), {
        wolf: 4,
        villager: 4,
        seer: 1,
        witch: 1,
        hunter: 1,
        silence_elder: 1,
      }),
  );
  check(
    equal(c.winConditions ?? [c.winCondition], ["slaughter_side"]) &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      c.voting?.exilePolicy === "awa_one_pk_v1" &&
      equal(c.silenceElder, { policy: SILENCE_ELDER_POLICY }),
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
    "tieBreaker",
    "voting",
    "disclosure",
    "lastWords",
    "roleSetups",
    "silenceElder",
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
interface Prefix {
  day: number;
  history: SilenceElderChoice[];
  alive: number[];
  expired: Set<number>;
}
interface Expression {
  day: number;
  round: SilenceExpressionRound;
  actorId: number;
  translatorId: number | null;
  description: string;
  interpreted: boolean;
  publishedAt: number;
  interpretedAt?: number;
  invalidatedAt?: number;
}

export function validateSilenceElderRecord(record: ReproductionRecord): void {
  const c = record.metadata.normalizedBoard;
  const owns = c.roleSetups.some((r) => r.role === Role.SilenceElder && r.count > 0);
  const artifacts =
    record.events.some((e) => (SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(e.type)) ||
    record.decisions.some(
      (d) => stages.has(d.stage) || d.request.allowedTools.some((t) => tools.has(t)),
    ) ||
    record.checkpoints.some((cp) =>
      cp.players.some((p) => Object.hasOwn(p.privateState, "silenceElder")),
    );
  if (!owns) {
    check(
      !c.silenceElder &&
        !artifacts &&
        !record.metadata.players.some((p) => p.role === Role.SilenceElder),
    );
    return;
  }
  board(record);
  const actors = record.metadata.players.filter((p) => p.role === Role.SilenceElder);
  check(actors.length === 1 && actors[0]!.camp === Camp.Good);
  const actor = actors[0]!.id,
    original = new Map(record.metadata.players.map((p) => [p.id, p]));
  check(original.size === 12);
  const alive = new Set(original.keys()),
    history: SilenceElderChoice[] = [],
    choices = new Map<number, SilenceElderChoice>();
  const announcements = new Map<number, { targetId: number; translatorId: number | null }>(),
    expired = new Set<number>();
  const expressions = new Map<string, Expression>(),
    facts = new Map<RecordedDecision, number>();
  const prefixes: Prefix[] = [{ day: 1, history: [], alive: [...alive], expired: new Set() }];
  let day = 1,
    phase: string = Phase.Night,
    pk: number[] | undefined,
    awaiting: Expression | undefined;
  const decision = (stage: string, who: number, when: number, round?: SilenceExpressionRound) => {
    const found = record.decisions.filter(
      (d) =>
        d.stage === stage &&
        d.actorId === who &&
        d.day === when &&
        (round === undefined || d.request.context.silence_round === round),
    );
    check(found.length === 1);
    return found[0]!;
  };
  // 表达先发表再完成通知：sink可追加事实后抛错，false-close仍留下真实候选与已发表前缀。
  // 只允许实际error决定；完成CP不得包住这类失败，最终档案还必须有覆盖该决定的失败CP。
  const publicationOutcome = (d: RecordedDecision, eventIndex: number): boolean => {
    if (d.outcome.kind === "action") return true;
    if (d.outcome.kind !== "error" || d.returnedCandidate == null) return false;
    const position = record.decisions.indexOf(d);
    const covers = (cp: ReproductionRecord["checkpoints"][number]) =>
      cp.eventCount > eventIndex &&
      cp.decisionCount !== undefined &&
      cp.decisionCount > position &&
      d.settleOrder !== undefined &&
      cp.settlementCount !== undefined &&
      d.settleOrder <= cp.settlementCount;
    return (
      !record.checkpoints.some((cp) => cp.complete && covers(cp)) &&
      (!record.finalized || record.checkpoints.some((cp) => !cp.complete && covers(cp)))
    );
  };
  for (const [index, e] of record.events.entries()) {
    const p = e.payload;
    // 正常生产窗口是串行的：已发表动作后的下一个事实只能是译文/拒译，或真实目标/译者死亡撤权。
    if (awaiting && !awaiting.interpreted && awaiting.translatorId !== null) {
      const death = removed(e.type, p).some(
        (id) => id === awaiting!.actorId || id === awaiting!.translatorId,
      );
      check(e.type === "silence_translated" || e.type === "silence_translation_declined" || death);
      if (death) {
        awaiting.invalidatedAt = index + 1;
        awaiting = undefined;
      }
    }
    if (e.type === "phase_changed") {
      day = p.day as number;
      phase = p.phase as string;
      if (phase === Phase.Night || phase === Phase.Day) pk = undefined;
    }
    if (e.type === "exile_pk_started") pk = [...(p.candidates as number[])];
    if ((SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(e.type)) {
      const f = readSilenceElderFact(e.type, p);
      check(f && f.payload.day === day);
      const visibility = silenceElderFactAudience(f.type);
      check(
        visibility === "public"
          ? e.audience === undefined
          : visibility === "god"
            ? e.audience?.length === 0
            : "actorId" in f.payload &&
              e.audience?.length === 1 &&
              e.audience[0] === f.payload.actorId,
      );
      if (f.type === "silence_chosen") {
        const q = f.payload;
        check(
          phase === Phase.Night &&
            q.actorId === actor &&
            alive.has(actor) &&
            !choices.has(day) &&
            alive.has(q.targetId) &&
            (q.translatorId === null || alive.has(q.translatorId)),
        );
        const d = decision("silence_elder", actor, day);
        strict(d, Phase.Night, "silence");
        const action = returned(d);
        check(
          d.outcome.kind === "action" &&
            action?.name === "silence" &&
            equal(action.args, { target_id: q.targetId, translator_id: q.translatorId }) &&
            equal(
              d.request.context.silence_candidates,
              prefixes[d.openedAtEventCount ?? -1]?.alive,
            ),
        );
        // 决定必须先于对应事实发表；完整feed也不能让较晚请求反向证明较早付款或表达。
        check(d.openedAtEventCount !== undefined && d.openedAtEventCount <= index);
        facts.set(d, index + 1);
        const choice = { day, targetId: q.targetId, translatorId: q.translatorId };
        choices.set(day, choice);
        history.push(choice);
      }
      if (f.type === "silence_announced") {
        const q = f.payload,
          choice = choices.get(day);
        check(
          phase === Phase.Day &&
            choice &&
            !expired.has(day) &&
            !announcements.has(day) &&
            q.targetId === choice.targetId &&
            alive.has(q.targetId),
        );
        check(
          q.translatorId ===
            (choice.translatorId !== null && alive.has(choice.translatorId)
              ? choice.translatorId
              : null),
        );
        announcements.set(day, { targetId: q.targetId, translatorId: q.translatorId });
      }
      if (f.type === "silence_gesture") {
        const q = f.payload,
          announcement = announcements.get(day),
          key = `${day}:${q.round}`;
        check(
          announcement &&
            !expired.has(day) &&
            q.actorId === announcement.targetId &&
            alive.has(q.actorId) &&
            !expressions.has(key) &&
            phase === (q.round === "day" ? Phase.Day : Phase.Voting) &&
            (q.round !== "pk" || pk?.includes(q.actorId)),
        );
        const d = decision("silence_gesture", q.actorId, day, q.round);
        strict(d, q.round === "day" ? Phase.Day : Phase.Voting, "gesture");
        const translatorId =
          announcement.translatorId !== null && alive.has(announcement.translatorId)
            ? announcement.translatorId
            : null;
        const action = returned(d);
        check(
          publicationOutcome(d, index) &&
            action?.name === "gesture" &&
            equal(action.args, { description: q.description }) &&
            d.request.context.silence_target_id === q.actorId &&
            d.request.context.silence_translator_id === translatorId &&
            d.request.context.silence_round === q.round,
        );
        // 决定必须先于对应事实发表；完整feed也不能让较晚请求反向证明较早付款或表达。
        check(d.openedAtEventCount !== undefined && d.openedAtEventCount <= index);
        facts.set(d, index + 1);
        const expression = {
          day,
          round: q.round,
          actorId: q.actorId,
          translatorId,
          description: q.description,
          interpreted: false,
          publishedAt: index + 1,
        };
        expressions.set(key, expression);
        awaiting = translatorId === null ? undefined : expression;
      }
      if (f.type === "silence_translated" || f.type === "silence_translation_declined") {
        const q = f.payload,
          expression = expressions.get(`${day}:${q.round}`);
        check(
          expression &&
            !expression.interpreted &&
            !expired.has(day) &&
            q.actorId === expression.translatorId &&
            q.targetId === expression.actorId &&
            alive.has(q.actorId) &&
            alive.has(q.targetId) &&
            phase === (q.round === "day" ? Phase.Day : Phase.Voting),
        );
        const d = decision("silence_translation", q.actorId, day, q.round);
        strict(d, q.round === "day" ? Phase.Day : Phase.Voting, "translate_silence");
        const action = returned(d),
          body = f.type === "silence_translated" ? f.payload.text : null;
        check(
          publicationOutcome(d, index) &&
            action?.name === "translate_silence" &&
            equal(action.args, { text: body }) &&
            d.request.context.silence_target_id === q.targetId &&
            d.request.context.silence_translator_id === q.actorId &&
            d.request.context.silence_round === q.round &&
            d.request.context.silence_gesture_description === expression.description,
        );
        check(
          d.request.context.visible_events.some(
            (e) =>
              e.type === "silence_gesture" &&
              equal(e.payload, {
                policy: SILENCE_ELDER_POLICY,
                day,
                actorId: expression.actorId,
                round: q.round,
                description: expression.description,
              }),
          ),
        );
        // 决定必须先于对应事实发表；完整feed也不能让较晚请求反向证明较早付款或表达。
        check(d.openedAtEventCount !== undefined && d.openedAtEventCount <= index);
        facts.set(d, index + 1);
        expression.interpreted = true;
        expression.interpretedAt = index + 1;
        awaiting = undefined;
      }
      if (f.type === "silence_expired") {
        const choice = choices.get(day);
        check(choice && choice.targetId === f.payload.targetId && !expired.has(day));
        expired.add(day);
      }
    }
    if (e.type === "day_speech") {
      const announcement = announcements.get(day);
      check(!announcement || expired.has(day) || p.actorId !== announcement.targetId);
    }
    for (const id of removed(e.type, p)) alive.delete(id);
    prefixes[index + 1] = {
      day,
      history: history.map((h) => ({ ...h })),
      alive: [...alive],
      expired: new Set(expired),
    };
  }
  // 每个请求只应看到发布前的本族事实；比较完整本族子序列，同时拒未来事实、遗漏和God泄露。
  for (const d of record.decisions) {
    check(d.openedAtEventCount !== undefined && !!prefixes[d.openedAtEventCount]);
    const canonical = record.events
      .slice(0, d.openedAtEventCount)
      .filter((e) => (SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(e.type));
    const expected = canonical.flatMap((e) => {
      const f = readSilenceElderFact(e.type, e.payload);
      check(f);
      const visibility = silenceElderFactAudience(f.type);
      return visibility === "public" ||
        (visibility === "actor" && "actorId" in f.payload && f.payload.actorId === d.actorId)
        ? [{ type: e.type, payload: f.payload }]
        : [];
    });
    const actual = d.request.context.visible_events
      .filter((e) => (SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(e.type))
      .map((e) => ({ type: e.type, payload: e.payload }));
    check(equal(actual, expected));
    // 讨论一旦开始，仍活的被禁言者必须已匿名公告；其普通speak请求不能从工具列表绕开替换。
    if (["day_speech", "exile_pk_speech", "silence_gesture"].includes(d.stage)) {
      const choice = choices.get(d.day),
        living = prefixes[d.openedAtEventCount]!.alive;
      if (choice && living.includes(choice.targetId)) {
        check(
          expected.some(
            (e) =>
              e.type === "silence_announced" &&
              "targetId" in e.payload &&
              e.payload.targetId === choice.targetId,
          ),
        );
        if (d.actorId === choice.targetId) check(d.stage === "silence_gesture");
      }
    }
  }
  for (const cp of record.checkpoints) {
    check(
      cp.decisionCount !== undefined &&
        cp.settlementCount !== undefined &&
        cp.decisionCount <= record.decisions.length,
    );
    const known = record.decisions
      .slice(0, cp.decisionCount)
      .filter((d) => d.settleOrder !== undefined && d.settleOrder <= cp.settlementCount!);
    const prefix = prefixes[cp.eventCount];
    check(prefix);
    check(
      equal(
        cp.players
          .filter((p) => p.alive)
          .map((p) => p.id)
          .sort((a, b) => a - b),
        [...prefix.alive].sort((a, b) => a - b),
      ),
    );
    for (const p of cp.players) {
      const start = original.get(p.id);
      check(start && p.role === start.role && p.camp === start.camp);
      check(
        p.vote.canVote &&
          p.vote.weight ===
            (p.badge.isSheriff && !p.badge.destroyed ? (c.sheriff?.voteWeight ?? 1.5) : 1),
      );
      if (p.id !== actor) check(!Object.hasOwn(p.privateState, "silenceElder"));
    }
    const player = cp.players.find((p) => p.id === actor);
    check(player);
    const state = readSilenceElderStateData(player.privateState.silenceElder);
    check(state);
    if (cp.complete) {
      check(equal(state.history, prefix.history));
      for (const choice of prefix.history) check(prefix.expired.has(choice.day));
      // 只检查该完成前缀中的已发表表达，不把较晚的请求或手势倒灌较早CP。
      for (const d of known)
        if (stages.has(d.stage)) check(facts.has(d) && facts.get(d)! <= cp.eventCount);
      for (const expression of expressions.values())
        if (expression.publishedAt <= cp.eventCount && expression.translatorId !== null)
          check(
            (expression.interpretedAt !== undefined && expression.interpretedAt <= cp.eventCount) ||
              (expression.invalidatedAt !== undefined && expression.invalidatedAt <= cp.eventCount),
          );
    } else if (!equal(state.history, prefix.history)) {
      check(
        state.history.length === prefix.history.length + 1 &&
          equal(state.history.slice(0, -1), prefix.history),
      );
      const choice = state.history.at(-1)!;
      check(choice.day === prefix.day);
      const d = decision("silence_elder", actor, choice.day);
      strict(d, Phase.Night, "silence");
      const action = returned(d),
        living = prefixes[d.openedAtEventCount ?? -1]?.alive;
      check(living && known.includes(d));
      check(
        action?.name === "silence" &&
          equal(action.args, { target_id: choice.targetId, translator_id: choice.translatorId }) &&
          living.includes(actor) &&
          living.includes(choice.targetId) &&
          (choice.translatorId === null || living.includes(choice.translatorId)) &&
          equal(d.request.context.silence_candidates, living),
      );
    }
    for (const d of known)
      if (
        d.request.phase === Phase.Night &&
        d.stage !== "silence_elder" &&
        prefixes[d.openedAtEventCount!]!.alive.includes(actor)
      )
        check(state.history.some((h) => h.day === d.day));
    for (const d of known)
      if (d.stage === "silence_elder" && d.outcome.kind === "action") {
        const action = d.outcome.action;
        check(
          action?.name === "silence" &&
            state.history.some(
              (h) =>
                h.day === d.day &&
                h.targetId === action.args.target_id &&
                h.translatorId === action.args.translator_id,
            ),
        );
      }
  }
}
