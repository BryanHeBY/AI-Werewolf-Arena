/**
 * 负责觉醒隐狼原激活学习枪贡献的装配。输入为原死亡波与晚查询；输出为含激活元数据复验的原枪击提案。
 * 捕获表每次 hook 独立创建；资源 owner 核原 state／learning／gun，不复制库存或复活已消费枪。
 * 查询函数在原 callee 点取得并裸调用；此装配不授许可、不标死或切换阶段，付款／失败由完整结算处理。
 * 在原有序死亡钩子时点只装配原读写贡献；许可与生命仍由结算复验，失败不补偿已付款库存。
 */
import { Role, permitsDeathShot } from "../../../../core/domain/model";
import type { DeathHook } from "../../hooks/hook_registry";
import { resolveNativeDeathShots } from "../native-death-shot-settlement";
import { getAwakenedState } from "./state";
import { createAwakenedGunReader } from "../native-death-gun-resources";

export const awakenedDeathHook: DeathHook = (world, ids, sources, choose, events, context) => {
  const readGun = createAwakenedGunReader({ get getAwakenedState() { return getAwakenedState; } });
  return resolveNativeDeathShots(
    world,
    ids,
    sources,
    choose,
    events,
    {
      role: Role.AwakenedHiddenWolf,
      state: readGun,
      permits: permitsDeathShot,
      shotEvent: (actorId, targetId) => ({
        timestamp: Date.now(),
        type: "player_shot",
        payload: { actorId, targetId },
      }),
    },
    context,
  );
};
