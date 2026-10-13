/**
 * 负责独立审核恶魔选择、原生结果及贵族／红月联动证据。输入为归档配置、决定、事实与 checkpoint；
 * 输出为独立重建的审计结果或原拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import type { NobleRecordAudit } from "./noble_secret_body_record";
import { validateRedMoonRecord } from "./red_moon_record";
import { validateDemonNativeStocks } from "./demon_hunter_stocks";
import { z } from "zod";
import {
  DEMON_HUNTER_POLICY,
  DEMON_HUNTER_EVENT_TYPES,
  readDemonHunterEventFact,
  readDemonHunterPlayerFact,
  readDemonHunterState,
  readDemonHuntTool,
} from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import { isDemonHunterPreset } from "../verification/board-support";
import { Role, Camp, Phase, DeathCause } from "@ai-werewolf-arena/game-contract";
import { readFaultPlan } from "../core/domain/fault_plan";
import type { ReproductionRecord } from "./reproduction";
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const choice = z.strictObject({ day: positive.min(2), targetId: positive.nullable() });
const cancel = z.strictObject({
  policy: z.literal(DEMON_HUNTER_POLICY),
  actorId: positive,
  day: positive.min(2),
  targetId: positive,
  reason: z.literal("authority_revoked"),
  faultId: z.string().min(1).nullable(),
});
const immune = z.strictObject({
  policy: z.literal(DEMON_HUNTER_POLICY),
  actorId: positive,
  day: positive,
  witchId: positive,
});
const rootCauses = [
  DeathCause.WolfKill,
  DeathCause.Poison,
  DeathCause.DemonHunt,
  DeathCause.DemonHuntBacklash,
  DeathCause.ServantExpiry,
] as const;
const frozenSchema = z.strictObject({
  policy: z.literal(DEMON_HUNTER_POLICY),
  day: positive,
  hunt: z.strictObject({
    choice: choice.nullable(),
    damage: z
      .strictObject({ targetId: positive, cause: z.enum(["demon_hunt", "demon_hunt_backlash"]) })
      .nullable(),
    cancelled: cancel.nullable(),
    servantCleared: z.record(z.string(), z.json()).optional(),
  }),
  poison_immunities: z.array(immune).max(1),
  poison_overrides: z.array(z.strictObject({ targetId: positive, poison: z.boolean() })).max(1),
  heal_overrides: z.array(z.strictObject({ targetId: positive, heal: z.boolean() })).max(1),
  guard_overrides: z.array(z.strictObject({ targetId: positive, guard: z.boolean() })).max(1),
  deaths: z.array(positive),
  death_sources: z.record(z.string(), z.array(z.enum(rootCauses))),
});
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function assert(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_demon_hunter_state_invalid");
}
const isFact = (type: string) => (DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(type);
/** 独立审核序列化因果；取消标签本身不能授权覆盖效果。 */
export function validateDemonHunterRecord(
  record: ReproductionRecord,
  noble: NobleRecordAudit | null = null,
): void {
  const redMoon = validateRedMoonRecord(record);
  const board = record.metadata.normalizedBoard,
    owns = board.roleSetups.some((r) => r.role === Role.DemonHunter && r.count > 0),
    artifacts =
      record.metadata.faultPlan ||
      record.events.some((e) => isFact(e.type)) ||
      record.operations.some(
        (o) => o.op === "fault_applied" || o.op === "demon_hunter_sources_frozen",
      ) ||
      record.decisions.some(
        (d) => d.stage === "demon_hunter" || d.request.allowedTools.includes("demon_hunt"),
      ) ||
      record.checkpoints.some((c) =>
        c.players.some((p) => Object.hasOwn(p.privateState, "demonHunter")),
      );
  if (!owns) {
    assert(!artifacts && !board.demonHunter);
    return;
  }
  assert(isDemonHunterPreset(board) && !record.metadata.initialDeal);
  const players = record.metadata.players,
    ids = new Set(players.map((p) => p.id)),
    original = new Map(players.map((p) => [p.id, p])),
    demon = players.filter((p) => p.role === Role.DemonHunter),
    witch = players.filter((p) => p.role === Role.Witch);
  assert(
    players.length === board.boardSize &&
      ids.size === board.boardSize &&
      demon.length === 1 &&
      witch.length === 1,
  );
  const actorId = demon[0]!.id,
    witchId = witch[0]!.id;
  assert(
    board.roleSetups.every((r) => players.filter((p) => p.role === r.role).length === r.count),
  );
  for (const p of players)
    assert(
      p.camp ===
        ([Role.Wolf, Role.RedMoonApostle, Role.NightNoble].includes(p.role)
          ? Camp.Wolf
          : Camp.Good),
    );
  for (const cp of record.checkpoints) {
    assert(
      cp.players.length === ids.size && new Set(cp.players.map((p) => p.id)).size === ids.size,
    );
    for (const p of cp.players) {
      const initial = original.get(p.id);
      assert(
        initial &&
          p.role === initial.role &&
          p.camp === initial.camp &&
          equal(p.victory, { affiliations: [{ kind: "faction", faction: initial.camp }] }),
      );
      if (p.id !== actorId) assert(!Object.hasOwn(p.privateState, "demonHunter"));
    }
  }
  validateDemonNativeStocks(record, redMoon, noble);
  for (const decision of record.decisions) {
    for (const event of decision.request.context.visible_events) {
      if (!isFact(event.type)) continue;
      assert(event.type === "demon_hunter_chosen" && decision.actorId === actorId);
      const own = readDemonHunterPlayerFact(event.type, event.payload);
      assert(own && own.day <= decision.day);
      if (record.finalized)
        assert(
          record.events.some(
            (e) =>
              e.type === "demon_hunter_chosen" &&
              e.payload.actorId === actorId &&
              e.payload.day === own.day &&
              e.payload.targetId === own.targetId,
          ),
        );
    }
  }
  // 增量快照刻意省略领域操作，且可能先于下一份 checkpoint 发布。
  if (!record.finalized) return;
  const decisions = record.decisions.filter((d) => d.stage === "demon_hunter"),
    committed = decisions.filter((d) => d.outcome.kind === "action"),
    chosen = record.events.filter((e) => e.type === "demon_hunter_chosen"),
    cancelled = record.events.filter((e) => e.type === "demon_hunter_cancelled"),
    immunities = record.events.filter((e) => e.type === "demon_hunter_poison_immune"),
    accepted = record.operations.filter(
      (o) => o.op === "validate_tool_call" && o.input?.tool === "demon_hunt",
    );
  let previous = 1;
  for (const d of decisions) {
    assert(
      d.actorId === actorId &&
        d.day > previous &&
        d.turn === 1 &&
        d.request.phase === Phase.Night &&
        d.request.actorId === actorId &&
        d.request.context.day === d.day &&
        d.request.context.stage === "demon_hunter" &&
        equal(d.request.allowedTools, ["demon_hunt"]) &&
        d.request.context.allow_fallback === false &&
        d.request.context.action_failure_policy === "error" &&
        d.request.context.turn_constraints.min_valid_actions === 1 &&
        d.request.context.turn_constraints.max_valid_actions === 1 &&
        equal(d.request.context.turn_constraints.required_any_tools, ["demon_hunt"]),
    );
    const prior = record.checkpoints.find((cp) => cp.cycle === d.day - 1);
    assert(prior?.complete && prior.players.find((p) => p.id === actorId)?.alive);
    previous = d.day;
  }
  assert(chosen.length === committed.length && accepted.length === committed.length);
  const choices = new Map<number, { day: number; targetId: number | null }>();
  for (let index = 0; index < committed.length; index++) {
    const d = committed[index]!,
      call = readDemonHuntTool(d.outcome.kind === "action" ? d.outcome.action : null);
    assert(
      call &&
        (call.args.target_id === null ||
          (ids.has(call.args.target_id) && call.args.target_id !== actorId)),
    );
    const prior = record.checkpoints.find((cp) => cp.cycle === d.day - 1)!;
    if (call.args.target_id !== null)
      assert(prior.players.find((p) => p.id === call.args.target_id)?.alive);
    const c = { day: d.day, targetId: call.args.target_id },
      e = chosen[index]!,
      op = accepted[index]!;
    choices.set(d.day, c);
    assert(
      equal(e.payload, { policy: DEMON_HUNTER_POLICY, actorId, ...c }) &&
        equal(e.audience, [actorId]) &&
        op.scope === "gateway" &&
        op.phase === Phase.Night &&
        op.status === "ok" &&
        op.actor_id === actorId &&
        equal(op.input, { tool: "demon_hunt", args: call.args }),
    );
  }
  const plan = record.metadata.faultPlan ? readFaultPlan(record.metadata.faultPlan) : null,
    faults = record.operations.filter((o) => o.op === "fault_applied"),
    applied = new Map<number, string>();
  for (let index = 0; index < faults.length; index++) {
    const op = faults[index]!,
      step = plan?.steps[index],
      c = step && choices.get(step.at.day);
    assert(
      step &&
        c &&
        c.targetId !== null &&
        step.at.afterDecision.actorId === actorId &&
        [actorId, c.targetId].includes(step.mutation.playerId) &&
        op.scope === "resolution" &&
        op.phase === Phase.Night &&
        op.status === "ok" &&
        equal(op.input, { version: "awa_fault_plan_v1", step }) &&
        equal(op.output, { originalVersion: 0, replacementVersion: 0 }),
    );
    assert(!applied.has(step.at.day));
    applied.set(step.at.day, step.id);
  }
  const publicNights = new Map<number, { deaths: number[]; shots: number[] }>();
  let eventDay = 1,
    eventPhase: string = Phase.Night,
    shots: number[] = [];
  for (const e of record.events) {
    if (e.type === "phase_changed") {
      eventDay = Number(e.payload.day);
      eventPhase = String(e.payload.phase);
      if (eventPhase === Phase.Night) shots = [];
    }
    if (e.type === "hunter_shot" && eventPhase === Phase.Night) {
      assert(
        original.get(Number(e.payload.hunterId))?.role === Role.Hunter &&
          ids.has(Number(e.payload.targetId)),
      );
      shots.push(Number(e.payload.targetId));
    }
    if (e.type === "night_resolved") {
      assert(
        eventPhase === Phase.Night &&
          !publicNights.has(eventDay) &&
          Array.isArray(e.payload.deaths),
      );
      const deaths = e.payload.deaths as number[];
      assert(deaths.length === new Set(deaths).size && deaths.every((id) => ids.has(id)));
      publicNights.set(eventDay, { deaths, shots: [...shots] });
    }
  }
  const frozen = record.operations.filter((o) => o.op === "demon_hunter_sources_frozen"),
    expectedCancel: unknown[] = [],
    expectedImmunities: unknown[] = [];
  previous = 0;
  for (const op of frozen) {
    const parsed = frozenSchema.safeParse(op.output);
    assert(
      parsed.success &&
        op.scope === "resolution" &&
        op.phase === Phase.Night &&
        op.status === "ok" &&
        op.input === undefined,
    );
    const source = parsed.data,
      c = choices.get(source.day) ?? null,
      faultId = applied.get(source.day) ?? null;
    assert(source.day > previous && equal(source.hunt.choice, c));
    previous = source.day;
    const prior = record.checkpoints.find((cp) => cp.cycle === source.day - 1);
    assert(prior);
    const eligible =
      source.day >= 2 &&
      prior.players.find((p) => p.id === actorId)?.alive &&
      !redMoon?.sealedNights.has(source.day);
    assert(Boolean(c) === Boolean(eligible));
    if (faultId) {
      assert(
        c?.targetId !== null &&
          c &&
          equal(source.hunt.cancelled, {
            policy: DEMON_HUNTER_POLICY,
            actorId,
            ...c,
            reason: "authority_revoked",
            faultId,
          }) &&
          source.hunt.damage === null,
      );
      assert(
        record.operations.indexOf(faults.find((f) => (f.input?.step as any)?.id === faultId)!) <
          record.operations.indexOf(op),
      );
    } else {
      assert(source.hunt.cancelled === null);
      const damage =
        !c || c.targetId === null
          ? null
          : original.get(c.targetId)!.camp === Camp.Wolf
            ? { targetId: c.targetId, cause: "demon_hunt" }
            : { targetId: actorId, cause: "demon_hunt_backlash" };
      const n = noble?.nights.get(source.day);
      assert(equal(source.hunt.damage, n ? n.huntDamage : damage));
      assert(equal(source.hunt.servantCleared ?? null, n?.clear ?? null));
    }
    if (source.hunt.cancelled) expectedCancel.push(source.hunt.cancelled);
    assert(
      Object.keys(source.death_sources).every(
        (id) => /^(0|[1-9][0-9]*)$/.test(id) && ids.has(Number(id)),
      ),
    );
    if (!noble)
      assert(
        source.hunt.servantCleared === undefined &&
          !Object.values(source.death_sources).some((c) => c.includes(DeathCause.ServantExpiry)),
      );
    else assert(equal(source.death_sources, noble.nights.get(source.day)?.final));
    const roots = new Map(
      Object.entries(source.death_sources)
        .filter(([, causes]) => causes.length > 0)
        .map(([id, causes]) => [Number(id), causes]),
    );
    assert(
      source.deaths.length === new Set(source.deaths).size &&
        source.deaths.every((id) => ids.has(id) && roots.has(id)) &&
        roots.size === source.deaths.length,
    );
    for (const [id, causes] of roots) {
      assert(new Set(causes).size === causes.length);
      for (const cause of causes.filter(
        (x) => x === DeathCause.DemonHunt || x === DeathCause.DemonHuntBacklash,
      ))
        assert(
          source.hunt.damage &&
            id === source.hunt.damage.targetId &&
            cause ===
              (source.hunt.damage.cause === "demon_hunt"
                ? DeathCause.DemonHunt
                : DeathCause.DemonHuntBacklash),
        );
    }
    if (source.hunt.damage && !noble)
      assert(
        roots
          .get(source.hunt.damage.targetId)
          ?.includes(
            source.hunt.damage.cause === "demon_hunt"
              ? DeathCause.DemonHunt
              : DeathCause.DemonHuntBacklash,
          ),
      );
    const publicNight = publicNights.get(source.day);
    if (publicNight) {
      const completeDeaths = [
        ...new Set([
          ...source.deaths,
          ...publicNight.shots,
          ...(redMoon?.expiredNights.has(source.day)
            ? [redMoon.expiredNights.get(source.day)!]
            : []),
        ]),
      ].sort((a, b) => a - b);
      assert(
        equal(
          [...publicNight.deaths].sort((a, b) => a - b),
          completeDeaths,
        ),
      );
    } else
      assert(
        !record.checkpoints.at(-1)!.complete && source.day === record.checkpoints.at(-1)!.cycle,
      );
    const potion = record.decisions.find(
      (d) =>
        d.actorId === witchId &&
        d.day === source.day &&
        d.stage === "witch" &&
        d.outcome.kind === "action" &&
        d.outcome.action?.name === "use_potion" &&
        d.outcome.action.args.potion_type === "poison" &&
        d.outcome.action.args.target_id === actorId,
    );
    const appliedStep = faultId ? plan?.steps.find((step) => step.id === faultId) : undefined;
    const qualifiedPotion =
      potion && (!appliedStep || ![actorId, witchId].includes(appliedStep.mutation.playerId));
    assert(source.poison_immunities.length === (qualifiedPotion ? 1 : 0));
    for (const fact of source.poison_immunities) {
      assert(
        potion &&
          equal(fact, { policy: DEMON_HUNTER_POLICY, actorId, day: source.day, witchId }) &&
          !roots.get(actorId)?.includes(DeathCause.Poison),
      );
      expectedImmunities.push(fact);
    }
    for (const override of [
      ...source.poison_overrides,
      ...source.heal_overrides,
      ...source.guard_overrides,
    ])
      assert(ids.has(override.targetId));
  }
  assert([...publicNights.keys()].every((day) => frozen.some((o) => o.output?.day === day)));
  assert(
    equal(
      cancelled.map((e) => e.payload),
      expectedCancel,
    ) &&
      equal(
        immunities.map((e) => e.payload),
        expectedImmunities,
      ),
  );
  for (const e of [...chosen, ...cancelled, ...immunities])
    assert(
      readDemonHunterEventFact(e.type, e.payload) &&
        equal(e.audience, e.type === "demon_hunter_chosen" ? [actorId] : []),
    );
  const last = record.checkpoints.at(-1)!;
  if (last.complete) assert(!plan || faults.length === plan.steps.length);
  for (const cp of record.checkpoints) {
    const state = readDemonHunterState(
      cp.players.find((p) => p.id === actorId)!.privateState.demonHunter,
    );
    assert(state);
    const visible = record.events
      .slice(0, cp.eventCount)
      .filter((e) => e.type === "demon_hunter_chosen");
    assert(
      equal(
        state.history,
        visible.map((e) => ({ day: e.payload.day, targetId: e.payload.targetId })),
      ),
    );
    if (cp.cycle === 0) assert(cp.complete && state.history.length === 0);
    if (cp.complete)
      assert(
        !record.events.slice(0, cp.eventCount).some((e) => e.type === "demon_hunter_cancelled"),
      );
  }
}
