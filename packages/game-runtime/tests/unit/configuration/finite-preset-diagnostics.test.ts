/**
 * finite-preset-diagnostics 单元测试以既有内存配置、原回调控制和显式坏变体核对有限板子 schema／读写器及安全诊断。原字面预期、身份快照和拒绝断言为依据，迁移不重新生成；保留支持文件、夹具字节、政策及状态，不运行模型或实体传输。
 */
import { expect, test } from "bun:test";
import { BoardConfigurationError } from "../../../src/app/config/board-definition";
import { configDiagnostic } from "../../../src/app/config/error-codes";
for (const preset of ["mist_raven", "radiant_eclipse"] as const) {
  test(`${preset}: finite preset error keeps its machine code and safe field path`, () => {
    const code = `board_config_${preset}_preset_invalid`;
    expect(configDiagnostic(new BoardConfigurationError(code, "board"))).toEqual({
      code,
      path: "board",
    });
    expect(configDiagnostic(new BoardConfigurationError(code, "secret!"))).toEqual({ code });
  });
}
