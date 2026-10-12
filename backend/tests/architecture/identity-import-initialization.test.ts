/**
 * Architecture tests verify five initial-identity import orders initialize public setup constructors without a temporal dead zone.
 * Input: Fresh interpreter processes rooted at the backend and the original entry-order matrix.
 * Output and oracle: Literal successful exit and constructor checks are asserted; process isolation is used only for module initialization, not a played game.
 */
import { expect, test } from "bun:test";
import path from "node:path";
const base = "./src/game/mechanisms/roles/";
for (const entry of [
  "initial_identity/setup",
  "shapeshifter/setup",
  "thief/setup",
  "catalog",
  "../../engine/phase_manager",
]) {
  test(`fresh process imports identity setup from ${entry} without a temporal dead zone`, () => {
    const first =
      entry === "../../engine/phase_manager"
        ? "./src/game/engine/phase_manager.ts"
        : base + entry + ".ts";
    const script = `
      await import(${JSON.stringify(first)});
      const shared = await import("./src/game/mechanisms/roles/initial_identity/setup.ts");
      const thief = await import("./src/game/mechanisms/roles/thief/setup.ts");
      const shape = await import("./src/game/mechanisms/roles/shapeshifter/setup.ts");
      if (typeof shared.InitialIdentitySetupWindow !== "function" ||
          typeof thief.ThiefSetupWindow !== "function" ||
          typeof shape.ShapeshifterSetupWindow !== "function") throw new Error("missing_setup_constructor");
      console.log("identity_import_ok");
    `;
    const result = Bun.spawnSync([process.execPath, "-e", script], {
      cwd: path.resolve(import.meta.dir, "../.."),
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
    expect(result.exitCode).toBe(0);
    expect(new TextDecoder().decode(result.stdout).trim()).toBe("identity_import_ok");
  }, 15000);
}
