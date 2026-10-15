/**
 * 负责一局复现请求的开启、结算、事件快照与终结记录；本实例唯一拥有对应轨迹状态。
 * 输入为元数据、原请求、实际 provider 和事件读取回调；输出为本构建 schema 3 Tape 与游标，历史读取另由格式 owner 保留。
 * 结果复制并核对原请求后，在其 delivery scope 登记结算；返回行动可以先于回调，结算回执不表示资源付款。
 * 状态先写入再通知录制器，通知失败不回滚已写前缀；终结保留不完整与 pending 的原拒绝顺序。
 * Node 对象检查仅处理 provider 数据，不进入共享浏览器契约；不控制阶段、持久化文件或复盘版本。
 */
import { types } from "node:util";
import { Camp, type ToolCall } from "@ai-werewolf-arena/game-contract";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract/requests";
import type { ActionProvider } from "../../domain/actions";
import { assertRequestDelivery, deferRequestDelivery } from "../../domain/request-delivery";
import {
  REPRODUCTION_SCHEMA_VERSION,
  parseReproductionRecord,
  recordedErrorName,
  type RecordedDecision,
  type RecordedCheckpoint,
  type RecordedGameEvent,
  type RecordedErrorName,
  type ReproductionFailureScope,
  type ReproductionMetadata,
  type ReproductionRecord,
} from "./format";

/** deadline 是本轮运行时条件；归档只复制原请求事实，不替换 provider 收到的原对象。 */
export function normalizedRequest(request: ActionRequest): Omit<ActionRequest, "deadlineAtMs"> {
  const { deadlineAtMs: _deadline, ...facts } = request;
  return structuredClone(facts);
}

/** 复制 provider 数据时，不触发 getter、Proxy trap 或自定义序列化。 */
function copyDecisionData(value: unknown, depth = 0): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  if (
    !value ||
    typeof value !== "object" ||
    depth > 32 ||
    types.isProxy(value) ||
    Object.getOwnPropertySymbols(value).length
  )
    throw new Error("reproduction_action_not_data");
  const array = Array.isArray(value),
    proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
    throw new Error("reproduction_action_not_plain");
  const fields = Object.getOwnPropertyDescriptors(value),
    copy: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (array && key === "length") continue;
    if (!field.enumerable || !Object.hasOwn(field, "value"))
      throw new Error("reproduction_action_accessor");
    Object.defineProperty(copy, key, {
      value: copyDecisionData(field.value, depth + 1),
      enumerable: true,
    });
  }
  if (!array) return copy;
  const length = fields.length?.value;
  if (
    !Number.isSafeInteger(length) ||
    length > 1024 ||
    Object.keys(copy).length !== length ||
    !Array.from({ length }, (_, i) => Object.hasOwn(copy, i)).every(Boolean)
  )
    throw new Error("reproduction_action_array");
  return Array.from({ length }, (_, i) => copy[i]);
}

export class ReproductionTrace {
  // 元数据与七个可变载体共同持有本局因果；事件只在 checkpoint／build 时复制，游标不借用管理器状态。
  private readonly decisions: RecordedDecision[] = [];
  private readonly checkpoints: RecordedCheckpoint[] = [];
  private events: RecordedGameEvent[] = [];
  private settled = 0;
  private invalid = false;
  private readonly errors: Array<{ scope: ReproductionFailureScope; name: RecordedErrorName }> = [];
  private readonly turns = new Map<string, number>();
  constructor(
    private readonly metadata: ReproductionMetadata,
    private readonly onChange: () => void,
    private readonly liveEvents?: () => readonly GameEvent[],
  ) {
    this.metadata = structuredClone(metadata);
  }

  /** 录制协作只复制本实例首次捕获的来源；不重读 caller getter、liveEvents 或返回可写原体。 */
  recordedMetadataIdentity(): Pick<ReproductionMetadata, "engine" | "random" | "ruleset"> {
    return structuredClone({
      engine: this.metadata.engine,
      random: this.metadata.random,
      ruleset: this.metadata.ruleset,
    });
  }

  get settlementCount(): number {
    return this.settled;
  }
  get decisionCount(): number {
    return this.decisions.length;
  }
  get ownedEventCursor(): number | undefined {
    return this.metadata.normalizedBoard.awakenedWolfKing ||
      this.metadata.normalizedBoard.warden ||
      this.metadata.normalizedBoard.silenceElder ||
      this.metadata.normalizedBoard.nobleSecretBody ||
      this.metadata.normalizedBoard.fragrantPairSeer ||
      this.metadata.normalizedBoard.animalDream
      ? (this.liveEvents?.().length ?? this.events.length)
      : undefined;
  }
  async decide(request: ActionRequest, provider: ActionProvider): Promise<ToolCall | null> {
    const key = `${request.actorId}/${request.context.day}/${request.context.stage}`;
    const turn = (this.turns.get(key) ?? 0) + 1;
    this.turns.set(key, turn);
    const entry: RecordedDecision = {
      actorId: request.actorId,
      day: request.context.day,
      stage: request.context.stage,
      turn,
      request: normalizedRequest(request),
      openedAfterSettlement: this.settled,
      ...(this.ownedEventCursor === undefined ? {} : { openedAtEventCount: this.ownedEventCursor }),
      outcome: { kind: "pending" },
    };
    // 开启先提交计数和 pending 前缀；通知抛错时不调用 provider，也不回滚该前缀。
    this.decisions.push(entry);
    this.onChange();
    try {
      const action = await provider.getAction(request);
      const recordedAction = copyDecisionData(action) as ToolCall | null;
      assertRequestDelivery(request);
      // 请求原体的 delivery scope 决定何时结算；正常返回 action 仍可能留下 pending。
      const settle = (accepted: boolean) => {
        // 只在实际 false-close 保留此前 copyDecisionData 已成功返回的候选，包括 null。
        // 这份事实不把 error 改成接受；真 Provider 抛错和交付检查早抛仍不产生该字段。
        if (!accepted) entry.returnedCandidate = recordedAction;
        entry.outcome = accepted
          ? { kind: "action", action: recordedAction }
          : { kind: "error", code: "decision_failed", name: "Error" };
        entry.settleOrder = ++this.settled;
        this.onChange();
      };
      if (!deferRequestDelivery(request, settle)) settle(true);
      return recordedAction;
    } catch (error) {
      // 同步 settle 的通知也在此 try 内：通知抛错后写 error 并再次增加结算计数，再通知。
      // deferred 回调在未来调用时才执行，异常不会回到本 try；保留原边界与已写前缀。
      // 传输错误文本可能含认证凭证；只保留可复现的失败信息，原始消息不入档。
      entry.outcome = { kind: "error", code: "decision_failed", name: recordedErrorName(error) };
      entry.settleOrder = ++this.settled;
      this.onChange();
      throw error;
    }
  }

  invalidate(): void {
    this.invalid = true;
    this.onChange();
  }

  noteFailure(scope: ReproductionFailureScope, error: unknown): void {
    this.errors.push({ scope, name: recordedErrorName(error) });
    this.onChange();
  }

  checkpoint(checkpoint: RecordedCheckpoint, events: readonly GameEvent[]): void {
    if (events.length !== checkpoint.eventCount)
      throw new Error("reproduction_checkpoint_events_mismatch");
    // 数量不匹配须在任何写入之前拒绝；带机制的 checkpoint 追加当前决定／结算计数。
    this.checkpoints.push(
      structuredClone(
        this.metadata.normalizedBoard.awakenedWolfKing ||
          this.metadata.normalizedBoard.warden ||
          this.metadata.normalizedBoard.silenceElder ||
          checkpoint.animalDream ||
          checkpoint.nobleBody ||
          checkpoint.fragrantPair
          ? { ...checkpoint, settlementCount: this.settled, decisionCount: this.decisions.length }
          : checkpoint,
      ),
    );
    this.events = structuredClone(
      events.map(({ payload, ...event }) => ({ ...event, payload: { ...payload } })),
    );
    this.onChange();
  }

  build(input?: {
    operations: ReproductionRecord["operations"];
    termination: { reason: string; winner: Camp | null };
  }): ReproductionRecord {
    const currentEvents = this.liveEvents?.();
    if (currentEvents && currentEvents.length < (this.checkpoints.at(-1)?.eventCount ?? 0))
      throw new Error("reproduction_live_events_before_checkpoint");
    const record = {
      schemaVersion: REPRODUCTION_SCHEMA_VERSION,
      finalized: Boolean(input),
      metadata: this.metadata,
      decisions: this.decisions,
      checkpoints: this.checkpoints,
      events: currentEvents
        ? structuredClone(
            currentEvents.map(({ payload, ...event }) => ({ ...event, payload: { ...payload } })),
          )
        : this.events,
      operations: input?.operations ?? [],
      termination: input ? { ...input.termination, errors: this.errors } : null,
    };
    // 最终拒绝先看失效，再看 pending；错误账本仍按登记顺序输出。
    if (input && this.invalid) throw new Error("reproduction_trace_incomplete");
    if (input && this.decisions.some((entry) => entry.outcome.kind === "pending"))
      throw new Error("reproduction_decisions_pending");
    return parseReproductionRecord(record);
  }
}
