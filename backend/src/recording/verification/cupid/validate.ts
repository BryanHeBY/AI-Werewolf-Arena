/**
 * 负责丘比特严格 Tape 的独立选择、付款前缀、关系知识与胜利成员核验。
 * 输入是格式已准入的 Record，输出为接受或本族明确错误；本账本只读归档，不调用 World、生产关系／结算或 checkpoint 写方。
 * schema 2 下新增语义拒绝是明确的严格读取政策；公开 replay／player reader 不接本入口。
 * 失败 checkpoint 可保留已绑定关系、部分字段／归属或部分事实；关系死亡事实先于真实标死，不能单凭事实判死。
 * Tape 未记录生命版本、组件原引用、执行退休或逐请求事件游标；本核验不把这些缺席证据补成运行许可。
 */
import {
  Camp,
  DeathCause,
  Phase,
  Role,
  WinCondition,
  type LoversComponent,
  type VictoryAffiliation,
} from "@ai-werewolf-arena/game-contract";
import {
  CUPID_EVENT_TYPES,
  readCupidEventFact,
} from "@ai-werewolf-arena/game-contract/facts/cupid";
import { readVictoryResult } from "@ai-werewolf-arena/replay-contract";
import type {
  RecordedCheckpoint,
  RecordedDecision,
  ReproductionRecord,
} from "../../reproduction/format";

const DEFAULT_POLICY = "netease_2017_cupid_follows_lovers_v1";
const fail: () => never = () => {
  throw new Error("reproduction_cupid_state_invalid");
};
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const keys = (value: Record<string, unknown>, names: string[]) =>
  Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
// JSON 对象的键顺序不是游戏证据；数组顺序则保留配对、安装与事实发表的原含义。
function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, i) => same(value, right[i]));
  const a = object(left),
    b = object(right);
  return (
    !!a &&
    !!b &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
  );
}
function pair(value: unknown): [number, number] | null {
  return Array.isArray(value) &&
    value.length === 2 &&
    value.every(positive) &&
    value[0] !== value[1]
    ? [value[0], value[1]]
    : null;
}
function actionPair(decision: RecordedDecision): [number, number] | null {
  if (decision.outcome.kind !== "action" || decision.outcome.action?.name !== "choose_lovers")
    return null;
  const args = decision.outcome.action.args;
  return pair([args.first_id, args.second_id]);
}
function requestIsCupid(decision: RecordedDecision): boolean {
  return (
    decision.stage === "cupid" ||
    decision.request.context.stage === "cupid" ||
    decision.request.allowedTools.includes("choose_lovers") ||
    (decision.outcome.kind === "action" && decision.outcome.action?.name === "choose_lovers")
  );
}

export function validateCupidRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard;
  const owner = board.roleSetups.some((row) => row.role === Role.Cupid && row.count > 0);
  const facts = record.events.filter((event) =>
    (CUPID_EVENT_TYPES as readonly string[]).includes(event.type),
  );
  const decisions = record.decisions.filter(requestIsCupid);
  if (!owner) {
    if (
      facts.length ||
      decisions.length ||
      record.metadata.players.some((p) => p.role === Role.Cupid) ||
      record.decisions.some((d) =>
        d.request.context.visible_events.some((e) =>
          (CUPID_EVENT_TYPES as readonly string[]).includes(e.type),
        ),
      ) ||
      record.checkpoints.some((cp) =>
        cp.players.some((p) => Object.hasOwn(p.privateState, "cupid") || p.lovers !== undefined),
      )
    )
      fail();
    return;
  }
  const initial = record.metadata.players;
  const actors = initial.filter((p) => p.role === Role.Cupid),
    actor = actors[0];
  const allowed = [
    Role.Cupid,
    Role.Wolf,
    Role.WolfKing,
    Role.WhiteWolfKing,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.Hunter,
    Role.Idiot,
    Role.Villager,
    Role.Knight,
    Role.Dreamer,
    Role.WolfBeauty,
  ];
  const wolfRoles = [Role.Wolf, Role.WolfKing, Role.WhiteWolfKing, Role.WolfBeauty];
  const policy = board.cupid?.policy ?? DEFAULT_POLICY;
  if (
    actors.length !== 1 ||
    !actor ||
    initial.length !== board.boardSize ||
    record.metadata.initialDeal !== undefined ||
    !same(
      board.winConditions?.length
        ? board.winConditions
        : [board.winCondition ?? WinCondition.SlaughterCity],
      [WinCondition.SlaughterCity],
    ) ||
    ![DEFAULT_POLICY, "lui_meme_lovers_only_v1"].includes(policy) ||
    new Set(initial.map((p) => p.id)).size !== initial.length ||
    initial.some(
      (p) =>
        !allowed.includes(p.role) ||
        p.camp !== (wolfRoles.includes(p.role) ? Camp.Wolf : Camp.Good),
    ) ||
    board.roleSetups.some(
      (row) => initial.filter((p) => p.role === row.role).length !== row.count,
    ) ||
    initial.some((p) => !board.roleSetups.some((row) => row.role === p.role && row.count > 0)) ||
    decisions.length > 3
  )
    fail();
  const byId = new Map(initial.map((p) => [p.id, p]));
  // 请求字段只证明录制的必选契约；没有真实期限、alias 或原体引用，不据它们授予行动许可。
  decisions.forEach((decision, index) => {
    const request = decision.request,
      context = request.context;
    if (
      decision.actorId !== actor.id ||
      request.actorId !== actor.id ||
      decision.day !== 1 ||
      context.day !== 1 ||
      decision.stage !== "cupid" ||
      context.stage !== "cupid" ||
      request.phase !== Phase.Night ||
      decision.turn !== index + 1 ||
      !same(request.allowedTools, ["choose_lovers"]) ||
      context.allow_fallback !== false ||
      context.action_failure_policy !== "error" ||
      context.turn_constraints.min_valid_actions !== 1 ||
      context.turn_constraints.max_valid_actions !== 1 ||
      !same(context.turn_constraints.required_any_tools, ["choose_lovers"]) ||
      (index === 0
        ? context.retry_attempt !== undefined || context.retry_max !== undefined
        : context.retry_attempt !== index || context.retry_max !== 2)
    )
      fail();
  });

  let selected: [number, number] | null = null;
  const remember = (value: unknown) => {
    const next = pair(value);
    if (!next || next.some((id) => !byId.has(id)) || (selected && !same(selected, next))) fail();
    selected = next;
  };
  // 从已经写出的字段／事实确定唯一配对；无字段的未付尝试不会被猜成已提交。
  for (const event of facts) {
    const fact = readCupidEventFact(event.type, event.payload);
    if (!fact || event.audience !== undefined) fail();
    if (event.type === "cupid_lovers_chosen" || event.type === "cupid_relation_resolved")
      remember(fact.pairIds);
  }
  for (const cp of record.checkpoints)
    for (const player of cp.players) {
      if (player.lovers !== undefined) remember(player.lovers.pairIds);
      const state = object(player.privateState.cupid),
        choice = object(state?.choice);
      if (choice) remember(choice.pairIds);
    }
  const selectedPair = selected as [number, number] | null;
  // 首付款后阶段退出，只有最后一次同族请求可能解释已写配对；更早匹配不能遮住后继 known／null／无效回复。
  // 延后结算的末 error／pending 未保存候选，可由 CP／事实确定合法配对，但不能据它证明回复内容或许可。
  const lastDecision = decisions.at(-1);
  const opaqueDecision = lastDecision !== undefined && lastDecision.outcome.kind !== "action";
  if (
    selectedPair &&
    (!lastDecision || (!opaqueDecision && !same(actionPair(lastDecision), selectedPair)))
  )
    fail();
  const relation: LoversComponent | null = selectedPair
    ? {
        actorId: actor.id,
        day: 1,
        policy,
        pairIds: selectedPair,
        pairCamps: [
          byId.get(selectedPair[0])!.camp as Camp.Good | Camp.Wolf,
          byId.get(selectedPair[1])!.camp as Camp.Good | Camp.Wolf,
        ],
        groupId: "cupid_lovers",
        mixed: byId.get(selectedPair[0])!.camp !== byId.get(selectedPair[1])!.camp,
      }
    : null;
  const memberIds = relation
    ? [...new Set([...relation.pairIds, ...(policy === DEFAULT_POLICY ? [actor.id] : [])])]
    : [];
  const initialMembers = new Map(
    initial.map((p) => [p.id, [{ kind: "faction", faction: p.camp }] as VictoryAffiliation[]]),
  );
  const paidMember: VictoryAffiliation[] = relation
    ? [
        relation.mixed
          ? { kind: "relationship", groupId: relation.groupId }
          : { kind: "faction", faction: relation.pairCamps[0] },
      ]
    : [];
  const selectionFacts = relation
    ? [
        {
          type: "cupid_lovers_chosen",
          payload: { actorId: actor.id, day: 1, pairIds: [...relation.pairIds] },
        },
        {
          type: "lover_recognized",
          payload: { actorId: relation.pairIds[0], partnerId: relation.pairIds[1] },
        },
        {
          type: "lover_recognized",
          payload: { actorId: relation.pairIds[1], partnerId: relation.pairIds[0] },
        },
        { type: "cupid_relation_resolved", payload: relation },
      ]
    : [];
  let published = 0;
  const deaths = new Set<string>(),
    derived = new Set<number>();
  for (const event of facts) {
    if (event.type !== "lovers_death") {
      const expected = selectionFacts[published++];
      if (!expected || event.type !== expected.type || !same(event.payload, expected.payload))
        fail();
    } else {
      const root = event.payload.actorId,
        target = event.payload.targetId;
      if (
        !relation ||
        published !== 4 ||
        !relation.pairIds.includes(root as number) ||
        !relation.pairIds.includes(target as number) ||
        root === target ||
        deaths.has(`${root}:${target}`)
      )
        fail();
      deaths.add(`${root}:${target}`);
      derived.add(target as number);
    }
  }
  // 事实是 God 原流，玩家请求只能携带自己的选择或互认副本，不泄漏冻结阵营／关系结算或秘密牵连。
  for (const decision of record.decisions) {
    for (const event of decision.request.context.visible_events) {
      if (!(CUPID_EVENT_TYPES as readonly string[]).includes(event.type)) continue;
      const fact = readCupidEventFact(event.type, event.payload);
      if (
        !fact ||
        !["cupid_lovers_chosen", "lover_recognized"].includes(event.type) ||
        fact.actorId !== decision.actorId ||
        !facts.some(
          (original) => original.type === event.type && same(original.payload, event.payload),
        )
      )
        fail();
    }
    if (
      (decision.stage === "hunter_shot" || decision.stage === "death_shot") &&
      (decision.request.context.death_sources?.includes(DeathCause.Lovers) ||
        derived.has(decision.actorId))
    )
      fail();
  }
  for (const event of record.events) {
    if (
      (event.type === "hunter_shot" && derived.has(event.payload.hunterId as number)) ||
      (["player_shot", "wolf_king_shot"].includes(event.type) &&
        derived.has(event.payload.actorId as number))
    )
      fail();
  }

  // 每个数字是原写序中的可观察位置。不可见的 WeakMap／相同值组件写不被编造为独立档案证据。
  let minimumPrefix = 0,
    priorEventCount = 0;
  for (const [index, cp] of record.checkpoints.entries()) {
    if (
      cp.cycle !== index ||
      cp.eventCount < priorEventCount ||
      cp.eventCount > record.events.length ||
      cp.players.length !== initial.length ||
      new Set(cp.players.map((p) => p.id)).size !== initial.length ||
      Boolean(cp.failure) !== !cp.complete
    )
      fail();
    priorEventCount = cp.eventCount;
    const current = cp.players.find((p) => p.id === actor.id),
      state = object(current?.privateState.cupid);
    if (
      !current ||
      !state ||
      !keys(state, ["policy", "remaining", "choice"]) ||
      state.policy !== policy ||
      cp.players.some((p) => {
        const original = byId.get(p.id);
        return (
          !original ||
          p.role !== original.role ||
          p.camp !== original.camp ||
          (p.id !== actor.id && (Object.hasOwn(p.privateState, "cupid") || p.lovers !== undefined))
        );
      })
    )
      fail();
    const visibleFacts = record.events
      .slice(0, cp.eventCount)
      .filter(
        (e) =>
          (CUPID_EVENT_TYPES as readonly string[]).includes(e.type) && e.type !== "lovers_death",
      ).length;
    const choices = relation ? { day: 1, pairIds: [...relation.pairIds] } : null;
    const matches: number[] = [];
    const lastPrefix = relation ? 3 + memberIds.length + 4 : 0;
    for (let prefix = minimumPrefix; prefix <= lastPrefix; prefix++) {
      const bound = prefix >= 1;
      const installed = Math.max(0, Math.min(memberIds.length, prefix - 3));
      const factCount = Math.max(0, prefix - 3 - memberIds.length);
      if (
        same(current.lovers, bound ? relation : undefined) &&
        state.remaining === (prefix >= 2 ? 0 : 1) &&
        same(state.choice, prefix >= 3 ? choices : null) &&
        visibleFacts === factCount &&
        cp.players.every((p) =>
          same(
            p.victory.affiliations,
            memberIds.slice(0, installed).includes(p.id) ? paidMember : initialMembers.get(p.id),
          ),
        )
      )
        matches.push(prefix);
    }
    if (
      !matches.length ||
      (cp.cycle === 0 && (matches[0] !== 0 || cp.players.some((p) => !p.alive))) ||
      (cp.complete && cp.cycle > 0 && !matches.includes(lastPrefix)) ||
      (cp.complete && cp.cycle > 0 && !relation)
    )
      fail();
    minimumPrefix = cp.complete && cp.cycle > 0 ? lastPrefix : matches[0]!;
    // 只在完整周期核最终存活结果；失败周期中，lovers_death 已发表仍可能尚未完成标死。
    if (
      (cp.complete || cp.snapshot.result !== null) &&
      cp.cycle > 0 &&
      relation &&
      record.events.slice(0, cp.eventCount).some((e) => e.type === "lovers_death") &&
      relation.pairIds.some((id) => cp.players.find((p) => p.id === id)!.alive)
    )
      fail();
    if (cp.snapshot.result) validateResult(cp, relation, memberIds, initialMembers, paidMember);
  }
  // 当前 liveEvents 可以领先最后 checkpoint；这里只核事实自身的成员，不伪造缺席的最终生命快照。
  for (const event of record.events)
    if (event.type === "game_over") {
      let result: ReturnType<typeof readVictoryResult>;
      try {
        result = readVictoryResult(
          event.payload,
          initial.map((p) => p.id),
        );
      } catch {
        return fail();
      }
      if (result.outcome.kind === "victory") {
        const claim = result.outcome.primary;
        const expected = initial
          .filter((p) =>
            (memberIds.includes(p.id) ? paidMember : initialMembers.get(p.id)!).some(
              (a) =>
                (claim.kind === "faction" && a.kind === "faction" && a.faction === claim.faction) ||
                (claim.kind === "relationship" &&
                  a.kind === "relationship" &&
                  a.groupId === claim.groupId),
            ),
          )
          .map((p) => p.id)
          .sort((a, b) => a - b);
        if (
          claim.kind === "individual" ||
          result.outcome.additional.length ||
          !same(claim.winningPlayerIds, expected) ||
          !same(result.outcome.winningPlayerIds, expected)
        )
          fail();
      }
      const cp = record.checkpoints.find(
        (p) => p.eventCount > record.events.indexOf(event) && p.snapshot.result,
      );
      if (cp && !same(result, cp.snapshot.result)) fail();
    }
}

/** 独立按冻结 City 规则读完整 checkpoint；死者成员仍参与胜利名单，真实 Camp 与关系归属分开统计。 */
function validateResult(
  cp: RecordedCheckpoint,
  relation: LoversComponent | null,
  members: number[],
  initialMembers: Map<number, VictoryAffiliation[]>,
  paidMember: VictoryAffiliation[],
): void {
  const result = cp.snapshot.result!;
  if (result.outcome.kind === "no_winner") {
    if (result.winner !== null || result.reason !== "max_days_reached") fail();
    return;
  }
  // 封盘后的发表／收尾仍可能抛错；failure 不抹去已写入的真实终态。
  if (!relation) fail();
  const living = cp.players.filter((p) => p.alive);
  const wolves = living.filter((p) => p.camp === Camp.Wolf).length;
  const good = living.filter(
    (p) =>
      p.camp === Camp.Good &&
      !(
        relation.policy === DEFAULT_POLICY &&
        p.id === relation.actorId &&
        (relation.mixed || relation.pairCamps[0] === Camp.Wolf)
      ),
  ).length;
  const groupWins =
    relation.mixed &&
    relation.pairIds.every((id) => living.some((p) => p.id === id)) &&
    living.every((p) => members.includes(p.id));
  const target = groupWins
    ? ({ kind: "relationship", groupId: "cupid_lovers" } as const)
    : wolves === 0
      ? ({ kind: "faction", faction: Camp.Good } as const)
      : good === 0
        ? ({ kind: "faction", faction: Camp.Wolf } as const)
        : null;
  const reason = groupWins
    ? "cupid_lovers_only_survivors"
    : wolves === 0
      ? "all_wolves_eliminated"
      : "all_good_eliminated";
  if (!target) fail();
  const winners = cp.players
    .filter((p) =>
      (members.includes(p.id) ? paidMember : initialMembers.get(p.id)!).some((a) =>
        target.kind === "faction"
          ? a.kind === "faction" && a.faction === target.faction
          : a.kind === "relationship" && a.groupId === target.groupId,
      ),
    )
    .map((p) => p.id)
    .sort((a, b) => a - b);
  if (
    result.reason !== reason ||
    result.winner !== (target.kind === "faction" ? target.faction : null) ||
    !same(result.outcome, {
      kind: "victory",
      primary: { ...target, winningPlayerIds: winners },
      additional: [],
      winningPlayerIds: winners,
    })
  )
    fail();
}
