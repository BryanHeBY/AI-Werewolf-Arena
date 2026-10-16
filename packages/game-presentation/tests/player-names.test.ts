/**
 * 包级单元测试负责验证姓名参数插值、编号回退和双语原文隔离。
 * 输入为字面名单、模板参数与动物事实；预期来自手写标签、日期和原文断言。
 * 不启动 World、React、真实传输或完整对局，不由生产输出重建字面预期。
 */
import { expect, test } from "bun:test";
import { animalDreamEventLabel, createPlayerText, playerLabel } from "../src";
import { text } from "@ai-werewolf-arena/game-text";

test("缺省、重名与中英文都保持编号可辨识，昵称不翻译", () => {
  expect(playerLabel({ id: 8 })).toBe("8号");
  expect(playerLabel({ id: 8 }, "en")).toBe("Player 8");
  expect(playerLabel({ id: 8, name: "沈砚舟" })).toBe("8号·沈砚舟");
  expect(playerLabel({ id: 9, name: "沈砚舟" }, "en")).toBe("Player 9·沈砚舟");
});

test("模板替换只扫描一次，玩家原文与昵称中的占位符都原样保留", () => {
  const named = createPlayerText([{ id: 8, name: "沈{target}舟" }]);
  const speech = "8号说 Player 8，{actor}号与1号都只是原文。";
  expect(named("zh-CN", "console.chat.day", { actor: 8, speech })).toContain(`8号·沈{target}舟`);
  expect(named("zh-CN", "console.chat.day", { actor: 8, speech })).toEndWith(speech);
  expect(named("en", "replay.day_speech", { actor: 8, speech })).toContain("Player 8·沈{target}舟");
  expect(named("en", "replay.day_speech", { actor: 8, speech })).toEndWith(speech);
  const ability = { actor: 9, id: "8", kind: "k", operation: "o" };
  expect(named("zh-CN", "ability.change", ability)).toBe(text("zh-CN", "ability.change", ability));
  expect(() => named("zh-CN", "console.chat.day", { actor: 8 })).toThrow("i18n_parameter_missing");
  expect(named("zh-CN", "console.bear.report", { day: 8, result: "咆哮" })).toBe(
    text("zh-CN", "console.bear.report", { day: 8, result: "咆哮" }),
  );
});

test("同一份机制文案消费本局名单，空名单保持旧版逐字输出", () => {
  const payload = {
    policy: "awa_animal_dream_v1",
    day: 8,
    phase: "night",
    proposedIds: [8, 9],
    blockedCatId: 9,
  };
  const named = createPlayerText([
    { id: 8, name: "茶茶" },
    { id: 9, name: "小白" },
  ]);
  const label = animalDreamEventLabel("animal_wave_prepared", payload, "zh-CN", named)!;
  expect(label).toContain("第8天");
  expect(label).toContain("8号·茶茶");
  expect(label).toContain("9号·小白");
  expect(animalDreamEventLabel("animal_wave_prepared", payload, "zh-CN", createPlayerText())).toBe(
    animalDreamEventLabel("animal_wave_prepared", payload, "zh-CN"),
  );
  expect(createPlayerText([{ id: 8, name: "另一个局" }])("zh-CN", "common.player", { id: 8 })).toBe(
    "8号·另一个局",
  );
  expect(named("zh-CN", "common.player", { id: 8 })).toBe("8号·茶茶");
});
