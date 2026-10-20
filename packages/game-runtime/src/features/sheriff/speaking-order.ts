/**
 * 负责请求警长发言方向并形成原座位顺序。输入为 World、存活编号、请求构造依赖与原回复；输出默认顺时针或已校验方向、警长最后的原名单。
 * 未启警长或无警长保原早返回，不读取／创建工厂；有效持徽者之后才独立 new 本次方向工厂。
 * 请求、玩家或网关失败保原异常，方向事实在原回复处理之后发布；此模块不赋警徽、改生命或共享选举工厂。
 */
import { COMPONENT } from "../../domain/components/names";
import { IdentityComponent } from "../../domain/entities/player";
import { ActionProvider, EntityId, GameEvent, Phase } from "../../domain/model";
import { World } from "../../domain/world";
import { ToolGateway } from "../../engine/actions/tool-gateway";
import type { ActionRequestFactoryConstructorPort } from "../../domain/actions";
import { findSheriffId } from "./badge";

export type SpeakerDirection = "clockwise" | "counter_clockwise";

export async function chooseSpeakerDirection(input: {
  world: World;
  events: GameEvent[];
  toolGateway: ToolGateway;
  actionProvider: ActionProvider;
  day: number;
  enableSheriff: boolean;
  readonly requestFactory: ActionRequestFactoryConstructorPort;
}): Promise<SpeakerDirection> {
  const { world, events, toolGateway, actionProvider, day, enableSheriff } = input;
  const defaultDirection: SpeakerDirection = "clockwise";
  if (!enableSheriff) {
    return defaultDirection;
  }

  const sheriffId = findSheriffId(world);
  if (sheriffId === null) {
    return defaultDirection;
  }

  let finalDirection: SpeakerDirection = defaultDirection;
  // 构造器 getter 到原 new 点才读取，default／无持徽者路径不触及它。
  const requests = new input.requestFactory(world, events, day);
  const req = requests.create({
    phase: Phase.Day,
    actorId: sheriffId,
    allowedTools: ["choose_direction"],
    stage: "sheriff_choose_direction",
    requiresAction: true,
    summary: { key: "request.summary.sheriff_direction" },
    context: {},
  });
  const action = await actionProvider.getAction(req);
  if (action?.name === "choose_direction") {
    const result = toolGateway.validateAndSanitize(world, sheriffId, action, {
      phase: Phase.Day,
    });
    if (result.ok && result.sanitizedCall) {
      finalDirection = result.sanitizedCall.args.direction;
    }
  }

  events.push({
    timestamp: Date.now(),
    type: "sheriff_direction_chosen",
    payload: {
      sheriffId,
      direction: finalDirection,
    },
  });

  return finalDirection;
}

export function buildSpeakerOrder(
  world: World,
  aliveIds: EntityId[],
  sheriffId: EntityId | null,
  direction: SpeakerDirection,
): EntityId[] {
  if (sheriffId === null) {
    return [...aliveIds];
  }

  // 按原读取点固定座位，警长最后；这里只生成顺序副本，不写座位或警徽。
  const seatMap = new Map<EntityId, number>();
  for (const id of aliveIds) {
    const identity = world.getComponent(id, COMPONENT.Identity);
    seatMap.set(id, identity?.seat ?? id);
  }

  const orderedBySeat = [...aliveIds].sort((a, b) => (seatMap.get(a) ?? a) - (seatMap.get(b) ?? b));
  const sheriffIndex = orderedBySeat.indexOf(sheriffId);
  if (sheriffIndex < 0) {
    return orderedBySeat;
  }

  if (direction === "clockwise") {
    return [...orderedBySeat.slice(sheriffIndex + 1), ...orderedBySeat.slice(0, sheriffIndex + 1)];
  }

  const counterClockwise: EntityId[] = [];
  for (let i = sheriffIndex - 1; i >= 0; i--) {
    counterClockwise.push(orderedBySeat[i]);
  }
  for (let i = orderedBySeat.length - 1; i > sheriffIndex; i--) {
    counterClockwise.push(orderedBySeat[i]);
  }
  counterClockwise.push(sheriffId);
  return counterClockwise;
}
