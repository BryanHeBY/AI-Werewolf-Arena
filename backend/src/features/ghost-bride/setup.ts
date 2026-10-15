/**
 * 负责通过原婚礼 authority 顺序收集鬼魂新娘的新郎／见证人选择。
 * 输入为只读板子政策、当前阵容和引擎请求；输出为设置事实或中断结果，回合由原 owner 关闭。
 * 此协调器不改规则或绕过身份、失败及期限校验，每次请求保留原 new 点与 opaque turn。
 * 构造依赖只晚读实际类，base只传对象引用；内层turn与外层setup仍各按原 finally 关闭，不补交失败选择。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { GHOST_BRIDE_POLICY, readWeddingTool } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import {
  Phase,
  type World,
  type GameEvent,
  type ActionProvider,
  type ActionRequest,
  type ActionStage,
  type ToolName,
} from "../../domain";
import type { ActionRequestFactoryConstructorPort } from "../../domain/actions";
import type { ToolGateway } from "../../engine/actions/tool-gateway";
import {
  beginWeddingSetup,
  openWeddingTurn,
  closeWeddingTurn,
  closeWeddingSetup,
  ghostBrideReady,
  weddingSetup,
  weddingPair,
  weddingGroup,
  weddingActorView,
  weddingNightCapture,
  authorizedWeddingTurn,
  commitWeddingTool,
  takeWeddingChat,
} from "./authority";
/** 装配依赖晚提供类，每次仍 new 原参数的工厂；opaque 原回合仍由 authority 校验，不启用 fallback。 */
export async function executeWeddingTurn(input: {
  world: World;
  gateway: ToolGateway;
  events: GameEvent[];
  provider: ActionProvider;
  day: number;
  actorId: number;
  kind: "bridegroom" | "chat" | "witness" | "knife";
  tool: ToolName;
  stage: ActionStage;
  isCurrent: () => boolean;
  construction: { readonly requestFactory: ActionRequestFactoryConstructorPort };
}): Promise<void> {
  const { world, gateway, events, provider, day, actorId, kind, tool, stage, isCurrent } = input;
  const scope = openWeddingTurn(world, kind, actorId, day, isCurrent);
  try {
    const view = weddingActorView(world, actorId);
    // opaque turn 已开、原 view 已读后才查类；失败仍在原 try 内关闭此 turn。
    const request = new input.construction.requestFactory(world, events, day).create({
      phase: Phase.Night,
      actorId,
      allowedTools: [tool],
      stage,
      requiresAction: true,
      summary: { key: "request.summary.night_action" },
      context: {
        allow_fallback: false,
        action_failure_policy: "error",
        ...(kind === "witness" && view && "proposedWitnessId" in view
          ? { proposedWitnessId: view.proposedWitnessId }
          : {}),
      },
    });
    // 原 provider receiver／callee 先准备，新增 Reflect／bind 查找也在末守卫前；不提前调用候选动作。
    // 已观察的 turn 失效不能继续发请求；builder 后新增这次当前性／时钟读取是 F02 政策。
    const getAction = provider.getAction,
      invoke = Reflect.apply.bind(Reflect),
      args: [ActionRequest] = [request];
    if (!authorizedWeddingTurn(world, actorId, Phase.Night, day, scope))
      throw new Error("ghost_bride_turn_revoked");
    const raw = await invoke(getAction, provider, args);
    if (!authorizedWeddingTurn(world, actorId, Phase.Night, day, scope))
      throw new Error("ghost_bride_turn_revoked");
    const call = readWeddingTool(raw);
    if (!call || call.name !== tool) throw new Error("ghost_bride_required_action_missing");
    const valid = gateway.validateAndSanitize(world, actorId, call, {
      phase: Phase.Night,
      day,
      ghostBrideScope: scope,
      deferOperation: true,
    });
    if (!valid.ok || !valid.sanitizedCall) throw new Error("ghost_bride_action_invalid");
    const committed = commitWeddingTool(scope, call);
    const pair = weddingPair(world);
    if (!pair) throw new Error("ghost_bride_pair_unavailable");
    if (kind === "bridegroom" && committed)
      events.push({
        timestamp: Date.now(),
        type: "ghost_bride_pair_chosen",
        payload: { ...pair },
        audience: Object.freeze([pair.brideId, pair.groomId].sort((a, b) => a - b)),
      });
    if (kind === "witness" && call.name === "choose_wedding_witness") {
      const votes = weddingSetup(world)!.witnessVotes;
      if (votes.some((v) => v.actorId === actorId && v.targetId === call.args.target_id))
        events.push({
          timestamp: Date.now(),
          type: "ghost_bride_witness_vote",
          payload: {
            policy: GHOST_BRIDE_POLICY,
            groupId: pair.groupId,
            day: 1,
            actorId,
            targetId: call.args.target_id,
            voteIndex: votes.length as 1 | 2,
          },
          audience: Object.freeze([]),
        });
      const group = weddingGroup(world);
      if (committed && group)
        events.push({
          timestamp: Date.now(),
          type: "ghost_bride_group_chosen",
          payload: { ...group },
          audience: Object.freeze(
            [group.brideId, group.groomId, group.witnessId].sort((a, b) => a - b),
          ),
        });
    }
    if (
      kind === "knife" &&
      committed &&
      (call.name === "kill_vote" || call.name === "wedding_kill_vote")
    ) {
      const capture = weddingNightCapture(world, day)!;
      if (capture.owner === "none") throw new Error("ghost_bride_knife_owner_invalid");
      events.push({
        timestamp: Date.now(),
        type: "ghost_bride_knife_vote",
        payload: {
          policy: GHOST_BRIDE_POLICY,
          groupId: pair.groupId,
          day,
          owner: capture.owner,
          actorId,
          targetId: call.args.target_id,
          abstain: call.args.abstain,
        },
        audience: Object.freeze(capture.owner === "ordinary_pack" ? [] : [actorId]),
      });
      if (capture.owner === "ordinary_pack")
        events.push({
          timestamp: Date.now(),
          type: "wolf_kill_vote_cast",
          payload: { actorId, targetId: call.args.target_id, abstain: call.args.abstain },
          audience: Object.freeze([...capture.actorIds].sort((a, b) => a - b)),
        });
    }
    const actualDisagreement =
      kind === "witness" &&
      call.name === "choose_wedding_witness" &&
      weddingSetup(world)!.witnessVotes.some(
        (v) => v.actorId === actorId && v.targetId === call.args.target_id,
      );
    const recordCommit = () =>
      safeRecordLogicOp({
        scope: "gateway",
        op: "validate_tool_call",
        actorId,
        phase: Phase.Night,
        status: "ok",
        input: { tool: call.name, args: call.args },
      });
    if (kind !== "chat" && (committed || actualDisagreement)) recordCommit();
    if (!committed) throw new Error("ghost_bride_action_commit_failed");
    if (kind === "chat") {
      const message = takeWeddingChat(scope);
      if (!message) throw new Error("ghost_bride_chat_delivery_revoked");
      recordCommit();
      events.push({
        timestamp: Date.now(),
        type: "ghost_bride_partner_chat",
        payload: { policy: GHOST_BRIDE_POLICY, groupId: pair.groupId, ...message },
        audience: Object.freeze([message.actorId, message.recipientId].sort((a, b) => a - b)),
      });
    }
  } finally {
    closeWeddingTurn(scope);
  }
}
export class GhostBrideSetupWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
    private readonly events: GameEvent[],
    /** 保存引用；下方 base 的展开不会读取真正构造器。 */
    private readonly construction: { readonly requestFactory: ActionRequestFactoryConstructorPort },
  ) {}
  async execute(
    config: ReadonlyBoardConfig,
    provider: ActionProvider,
    day: number,
    isCurrent: () => boolean,
  ): Promise<boolean> {
    if (ghostBrideReady(this.world)) return true;
    const setup = weddingSetup(this.world);
    if (!setup || setup.status !== "pending" || day !== 1)
      throw new Error("ghost_bride_setup_unavailable");
    try {
      beginWeddingSetup(this.world, config, isCurrent);
      const base = {
        world: this.world,
        gateway: this.gateway,
        events: this.events,
        provider,
        day,
        isCurrent,
        // 普通数据字段仅传依赖对象；...base 不触发其 requestFactory getter。
        construction: this.construction,
      };
      await executeWeddingTurn({
        ...base,
        actorId: setup.actorId,
        kind: "bridegroom",
        tool: "choose_bridegroom",
        stage: "ghost_bride_groom",
      });
      const pair = weddingPair(this.world)!;
      for (const actorId of [pair.brideId, pair.groomId])
        await executeWeddingTurn({
          ...base,
          actorId,
          kind: "chat",
          tool: "speak_to_partner",
          stage: "ghost_bride_chat",
        });
      for (const actorId of [pair.brideId, pair.groomId])
        await executeWeddingTurn({
          ...base,
          actorId,
          kind: "witness",
          tool: "choose_wedding_witness",
          stage: "ghost_bride_witness",
        });
      if (!isCurrent() || !ghostBrideReady(this.world))
        throw new Error("ghost_bride_setup_revoked");
      return true;
    } finally {
      closeWeddingSetup(this.world, isCurrent() ? "failed" : "cancelled");
    }
  }
}
