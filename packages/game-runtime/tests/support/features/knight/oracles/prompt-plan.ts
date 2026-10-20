/**
 * 测试支持模块负责为骑士传输计划补写字面资源与双语提示预期；输入为原场景对象。遍历骑士的原 turns，直接写入每个 turn.knightResourceRemaining，并在字面 duel 后将后续预期归零；返回新场景外壳及提示回调，原 turn 引用仍共享。不执行真实决斗或从生产结算生成预期。
 */
import { Role } from "../../../../../src/domain";
import type { TransportGameScenario } from "../../../transport/contracts";

export function oracle(scene: TransportGameScenario): TransportGameScenario {
  for (const [actor, turns] of scene.turns) {
    if (scene.roles[actor - 1] !== Role.Knight) continue;
    let remaining: 0 | 1 = 1;
    for (const turn of turns) {
      turn.knightResourceRemaining = remaining;
      if (turn.action?.name === "duel") remaining = 0;
    }
  }
  return {
    ...scene,
    promptAssertions: (actor, locale) =>
      scene.roles[actor - 1] === Role.Knight
        ? {
            expectedIdentityMarker:
              locale === "en"
                ? "Your true role when this session begins is Knight."
                : "真实身份是骑士。",
            requiredCurrentMarkers:
              locale === "en" ? ["Your role is Knight,"] : ["你的底牌是【骑士】"],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Duel opportunities remaining:" : "决斗机会剩余：",
            ],
          },
  };
}
