/**
 * 单元组件测试负责正式角色纹章的闭合登记、未知降级与头像分离。输入为契约角色集合和手写原型／未知 ID，输出明确的独立纹章和安全中性图。
 * 预期来自 RoleId 契约及字面角色，不从纹章实现推测能力、胜负或隐藏身份；测试不下载图片或运行游戏规则。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ROLE_IDS } from "@ai-werewolf-arena/game-contract";
import { ROLE_CRESTS, getRoleCrest } from "../../../src/presentation/role-crests";
import { RoleCrest } from "../../../src/presentation/RoleCrest";
import { AvatarMark } from "../../../src/presentation/AvatarMark";

test("all 64 formal identities have explicit distinct marks at small badge sizes", () => {
  expect(Object.keys(ROLE_CRESTS).sort()).toEqual([...ROLE_IDS].sort());
  expect(ROLE_IDS).toHaveLength(64);
  const signatures = new Set<string>();
  for (const role of ROLE_IDS) {
    const definition = getRoleCrest(role)!;
    signatures.add(JSON.stringify([definition.motif, definition.detail, definition.awakened]));
    for (const size of [24, 48]) {
      const markup = renderToStaticMarkup(<RoleCrest role={role} size={size} />);
      expect(markup).toContain(`data-role-crest="${role}"`);
      expect(markup).toContain(`width="${size}"`);
      expect(markup).not.toContain("undefined");
      expect(markup).toBe(renderToStaticMarkup(<RoleCrest role={role} size={size} />));
    }
  }
  expect(signatures.size).toBe(64);
});

test("unknown or prototype names stay neutral and a role crest cannot change the LLM avatar", () => {
  for (const role of ["unknown", "toString", "__proto__", "seer_checked"]) {
    expect(getRoleCrest(role)).toBeNull();
    expect(renderToStaticMarkup(<RoleCrest role={role} />)).toContain('data-role-crest="neutral"');
  }
  const html = renderToStaticMarkup(
    <>
      <AvatarMark avatar={{ kind: "symbol", key: "openai" }} />
      <RoleCrest role="witch" />
    </>,
  );
  expect(html).toContain('data-avatar-key="openai"');
  expect(html).toContain('data-role-crest="witch"');
  expect(html).not.toContain('data-avatar-key="witch"');
});
