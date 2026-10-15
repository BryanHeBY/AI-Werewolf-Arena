/**
 * 负责婚约、孤女、盗贼和换皮者的开局 checkpoint 贡献。输入为同一 World；
 * 输出保留四次 setup 查询的原顺序及返回对象引用，归档字段仍按孤女、婚约、盗贼、换皮者排序。
 * 查询在三种强权威编码之前执行，字段加入在计数之后；不缓存跨次快照、不重开或关闭机制。
 */
import type { World } from "../../domain/world";
import { weddingSetup } from "../../game/mechanisms/roles/ghost_bride/authority";
import { projectLonelyGirlSetup } from "../../game/mechanisms/roles/lonely_girl/lifecycle";
import { projectThiefSetup } from "../../game/mechanisms/roles/thief/deal";
import { projectShapeshifterSetup } from "../../game/mechanisms/roles/shapeshifter/deal";

export function prepareIdentityCheckpoint(world: World) {
  const ghostBrideSetup = weddingSetup(world);
  const lonelyGirlSetup = projectLonelyGirlSetup(world);
  const thiefSetup = projectThiefSetup(world),
    shapeshifterSetup = projectShapeshifterSetup(world);
  return { ghostBrideSetup, lonelyGirlSetup, thiefSetup, shapeshifterSetup };
}

export function captureIdentityContributions({
  ghostBrideSetup,
  lonelyGirlSetup,
  thiefSetup,
  shapeshifterSetup,
}: ReturnType<typeof prepareIdentityCheckpoint>) {
  return {
    ...(lonelyGirlSetup ? { lonelyGirlSetup } : {}),
    ...(ghostBrideSetup ? { ghostBrideSetup } : {}),
    ...(thiefSetup ? { thiefSetup } : {}),
    ...(shapeshifterSetup ? { shapeshifterSetup } : {}),
  };
}
