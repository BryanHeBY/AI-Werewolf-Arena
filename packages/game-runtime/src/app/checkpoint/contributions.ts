/**
 * 负责一次 checkpoint 的固定贡献装配。输入为真实 World、完整／失败模式与原录制游标；
 * 输出先准备动物审计和四种 setup，再按原顺序编码权威及 setup 字段，最后由调用方取得玩家记录。
 * 这里没有动态 registry 或第二套状态；机制贡献不驱动游戏，独立 verifier 不导入本写方装配。
 * 快照的 cycle／failure／eventCount 仍由原运行入口决定；seq 由原轨迹所有者推进。
 * 贡献不读取 seq、不提前查询玩家，也不改变失败前缀。
 */
import type { World } from "../../domain/world";
import { prepareAnimalCheckpoint, captureAuthorityContributions } from "./authority-snapshots";
import { prepareIdentityCheckpoint, captureIdentityContributions } from "./identity-setups";
export { capturePlayerContributions } from "./player-snapshots";

export function prepareCheckpointContributions(world: World, complete: boolean) {
  const animal = prepareAnimalCheckpoint(world, complete);
  const setups = prepareIdentityCheckpoint(world);
  return { animal, setups };
}

export function captureCheckpointContributions(
  world: World,
  complete: boolean,
  prepared: ReturnType<typeof prepareCheckpointContributions>,
  cursors?: { settlementCount: number; decisionCount: number },
) {
  return {
    ...captureAuthorityContributions(world, complete, cursors),
    ...captureIdentityContributions(prepared.setups),
  };
}
