/**
 * 负责收集河豚反噬选择，输入为 World、事件数组、Provider／网关、日期与原单元对象。
 * 当前单元／actor 及绑定请求决定资格；校验后先提交回执，再按原票型政策发表揭示与目标。
 * 输出为捕获的目标数组；成功建立 scope 并进入原 try 后才由 finally 关闭，库存及原票源归 authority，不提交死亡波。
 * 不变量：无待选 actor 不读取构造依赖；有效 actor 后在原点 new 原独立工厂，不复用 Voting 的普通投票工厂。
 */
import { ANIMAL_DREAM_POLICY } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../domain/world";
import type { ActionProvider } from "../../../../domain/actions";
import type { GameEvent } from "../../../../domain/events";
import { Phase } from "../../../../domain/identity";
import type { ActionRequestFactoryConstructorPort } from "../../../../domain/actions";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import {
  animalPufferChoiceActor,
  animalAuthoritySnapshot,
  animalPufferReaction,
} from "./authority";
import {
  openAnimalRequest,
  animalRequestScope,
  readAnimalTool,
  commitAnimalRequest,
  closeAnimalRequest,
} from "./requests";
import { appendAnimalFact } from "./facts";
export async function runAnimalPufferChoice(
  world: World,
  events: GameEvent[],
  provider: ActionProvider,
  gateway: ToolGateway,
  day: number,
  unit: object,
  construction: { readonly requestFactory: ActionRequestFactoryConstructorPort },
): Promise<readonly number[]> {
  const actorId = animalPufferChoiceActor(world, unit);
  if (actorId === null) return [];
  // 独立构造／create 先于 openAnimalRequest 和 try；这两步抛错时尚无此请求 scope，不能新增 finally 关闭。
  const request = new construction.requestFactory(world, events, day).create({
      actorId,
      phase: Phase.Voting,
      allowedTools: ["puffer_retaliate"],
      stage: "puffer_reaction",
      requiresAction: true,
      summary: { key: "action.puffer_retaliate.directive" },
      context: { allow_fallback: false, action_failure_policy: "error" },
    }),
    scope = openAnimalRequest(world, request, unit);
  try {
    const raw = await provider.getAction(request),
      call = readAnimalTool(raw);
    if (animalRequestScope(world, request) !== scope || call?.name !== "puffer_retaliate")
      throw Error("animal_required_action_invalid");
    const valid = gateway.validateAndSanitize(world, actorId, call, {
      phase: Phase.Voting,
      day,
      animalScope: scope,
      deferOperation: true,
    });
    if (!valid.ok || !valid.sanitizedCall) throw Error("animal_required_action_invalid");
    const receipt = commitAnimalRequest(world, scope, valid.sanitizedCall);
    if (!("activate" in receipt)) throw Error("animal_receipt_invalid");
    appendAnimalFact(world, events, "animal_puffer_decided", {
      policy: ANIMAL_DREAM_POLICY,
      actorId,
      ...receipt,
    });
    const targetIds = [...animalPufferReaction(world, unit)];
    if (receipt.activate) {
      appendAnimalFact(world, events, "animal_puffer_revealed", {
        policy: ANIMAL_DREAM_POLICY,
        day,
        actorId,
        reason: "retaliation",
      });
      const snapshot = animalAuthoritySnapshot(world)!;
      appendAnimalFact(world, events, "animal_puffer_targets", {
        policy: ANIMAL_DREAM_POLICY,
        day,
        actorId,
        targetIds,
        round:
          snapshot.policies!.ballotPolicy === "awa_first_ballot_v1"
            ? 1
            : snapshot.unit!.finalRound!,
      });
    }
    return targetIds;
  } finally {
    closeAnimalRequest(scope);
  }
}
