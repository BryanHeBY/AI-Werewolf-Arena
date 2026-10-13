/**
 * 负责独立审核红月延迟、转换与胜利前缀。输入为归档配置、决定、事实与 checkpoint；
 * 输出为独立重建的审计结果或原拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import { isRedMoonPreset } from "../verification/board-support";
import {
  readRedMoonNextNightFact,
  readRedMoonExpiryFact,
} from "@ai-werewolf-arena/game-contract/facts/red-moon";
import { Camp, Role, Phase, DeathCause } from "@ai-werewolf-arena/game-contract";
import type { ReproductionRecord } from "./reproduction";
const roleId = "red_moon_apostle";
const factTypes = new Set([
  "red_moon_night_sealed",
  "red_moon_exile_delayed",
  "red_moon_delay_expired",
]);
interface State {
  policy: "awa_red_moon_demon_v1";
  lastWolfBlastPolicy: "ends_game" | "forbidden";
  blastDay: number | null;
  exileDay: number | null;
  expirySettled: boolean;
}
export interface RedMoonRecordAudit {
  sealedNights: ReadonlySet<number>;
  expiredNights: ReadonlyMap<number, number>;
  stateAt(eventCount: number): State;
  idiotRevealedAt(eventCount: number): boolean;
}
function assert(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_red_moon_state_invalid");
}
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
/** 重建有限板子的公开状态迁移，不直接信任 checkpoint 中的库存。 */
export function validateRedMoonRecord(record: ReproductionRecord): RedMoonRecordAudit | null {
  const board = record.metadata.normalizedBoard;
  const owns = board.roleSetups.some((r) => String(r.role) === roleId && r.count > 0);
  const artifacts =
    record.events.some((e) => factTypes.has(e.type)) ||
    record.operations.some((o) => o.op === "red_moon_expiry_settled") ||
    record.checkpoints.some((cp) =>
      cp.players.some((p) => Object.hasOwn(p.privateState, "redMoon")),
    );
  if (!owns) {
    assert(!artifacts && !board.redMoon);
    return null;
  }
  assert(isRedMoonPreset(board) && !record.metadata.faultPlan && !record.metadata.initialDeal);
  const players = record.metadata.players,
    original = new Map(players.map((p) => [p.id, p]));
  const red = players.filter((p) => String(p.role) === roleId),
    idiots = players.filter((p) => p.role === Role.Idiot);
  assert(red.length === 1 && idiots.length === 1 && original.size === 12);
  const actorId = red[0]!.id,
    idiotId = idiots[0]!.id;
  const state: State = {
    policy: "awa_red_moon_demon_v1",
    lastWolfBlastPolicy: board.redMoon!.lastWolfBlastPolicy,
    blastDay: null,
    exileDay: null,
    expirySettled: false,
  };
  const states: State[] = [{ ...state }],
    idiotStates = [false];
  const alive = new Set(players.map((p) => p.id)),
    sealedNights = new Set<number>(),
    expiredNights = new Map<number, number>();
  const frozen = record.operations.filter((o) => o.op === "demon_hunter_sources_frozen");
  const expiryOps = record.operations.filter((o) => o.op === "red_moon_expiry_settled");
  let day = 1,
    phase: string = Phase.Night,
    voteTarget: number | null = null,
    idiotRevealed = false;
  let pendingSeal: number | null = null;
  const wolfCount = () => [...alive].filter((id) => original.get(id)?.camp === Camp.Wolf).length;
  const ordinaryAlive = (night: number) => {
    const op = frozen.find((o) => o.output?.day === night);
    assert(op && Array.isArray(op.output?.deaths));
    const ids = op.output.deaths as unknown[];
    assert(ids.every((id) => typeof id === "number" && original.has(id)));
    const remaining = new Set(alive);
    for (const id of ids) remaining.delete(id as number);
    return remaining;
  };
  const goodSidesRemain = (remaining: Set<number>) =>
    [...remaining].some((id) => original.get(id)?.role === Role.Villager) &&
    [...remaining].some(
      (id) => original.get(id)?.camp === Camp.Good && original.get(id)?.role !== Role.Villager,
    );
  for (let index = 0; index < record.events.length; index++) {
    const e = record.events[index]!;
    if (pendingSeal !== null) assert(e.type === "red_moon_night_sealed");
    if (e.type === "phase_changed") {
      assert(
        typeof e.payload.day === "number" &&
          Number.isSafeInteger(e.payload.day) &&
          e.payload.day > 0,
      );
      day = e.payload.day;
      phase = String(e.payload.phase);
      voteTarget = null;
    }
    if (e.type === "vote_summary") {
      assert(
        phase === Phase.Voting &&
          (e.payload.target === null || typeof e.payload.target === "number"),
      );
      voteTarget = e.payload.target as number | null;
    }
    if (e.type === "wolf_self_destruct") {
      const id = e.payload.wolfId;
      assert(typeof id === "number" && alive.has(id) && original.get(id)?.camp === Camp.Wolf);
      if (id === actorId) {
        assert(
          (phase === Phase.Day || phase === Phase.Voting) &&
            state.blastDay === null &&
            state.exileDay === null,
        );
        assert(wolfCount() > 1 || state.lastWolfBlastPolicy === "ends_game");
        pendingSeal = wolfCount() > 1 ? day : null;
        state.blastDay = day;
      }
      alive.delete(id);
    }
    if (e.type === "red_moon_night_sealed") {
      const fact = readRedMoonNextNightFact(e.type, e.payload);
      assert(
        fact &&
          fact.actorId === actorId &&
          fact.day === day &&
          pendingSeal === day &&
          record.events[index - 1]?.type === "wolf_self_destruct" &&
          record.events[index - 1]?.payload.wolfId === actorId &&
          !sealedNights.has(fact.night),
      );
      sealedNights.add(fact.night);
      pendingSeal = null;
    }
    if (e.type === "red_moon_exile_delayed") {
      const fact = readRedMoonNextNightFact(e.type, e.payload);
      assert(
        fact &&
          fact.actorId === actorId &&
          fact.day === day &&
          phase === Phase.Voting &&
          voteTarget === actorId &&
          alive.has(actorId) &&
          wolfCount() === 1 &&
          state.blastDay === null &&
          state.exileDay === null,
      );
      state.exileDay = day;
    }
    if (e.type === "idiot_revealed") {
      assert(
        e.payload.targetId === idiotId &&
          phase === Phase.Voting &&
          voteTarget === idiotId &&
          alive.has(idiotId) &&
          !idiotRevealed,
      );
      idiotRevealed = true;
    }
    if (e.type === "voted_out") {
      const id = e.payload.target;
      assert(
        typeof id === "number" && alive.has(id) && phase === Phase.Voting && voteTarget === id,
      );
      assert(id !== idiotId && !(id === actorId && wolfCount() === 1));
      alive.delete(id);
    }
    if (e.type === "red_moon_delay_expired") {
      const fact = readRedMoonExpiryFact(e.type, e.payload);
      assert(
        fact &&
          fact.actorId === actorId &&
          fact.day === day &&
          phase === Phase.Night &&
          state.exileDay === day - 1 &&
          !state.expirySettled &&
          alive.has(actorId) &&
          !expiredNights.has(day),
      );
      if (record.finalized) {
        const remaining = ordinaryAlive(day);
        assert(remaining.has(actorId) && goodSidesRemain(remaining));
        const ops = expiryOps.filter((o) => o.output?.day === day),
          source = frozen.find((o) => o.output?.day === day)!;
        assert(ops.length === 1);
        const op = ops[0]!;
        assert(
          op.scope === "resolution" &&
            op.phase === Phase.Night &&
            op.status === "ok" &&
            op.input === undefined &&
            equal(op.output, { actorId, day, cause: DeathCause.RedMoonExpiry }) &&
            record.operations.indexOf(source) < record.operations.indexOf(op),
        );
      }
      state.expirySettled = true;
      expiredNights.set(day, actorId);
    }
    if (e.type === "night_resolved") {
      assert(phase === Phase.Night && Array.isArray(e.payload.deaths));
      const deaths = e.payload.deaths as number[];
      assert(
        deaths.length === new Set(deaths).size &&
          deaths.every((id) => original.has(id) && alive.has(id)),
      );
      if (record.finalized) {
        const remaining = ordinaryAlive(day);
        const shouldExpire =
          state.exileDay === day - 1 && remaining.has(actorId) && goodSidesRemain(remaining);
        assert(expiredNights.has(day) === shouldExpire);
        if (shouldExpire) assert(deaths.includes(actorId));
      }
      for (const id of deaths) alive.delete(id);
    }
    if (factTypes.has(e.type)) assert(e.audience === undefined);
    states.push({ ...state });
    idiotStates.push(idiotRevealed);
  }
  if (record.finalized) {
    assert(expiryOps.length === expiredNights.size);
    if (record.checkpoints.at(-1)?.complete) assert(pendingSeal === null);
  }
  for (const d of record.decisions) {
    if (sealedNights.has(d.day)) assert(!["seer", "witch", "demon_hunter"].includes(d.stage));
    for (const e of d.request.context.visible_events) {
      if (!factTypes.has(e.type)) continue;
      assert(
        record.events.some((source) => source.type === e.type && equal(source.payload, e.payload)),
      );
    }
  }
  return {
    sealedNights,
    expiredNights,
    stateAt(count) {
      assert(Number.isSafeInteger(count) && count >= 0 && count < states.length);
      return { ...states[count]! };
    },
    idiotRevealedAt(count) {
      assert(Number.isSafeInteger(count) && count >= 0 && count < idiotStates.length);
      return idiotStates[count]!;
    },
  };
}
