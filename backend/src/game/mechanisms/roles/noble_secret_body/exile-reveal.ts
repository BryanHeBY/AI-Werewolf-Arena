/**
 * 负责秘密之身放逐免死、公开翻牌与必需活人发言的完整同步交接。
 * 输入为原运行对象的晚读查询和已映射目标；输出原行动请求以及是否已处理放逐，不输出 JSON 租约。
 * 身体付款先于公开事实和必需录制；失败保留已付／已发布前缀，不重试或回滚。原权威独占资源和许可。
 * 生成器仅在原 Provider 等待点交出请求；调用方负责原唯一 await，拒绝时必须 return 进入已打开的 finally。
 * 非本族或不触发路径同步结束，不增加等待；发言复验、提交和关闭仍按原顺序执行。
 */
import { Phase } from "../../../../core/domain/identity";
import type { ActionRequest, ToolCall } from "@ai-werewolf-arena/game-contract";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import type { World } from "../../../../core/domain/world";
import type { GameActionRequestFactory } from "../../../engine/action_request_factory";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import { checkpointNobleBodyAuthority, consumeSecretBodyExile } from "./authority";
import {
  openNobleBodyRevealRequest,
  nobleBodyRequestScope,
  commitNobleBodyRevealSpeech,
  closeNobleBodyRequest,
} from "./requests";
import { getSessionRecorder } from "../../../../recording/recording_context";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";

/** 原对象的只读视图；getter 在原表达式位置读取，不缓存 World、日次、回调或工厂方法，也不授予许可。 */
export interface SecretBodyExileRevealQueries {
  readonly enabled: ReadonlyBoardConfig["nobleSecretBody"];
  readonly world: World;
  readonly events: GameEvent[];
  readonly requests: Pick<GameActionRequestFactory, "create">;
  readonly toolGateway: Pick<ToolGateway, "validateAndSanitize">;
  readonly day: number;
  readonly isCurrent: (() => boolean) | undefined;
}

/** false 表示继续普通放逐；true 表示已完成翻牌。暂停时仅交原请求，不能据请求副本代替当前 scope。 */
export function* revealSecretBodyExile(
  queries: SecretBodyExileRevealQueries,
  effectiveTarget: number,
): Generator<ActionRequest, boolean, ToolCall | null> {
  if (queries.enabled) {
    const owned = checkpointNobleBodyAuthority(queries.world, true);
    if (effectiveTarget === owned.bodyId && owned.body.body.kind === "intact") {
      // 先耗身，再发布与必需录制；这些失败仍处于打开发言 scope 之前。
      const receipt = consumeSecretBodyExile(queries.world, queries.day),
        payload = { policy: "awa_noble_secret_body_v1" as const, ...receipt };
      queries.events.push({ timestamp: Date.now(), type: "secret_body_revealed", payload });
      getSessionRecorder()?.recordRequiredLogicOp({
        scope: "resolution",
        op: "secret_body_revealed",
        actorId: receipt.actorId,
        phase: Phase.Voting,
        status: "ok",
        output: payload,
      });
      const request = queries.requests.create({
          actorId: receipt.actorId,
          phase: Phase.Voting,
          allowedTools: ["speak"],
          stage: "awakened_idiot_reveal_speech",
          requiresAction: true,
          summary: { key: "request.summary.secret_body_reveal" },
          context: { allow_fallback: false, action_failure_policy: "error" },
        }),
        scope = openNobleBodyRevealRequest(
          queries.world,
          queries.day,
          request,
          queries.isCurrent ?? (() => true),
        );
      try {
        // 这里只暂停，不调用 Provider；恢复后先复验原 scope，再校验和提交。
        const action = yield request;
        if (nobleBodyRequestScope(queries.world, request) !== scope || action?.name !== "speak")
          throw Error("secret_body_reveal_speech_required");
        const valid = queries.toolGateway.validateAndSanitize(queries.world, receipt.actorId, action, {
          phase: Phase.Voting,
          day: queries.day,
          deferOperation: true,
        });
        if (
          !valid.ok ||
          !valid.sanitizedCall ||
          nobleBodyRequestScope(queries.world, request) !== scope
        )
          throw Error("secret_body_reveal_speech_required");
        const spoken = commitNobleBodyRevealSpeech(queries.world, scope, valid.sanitizedCall);
        queries.events.push({
          timestamp: Date.now(),
          type: "secret_body_reveal_speech",
          payload: { policy: "awa_noble_secret_body_v1", ...spoken },
        });
        safeRecordLogicOp({
          scope: "gateway",
          op: "validate_tool_call",
          actorId: receipt.actorId,
          phase: Phase.Voting,
          status: "ok",
          input: { tool: "speak", args: { text: spoken.text } },
        });
      } finally {
        // 成功／复验错误均关闭一次；Provider 拒绝由调用方 return 驱动这里，关闭错误沿原 finally 优先。
        closeNobleBodyRequest(scope);
      }
      return true;
    }
  }
  return false;
}
