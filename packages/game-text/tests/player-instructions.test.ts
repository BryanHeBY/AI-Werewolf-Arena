/**
 * 包级单元测试验证角色说明保留会改变决策的玩法差异，同时避免把后台实现术语带进牌桌表达。
 * 两语用手写规则断言区分机械狼和觉醒隐狼的激活、连守及额外刀时效。
 */
import { expect, test } from "bun:test";
import { text } from "../src";

test("identity role explanations use game timing and preserve distinct mechanical and awakened rules", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const hybrid = text(locale, "role.hybrid.state");
    const mechanical = text(locale, "role.mechanical_wolf.state");
    const awakened = text(locale, "role.awakened_hidden_wolf.state");
    const mirror = text(locale, "role.mirror_girl.state");
    for (const prompt of [hybrid, mechanical, awakened, mirror]) {
      expect(prompt).not.toMatch(/(?:阶段|stage\s*)(?:110|580|600|650|900)/i);
      expect(prompt).not.toMatch(
        /new owner|new body|paid prefixes|gateway|newowner|新owner|新body|G02/i,
      );
      if (locale === "en") expect(prompt).not.toMatch(/[\u4e00-\u9fff]/);
    }
    expect(hybrid).toContain(
      locale === "en" ? "not their role or alignment" : "不告知对方身份或阵营",
    );
    expect(hybrid).toContain(
      locale === "en" ? "alignment at the time of selection" : "选择当时的真实阵营",
    );
    expect(mechanical).toContain(
      locale === "en" ? "eliminates you at dawn" : "保护失败且你在天亮出局",
    );
    expect(mechanical).toContain(locale === "en" ? "expires it permanently" : "不能以后补用");
    expect(awakened).toContain(
      locale === "en" ? "can be corrected without closing the turn" : "选错可修正，不直接关闭回合",
    );
    expect(awakened).toContain(locale === "en" ? "preserves it for later nights" : "可留到后夜");
    expect(mirror).toContain(locale === "en" ? "revival" : "复活");
    expect(mirror).toContain(locale === "en" ? "their own empty histories" : "从空记录开始");
    expect(mirror).toContain(
      locale === "en"
        ? "Three invalid submissions are still a failure"
        : "三次非法提交仍按失败处理",
    );
  }
});
