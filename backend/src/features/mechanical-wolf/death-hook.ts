/**
 * 负责机械狼原学习枪贡献的装配。输入为原死亡波与晚查询；输出为同枪捕获 reader 和原枪击提案。
 * 捕获表每次 hook 独立创建；资源 owner 核原 state／learning／gun，不复制库存或复活已消费枪。
 * 查询函数在原 callee 点取得并裸调用；此装配不授许可、不标死或切换阶段，付款／失败由完整结算处理。
 * 在原有序死亡钩子时点只装配原读写贡献；许可与生命仍由结算复验，失败不补偿已付款库存。
 */
import { Role, permitsDeathShot } from "../../domain/model";
import type { DeathHook } from "../../engine/hooks/registry";
import {
  ownDeathHook,
  type OwnedHookBindingSource,
  type OwnedDeathCommands,
} from "../../engine/hooks/owned-bindings";
import { resolveNativeDeathShots } from "../death-actions/settlement-ports";
import { getMechanicalState } from "./state";
import { createMechanicalGunReader } from "../death-actions/native-resource-ports";

function resolveOwnedDeath(
  source: OwnedHookBindingSource,
  ids: Parameters<DeathHook>[1],
  sources: Parameters<DeathHook>[2],
  choose: Parameters<DeathHook>[3],
  context: Parameters<DeathHook>[4],
): ReturnType<DeathHook> {
  const world = source.world,
    events = source.events;
  const readGun = createMechanicalGunReader({
    get getMechanicalState() {
      return getMechanicalState;
    },
  });
  return resolveNativeDeathShots(
    world,
    ids,
    sources,
    choose,
    events,
    {
      role: Role.MechanicalWolf,
      state: readGun,
      permits: permitsDeathShot,
      shotEvent: (actorId, targetId) => ({
        timestamp: Date.now(),
        type: "mechanical_shot",
        payload: { actorId, targetId },
      }),
    },
    context,
  );
}

/** 本族运行hook只得到具体结算命令；cold绑定不查询名单、库存或World。 */
export const mechanicalDeathHook: DeathHook = ownDeathHook<OwnedDeathCommands>(
  (runtime, ids, sources, choose, context) => runtime.ports.resolve(ids, sources, choose, context),
  (source) => ({
    resolve: (
      ids: Parameters<DeathHook>[1],
      sources: Parameters<DeathHook>[2],
      choose: Parameters<DeathHook>[3],
      context: Parameters<DeathHook>[4],
    ) => resolveOwnedDeath(source, ids, sources, choose, context),
  }),
);
