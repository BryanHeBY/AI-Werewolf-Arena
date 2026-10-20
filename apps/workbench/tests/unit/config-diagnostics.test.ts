/** 定向测试确保配置解析器的每个公开诊断都有双语恢复建议，并保留可读字段位置。 */
import { expect, test } from "bun:test";
import { CONFIG_ERROR_CODES } from "@ai-werewolf-arena/game-runtime/config/diagnostics";
import {
  workbenchConfigLocation,
  workbenchServiceMessage,
} from "@ai-werewolf-arena/game-text/workbench-service";

test("all public configuration errors have Chinese and English recovery guidance", () => {
  for (const code of CONFIG_ERROR_CODES) {
    expect(workbenchServiceMessage("zh-CN", code), code).toBeTruthy();
    expect(workbenchServiceMessage("en", code), code).toBeTruthy();
  }
  expect(workbenchServiceMessage("zh-CN", "pi_model_not_found")).toContain("登记");
  expect(workbenchServiceMessage("en", "runtime_config_player_binding_invalid")).toContain("board");
  expect(workbenchServiceMessage("zh-CN", "untrusted-arbitrary-error")).toBeUndefined();
  expect(workbenchServiceMessage("zh-CN", "__proto__")).toBeUndefined();
  expect(workbenchServiceMessage("en", "toString")).toBeUndefined();
});
test("field locations preserve named IDs while explaining structural fields", () => {
  expect(workbenchConfigLocation("zh-CN", "agents.items.cat.options.defaultModel")).toBe(
    "Agent › 条目 › cat › 参数 › 模型",
  );
  expect(workbenchConfigLocation("en", "game.maxRuntimeMs")).toBe("Game › Game time limit");
  expect(workbenchConfigLocation("zh-CN", "roles.witch.selfHeal")).toContain("女巫自救");
});
