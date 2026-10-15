/**
 * Unit tests for finite-preset-diagnostics; Pure finite-board schema/reader/writer or safe diagnostic validation against literal configuration.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
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
