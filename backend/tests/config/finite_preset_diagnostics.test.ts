import { expect, test } from "bun:test";
import { BoardConfigurationError } from "../../src/runtime/config/board_definition";
import { configDiagnostic } from "../../src/runtime/config/error_codes";
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
