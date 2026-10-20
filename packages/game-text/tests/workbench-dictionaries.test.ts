/** 负责工作台四份词典的一致性单元验证；输入公开双语消息，独立断言键与占位符对齐，不访问配置或认证。 */
import { expect, test } from "bun:test";
import * as agent from "../src/workbench-agent";
import * as board from "../src/workbench-board";
import * as config from "../src/workbench-config-ui";
import * as service from "../src/workbench-service";
import { placeholders } from "../src/index";
for (const [name, module] of Object.entries({ agent, board, config, service })) {
  test(`${name} has matching Chinese and English messages`, () => {
    const zh = module.zhCN as Record<string, string>,
      en = module.en as Record<string, string>;
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(zh)) {
      expect(zh[key].trim(), key).not.toBe("");
      expect(en[key].trim(), key).not.toBe("");
      expect(placeholders(zh[key]), key).toEqual(placeholders(en[key]));
    }
  });
}
