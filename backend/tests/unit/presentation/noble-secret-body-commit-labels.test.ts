/**
 * 单元测试验证贵族与秘体提交标签及不可公开的终态字段。输入为目标、种类和语言的字面量事实；手写标签与隐藏字段预期检验已授权展示，不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { nobleSecretBodyEventLabel } from "@ai-werewolf-arena/game-presentation";
import { ScriptEventRenderRegistry } from "../../../src/game/mechanisms/script/event_render_registry";
const policy = "awa_noble_secret_body_v1";
const fixtures = [
  { type: "noble_body_knife_committed", payload: { policy, actorId: 1, day: 2, targetId: 6 } },
  { type: "noble_body_knife_committed", payload: { policy, actorId: 1, day: 2, targetId: null } },
  { type: "noble_body_native_damage_committed", payload: { policy, actorId: 5, day: 2 } },
];
for (const locale of ["zh-CN", "en"] as const)
  for (const f of fixtures)
    test(`commit labels and hidden terminal ${locale}/${f.type}/${f.payload.targetId}`, () => {
      const label = nobleSecretBodyEventLabel(f.type, f.payload, locale);
      if (label === null) throw new Error("noble_commit_label_missing");
      expect(label).toContain(locale === "en" ? "[God] Night 2" : "[God] 第2夜");
      if (locale === "en") expect(label).not.toMatch(/[\u4e00-\u9fff]/);
      const registry = new ScriptEventRenderRegistry(),
        event = { ...f, timestamp: 1, audience: [] } as any;
      expect(registry.toLiveRender(event, false, locale)).toEqual([]);
      expect(registry.toLiveRender(event, true, locale)).toEqual([{ kind: "god", text: label }]);
    });
