/**
 * 负责编译期单元验证定序王子与鬼魂新娘玩家数据的原形状及公共类型归属。
 * 输入为独立手写旧字段与原 optional／null／可写预期；输出为精确类型、双向赋值和旧出口反例。
 * 本单元拥有预期，不从新声明派生旧形状；仅编译，不执行 World、状态 reader、婚礼、重投或提交。
 */
import type {
  OrderPrinceChoice,
  OrderPrinceState,
} from "@ai-werewolf-arena/game-contract/facts/order-prince";
import type { WeddingActorView } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import type { Camp } from "@ai-werewolf-arena/game-contract";
import type { PlayerObservation } from "../../../src/game/observation/player-observation";
import type { projectOrderPrinceState } from "../../../src/game/mechanisms/roles/order_prince/state";
import type { weddingActorView } from "../../../src/game/mechanisms/roles/ghost_bride/authority";
import type {
  // @ts-expect-error 原 Choice 类型已退出，runtime 函数仍保留。
  OrderPrinceChoice as RetiredChoice,
  // @ts-expect-error 原 State 类型已退出，不保旧叶 type 桥。
  OrderPrinceState as RetiredOrder,
} from "../../../src/game/mechanisms/roles/order_prince/state";
// @ts-expect-error 婚礼数据类型归公共事实 owner，不保旧 authority 类型桥。
import type { WeddingActorView as RetiredWedding } from "../../../src/game/mechanisms/roles/ghost_bride/authority";
export type RetiredLeafChecks = [RetiredChoice, RetiredOrder, RetiredWedding];

interface OriginalChoice {
  day: number;
  activate: boolean;
}
interface OriginalOrder {
  policy: "awa_order_prince_first_ballot_v1";
  history: OriginalChoice[];
}
type OriginalWedding =
  | {
      policy: "awa_melbourne_ghost_bride_v1";
      member: "bride" | "groom";
      faction: Camp.ThirdParty;
      partnerId: number;
      witnessId: number | null;
      proposedWitnessId?: number;
      canKnife: boolean;
    }
  | {
      policy: "awa_melbourne_ghost_bride_v1";
      member: "witness";
      faction: Camp.ThirdParty;
      brideId: number;
      groomId: number;
      canKnife: boolean;
    };
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
export type PublicKnowledgeChecks = [
  Expect<Equal<OrderPrinceChoice, OriginalChoice>>,
  Expect<Equal<OrderPrinceState, OriginalOrder>>,
  Expect<Equal<WeddingActorView, OriginalWedding>>,
  Expect<Equal<ReturnType<typeof projectOrderPrinceState>, OriginalOrder | undefined>>,
  Expect<Equal<ReturnType<typeof weddingActorView>, OriginalWedding | null>>,
  Expect<Equal<PlayerObservation["ownState"]["orderPrince"], OriginalOrder | undefined>>,
  Expect<Equal<PlayerObservation["ownState"]["wedding"], OriginalWedding | undefined>>,
  Expect<OrderPrinceState extends OriginalOrder ? true : false>,
  Expect<OriginalOrder extends OrderPrinceState ? true : false>,
  Expect<WeddingActorView extends OriginalWedding ? true : false>,
  Expect<OriginalWedding extends WeddingActorView ? true : false>,
];

/** 仅编译原可写／nullable／optional 行为；关系知识不是 authority 或 pending 句柄。 */
export function originalWritableKnowledge(
  order: OrderPrinceState,
  pair: Extract<WeddingActorView, { member: "bride" | "groom" }>,
  witness: Extract<WeddingActorView, { member: "witness" }>,
): void {
  order.policy = "awa_order_prince_first_ballot_v1";
  order.history = [{ day: 1, activate: false }];
  order.history.push({ day: 2, activate: true });
  order.history[0]!.activate = true;
  pair.partnerId = 2;
  pair.witnessId = null;
  pair.proposedWitnessId = 3;
  delete pair.proposedWitnessId;
  pair.canKnife = false;
  witness.brideId = 1;
  witness.groomId = 2;
  witness.canKnife = true;
  // @ts-expect-error 独立知识没有原 pending／World 绑定。
  order.pendingDay;
  // @ts-expect-error 见证人分支不带伴侣聊天身份字段。
  witness.partnerId;
  // @ts-expect-error 见证人分支没有伴侣提名字段。
  witness.proposedWitnessId;
  // @ts-expect-error witnessId 原来可 null，但不可 undefined。
  pair.witnessId = undefined;
  // @ts-expect-error 关系知识没有 runtime authority 句柄。
  pair.authority;
}
