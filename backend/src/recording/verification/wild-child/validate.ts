/**
 * 负责独立重建野孩子的模范选择、原生命死亡来源和阵营激活。
 * 输入为归档事实、决定及 checkpoint；输出为原有因果与阵营状态校验。
 * 本 verifier 只推导归档纯数据，不导入 World、运行时权限、结算器或 checkpoint 写方。
 * 独立算法全文保持；原体、资源、关系和事件前缀仍按冻结归档规则审核，不驱动真实游戏。
 */
import type { ReproductionRecord } from "../../reproduction/format";
import { Role, Camp, Phase } from "@ai-werewolf-arena/game-contract";
import {
  WILD_CHILD_EVENT_TYPES,
  readWildChildEventFact,
} from "@ai-werewolf-arena/game-contract/facts/wild-child";

export function validateWildChildRecord(record: ReproductionRecord): void {
  const has = record.metadata.normalizedBoard.roleSetups.some(
    (row) => row.role === Role.WildChild && row.count === 1,
  );
  const fail: () => never = () => {
    throw new Error("reproduction_wild_child_state_invalid");
  };
  const facts = record.events.filter((e) =>
    (WILD_CHILD_EVENT_TYPES as readonly string[]).includes(e.type),
  );
  if (!has) {
    if (
      facts.length ||
      record.checkpoints.some((c) => c.players.some((p) => p.privateState.wildChild !== undefined))
    )
      fail();
    return;
  }
  const initial = record.metadata.players.filter((p) => p.role === Role.WildChild);
  if (
    initial.length !== 1 ||
    initial[0]!.camp !== Camp.Good ||
    !record.metadata.players.some((p) => p.role === Role.Wolf && p.camp === Camp.Wolf)
  )
    fail();
  const actorId = initial[0]!.id,
    ids = new Set(record.metadata.players.map((p) => p.id));
  let choice: { day: 1; targetId: number } | null = null,
    eligible: number | null = null,
    active: number | null = null,
    camp = Camp.Good;
  let cause: Record<string, unknown> | null = null,
    chosen = false,
    transformed = false,
    activated = false;
  const byCount = new Map<
    number,
    {
      choice: { day: 1; targetId: number } | null;
      eligible: number | null;
      active: number | null;
      camp: Camp;
      status: string;
    }
  >();
  byCount.set(0, { choice, eligible, active, camp, status: "pending" });
  const choiceDecisions = record.decisions.filter((d) => d.stage === "wild_child");
  if (
    choiceDecisions.length > 1 ||
    choiceDecisions.some(
      (d) =>
        d.actorId !== actorId ||
        d.day !== 1 ||
        d.request.phase !== Phase.Night ||
        d.request.context.allow_fallback !== false ||
        d.request.context.turn_constraints.min_valid_actions !== 1,
    )
  )
    fail();
  type NativeDeath = {
    root: number;
    wave: number;
    day: number;
    sources: readonly unknown[];
    phase: Phase;
  };
  const nativeDeaths = new Map<number, NativeDeath>();
  const nightOps = record.operations.filter(
    (op) => op.scope === "resolution" && op.op === "night_damage_resolved",
  );
  let nightIndex = 0;
  let eventDay = 1,
    eventPhase: Phase = Phase.Night;
  for (let index = 0; index < record.events.length; index++) {
    const event = record.events[index]!;
    if (event.type === "phase_changed") {
      eventDay = event.payload.day as number;
      eventPhase = event.payload.phase as Phase;
    }
    if (event.type === "night_resolved") {
      const output = nightOps[nightIndex++]?.output,
        deaths = event.payload.deaths;
      if (
        !Array.isArray(deaths) ||
        (record.finalized && (!output || !Array.isArray(output.deaths)))
      )
        fail();
      const sourceMap = output?.death_sources as Record<string, unknown> | undefined;
      for (const id of deaths as number[]) {
        const sources = sourceMap?.[id];
        if (
          record.finalized &&
          (!Array.isArray(sources) || !sources.length || !(output!.deaths as number[]).includes(id))
        )
          fail();
        nativeDeaths.set(id, {
          root: index,
          wave: 0,
          day: eventDay,
          sources: record.finalized ? (sources as unknown[]) : [],
          phase: Phase.Night,
        });
      }
    }
    if (event.type === "voted_out" && typeof event.payload.target === "number")
      nativeDeaths.set(event.payload.target, {
        root: index,
        wave: 0,
        day: eventDay,
        sources: ["exile"],
        phase: Phase.Voting,
      });
    if (event.type === "wolf_self_destruct" && typeof event.payload.wolfId === "number")
      nativeDeaths.set(event.payload.wolfId, {
        root: index,
        wave: 0,
        day: eventDay,
        sources: ["self_destruct"],
        phase: eventPhase,
      });
    if (
      event.type === "hunter_shot" &&
      typeof event.payload.hunterId === "number" &&
      typeof event.payload.targetId === "number"
    ) {
      const source = nativeDeaths.get(event.payload.hunterId);
      if (source && source.day === eventDay)
        nativeDeaths.set(event.payload.targetId, {
          ...source,
          wave: source.wave + 1,
          sources: ["shot"],
          phase: eventPhase,
        });
    }
    if ((WILD_CHILD_EVENT_TYPES as readonly string[]).includes(event.type)) {
      const p = readWildChildEventFact(event.type, event.payload);
      if (!p || p.actorId !== actorId) fail();
      if (event.type === "wild_child_model_chosen") {
        if (
          chosen ||
          eventDay !== 1 ||
          eventPhase !== Phase.Night ||
          !ids.has(p.targetId as number)
        )
          fail();
        const decision = choiceDecisions[0];
        if (
          !decision ||
          decision.outcome.kind !== "action" ||
          decision.outcome.action?.name !== "choose_wild_model" ||
          decision.outcome.action.args.target_id !== p.targetId
        )
          fail();
        chosen = true;
        choice = { day: 1, targetId: p.targetId as number };
      } else if (event.type === "wild_child_model_eliminated") {
        if (
          !choice ||
          cause ||
          p.targetId !== choice.targetId ||
          (p.deadIds as number[]).some((id) => !ids.has(id))
        )
          fail();
        const actual = nativeDeaths.get(p.targetId as number);
        if (
          !actual ||
          actual.day !== p.day ||
          actual.phase !== p.phase ||
          (record.finalized &&
            JSON.stringify([...actual.sources].sort()) !==
              JSON.stringify([...(p.sources as string[])].sort()))
        )
          fail();
        const wave = [...nativeDeaths]
          .filter(
            ([, d]) => d.root === actual.root && d.wave === actual.wave && d.day === actual.day,
          )
          .map(([id]) => id)
          .sort((a, b) => a - b);
        if (
          JSON.stringify(wave) !==
          JSON.stringify([...(p.deadIds as number[])].sort((a, b) => a - b))
        )
          fail();
        cause = p;
      } else if (event.type === "wild_child_transformed") {
        if (
          !choice ||
          !cause ||
          transformed ||
          p.deathCommit !== cause.deathCommit ||
          p.day !== cause.day ||
          (cause.deadIds as number[]).includes(actorId) ||
          eventDay !== p.day
        )
          fail();
        transformed = true;
        eligible = p.eligibleNight as number;
        camp = Camp.Wolf;
      } else {
        if (
          !transformed ||
          activated ||
          eventPhase !== Phase.Night ||
          p.eligibleNight !== eligible ||
          p.day !== eventDay ||
          eventDay < eligible!
        )
          fail();
        activated = true;
        active = p.day as number;
      }
    }
    byCount.set(index + 1, {
      choice: choice ? { ...choice } : null,
      eligible,
      active,
      camp,
      status: activated ? "active" : transformed ? "transformed" : chosen ? "chosen" : "pending",
    });
  }
  for (const checkpoint of record.checkpoints) {
    const player = checkpoint.players.find((p) => p.id === actorId),
      expected = byCount.get(checkpoint.eventCount);
    if (
      !player ||
      !expected ||
      player.role !== Role.WildChild ||
      player.camp !== expected.camp ||
      JSON.stringify(player.victory.affiliations) !==
        JSON.stringify([{ kind: "faction", faction: expected.camp }])
    )
      fail();
    const state = player.privateState.wildChild as Record<string, unknown> | undefined;
    if (
      !state ||
      Object.keys(state).sort().join(",") !==
        ["policy", "remaining", "status", "choice", "eligibleNight", "activeFromNight"]
          .sort()
          .join(",") ||
      state.policy !== "awa_lui_meme_wild_child_v1" ||
      JSON.stringify(state.choice) !== JSON.stringify(expected.choice) ||
      state.eligibleNight !== expected.eligible ||
      state.activeFromNight !== expected.active
    )
      fail();
    const closed = expected.status === "pending" && checkpoint.cycle > 0 && !checkpoint.complete;
    if (
      state.status !== (closed ? "closed" : expected.status) ||
      state.remaining !== (expected.status === "pending" && !closed ? 1 : 0) ||
      (checkpoint.cycle === 0 && (expected.status !== "pending" || !player.alive)) ||
      (checkpoint.complete && checkpoint.cycle > 0 && expected.status === "pending")
    )
      fail();
  }
}
