/**
 * 单元编译测试验证猎魔人三份公共纯结构的原形状和旧后端类型出口退休。
 * 输入为固定 Git 的独立完整字段预期及 canonical 类型；输出由编译器核对精确形状、
 * 双向赋值、nullable 和原可写性。本单元拥有独立字面 oracle，不运行状态读取、
 * World、权威、模型或提交；数据结构不授予请求、生命或库存权限。
 */
import type {
  DemonHunterChoice,
  DemonHunterState,
  DemonHuntTool,
} from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import type { PlayerObservation } from "../../../src/game/observation/player-observation";

// @ts-expect-error 旧声明出口退休，不由运行状态叶继续转发纯数据。
import type { DemonHunterChoice as RetiredChoice } from "../../../src/game/mechanisms/roles/demon_hunter/state-slot";
// @ts-expect-error 重复结构退出后端叶，共享事实契约成为唯一 owner。
import type { DemonHunterState as RetiredState } from "../../../src/game/mechanisms/roles/demon_hunter/state-slot";
// @ts-expect-error 重复工具结构退出后端叶，运行 reader 仍保留原出口。
import type { DemonHuntTool as RetiredTool } from "../../../src/game/mechanisms/roles/demon_hunter/state-slot";

interface OriginalChoice {
  day: number;
  targetId: number | null;
}
interface OriginalState {
  policy: "awa_netease_demon_hunter_v1";
  history: OriginalChoice[];
}
interface OriginalTool {
  name: "demon_hunt";
  args: { target_id: number | null; abstain: boolean };
}
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
export type AllDataBoundaryChecks = [
  Expect<Equal<OriginalChoice, DemonHunterChoice>>,
  Expect<Equal<OriginalState, DemonHunterState>>,
  Expect<Equal<OriginalTool, DemonHuntTool>>,
  Expect<Equal<NonNullable<PlayerObservation["ownState"]["demonHunter"]>, OriginalState>>,
  Expect<OriginalChoice extends DemonHunterChoice ? true : false>,
  Expect<DemonHunterChoice extends OriginalChoice ? true : false>,
  Expect<OriginalState extends DemonHunterState ? true : false>,
  Expect<DemonHunterState extends OriginalState ? true : false>,
  Expect<OriginalTool extends DemonHuntTool ? true : false>,
  Expect<DemonHuntTool extends OriginalTool ? true : false>,
  RetiredChoice,
  RetiredState,
  RetiredTool,
];

/** 只编译、不调用：公共原字段仍可写；非法私态、目标真值及权威句柄不进入形状。 */
export function checkOriginalDataMutability(
  choice: DemonHunterChoice,
  state: DemonHunterState,
  tool: DemonHuntTool,
): void {
  choice.day = 2;
  choice.targetId = null;
  state.policy = "awa_netease_demon_hunter_v1";
  state.history.push({ day: 3, targetId: null });
  state.history[0]!.targetId = 4;
  tool.name = "demon_hunt";
  tool.args.target_id = null;
  tool.args.abstain = true;
  // @ts-expect-error 原历史行不携带目标的真实阵营。
  choice.camp;
  // @ts-expect-error 结构不把内部原体或资源权威泄漏给观察消费者。
  state.world;
  // @ts-expect-error 合法工具形状不是已绑定请求租约。
  tool.lease;
}
