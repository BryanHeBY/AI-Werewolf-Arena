/**
 * 负责独立重建孤女的单次钦慕选择、结算知识与胜利成员。
 * 输入为归档配置、选择、事实和 checkpoint；输出为原有有限板子及状态校验。
 * 本 verifier 只推导归档纯数据，不导入 World、运行时权限、结算器或 checkpoint 写方。
 * 独立算法全文保持；原体、资源、关系和事件前缀仍按冻结归档规则审核，不驱动真实游戏。
 */
import type { ReproductionRecord } from "../../recording/reproduction";
import { Role, Camp, WinCondition, Phase } from "@ai-werewolf-arena/game-contract";
import {
  readLonelyGirlEventFact,
  readLonelyGirlChoiceTool,
  LONELY_GIRL_POLICY,
} from "@ai-werewolf-arena/game-contract/facts/lonely-girl";

export function validateLonelyGirlRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard,
    owner = board.roleSetups.some((row) => row.role === Role.LonelyGirl && row.count > 0),
    facts = record.events.filter((e) => e.type === "lonely_girl_admired_chosen"),
    decisions = record.decisions.filter(
      (d) =>
        d.stage === "lonely_girl" ||
        d.request.context.stage === "lonely_girl" ||
        d.request.allowedTools.includes("choose_admired_player") ||
        (d.outcome.kind === "action" && d.outcome.action?.name === "choose_admired_player"),
    );
  const fail = () => {
    throw new Error("reproduction_lonely_girl_state_invalid");
  };
  if (!owner) {
    if (
      facts.length ||
      decisions.length ||
      record.metadata.players.some((p) => p.role === Role.LonelyGirl) ||
      record.checkpoints.some(
        (c) =>
          c.lonelyGirlSetup !== undefined ||
          c.players.some((p) => Object.hasOwn(p.privateState, "lonelyGirl")),
      )
    )
      fail();
    return;
  }
  const initial = record.metadata.players.filter((p) => p.role === Role.LonelyGirl),
    actor = initial[0];
  if (
    initial.length !== 1 ||
    !actor ||
    actor.camp !== Camp.Good ||
    record.metadata.initialDeal !== undefined ||
    board.boardSize < 6 ||
    JSON.stringify(
      board.winConditions?.length
        ? board.winConditions
        : [board.winCondition ?? WinCondition.SlaughterCity],
    ) !== JSON.stringify([WinCondition.SlaughterCity]) ||
    board.events ||
    !board.roleSetups.some((row) => row.role === Role.Wolf && row.count > 0) ||
    board.roleSetups.some(
      (row) =>
        ![
          Role.LonelyGirl,
          Role.Wolf,
          Role.Villager,
          Role.Seer,
          Role.Witch,
          Role.Hunter,
          Role.Guard,
          Role.Idiot,
        ].includes(row.role),
    ) ||
    facts.length > 1 ||
    decisions.length > 1 ||
    record.events.some(
      (e) => e.type === "hybrid_exemplar_chosen" || e.type === "hybrid_affiliation_resolved",
    ) ||
    record.decisions.some(
      (d) =>
        d.stage === "hybrid" ||
        d.request.context.stage === "hybrid" ||
        d.request.allowedTools.includes("choose_exemplar") ||
        (d.outcome.kind === "action" && d.outcome.action?.name === "choose_exemplar"),
    )
  )
    fail();
  for (const d of decisions) {
    const c = d.request.context.turn_constraints;
    if (
      d.actorId !== actor.id ||
      d.request.actorId !== actor.id ||
      d.day !== 1 ||
      d.request.context.day !== 1 ||
      d.stage !== "lonely_girl" ||
      d.request.context.stage !== "lonely_girl" ||
      d.request.phase !== Phase.Night ||
      d.request.allowedTools.length !== 1 ||
      d.request.allowedTools[0] !== "choose_admired_player" ||
      c.min_valid_actions !== 1 ||
      c.max_valid_actions !== 1 ||
      JSON.stringify(c.required_any_tools) !== JSON.stringify(["choose_admired_player"]) ||
      d.request.context.allow_fallback !== false ||
      d.request.context.action_failure_policy !== "error"
    )
      fail();
  }
  const fact = facts[0],
    p = fact && readLonelyGirlEventFact(fact.type, fact.payload),
    decision = decisions[0],
    call =
      decision?.outcome.kind === "action"
        ? readLonelyGirlChoiceTool(decision.outcome.action)
        : null,
    target = p && record.metadata.players.find((row) => row.id === p.targetId);
  if (
    fact &&
    (!p ||
      !p.camp ||
      p.actorId !== actor.id ||
      !target ||
      target.camp !== p.camp ||
      !call ||
      call.args.target_id !== p.targetId)
  )
    fail();
  if (
    record.metadata.players.some(
      (player) => player.camp !== (player.role === Role.Wolf ? Camp.Wolf : Camp.Good),
    )
  )
    fail();
  // checkpoint 事件前缀可落后于当前决定。仅在已有后续非选择决定，且归档
  // 已终结或存在 cycle > 0 的检查点时，要求首次选择事实；失败开局不据此强制该事实。
  if (
    !facts.length &&
    record.decisions.some((d) => !decisions.includes(d)) &&
    (record.finalized || record.checkpoints.some((c) => c.cycle > 0))
  )
    fail();
  let completed = false,
    closed = false,
    finalStatus: string | null = null;
  for (const checkpoint of record.checkpoints) {
    const setup = checkpoint.lonelyGirlSetup,
      player = checkpoint.players.find((row) => row.id === actor.id),
      visible = record.events
        .slice(0, checkpoint.eventCount)
        .some((e) => e.type === "lonely_girl_admired_chosen");
    if (
      checkpoint.players.some((player) => {
        const initial = record.metadata.players.find((p) => p.id === player.id);
        return !initial || player.role !== initial.role || player.camp !== initial.camp;
      })
    )
      fail();
    if (
      !setup ||
      !player ||
      setup.actorId !== actor.id ||
      player.role !== Role.LonelyGirl ||
      player.camp !== Camp.Good ||
      checkpoint.players.some(
        (row) => row.id !== actor.id && Object.hasOwn(row.privateState, "lonelyGirl"),
      ) ||
      checkpoint.players.some((row) => Object.hasOwn(row.privateState, "hybrid"))
    )
      fail();
    if (checkpoint.cycle === 0 && (setup!.status !== "pending" || visible || !checkpoint.complete))
      fail();
    if (checkpoint.cycle > 0 && setup!.status === "pending") fail();
    if (setup!.status === "failed" && checkpoint.complete) fail();
    if (finalStatus && setup!.status !== finalStatus) fail();
    if (setup!.status !== "pending") finalStatus = setup!.status;
    const state = player!.privateState.lonelyGirl as Record<string, unknown> | undefined;
    if (
      !state ||
      Array.isArray(state) ||
      Object.keys(state).length !== 3 ||
      state.policy !== LONELY_GIRL_POLICY
    )
      fail();
    if (visible) {
      if (
        !p ||
        !p.camp ||
        setup!.status !== "complete" ||
        state!.remaining !== 0 ||
        JSON.stringify(state!.choice) !== JSON.stringify({ day: 1, targetId: p.targetId }) ||
        JSON.stringify(player!.victory.affiliations) !==
          JSON.stringify([{ kind: "faction", faction: p.camp }]) ||
        closed
      )
        fail();
      completed = true;
    } else {
      if (
        completed ||
        setup!.status === "complete" ||
        state!.choice !== null ||
        JSON.stringify(player!.victory.affiliations) !== "[]" ||
        state!.remaining !== (setup!.status === "pending" ? 1 : 0)
      )
        fail();
      if (setup!.status !== "pending") closed = true;
      else if (closed) fail();
    }
  }
}
