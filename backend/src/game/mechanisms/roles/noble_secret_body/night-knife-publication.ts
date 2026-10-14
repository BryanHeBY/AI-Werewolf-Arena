/**
 * 负责普通狼刀阶段末夜之贵族专用 God 事实与必需录制操作的完整同步发布。
 * 输入为原夜上下文的惰性查询与原未映射刀口；输出追加同一 payload 的事件和领域记录。
 * 先检查板子，再查原贵族编号和日次；events.push 方法先取得，再读时钟，事件先于必需记录。
 * 本模块不投票、映射、标死或付款；push／记录失败原样传播，保留此前印记、刀口和已发表前缀。
 */
import { Phase, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../core/domain/world";
import { getSessionRecorder } from "../../../../recording/recording_context";
import { checkpointNobleBodyAuthority, isNobleBodyBoard } from "./authority";

/** 仅原 World／事件引用和日次方法；只读字段不冻结数组，也不是新增的运行授权或记录镜像。 */
export interface NobleNightKnifePublicationRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  currentDay(): number;
}

/** 生产调用方的 context 闭包每次返回同一个 ctx；原 getter／currentDay receiver 在原字段点才读取。 */
export function publishNobleNightKnife(
  context: () => NobleNightKnifePublicationRuntime,
  targetId: number | null,
): void {
  if (isNobleBodyBoard(context().world)) {
    const actorId = checkpointNobleBodyAuthority(context().world, false).nobleId;
    const payload = {
      policy: "awa_noble_secret_body_v1" as const,
      actorId,
      day: context().currentDay(),
      targetId,
    };
    context().events.push({
      timestamp: Date.now(),
      type: "noble_body_knife_committed",
      payload,
      audience: Object.freeze([]),
    });
    // 事件已经追加；必需录制抛错不恢复此前刀口／印记或删除已发表事件。
    getSessionRecorder()?.recordRequiredLogicOp({
      scope: "phase_pipeline",
      op: "noble_body_knife_committed",
      phase: Phase.Night,
      status: "ok",
      output: payload,
    });
  }
}
