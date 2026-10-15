/**
 * 单元测试以原不可变公开板子 JSON 及三个手写政策／key 变体为输入，核对 Noble／Secret Body 枚举或未知 key 错误早于静默归一化。精确诊断码及私密探针不泄露为预期；只读输入，不创建配置树或档案。
 */
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import { configDiagnostic, CONFIG_ERROR_CODES } from "../../../src/app/config/error-codes";

const root = fileURLToPath(new URL("../../../../configs.example/boards", import.meta.url));

test("public role policy enums and unknown keys fail before normalization can silently accept them", async () => {
  const baseline = JSON.parse(
    await readFile(join(root, "awa_noble_secret_body_12_standard_nonconsecutive_v1.json"), "utf8"),
  );
  for (const change of [
    (r: any) => (r.roles.night_noble.wolfActionPolicy = "all_wolves_disabled"),
    (r: any) => (r.roles.awakened_idiot.protectionRepeatPolicy = "unlimited"),
    (r: any) => (r.roles.night_noble.extraCanary = "private-not-for-errors"),
  ]) {
    const raw = structuredClone(baseline);
    change(raw);
    let error: unknown;
    try {
      parseBoardDefinition(raw);
    } catch (e) {
      error = e;
    }
    const diagnostic = configDiagnostic(error);
    expect(diagnostic.code).toBe("board_config_invalid_field");
    expect(JSON.stringify(diagnostic)).not.toContain("private-not-for-errors");
  }
  expect(CONFIG_ERROR_CODES).toContain("board_config_noble_secret_body_preset_invalid");
});
