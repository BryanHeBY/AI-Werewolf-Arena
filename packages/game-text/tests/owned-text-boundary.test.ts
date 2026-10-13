/**
 * 单元架构测试负责验证文案包只公开自身词典／文案操作，事实数据由契约包直接提供。
 * 输入为公开文案 namespace 与三个手写类型反例；输出为独立预期的 11 个文案值出口断言，
 * 编译时必须拒绝旧事实／copier／policy 入口。此测试不运行角色、World、Provider 或整局，
 * 不重复既有两语词典测试，也不从生产结果生成预期。
 */
import { expect, test } from "bun:test";
import * as gameText from "@ai-werewolf-arena/game-text";
// @ts-expect-error 事实类型已退出文案包公开 API，消费者应使用契约包的事实模块。
import type { AnimalDreamFact as RetiredAnimalFact } from "@ai-werewolf-arena/game-text";
// @ts-expect-error 惯用 copier 属于数据契约，不由文案包转发。
import type { copyEventData as RetiredCopier } from "@ai-werewolf-arena/game-text";
// @ts-expect-error 角色政策由契约包提供，文案包不再公开此旧入口。
import type { ANIMAL_DREAM_POLICY as RetiredPolicy } from "@ai-werewolf-arena/game-text";

test("text package publishes only its owned rendering operations", () => {
  expect(Object.keys(gameText).sort()).toEqual([
    "AUDIT_SECTIONS",
    "auditHeadings",
    "dictionaries",
    "errorMessage",
    "placeholders",
    "renderMessage",
    "roleName",
    "term",
    "text",
    "toolFailure",
    "validateDictionaries",
  ]);
});
