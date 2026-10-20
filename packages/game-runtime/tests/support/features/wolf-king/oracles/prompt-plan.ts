/**
 * 持有本模块手写测试预期和有界契约断言；输入为提供的计划或观察元组，输出保留字面库存、身份、标记及错误预期。不从生产结算重新生成预期游戏结果，也不运行游戏、模型或传输。
 */
import { Role } from "../../../../../src/domain";
import type { TransportGameScenario } from "../../../transport/contracts";

export function withPromptOracle(scenario: TransportGameScenario): TransportGameScenario {
  return {
    ...scenario,
    promptAssertions: (actor, locale) =>
      scenario.roles[actor - 1] === Role.WolfKing
        ? {
            expectedIdentityMarker:
              locale === "en"
                ? "Your true role when this session begins is Wolf King."
                : "真实身份是狼王。",
            requiredCurrentMarkers:
              locale === "en"
                ? ["Your role is Wolf King.", "Shots remaining: 1."]
                : ["你的底牌是【狼王】", "剩余枪：1。"],
          }
        : { forbiddenCurrentMarkers: [locale === "en" ? "Shots remaining:" : "剩余枪："] },
  };
}
