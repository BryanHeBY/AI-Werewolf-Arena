/**
 * 负责猎人的死亡钩子贡献，在原死亡波中装配枪击选择、死因政策与公开事件。
 * 输入是原 World 玩家、死亡原因、选择回调与当前生命上下文；输出是待提交的枪击死亡和猎人事件。
 * 可用枪击之前的死因、原生命和行动权限检查，以及接受之后的原生枪消费，均由共享枪击所有者负责。
 * 中毒保留原沉默事件，失败或关闭窗口不绕过检查。本钩子不打开死亡权限、不提交目标死亡，
 * 也不切换阶段或关闭死亡波。
 */
import { Role, permitsHunterShot } from "../../../../core/domain/model";
import type { DeathHook } from "../../hooks/hook_registry";
import { getHunterState } from "../native-death-gun-resources";
import { openDemonHunterStockFrame } from "../demon_hunter/native-gun-ports";
import { resolveNativeDeathShots } from "../native-death-shot-settlement";

export const hunterDeathHook: DeathHook = (world, ids, sources, choose, events, context) =>
  resolveNativeDeathShots(
    world,
    ids,
    sources,
    choose,
    events,
    {
      role: Role.Hunter,
      state: getHunterState,
      // 仅实际 Hunter 分支晚取原命令；本 getter 不读 World，不提前捕获审计。
      get openHunterStock() { return openDemonHunterStockFrame; },
      permits: (sources) => permitsHunterShot(sources),
      policy: (state) => state.deathActionPolicy ?? "awa_qualified_sources_v1",
      poisonEvent: (hunterId) => ({
        timestamp: Date.now(),
        type: "hunter_silent_due_to_poison",
        payload: { hunterId },
      }),
      shotEvent: (hunterId, targetId) => ({
        timestamp: Date.now(),
        type: "hunter_shot",
        payload: { hunterId, targetId },
      }),
    },
    context,
  );
