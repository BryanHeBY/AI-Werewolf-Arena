/**
 * 持有完整传输执行后的独立 Noble／Body 终局、因果及玩家视图字面预期。输入为实际消息、请求前缀、快照或原本地端点及显式预期，输出为原断言与拒绝诊断；各层测试沿用独立标记和已录前缀，不从生产身份、观察或板子算法生成结果预期。
 */
import { expect } from "bun:test";
import type { ReproductionRecord } from "../../../../../src/recording/reproduction/format";
import { type nobleTransportScenario } from "../builders/transport-plan";
type Scenario = ReturnType<typeof nobleTransportScenario>;
type BodySpend = [
  number,
  number,
  "servant_expiry" | "wolf_kill" | "poison" | "demon_hunt" | "demon_hunt_backlash",
];
type Contract = [
  created: number,
  target: number,
  status: "pending" | "cleared" | "expired" | "target_dead",
  terminal: number | null,
];
/**
 * 终局原因与状态均为手写预期，不由生产状态转换计算。
 */
const finals: Record<
  Scenario["name"],
  { body: null | BodySpend | "revealed"; contracts: Contract[] }
> = {
  pass_breaks_repeat: { body: null, contracts: [] },
  noble_pre_election_blast: { body: null, contracts: [] },
  noble_pre_vote_blast: { body: [3, 6, "servant_expiry"], contracts: [[2, 6, "expired", 3]] },
  ordinary_pre_election_blast: { body: null, contracts: [] },
  ordinary_pre_vote_blast: {
    body: [3, 6, "servant_expiry"],
    contracts: [
      [2, 6, "expired", 3],
      [4, 7, "pending", null],
    ],
  },
  expiry: {
    body: [3, 6, "servant_expiry"],
    contracts: [
      [2, 6, "expired", 3],
      [4, 7, "pending", null],
    ],
  },
  new_and_old_clear: {
    body: null,
    contracts: [
      [2, 6, "cleared", 2],
      [3, 12, "cleared", 4],
    ],
  },
  two_sources: {
    body: [3, 6, "wolf_kill"],
    contracts: [
      [2, 5, "expired", 3],
      [4, 7, "pending", null],
    ],
  },
  pending_last_wolf: { body: null, contracts: [[2, 7, "expired", 3]] },
  badge_reveal: { body: "revealed", contracts: [] },
  pending_at_end: { body: null, contracts: [[2, 7, "pending", null]] },
  caster_death: { body: [3, 6, "servant_expiry"], contracts: [[2, 6, "expired", 3]] },
  healed_target_fallback_then_exile: {
    body: [3, 5, "servant_expiry"],
    contracts: [
      [2, 5, "expired", 3],
      [4, 7, "pending", null],
    ],
  },
  self_poison_expiry: {
    body: [3, 5, "poison"],
    contracts: [
      [2, 5, "expired", 3],
      [4, 7, "pending", null],
    ],
  },
  toxin_immunity: { body: null, contracts: [] },
  toxin_immunity_backlash: { body: [2, 4, "demon_hunt_backlash"], contracts: [] },
  dead_noble_expiry: { body: null, contracts: [[2, 6, "expired", 3]] },
  day_target_death_reopens: {
    body: null,
    contracts: [
      [2, 6, "target_dead", 2],
      [3, 9, "expired", 4],
    ],
  },
  first_night_death_pending_end: { body: null, contracts: [[2, 6, "pending", null]] },
  clear_preserves_poison: {
    body: null,
    contracts: [
      [2, 6, "cleared", 2],
      [3, 12, "cleared", 4],
    ],
  },
};
export function assertNobleTransportGolden(record: ReproductionRecord, s: Scenario) {
  const golden = finals[s.name],
    map = (old: number) => s.mapping.get(old)!,
    starts = (day: number): readonly number[] =>
      day === 1 ? Array.from({ length: 12 }, (_, i) => i + 1) : s.plan.alive[day - 2]!,
    noticeDay = (old: number, cycle: number) => {
      let n = 0;
      for (let d = 1; d <= cycle; d++) if (starts(d).includes(old)) n = d;
      return n;
    },
    lastChoice = (old: number, stage: string, day: number) => {
      const t = s.turns
        .get(map(old))!
        .filter((t) => t.stage === stage && t.day <= day)
        .at(-1);
      return t
        ? {
            day: t.day,
            targetId: (t.action as { args: { target_id: number | null } }).args.target_id,
          }
        : null;
    },
    contracts = (day: number, knownNight?: number) =>
      golden.contracts
        .filter((c) => c[0] <= day)
        .map(([created, target, kind, terminal]) => ({
          id: `servant:night:${created}`,
          targetId: map(target),
          createdNight: created,
          expiresNight: created + 1,
          status:
            terminal !== null && terminal < (knownNight ?? day + 1) && kind !== "pending"
              ? { kind, day: terminal }
              : { kind: "pending" as const },
        })),
    bodyKind = (day: number) =>
      golden.body === "revealed" && day >= 1
        ? "exile_revealed"
        : Array.isArray(golden.body) && day >= golden.body[0]
          ? "night_spent"
          : "intact",
    knownBody = (night: number) =>
      golden.body === "revealed" && night > 1
        ? "exile_revealed"
        : Array.isArray(golden.body) && night > golden.body[0]
          ? "spent"
          : "intact";
  for (const cp of record.checkpoints.slice(1)) {
    const day = cp.cycle,
      n = cp.nobleBody!,
      body = bodyKind(day),
      nb = noticeDay(5, day),
      nn = noticeDay(1, day);
    const witch = cp.players.find((p) => p.id === map(3))!,
      ability = (
        witch.privateState.abilities as Record<
          string,
          { state: Record<string, unknown>; uses: number; lastUsedDay: number }
        >
      )["native:potion"],
      bottles = s.turns
        .get(map(3))!
        .filter((t) => t.day <= day && t.action?.name === "use_potion")
        .map((t) => ({
          day: t.day,
          type: (t.action as { args: { potion_type: string } }).args.potion_type,
        }));
    expect(ability.state.heal).toBe(1 - bottles.filter((b) => b.type === "heal").length);
    expect(ability.state.poison).toBe(1 - bottles.filter((b) => b.type === "poison").length);
    expect(ability.state.healUsedThisNight).toBe(
      bottles.some((b) => b.day === day && b.type === "heal"),
    );
    expect(ability.state.poisonUsedThisNight).toBe(
      bottles.some((b) => b.day === day && b.type === "poison"),
    );
    expect(ability.uses).toBe(bottles.filter((b) => b.type !== "none").length);
    expect(ability.lastUsedDay).toBe(day);
    expect(n.noble.contracts).toEqual(contracts(day));
    expect(n.noble.lastChoice).toEqual(lastChoice(1, "night_noble", day));
    expect(n.body.lastChoice).toEqual(lastChoice(5, "secret_body", day));
    expect(n.body.body).toEqual(
      body === "intact"
        ? { kind: "intact" }
        : body === "exile_revealed"
          ? { kind: "exile_revealed", day: 1 }
          : {
              kind: "night_spent",
              day: (golden.body as BodySpend)[0],
              targetId: map((golden.body as BodySpend)[1]),
              cause: (golden.body as BodySpend)[2],
            },
    );
    expect(n.knowledge.noble).toEqual({
      wolfActionPolicy: s.board.config.nightNoble!.wolfActionPolicy,
      lastNotifiedNight: nn,
      lastChoice: lastChoice(1, "night_noble", day),
      contracts: contracts(day, nn),
    });
    expect(n.knowledge.body).toEqual({
      protectionRepeatPolicy: s.board.config.awakenedIdiot!.protectionRepeatPolicy,
      lastNotifiedNight: nb,
      lastChoice: lastChoice(5, "secret_body", day),
      resource: golden.body === "revealed" ? "exile_revealed" : knownBody(nb),
      publicRevealDay: golden.body === "revealed" ? 1 : null,
    });
    expect(n.notices.map((v) => [v.kind, v.actorId, v.day])).toEqual(
      Array.from({ length: day }, (_, i) => i + 1).flatMap((d) =>
        ([1, 5] as const)
          .filter((id) => starts(d).includes(id))
          .map((id) => [
            id === 1 ? ("night_noble" as const) : ("secret_body" as const),
            map(id),
            d,
          ]),
      ),
    );
    for (const flag of n.nights)
      expect(flag).toEqual({
        day: flag.day,
        status: "normal",
        bodyChosen: s.plan.bodyActive[flag.day - 1],
        nobleChosen: s.plan.nobleActive[flag.day - 1],
        expiryProcessed: true,
        bodyResolved: true,
        revealOpened: s.name === "badge_reveal" && flag.day === 1,
        revealCompleted: s.name === "badge_reveal" && flag.day === 1,
      });
  }
  if (s.name === "badge_reveal") {
    const first = record.checkpoints[1]!,
      second = record.checkpoints[2]!,
      third = record.checkpoints[3]!;
    for (const c of [first, second]) {
      const p = c.players.find((p) => p.id === map(5))!;
      expect(p.alive).toBe(true);
      expect(p.badge!.isSheriff).toBe(true);
      expect(p.vote).toEqual({ weight: 1.5, canVote: true });
    }
    expect(third.players.find((p) => p.id === map(5))!.alive).toBe(false);
    expect(third.players.find((p) => p.id === map(2))!.badge!.isSheriff).toBe(true);
    expect(
      record.decisions.some(
        (d) =>
          d.actorId === map(5) &&
          d.day === 1 &&
          ["last_words", "sheriff_badge_choice"].includes(d.stage),
      ),
    ).toBe(false);
  }
  if (s.name === "first_night_death_pending_end") {
    expect(
      record.decisions
        .filter((d) => d.day === 1 && d.stage === "sheriff_nomination")
        .map((d) => d.actorId)
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 12 }, (_, i) => i + 1).filter((id) => id !== map(10)));
    expect(
      record.decisions.filter((d) => d.day === 1 && d.stage === "last_words").map((d) => d.actorId),
    ).toEqual([map(10), map(11)]);
  }
}
