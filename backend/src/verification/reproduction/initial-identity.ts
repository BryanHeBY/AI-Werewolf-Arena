/**
 * 负责独立重建盗贼／换皮者的完整初始发牌、选择与后续角色状态。
 * 输入为归档原牌、决定、事件和 checkpoint；输出保持原拒绝原因和检查顺序。
 * 本 verifier 只推导归档纯数据，不导入 World、运行时权限、结算器或 checkpoint 写方。
 * 独立算法全文保持；原体、资源、关系和事件前缀仍按冻结归档规则审核，不驱动真实游戏。
 */
import type { ReproductionRecord } from "../../recording/reproduction";
import { Role, Camp, Phase } from "@ai-werewolf-arena/game-contract";
import {
  SHAPESHIFTER_EVENT_TYPES,
  readShapeshifterEventFact,
  readShapeshifterChoiceTool,
} from "@ai-werewolf-arena/game-contract/facts/shapeshifter";

export function validateInitialIdentityRecord(record: ReproductionRecord): void {
  const m = record.metadata,
    hasThief = m.normalizedBoard.roleSetups.some((row) => row.role === Role.Thief && row.count > 0),
    hasShape = m.normalizedBoard.roleSetups.some(
      (row) => row.role === Role.Shapeshifter && row.count > 0,
    ),
    identity = hasShape ? Role.Shapeshifter : Role.Thief;
  if (hasShape && hasThief) throw new Error("reproduction_initial_identity_owners_invalid");
  const fail = () => {
    throw new Error(
      hasShape ? "reproduction_shapeshifter_state_invalid" : "reproduction_thief_state_invalid",
    );
  };
  if (
    !hasShape &&
    (record.events.some((e) => (SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(e.type)) ||
      record.decisions.some(
        (d) =>
          d.stage === "shapeshifter" ||
          d.request.context.stage === "shapeshifter" ||
          d.request.allowedTools.includes("choose_shapeshifter_card") ||
          (d.outcome.kind === "action" && d.outcome.action?.name === "choose_shapeshifter_card"),
      ) ||
      record.checkpoints.some((c) =>
        c.players.some((p) => p.privateState.shapeshifter !== undefined),
      ))
  )
    fail();
  if (!hasThief && !hasShape) {
    if (
      m.initialDeal !== undefined ||
      record.checkpoints.some(
        (c) => c.thiefSetup !== undefined || c.shapeshifterSetup !== undefined,
      ) ||
      record.events.some((e) => (SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(e.type))
    )
      fail();
    return;
  }
  const initial = m.initialDeal,
    n = m.normalizedBoard.boardSize;
  if (!initial || initial.length !== n + 2 || m.players.length !== n) return fail();
  const deck = m.normalizedBoard.roleSetups.flatMap((row) => Array<Role>(row.count).fill(row.role));
  deck.push(Role.Villager, Role.Villager);
  if (
    [...initial].sort().join(",") !== deck.sort().join(",") ||
    initial.filter((role) => role === identity).length !== 1
  )
    fail();
  const supported = [
    identity,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Idiot,
  ];
  if (
    initial.some((role) => !supported.includes(role)) ||
    m.players.some(
      (p, i) => p.role !== initial[i] || p.camp !== (p.role === Role.Wolf ? Camp.Wolf : Camp.Good),
    )
  )
    fail();
  const actorIndex = initial.slice(0, n).indexOf(identity),
    actorId = actorIndex < 0 ? null : m.players[actorIndex]!.id;
  const originalIds = Array.from({ length: n + 2 }, (_, i) => `deal:${i}`);
  let previousStatus: string | undefined, previousSelection: string | undefined;
  for (const checkpoint of record.checkpoints) {
    if (hasShape ? checkpoint.thiefSetup !== undefined : checkpoint.shapeshifterSetup !== undefined)
      fail();
    const state = hasShape ? checkpoint.shapeshifterSetup : checkpoint.thiefSetup;
    if (!state || state.hands.length !== n || state.reserve.length !== 2) return fail();
    const cards = [...state.hands, ...state.reserve];
    if (
      new Set(cards.map((card) => card.cardId)).size !== n + 2 ||
      cards.some(
        (card) =>
          !originalIds.includes(card.cardId) ||
          initial[originalIds.indexOf(card.cardId)] !== card.role,
      )
    )
      fail();
    if (
      new Set(state.hands.map((hand) => hand.actorId)).size !== n ||
      state.hands.some((hand) => !m.players.some((p) => p.id === hand.actorId))
    )
      fail();
    const selection = state.selection;
    if (checkpoint.cycle > 0 && state.status === "pending") fail();
    if (checkpoint.cycle === 0 && (state.status !== "pending" || selection !== null)) fail();
    if (
      previousStatus &&
      previousStatus !== "pending" &&
      (state.status !== previousStatus || JSON.stringify(selection) !== previousSelection)
    )
      fail();
    previousStatus = state.status;
    previousSelection = JSON.stringify(selection);
    if (state.status !== "complete" && selection !== null) fail();
    if (state.status === "complete" && (actorId === null) !== (selection === null)) fail();
    if (
      selection &&
      (selection.actorId !== actorId ||
        (selection.slot === null
          ? selection.role !== identity
          : selection.role !== initial[n + selection.slot]))
    )
      fail();
    if (selection?.slot === null && initial[n] === Role.Wolf && initial[n + 1] === Role.Wolf)
      fail();
    if (
      hasShape &&
      selection &&
      (selection.slot === null ||
        ([initial[n], initial[n + 1]].includes(Role.Wolf) && selection.role !== Role.Wolf))
    )
      fail();
    for (let i = 0; i < n; i++) {
      const player = m.players[i]!,
        hand = state.hands.find((h) => h.actorId === player.id),
        current = checkpoint.players.find((p) => p.id === player.id);
      const expected =
        i === actorIndex && selection?.slot !== undefined && selection.slot !== null
          ? `deal:${n + selection.slot}`
          : `deal:${i}`;
      if (
        !hand ||
        !current ||
        hand.cardId !== expected ||
        current.role !== hand.role ||
        current.camp !== (hand.role === Role.Wolf ? Camp.Wolf : Camp.Good)
      )
        fail();
    }
    for (const slot of [0, 1] as const) {
      const expected = selection?.slot === slot ? `deal:${actorIndex}` : `deal:${n + slot}`;
      if (state.reserve[slot].cardId !== expected) fail();
    }
  }
  if (hasShape) {
    if (
      record.decisions.some(
        (d) =>
          d.stage === "thief" ||
          d.request.context.stage === "thief" ||
          d.request.allowedTools.includes("choose_thief_card") ||
          (d.outcome.kind === "action" && d.outcome.action?.name === "choose_thief_card"),
      )
    )
      fail();
    const facts = record.events.filter((e) =>
      (SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(e.type),
    );
    if (
      record.events.some(
        (e) => e.type === "thief_initial_deal" || e.type === "thief_identity_chosen",
      ) ||
      facts.some((e) => !readShapeshifterEventFact(e.type, e.payload))
    )
      fail();
    const deals = facts.filter((e) => e.type === "shapeshifter_initial_deal"),
      choices = facts.filter((e) => e.type === "shapeshifter_identity_chosen"),
      decisions = record.decisions.filter(
        (d) =>
          d.stage === "shapeshifter" ||
          d.request.context.stage === "shapeshifter" ||
          d.request.allowedTools.includes("choose_shapeshifter_card") ||
          (d.outcome.kind === "action" && d.outcome.action?.name === "choose_shapeshifter_card"),
      );
    if (
      deals.length !== 1 ||
      JSON.stringify(deals[0]!.payload.roles) !== JSON.stringify(initial) ||
      deals[0]!.payload.boardSize !== n ||
      choices.length > 1 ||
      decisions.length > (actorId === null ? 0 : 1)
    )
      fail();
    if (
      decisions.some(
        (d) =>
          d.stage !== "shapeshifter" ||
          d.actorId !== actorId ||
          d.request.actorId !== d.actorId ||
          d.request.context.day !== d.day ||
          d.request.context.stage !== "shapeshifter" ||
          d.day !== 1 ||
          d.request.phase !== Phase.Night ||
          d.request.allowedTools.length !== 1 ||
          d.request.allowedTools[0] !== "choose_shapeshifter_card" ||
          d.request.context.allow_fallback !== false ||
          d.request.context.action_failure_policy !== "error" ||
          d.request.context.turn_constraints.min_valid_actions !== 1 ||
          d.request.context.turn_constraints.max_valid_actions !== 1 ||
          JSON.stringify(d.request.context.turn_constraints.required_any_tools) !==
            JSON.stringify(["choose_shapeshifter_card"]),
      )
    )
      fail();
    if (choices.length) {
      const choice = choices[0]!.payload,
        decision = decisions[0],
        call =
          decision?.outcome.kind === "action"
            ? readShapeshifterChoiceTool(decision.outcome.action)
            : null;
      if (
        !decision ||
        decision.outcome.kind !== "action" ||
        !call ||
        call.args.slot !== choice.slot ||
        choice.actorId !== actorId ||
        choice.role !== initial![n + (choice.slot as number)] ||
        ([initial![n], initial![n + 1]].includes(Role.Wolf) && choice.role !== Role.Wolf)
      )
        fail();
    }
    for (const checkpoint of record.checkpoints) {
      const state = checkpoint.shapeshifterSetup!,
        selection = state.selection;
      const seen = record.events
        .slice(0, checkpoint.eventCount)
        .filter((e) => e.type === "shapeshifter_identity_chosen");
      if (
        seen.length !== (selection ? 1 : 0) ||
        (selection &&
          (seen[0]!.payload.slot !== selection.slot ||
            seen[0]!.payload.actorId !== selection.actorId))
      )
        fail();
      for (const player of checkpoint.players) {
        const expectedCamp = player.role === Role.Wolf ? Camp.Wolf : Camp.Good;
        if (
          JSON.stringify(player.victory.affiliations) !==
          JSON.stringify([{ kind: "faction", faction: expectedCamp }])
        )
          fail();
        const resource = player.privateState.shapeshifter;
        if (player.role === Role.Shapeshifter) {
          if (
            !resource ||
            typeof resource !== "object" ||
            Array.isArray(resource) ||
            Object.keys(resource).sort().join(",") !== "choice,policy,remaining" ||
            (resource as any).policy !== "awa_netease_shapeshifter_two_extra_villagers_v1" ||
            (resource as any).choice !== null ||
            (resource as any).remaining !== (state.status === "pending" ? 1 : 0)
          )
            fail();
        } else if (resource !== undefined) fail();
      }
    }
  }
}
