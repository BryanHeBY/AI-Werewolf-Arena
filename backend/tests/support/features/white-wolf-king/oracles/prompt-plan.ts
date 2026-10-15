/**
 * 持有本模块手写测试预期和有界契约断言；输入为提供的计划或观察元组，输出保留字面库存、身份、标记及错误预期。不从生产结算重新生成预期游戏结果，也不运行游戏、模型或传输。
 */
import { Role } from "../../../../../src/domain";
import type { TransportGameScenario } from "../../../transport/contracts";

export function oracle(scenario: TransportGameScenario): TransportGameScenario {
  return {
    ...scenario,
    promptAssertions: (actor, locale) =>
      scenario.roles[actor - 1] === Role.WhiteWolfKing
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is White Wolf King." : "真实身份是白狼王。",
            requiredCurrentMarkers:
              locale === "en"
                ? ["Your role is White Wolf King.", "Self-destruct opportunities remaining: 1."]
                : ["你的底牌是【白狼王】", "自爆机会剩余：1。"],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Self-destruct opportunities remaining:" : "自爆机会剩余：",
            ],
          },
  };
}
