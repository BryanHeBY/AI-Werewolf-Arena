/**
 * 负责混血儿严格 Tape 的独立必选、付款前缀、隐藏归属与终局成员核验。
 * 输入为格式已准入的归档，输出为接受或本族明确错误；只读决定、事实和 checkpoint，不调用生产阶段／Victory 计算或写方。
 * 真实 Camp、身份与已冻结归属分别校验；榜样／本人死亡不撤回归属，未付选择不凭失败事实补交。
 * 失败 checkpoint 可停在 remaining、choice、组件或事实任一原先完成的前缀；不假装同步段可回滚。
 * 新严格语义不改 schema 2 或公开历史 reader；Tape 缺席的原体、生命版本、租约及 await 游标不在这里补造。
 */
import { Camp, Phase, Role, WinCondition, type VictoryAffiliation } from "@ai-werewolf-arena/game-contract";
import { readHybridEventFact } from "@ai-werewolf-arena/game-contract/facts/hybrid";
import { readVictoryResult } from "@ai-werewolf-arena/replay-contract";
import type { RecordedCheckpoint, RecordedDecision, ReproductionRecord } from "../../recording/reproduction";

const fail: () => never = () => { throw new Error("reproduction_hybrid_state_invalid"); };
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const keys = (value: Record<string, unknown>, names: string[]) =>
  Object.keys(value).length === names.length && names.every((key) => Object.hasOwn(value, key));
function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, i) => same(value, right[i]));
  const a = object(left), b = object(right);
  return !!a && !!b && Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}
const familyFact = (type: string) => type === "hybrid_exemplar_chosen" || type === "hybrid_affiliation_resolved";
function requestIsHybrid(decision: RecordedDecision): boolean {
  return decision.stage === "hybrid" || decision.request.context.stage === "hybrid" || decision.request.allowedTools.includes("choose_exemplar") ||
    (decision.outcome.kind === "action" && decision.outcome.action?.name === "choose_exemplar");
}
function actionTarget(decision: RecordedDecision): number | null {
  if (decision.outcome.kind !== "action" || decision.outcome.action?.name !== "choose_exemplar") return null;
  const target = decision.outcome.action.args.target_id;
  return positive(target) ? target : null;
}

export function validateHybridRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard, initial = record.metadata.players;
  const owner = board.roleSetups.some((row) => row.role === Role.Hybrid && row.count > 0);
  const facts = record.events.filter((event) => familyFact(event.type)), decisions = record.decisions.filter(requestIsHybrid);
  if (!owner) {
    if (facts.length || decisions.length || initial.some((p) => p.role === Role.Hybrid) ||
      record.decisions.some((d) => d.request.context.visible_events.some((e) => familyFact(e.type))) ||
      record.checkpoints.some((cp) => cp.players.some((p) => Object.hasOwn(p.privateState, "hybrid")))) fail();
    return;
  }
  const actors = initial.filter((p) => p.role === Role.Hybrid), actor = actors[0];
  const allowed = [Role.Hybrid, Role.Wolf, Role.WolfKing, Role.HiddenWolf, Role.Seer, Role.Witch, Role.Guard, Role.Hunter, Role.Idiot, Role.Villager];
  const wolves = [Role.Wolf, Role.WolfKing, Role.HiddenWolf];
  const conditions = board.winConditions?.length ? board.winConditions : [board.winCondition ?? WinCondition.SlaughterCity];
  if (actors.length !== 1 || !actor || initial.length !== board.boardSize || record.metadata.initialDeal !== undefined ||
    conditions.some((c) => ![WinCondition.SlaughterCity, WinCondition.SlaughterSide, WinCondition.WolfReachHalf].includes(c)) ||
    new Set(initial.map((p) => p.id)).size !== initial.length ||
    initial.some((p) => !allowed.includes(p.role) || p.camp !== (wolves.includes(p.role) ? Camp.Wolf : Camp.Good)) ||
    board.roleSetups.some((row) => initial.filter((p) => p.role === row.role).length !== row.count) ||
    initial.some((p) => !board.roleSetups.some((row) => row.role === p.role && row.count > 0)) || decisions.length > 3) fail();
  const byId = new Map(initial.map((p) => [p.id, p]));
  decisions.forEach((decision, index) => {
    const request = decision.request, context = request.context;
    if (decision.actorId !== actor.id || request.actorId !== actor.id || decision.day !== 1 || context.day !== 1 ||
      decision.stage !== "hybrid" || context.stage !== "hybrid" || request.phase !== Phase.Night || decision.turn !== index + 1 ||
      !same(request.allowedTools, ["choose_exemplar"]) || context.allow_fallback !== false ||
      context.turn_constraints.min_valid_actions !== 1 || context.turn_constraints.max_valid_actions !== 1 ||
      !same(context.turn_constraints.required_any_tools, ["choose_exemplar"]) ||
      (index === 0 ? context.retry_attempt !== undefined || context.retry_max !== undefined
        : context.retry_attempt !== index || context.retry_max !== 2)) fail();
  });
  let targetId: number | null = null;
  const remember = (value: unknown) => {
    if (!positive(value) || value === actor.id || !byId.has(value) || (targetId !== null && targetId !== value)) fail();
    targetId = value;
  };
  for (const event of facts) {
    const fact = readHybridEventFact(event.type, event.payload);
    if (!fact || event.audience !== undefined || fact.actorId !== actor.id ||
      !keys(event.payload, fact.type === "hybrid_exemplar_chosen" ? ["actorId", "day", "targetId"] : ["actorId", "day", "targetId", "faction"])) fail();
    remember(fact.targetId);
  }
  for (const cp of record.checkpoints) for (const player of cp.players) {
    const state = object(player.privateState.hybrid), choice = object(state?.choice);
    if (choice) remember(choice.targetId);
  }
  // 首付款后阶段退出，最后一次同族决定才可承载选择；known／null／无效回复不能由更早匹配绕过。
  // 末 error／pending 没有序列化候选，不等于未付款；只允许 CP／事实提供合法数据，不补造权限。
  const lastDecision = decisions.at(-1);
  const lastTarget = lastDecision ? actionTarget(lastDecision) : null;
  const opaqueDecision = lastDecision !== undefined && lastDecision.outcome.kind !== "action";
  if (targetId !== null && lastTarget !== targetId && !opaqueDecision) fail();
  const selectedTarget = targetId as number | null;
  const faction = selectedTarget === null ? null : byId.get(selectedTarget)!.camp;
  const paid: VictoryAffiliation[] = faction === null ? [] : [{ kind: "faction", faction }];
  const expectedFacts = selectedTarget === null ? [] : [
    { type: "hybrid_exemplar_chosen", payload: { actorId: actor.id, day: 1, targetId: selectedTarget } },
    { type: "hybrid_affiliation_resolved", payload: { actorId: actor.id, day: 1, targetId: selectedTarget, faction } },
  ];
  if (facts.length > 2 || facts.some((event, index) => !same({ type: event.type, payload: event.payload }, expectedFacts[index]))) fail();
  // God 原流允许保留隐藏归属；玩家请求只可见本人选择的三字段事实，不能把阵营结算带入普通知识。
  for (const decision of record.decisions) for (const event of decision.request.context.visible_events) {
    if (!familyFact(event.type)) continue;
    if (event.type !== "hybrid_exemplar_chosen" || event.payload.actorId !== decision.actorId ||
      !facts.some((original) => original.type === event.type && same(original.payload, event.payload))) fail();
  }

  let minimumPrefix = 0, priorEventCount = 0;
  for (const [index, cp] of record.checkpoints.entries()) {
    if (cp.cycle !== index || cp.eventCount < priorEventCount || cp.eventCount > record.events.length ||
      cp.players.length !== initial.length || new Set(cp.players.map((p) => p.id)).size !== initial.length ||
      Boolean(cp.failure) !== !cp.complete) fail();
    priorEventCount = cp.eventCount;
    const current = cp.players.find((p) => p.id === actor.id), state = object(current?.privateState.hybrid);
    if (!current || !state || !keys(state, ["remaining", "choice"]) || cp.players.some((p) => {
      const original = byId.get(p.id);
      return !original || p.role !== original.role || p.camp !== original.camp ||
        (p.id !== actor.id && Object.hasOwn(p.privateState, "hybrid")) || p.lovers !== undefined;
    })) fail();
    const visible = record.events.slice(0, cp.eventCount).filter((e) => familyFact(e.type)).length;
    const choices = selectedTarget === null ? null : { day: 1, targetId: selectedTarget };
    const attempts = opaqueDecision || (lastTarget !== null && lastTarget !== actor.id && byId.has(lastTarget));
    const matches: number[] = [];
    // 0未付；1仅剩余次数已写；2选择已写；3归属已装；4选择事实；5隐藏归属事实。
    for (let prefix = minimumPrefix; prefix <= 5; prefix++) {
      if (prefix > 0 && !attempts || prefix >= 2 && selectedTarget === null) continue;
      if (state.remaining === (prefix >= 1 ? 0 : 1) && same(state.choice, prefix >= 2 ? choices : null) &&
        visible === Math.max(0, prefix - 3) && cp.players.every((p) => same(p.victory.affiliations,
          p.id === actor.id ? prefix >= 3 ? paid : [] : [{ kind: "faction", faction: p.camp }]))) matches.push(prefix);
    }
    if (!matches.length || (cp.cycle === 0 && (matches[0] !== 0 || cp.players.some((p) => !p.alive))) ||
      (cp.complete && cp.cycle > 0 && !matches.includes(5))) fail();
    minimumPrefix = cp.complete && cp.cycle > 0 ? 5 : matches[0]!;
    if (cp.snapshot.result) validateResult(cp, conditions);
  }
  for (const event of record.events) if (event.type === "game_over") {
    let result: ReturnType<typeof readVictoryResult>;
    try { result = readVictoryResult(event.payload, initial.map((p) => p.id)); } catch { return fail(); }
    if (result.outcome.kind === "victory") {
      const claim = result.outcome.primary;
      const winners = initial.filter((p) => (p.id === actor.id ? paid : [{ kind: "faction", faction: p.camp }] as VictoryAffiliation[])
        .some((a) => claim.kind === "faction" && a.kind === "faction" && a.faction === claim.faction)).map((p) => p.id).sort((a, b) => a - b);
      if (claim.kind !== "faction" || result.outcome.additional.length || !same(claim.winningPlayerIds, winners) ||
        !same(result.outcome.winningPlayerIds, winners)) fail();
    }
    const cp = record.checkpoints.find((p) => p.eventCount > record.events.indexOf(event) && p.snapshot.result);
    if (cp && !same(result, cp.snapshot.result)) fail();
  }
}

/** 冻结有限板的三个条件按配置顺序独立计算；Hybrid仍是实际Good民，胜利成员另按已付归属。 */
function validateResult(cp: RecordedCheckpoint, conditions: WinCondition[]): void {
  const result = cp.snapshot.result!;
  if (result.outcome.kind === "no_winner") {
    if (result.winner !== null || result.reason !== "max_days_reached") fail();
    return;
  }
  // 终态先写而后续发表失败的 checkpoint 仍按已提交数据核对，不以 complete=false 撤回结果。
  const alive = cp.players.filter((p) => p.alive), wolves = alive.filter((p) => p.camp === Camp.Wolf).length;
  const good = alive.filter((p) => p.camp === Camp.Good);
  const villagers = good.filter((p) => p.role === Role.Villager || p.role === Role.Hybrid).length;
  let candidate: { faction: Camp; reason: string } | null = null;
  for (const condition of conditions) {
    if (wolves === 0) candidate = { faction: Camp.Good, reason: "all_wolves_eliminated" };
    else if (condition === WinCondition.SlaughterCity && good.length === 0)
      candidate = { faction: Camp.Wolf, reason: "all_good_eliminated" };
    else if (condition === WinCondition.SlaughterSide && (villagers === 0 || good.length - villagers === 0))
      candidate = { faction: Camp.Wolf, reason: "slaughter_side_completed" };
    else if (condition === WinCondition.WolfReachHalf && wolves >= good.length && good.length > 0)
      candidate = { faction: Camp.Wolf, reason: "wolves_reach_half" };
    if (candidate) break;
  }
  if (!candidate) fail();
  const chosen = candidate;
  const winners = cp.players.filter((p) => p.victory.affiliations.some((a) => a.kind === "faction" && a.faction === chosen.faction))
    .map((p) => p.id).sort((a, b) => a - b);
  if (result.winner !== chosen.faction || result.reason !== chosen.reason || !same(result.outcome, {
    kind: "victory", primary: { kind: "faction", faction: chosen.faction, winningPlayerIds: winners }, additional: [], winningPlayerIds: winners,
  })) fail();
}
