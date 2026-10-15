/**
 * 仅编译的单元类型契约验证公共七类能力数据。
 * 输入是合法字面 payload 及带扩展字段的变量；TypeScript 编译器以原负例核对可选／可空字段、可写数据约定、
 * 深只读别名和原生 Role 枚举边界。两个辅助函数不被执行；不加载 live owner、World、parser 或运行校验。
 * 整条类型错误指令及其原说明保留为编译预期。
 */
import { Role, WitchSelfHealRule } from "../../src/index";
import type {
  AbilitySource,
  GuardState,
  NightAbilityReadStates,
  NightAbilityStates,
  PairSeerState,
  SeerState,
  WitchState,
} from "../../src/index";

function copiedDataKeepsItsOriginalContracts(
  guard: GuardState,
  witch: WitchState,
  seer: SeerState,
  pair: PairSeerState,
) {
  guard.repeatPolicy = "netease_consecutive_nights_v1";
  // @ts-expect-error Guard target was already read-only in its original input DTO.
  guard.lastTarget = 2;
  witch.heal--;
  witch.potionTurnClosedDay = 3;
  seer.history.push({ targetId: 2, isWerewolf: true, result: { kind: "camp", camp: "wolf" } });
  pair.history = [];
  // @ts-expect-error Pair history membership was already read-only in the original DTO.
  pair.history.push({ day: 1, targetIds: [2, 3], containsWerewolf: true });
  const origin: AbilitySource = { kind: "native", role: Role.Wolf };
  origin.role = Role.Seer;
  // @ts-expect-error Native source keeps its original Role enum rather than widening to raw RoleId.
  const rawOrigin: AbilitySource = { kind: "native", role: "wolf" };
  void rawOrigin;
  const extension = { lastTarget: null, lastIsWerewolf: null, history: [], custom: { free: true } };
  const structural: SeerState = extension; // 保留原结构类型对额外扩展字段的接受面。
  const absentResult: SeerState = { lastTarget: null, lastIsWerewolf: null, history: [] };
  const nullableResult: SeerState = {
    lastTarget: null,
    lastIsWerewolf: null,
    lastResult: null,
    history: [],
  };
  const all: NightAbilityStates = {
    seer_check: absentResult,
    role_check: { lastTarget: null, lastDay: null, history: [] },
    guard,
    potion: {
      heal: 1,
      poison: 1,
      selfHealRule: WitchSelfHealRule.Disabled,
      canSelfHeal: false,
      healUsedThisNight: false,
      poisonUsedThisNight: false,
    },
    dream: { lastTarget: null, lastDay: null, history: [] },
    pair_check: { policy: "awa_fragrant_pair_seer_v1", history: [] },
    shelter: { policy: "awa_radiant_eclipse_v1", lastTarget: null, lastDay: null },
  };
  void [origin, structural, nullableResult, all];
}

function sevenReadPayloadsGrantNoNestedWrites(data: NightAbilityReadStates) {
  // @ts-expect-error Guard policy is read-only through the read alias.
  data.guard.repeatPolicy = "awa_last_action_v1";
  // @ts-expect-error Witch bottle count is read-only through the read alias.
  data.potion.poison = 0;
  // @ts-expect-error Shelter target/day scalar structure is read-only.
  data.shelter.lastDay = 2;
  // @ts-expect-error Pair history rows are read-only.
  data.pair_check.history[0]!.containsWerewolf = false;
  // @ts-expect-error Pair tuple data retains its nested read-only boundary.
  data.pair_check.history[0]!.targetIds[0] = 3;
  // @ts-expect-error Dreamer history rows cannot be changed.
  data.dream.history[0]!.targetId = 3;
  // @ts-expect-error Seer history membership cannot be appended.
  data.seer_check.history.push({ targetId: 3, isWerewolf: false });
  if (data.seer_check.lastResult?.kind === "camp") {
    // @ts-expect-error Nullable Seer result fields are read-only.
    data.seer_check.lastResult.camp = "good";
  }
  if (data.seer_check.history[0]?.result?.kind === "role") {
    // @ts-expect-error Historical Seer result fields are also read-only.
    data.seer_check.history[0].result.role = Role.Wolf;
  }
  // @ts-expect-error Role-inspection result data is read-only below the history row.
  data.role_check.history[0]!.result.role = Role.Wolf;
  // @ts-expect-error Role-inspection has no invented nullable lastResult field.
  data.role_check.lastResult;
  // @ts-expect-error Pure data grants no World or command handle.
  data.potion.world;
}
void copiedDataKeepsItsOriginalContracts;
void sevenReadPayloadsGrantNoNestedWrites;
